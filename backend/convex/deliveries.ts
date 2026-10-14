import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { isTempCompliant, loadSettings } from "./lib/settings";
import { requireRole, requireUser } from "./lib/session";
import { storageType } from "./schema";

const itemInput = v.object({
  productId: v.optional(v.id("products")),
  productName: v.string(),
  barcode: v.optional(v.string()),
  batchCode: v.optional(v.string()),
  quantity: v.number(),
  unit: v.string(),
  useBy: v.optional(v.number()),
  bestBefore: v.optional(v.number()),
  storageType,
  temperatureC: v.optional(v.number()),
  packagingOk: v.boolean(),
  labelOk: v.boolean(),
  allergens: v.array(v.string()),
  accepted: v.boolean(),
  rejectionReason: v.optional(v.string()),
});

async function raiseCA(
  ctx: MutationCtx,
  user: Doc<"users">,
  ca: { title: string; description?: string; severity: "low" | "medium" | "high"; sourceId: string },
) {
  const id = await ctx.db.insert("correctiveActions", {
    ...ca,
    source: "goods_inward",
    status: "open",
    raisedAt: Date.now(),
    raisedById: user._id,
    raisedByName: user.name,
  });
  await logAudit(ctx, user, {
    action: "create",
    entityType: "correctiveAction",
    entityId: id,
    summary: `Auto-raised corrective action: ${ca.title}`,
  });
}

/** Goods inwards: one delivery with its line items. Compliance is computed server-side. */
export const create = mutation({
  args: {
    sessionToken: v.string(),
    supplierId: v.id("suppliers"),
    receivedAt: v.optional(v.number()),
    invoiceNumber: v.optional(v.string()),
    vehicleClean: v.boolean(),
    vehicleTempC: v.optional(v.number()),
    notes: v.optional(v.string()),
    items: v.array(itemInput),
  },
  handler: async (ctx, { sessionToken, items, ...args }) => {
    const user = await requireUser(ctx, sessionToken);
    if (items.length === 0) throw new ConvexError("Add at least one item");
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier) throw new ConvexError("Supplier not found");
    const settings = await loadSettings(ctx);
    const receivedAt = args.receivedAt ?? Date.now();

    for (const item of items) {
      if (!item.accepted && !item.rejectionReason?.trim()) {
        throw new ConvexError(`Give a reason for rejecting ${item.productName}`);
      }
    }
    const acceptedCount = items.filter((i) => i.accepted).length;
    const status =
      acceptedCount === items.length ? "accepted" : acceptedCount === 0 ? "rejected" : "partial";

    const deliveryId = await ctx.db.insert("deliveries", {
      ...args,
      receivedAt,
      supplierName: supplier.name,
      supplierApproved: supplier.approved,
      status,
      receivedById: user._id,
      receivedByName: user.name,
      voided: false,
    });

    const issues: string[] = [];
    for (const item of items) {
      // Auto-create catalogue entries so future deliveries/audits can pre-fill from them.
      let productId: Id<"products"> | undefined = item.productId;
      if (!productId) {
        const existing = item.barcode
          ? await ctx.db.query("products").withIndex("by_barcode", (q) => q.eq("barcode", item.barcode)).first()
          : await ctx.db.query("products").withIndex("by_name", (q) => q.eq("name", item.productName)).first();
        productId =
          existing?._id ??
          (await ctx.db.insert("products", {
            name: item.productName,
            barcode: item.barcode,
            storageType: item.storageType,
            allergens: item.allergens,
            defaultSupplierId: supplier._id,
            active: true,
            createdAt: Date.now(),
          }));
      }
      const temperatureCompliant = isTempCompliant(settings, item.storageType, item.temperatureC);
      await ctx.db.insert("deliveryItems", {
        ...item,
        productId,
        deliveryId,
        receivedAt,
        supplierId: supplier._id,
        temperatureCompliant,
        voided: false,
      });

      const expired = item.useBy !== undefined && item.useBy < receivedAt;
      if (item.accepted && temperatureCompliant === false) {
        issues.push(`${item.productName} accepted at ${item.temperatureC ?? "unrecorded"}°C (${item.storageType})`);
        await raiseCA(ctx, user, {
          title: `Out-of-range temperature accepted: ${item.productName}`,
          description: `Received ${item.storageType} at ${item.temperatureC ?? "no reading"}°C from ${supplier.name}. Check product, discard if unsafe, and follow up with supplier.`,
          severity: "high",
          sourceId: deliveryId,
        });
      }
      if (item.accepted && expired) {
        await raiseCA(ctx, user, {
          title: `Expired product accepted: ${item.productName}`,
          description: `Use-by date had passed at time of receipt.`,
          severity: "high",
          sourceId: deliveryId,
        });
      }
      if (!item.accepted) {
        issues.push(`${item.productName} rejected: ${item.rejectionReason}`);
        await raiseCA(ctx, user, {
          title: `Rejected at delivery: ${item.productName}`,
          description: `${item.rejectionReason}. Notify ${supplier.name} and arrange credit/replacement.`,
          severity: "medium",
          sourceId: deliveryId,
        });
      }
    }
    if (!supplier.approved) {
      await raiseCA(ctx, user, {
        title: `Delivery from unapproved supplier: ${supplier.name}`,
        description: "Verify the supplier is registered/approved, or stop purchasing from them.",
        severity: "medium",
        sourceId: deliveryId,
      });
    }
    if (!args.vehicleClean) {
      await raiseCA(ctx, user, {
        title: `Delivery vehicle not clean: ${supplier.name}`,
        severity: "low",
        sourceId: deliveryId,
      });
    }

    await logAudit(ctx, user, {
      action: "create",
      entityType: "delivery",
      entityId: deliveryId,
      summary: `Goods received from ${supplier.name}: ${items.length} item(s), ${status}${issues.length ? `. ${issues.join("; ")}` : ""}`,
      changes: { ...args, items },
    });
    return deliveryId;
  },
});

/** Records are never deleted. A manager voids them with a reason, which stays in the trail. */
export const voidDelivery = mutation({
  args: { sessionToken: v.string(), id: v.id("deliveries"), reason: v.string() },
  handler: async (ctx, { sessionToken, id, reason }) => {
    const user = await requireRole(ctx, sessionToken, ["admin", "manager"]);
    if (!reason.trim()) throw new ConvexError("A reason is required to void a record");
    const delivery = await ctx.db.get(id);
    if (!delivery) throw new ConvexError("Delivery not found");
    if (delivery.voided) return;
    await ctx.db.patch(id, { voided: true, voidReason: reason });
    const items = await ctx.db.query("deliveryItems").withIndex("by_delivery", (q) => q.eq("deliveryId", id)).collect();
    for (const item of items) await ctx.db.patch(item._id, { voided: true });
    await logAudit(ctx, user, {
      action: "void",
      entityType: "delivery",
      entityId: id,
      summary: `Voided delivery from ${delivery.supplierName}: ${reason}`,
    });
  },
});

export const updateNotes = mutation({
  args: { sessionToken: v.string(), id: v.id("deliveries"), notes: v.string() },
  handler: async (ctx, { sessionToken, id, notes }) => {
    const user = await requireUser(ctx, sessionToken);
    const delivery = await ctx.db.get(id);
    if (!delivery) throw new ConvexError("Delivery not found");
    await ctx.db.patch(id, { notes });
    await logAudit(ctx, user, {
      action: "update",
      entityType: "delivery",
      entityId: id,
      summary: `Edited notes on delivery from ${delivery.supplierName}`,
      changes: { notes: { from: delivery.notes ?? null, to: notes } },
    });
  },
});

export const list = query({
  args: { sessionToken: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, limit }) => {
    await requireUser(ctx, sessionToken);
    const deliveries = await ctx.db.query("deliveries").withIndex("by_receivedAt").order("desc").take(limit ?? 100);
    return await Promise.all(
      deliveries.map(async (d) => {
        const items = await ctx.db.query("deliveryItems").withIndex("by_delivery", (q) => q.eq("deliveryId", d._id)).collect();
        return {
          ...d,
          itemCount: items.length,
          tempIssues: items.filter((i) => i.accepted && i.temperatureCompliant === false).length,
        };
      }),
    );
  },
});

export const get = query({
  args: { sessionToken: v.string(), id: v.id("deliveries") },
  handler: async (ctx, { sessionToken, id }) => {
    await requireUser(ctx, sessionToken);
    const delivery = await ctx.db.get(id);
    if (!delivery) return null;
    const items = await ctx.db.query("deliveryItems").withIndex("by_delivery", (q) => q.eq("deliveryId", id)).collect();
    const history = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) => q.eq("entityType", "delivery").eq("entityId", id))
      .order("desc")
      .collect();
    return { delivery, items, history };
  },
});

/** Pre-fill helper: products this supplier has delivered before, most recent first. */
export const suggestionsForSupplier = query({
  args: { sessionToken: v.string(), supplierId: v.id("suppliers") },
  handler: async (ctx, { sessionToken, supplierId }) => {
    await requireUser(ctx, sessionToken);
    const deliveries = await ctx.db
      .query("deliveries")
      .withIndex("by_supplier", (q) => q.eq("supplierId", supplierId))
      .order("desc")
      .take(10);
    const seen = new Map<string, Doc<"deliveryItems">>();
    for (const d of deliveries) {
      const items = await ctx.db.query("deliveryItems").withIndex("by_delivery", (q) => q.eq("deliveryId", d._id)).collect();
      for (const i of items) if (!seen.has(i.productName)) seen.set(i.productName, i);
    }
    return [...seen.values()].map((i) => ({
      productId: i.productId,
      productName: i.productName,
      barcode: i.barcode,
      quantity: i.quantity,
      unit: i.unit,
      storageType: i.storageType,
      allergens: i.allergens,
    }));
  },
});

/** Stock received and accepted that is close to (or past) its use-by / best-before. */
export const expiring = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireUser(ctx, sessionToken);
    const settings = await loadSettings(ctx);
    const now = Date.now();
    const horizon = now + settings.expiryWarningDays * 86_400_000;
    const recent = await ctx.db
      .query("deliveryItems")
      .withIndex("by_receivedAt", (q) => q.gt("receivedAt", now - 90 * 86_400_000))
      .collect();
    return recent
      .filter((i) => i.accepted && !i.voided)
      .map((i) => ({ ...i, expiresAt: i.useBy ?? i.bestBefore }))
      .filter((i) => i.expiresAt !== undefined && i.expiresAt <= horizon)
      .sort((a, b) => a.expiresAt! - b.expiresAt!);
  },
});

/** Traceability / recall: find every receipt of a batch code or product. */
export const trace = query({
  args: { sessionToken: v.string(), search: v.string() },
  handler: async (ctx, { sessionToken, search }) => {
    await requireUser(ctx, sessionToken);
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const byBatch = await ctx.db.query("deliveryItems").withIndex("by_batch", (q) => q.eq("batchCode", search.trim())).collect();
    const recent = await ctx.db.query("deliveryItems").withIndex("by_receivedAt").order("desc").take(2000);
    const matches = new Map(byBatch.map((i) => [i._id, i]));
    for (const i of recent) {
      if (
        i.productName.toLowerCase().includes(term) ||
        i.batchCode?.toLowerCase().includes(term) ||
        i.barcode === term
      ) matches.set(i._id, i);
    }
    const out = [];
    for (const i of matches.values()) {
      const d = await ctx.db.get(i.deliveryId);
      out.push({ ...i, supplierName: d?.supplierName ?? "", receivedByName: d?.receivedByName ?? "" });
    }
    return out.sort((a, b) => b.receivedAt - a.receivedAt);
  },
});
