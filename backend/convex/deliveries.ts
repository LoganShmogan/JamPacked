import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { isTempCompliant } from "./lib/settings";
import { inBusiness, requireMember, scoped } from "./lib/session";
import { loadModule } from "./lib/module";
import { createLot, recordMovement } from "./lib/stock";
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
  locationId: v.optional(v.id("locations")), // where accepted stock is put away
});

async function raiseCA(
  ctx: MutationCtx,
  user: Doc<"users">,
  businessId: Id<"businesses">,
  ca: { title: string; description?: string; severity: "low" | "medium" | "high"; sourceId: string },
) {
  const id = await ctx.db.insert("correctiveActions", {
    ...ca,
    businessId,
    source: "goods_inward",
    status: "open",
    raisedAt: Date.now(),
    raisedById: user._id,
    raisedByName: user.name,
  });
  await logAudit(ctx, user, {
    businessId,
    action: "create",
    entityType: "correctiveAction",
    entityId: id,
    summary: `Auto-raised corrective action: ${ca.title}`,
  });
}

/** Goods inwards: one delivery with its line items. Compliance is computed server-side. */
export const create = mutation({
  args: {
    ...scoped,
    supplierId: v.id("suppliers"),
    receivedAt: v.optional(v.number()),
    invoiceNumber: v.optional(v.string()),
    vehicleClean: v.boolean(),
    vehicleTempC: v.optional(v.number()),
    notes: v.optional(v.string()),
    // Answers to the programme's receiving prompts: true / false / null or absent (not applicable)
    programmeAnswers: v.optional(
      v.array(v.object({ key: v.string(), value: v.optional(v.union(v.boolean(), v.null())) })),
    ),
    items: v.array(itemInput),
  },
  handler: async (ctx, { sessionToken, businessId, items, programmeAnswers, ...args }) => {
    const { user, business: settings } = await requireMember(ctx, sessionToken, businessId);
    const prompts = (await loadModule(ctx, settings)).receivingPrompts;
    const answers = (programmeAnswers ?? []).map((a) => {
      const p = prompts.find((x) => x.key === a.key);
      if (!p) throw new ConvexError(`Unknown receiving check: ${a.key}`);
      return { key: a.key, value: a.value ?? null, text: p.text };
    });
    if (items.length === 0) throw new ConvexError("Add at least one item");
    const supplier = inBusiness(await ctx.db.get(args.supplierId), businessId, "Supplier");
    const receivedAt = args.receivedAt ?? Date.now();

    for (const item of items) {
      if (!item.accepted && !item.rejectionReason?.trim()) {
        throw new ConvexError(`Give a reason for rejecting ${item.productName}`);
      }
      if (item.locationId) inBusiness(await ctx.db.get(item.locationId), businessId, "Location");
    }
    const acceptedCount = items.filter((i) => i.accepted).length;
    const status =
      acceptedCount === items.length ? "accepted" : acceptedCount === 0 ? "rejected" : "partial";

    const deliveryId = await ctx.db.insert("deliveries", {
      ...args,
      ...(answers.length ? { programmeAnswers: answers } : {}),
      businessId,
      receivedAt,
      supplierName: supplier.name,
      supplierApproved: supplier.approved,
      status,
      receivedById: user._id,
      receivedByName: user.name,
      voided: false,
    });

    const issues: string[] = [];
    for (const { locationId, ...item } of items) {
      // Auto-create catalogue entries so future deliveries/audits can pre-fill from them.
      let productId: Id<"products"> | undefined = item.productId;
      if (!productId) {
        const existing = item.barcode
          ? await ctx.db.query("products").withIndex("by_business_barcode", (q) => q.eq("businessId", businessId).eq("barcode", item.barcode)).first()
          : await ctx.db.query("products").withIndex("by_business_name", (q) => q.eq("businessId", businessId).eq("name", item.productName)).first();
        productId =
          existing?._id ??
          (await ctx.db.insert("products", {
            businessId,
            name: item.productName,
            barcode: item.barcode,
            storageType: item.storageType,
            allergens: item.allergens,
            defaultSupplierId: supplier._id,
            unit: item.unit,
            active: true,
            createdAt: Date.now(),
          }));
      }
      // Remember the unit so recipes and stock entries can fill it in next time.
      const product = inBusiness(await ctx.db.get(productId), businessId, "Product");
      if (!product.unit) await ctx.db.patch(productId, { unit: item.unit });
      const temperatureCompliant = isTempCompliant(settings, item.storageType, item.temperatureC);
      const deliveryItemId = await ctx.db.insert("deliveryItems", {
        ...item,
        businessId,
        productId,
        deliveryId,
        receivedAt,
        supplierId: supplier._id,
        temperatureCompliant,
        voided: false,
      });
      // Accepted goods go into stock as a lot that can be traced, rotated, used and recalled.
      if (item.accepted) {
        await createLot(ctx, user, {
          businessId,
          productId,
          productName: item.productName,
          barcode: item.barcode,
          deliveryId,
          deliveryItemId,
          supplierName: supplier.name,
          batchCode: item.batchCode,
          useBy: item.useBy,
          bestBefore: item.bestBefore,
          locationId,
          storageType: item.storageType,
          unit: item.unit,
          qtyReceived: item.quantity,
          receivedAt,
        });
      }

      const expired = item.useBy !== undefined && item.useBy < receivedAt;
      if (item.accepted && temperatureCompliant === false) {
        issues.push(`${item.productName} accepted at ${item.temperatureC ?? "unrecorded"}°C (${item.storageType})`);
        await raiseCA(ctx, user, businessId, {
          title: `Out-of-range temperature accepted: ${item.productName}`,
          description: `Received ${item.storageType} at ${item.temperatureC ?? "no reading"}°C from ${supplier.name}. Check product, discard if unsafe, and follow up with supplier.`,
          severity: "high",
          sourceId: deliveryId,
        });
      }
      if (item.accepted && expired) {
        await raiseCA(ctx, user, businessId, {
          title: `Expired product accepted: ${item.productName}`,
          description: `Use-by date had passed at time of receipt.`,
          severity: "high",
          sourceId: deliveryId,
        });
      }
      if (!item.accepted) {
        issues.push(`${item.productName} rejected: ${item.rejectionReason}`);
        await raiseCA(ctx, user, businessId, {
          title: `Rejected at delivery: ${item.productName}`,
          description: `${item.rejectionReason}. Notify ${supplier.name} and arrange credit/replacement.`,
          severity: "medium",
          sourceId: deliveryId,
        });
      }
    }
    if (!supplier.approved) {
      await raiseCA(ctx, user, businessId, {
        title: `Delivery from unapproved supplier: ${supplier.name}`,
        description: "Verify the supplier is registered/approved, or stop purchasing from them.",
        severity: "medium",
        sourceId: deliveryId,
      });
    }
    for (const a of answers.filter((x) => x.value === false)) {
      await raiseCA(ctx, user, businessId, {
        title: `Receiving check failed: ${a.text}`,
        description: `Delivery from ${supplier.name}.`,
        severity: "medium",
        sourceId: deliveryId,
      });
    }
    if (!args.vehicleClean) {
      await raiseCA(ctx, user, businessId, {
        title: `Delivery vehicle not clean: ${supplier.name}`,
        severity: "low",
        sourceId: deliveryId,
      });
    }

    await logAudit(ctx, user, {
      businessId,
      action: "create",
      entityType: "delivery",
      entityId: deliveryId,
      summary: `Goods received from ${supplier.name}: ${items.length} item(s), ${status}${issues.length ? `. ${issues.join("; ")}` : ""}`,
      changes: { ...args, items, programmeAnswers: answers },
    });
    return deliveryId;
  },
});

/** Records are never deleted. A manager voids them with a reason, which stays in the trail. */
export const voidDelivery = mutation({
  args: { ...scoped, id: v.id("deliveries"), reason: v.string() },
  handler: async (ctx, { sessionToken, businessId, id, reason }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!reason.trim()) throw new ConvexError("A reason is required to void a record");
    const delivery = inBusiness(await ctx.db.get(id), businessId, "Delivery");
    if (delivery.voided) return;
    await ctx.db.patch(id, { voided: true, voidReason: reason });
    const items = await ctx.db.query("deliveryItems").withIndex("by_delivery", (q) => q.eq("deliveryId", id)).collect();
    for (const item of items) {
      await ctx.db.patch(item._id, { voided: true });
      // Take whatever is left of its stock out, with the reason in the lot's history.
      const lot = await ctx.db.query("stockLots").withIndex("by_deliveryItem", (q) => q.eq("deliveryItemId", item._id)).unique();
      if (lot && lot.status !== "depleted") {
        await recordMovement(ctx, user, lot, { type: "void", qty: -lot.qtyOnHand, reason: `Delivery voided: ${reason}` }, { status: "depleted" });
      }
    }
    await logAudit(ctx, user, {
      businessId,
      action: "void",
      entityType: "delivery",
      entityId: id,
      summary: `Voided delivery from ${delivery.supplierName}: ${reason}`,
    });
  },
});

export const updateNotes = mutation({
  args: { ...scoped, id: v.id("deliveries"), notes: v.string() },
  handler: async (ctx, { sessionToken, businessId, id, notes }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    const delivery = inBusiness(await ctx.db.get(id), businessId, "Delivery");
    await ctx.db.patch(id, { notes });
    await logAudit(ctx, user, {
      businessId,
      action: "update",
      entityType: "delivery",
      entityId: id,
      summary: `Edited notes on delivery from ${delivery.supplierName}`,
      changes: { notes: { from: delivery.notes ?? null, to: notes } },
    });
  },
});

export const list = query({
  args: { ...scoped, limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, businessId, limit }) => {
    await requireMember(ctx, sessionToken, businessId);
    const deliveries = await ctx.db
      .query("deliveries")
      .withIndex("by_business_receivedAt", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(limit ?? 100);
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
  args: { ...scoped, id: v.id("deliveries") },
  handler: async (ctx, { sessionToken, businessId, id }) => {
    await requireMember(ctx, sessionToken, businessId);
    const delivery = await ctx.db.get(id);
    if (!delivery || delivery.businessId !== businessId) return null;
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
  args: { ...scoped, supplierId: v.id("suppliers") },
  handler: async (ctx, { sessionToken, businessId, supplierId }) => {
    await requireMember(ctx, sessionToken, businessId);
    inBusiness(await ctx.db.get(supplierId), businessId, "Supplier");
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

/** Traceability / recall: find every receipt of a batch code or product. */
export const trace = query({
  args: { ...scoped, search: v.string() },
  handler: async (ctx, { sessionToken, businessId, search }) => {
    await requireMember(ctx, sessionToken, businessId);
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const byBatch = await ctx.db
      .query("deliveryItems")
      .withIndex("by_business_batch", (q) => q.eq("businessId", businessId).eq("batchCode", search.trim()))
      .collect();
    const recent = await ctx.db
      .query("deliveryItems")
      .withIndex("by_business_receivedAt", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(2000);
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
      // One step forward: what happened to the stock, and who it was dispatched to.
      const lot = await ctx.db.query("stockLots").withIndex("by_deliveryItem", (q) => q.eq("deliveryItemId", i._id)).unique();
      const movements = lot ? await ctx.db.query("stockMovements").withIndex("by_lot", (q) => q.eq("lotId", lot._id)).collect() : [];
      out.push({
        ...i,
        supplierName: d?.supplierName ?? "",
        receivedByName: d?.receivedByName ?? "",
        lot: lot && {
          _id: lot._id,
          status: lot.status,
          qtyOnHand: lot.qtyOnHand,
          dispatched: movements.filter((m) => m.type === "dispatch").map((m) => ({ customer: m.customer!, qty: -m.qty, at: m.at })),
          // ...and what was made from it (production.trace follows those batches on).
          usedIn: movements
            .filter((m) => m.productionRunId)
            .map((m) => ({ productionRunId: m.productionRunId!, reason: m.reason!, qty: -m.qty, at: m.at })),
        },
      });
    }
    return out.sort((a, b) => b.receivedAt - a.receivedAt);
  },
});
