import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { inBusiness, requireMember, scoped } from "./lib/session";
import { belowPar, createLot, expiryOf, fifo, lotsOnHand, recordMovement } from "./lib/stock";
import { storageType } from "./schema";

const DAY = 86_400_000;

/** Stock on hand, first-expiring first, with where it is and whether it's going off. */
export const onHand = query({
  args: { ...scoped, locationId: v.optional(v.id("locations")) },
  handler: async (ctx, { sessionToken, businessId, locationId }) => {
    const { business } = await requireMember(ctx, sessionToken, businessId);
    const lots = (await lotsOnHand(ctx, businessId)).filter((l) => !locationId || l.locationId === locationId);
    const locations = new Map(
      (await ctx.db.query("locations").withIndex("by_business", (q) => q.eq("businessId", businessId)).collect()).map(
        (l) => [l._id, l.name],
      ),
    );
    const now = Date.now();
    return lots.map((l) => {
      const expiresAt = expiryOf(l);
      return {
        ...l,
        locationName: l.locationId ? locations.get(l.locationId) : undefined,
        expiresAt,
        expired: l.useBy !== undefined && l.useBy < now,
        expiringSoon: expiresAt !== undefined && expiresAt <= now + business.expiryWarningDays * DAY,
      };
    });
  },
});

export const lot = query({
  args: { ...scoped, id: v.id("stockLots") },
  handler: async (ctx, { sessionToken, businessId, id }) => {
    await requireMember(ctx, sessionToken, businessId);
    const lot = await ctx.db.get(id);
    if (!lot || lot.businessId !== businessId) return null;
    const movements = await ctx.db.query("stockMovements").withIndex("by_lot", (q) => q.eq("lotId", id)).order("desc").collect();
    const location = lot.locationId ? await ctx.db.get(lot.locationId) : null;
    return { lot, movements, locationName: location?.name };
  },
});

async function loadLot(ctx: Parameters<typeof requireMember>[0], businessId: Id<"businesses">, id: Id<"stockLots">) {
  return inBusiness(await ctx.db.get(id), businessId, "Stock");
}

/**
 * Stock going out: used in production, sold, dispatched to a customer, or wasted;
 * or a correction (`adjust`, signed). Held or expired stock can only be wasted.
 */
export const move = mutation({
  args: {
    ...scoped,
    lotId: v.id("stockLots"),
    type: v.union(v.literal("use"), v.literal("sell"), v.literal("dispatch"), v.literal("waste"), v.literal("adjust")),
    qty: v.number(),
    reason: v.optional(v.string()),
    customer: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, businessId, lotId, type, qty, ...args }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    const lot = await loadLot(ctx, businessId, lotId);
    const reason = args.reason?.trim() || undefined;
    const customer = args.customer?.trim() || undefined;
    if (type === "adjust") {
      if (qty === 0) throw new ConvexError("Enter how much to add or remove");
      if (!reason) throw new ConvexError("Give a reason for the adjustment");
    } else if (!(qty > 0)) throw new ConvexError("Quantity must be more than 0");
    if (type === "waste" && !reason) throw new ConvexError("Say why it was wasted");
    if (type === "dispatch" && !customer) throw new ConvexError("Who was it dispatched to?");
    if (["use", "sell", "dispatch"].includes(type)) {
      if (lot.status === "hold") throw new ConvexError(`${lot.productName} is on hold: ${lot.holdReason}`);
      if (lot.useBy !== undefined && lot.useBy < Date.now()) {
        throw new ConvexError(`${lot.productName} is past its use-by date. Waste it instead`);
      }
    }
    const change = type === "adjust" ? qty : -qty;
    const after = await recordMovement(ctx, user, lot, { type, qty: change, reason, customer });
    await logAudit(ctx, user, {
      businessId,
      action: type,
      entityType: "stockLot",
      entityId: lotId,
      summary: `${type[0].toUpperCase()}${type.slice(1)} ${Math.abs(change)} ${lot.unit} ${lot.productName}${
        customer ? ` to ${customer}` : ""
      }${reason ? ` (${reason})` : ""}. ${after.qtyOnHand} left`,
    });
  },
});

export const transfer = mutation({
  args: { ...scoped, lotId: v.id("stockLots"), locationId: v.id("locations") },
  handler: async (ctx, { sessionToken, businessId, lotId, locationId }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    const lot = await loadLot(ctx, businessId, lotId);
    const to = inBusiness(await ctx.db.get(locationId), businessId, "Location");
    await recordMovement(ctx, user, lot, { type: "transfer", qty: 0, toLocationId: locationId }, { locationId });
    await logAudit(ctx, user, {
      businessId,
      action: "transfer",
      entityType: "stockLot",
      entityId: lotId,
      summary: `Moved ${lot.productName} to ${to.name}`,
    });
  },
});

/** HOLD: quarantine stock (suspect, recalled, damaged) so nobody uses or sells it. */
export const hold = mutation({
  args: { ...scoped, lotId: v.id("stockLots"), reason: v.string() },
  handler: async (ctx, { sessionToken, businessId, lotId, reason }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    if (!reason.trim()) throw new ConvexError("Say why it is on hold");
    const lot = await loadLot(ctx, businessId, lotId);
    if (lot.status !== "available") throw new ConvexError(`${lot.productName} is not available to hold`);
    await recordMovement(ctx, user, lot, { type: "hold", qty: 0, reason }, { status: "hold", holdReason: reason });
    await logAudit(ctx, user, {
      businessId,
      action: "hold",
      entityType: "stockLot",
      entityId: lotId,
      summary: `Put ${lot.productName} on hold: ${reason}`,
    });
  },
});

export const release = mutation({
  args: { ...scoped, lotId: v.id("stockLots"), reason: v.string() },
  handler: async (ctx, { sessionToken, businessId, lotId, reason }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!reason.trim()) throw new ConvexError("Say why it is safe to release");
    const lot = await loadLot(ctx, businessId, lotId);
    if (lot.status !== "hold") throw new ConvexError(`${lot.productName} is not on hold`);
    await recordMovement(ctx, user, lot, { type: "release", qty: 0, reason }, { status: "available", holdReason: undefined });
    await logAudit(ctx, user, {
      businessId,
      action: "release",
      entityType: "stockLot",
      entityId: lotId,
      summary: `Released ${lot.productName} from hold: ${reason}`,
    });
  },
});

/** Opening stock, or anything that came in without a goods-inwards record. */
export const addLot = mutation({
  args: {
    ...scoped,
    productId: v.optional(v.id("products")),
    productName: v.string(),
    batchCode: v.optional(v.string()),
    useBy: v.optional(v.number()),
    bestBefore: v.optional(v.number()),
    locationId: v.optional(v.id("locations")),
    storageType,
    unit: v.string(),
    qty: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { sessionToken, businessId, qty, reason, ...lot }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!lot.productName.trim()) throw new ConvexError("Product name is required");
    if (!(qty > 0)) throw new ConvexError("Quantity must be more than 0");
    if (!reason.trim()) throw new ConvexError("Say where this stock came from");
    if (lot.productId) inBusiness(await ctx.db.get(lot.productId), businessId, "Product");
    if (lot.locationId) inBusiness(await ctx.db.get(lot.locationId), businessId, "Location");
    const id = await createLot(ctx, user, { ...lot, businessId, qtyReceived: qty, receivedAt: Date.now() }, reason);
    await logAudit(ctx, user, {
      businessId,
      action: "create",
      entityType: "stockLot",
      entityId: id,
      summary: `Added ${qty} ${lot.unit} ${lot.productName} to stock (${reason})`,
    });
    return id;
  },
});

/** Products below their par level, with how much is on hand and how much to order. */
export const lowStock = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId);
    return await belowPar(ctx, businessId);
  },
});

/** On-hand stock close to (or past) its use-by / best-before, soonest first. */
export const expiring = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    const { business } = await requireMember(ctx, sessionToken, businessId);
    const horizon = Date.now() + business.expiryWarningDays * DAY;
    return (await lotsOnHand(ctx, businessId))
      .map((l) => ({ ...l, expiresAt: expiryOf(l) }))
      .filter((l) => l.expiresAt !== undefined && l.expiresAt <= horizon);
  },
});

/**
 * Recall: puts every listed lot on HOLD in one step and raises one high-severity corrective
 * action listing them, ready for the "Recalling your food" steps.
 */
export const recall = mutation({
  args: { ...scoped, lotIds: v.array(v.id("stockLots")), reason: v.string() },
  handler: async (ctx, { sessionToken, businessId, lotIds, reason }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!reason.trim()) throw new ConvexError("Say why the stock is being recalled");
    const lots: Doc<"stockLots">[] = [];
    for (const id of lotIds) lots.push(await loadLot(ctx, businessId, id));
    const toHold = lots.filter((l) => l.status === "available").sort(fifo);
    if (toHold.length === 0) throw new ConvexError("None of that stock is available to hold");
    for (const lot of toHold) {
      await recordMovement(ctx, user, lot, { type: "hold", qty: 0, reason: `Recall: ${reason}` }, {
        status: "hold",
        holdReason: `Recall: ${reason}`,
      });
    }
    const caId = await ctx.db.insert("correctiveActions", {
      businessId,
      title: `Recall: ${reason}`,
      description: `On hold: ${toHold.map((l) => `${l.productName}${l.batchCode ? ` batch ${l.batchCode}` : ""} (${l.qtyOnHand} ${l.unit})`).join("; ")}. Follow the "Recalling your food" steps: notify your verifier, check where it went, record what you did.`,
      source: "stock",
      severity: "high",
      status: "open",
      raisedAt: Date.now(),
      raisedById: user._id,
      raisedByName: user.name,
    });
    await logAudit(ctx, user, {
      businessId,
      action: "recall",
      entityType: "correctiveAction",
      entityId: caId,
      summary: `Recall: ${toHold.length} lot(s) put on hold (${reason})`,
    });
    return { held: toHold.length, correctiveActionId: caId };
  },
});

/** Everyone stock has been dispatched to, most recent first, so a customer is only typed once. */
export const customers = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId);
    const recent = await ctx.db
      .query("stockMovements")
      .withIndex("by_business_at", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(2000);
    return [...new Set(recent.filter((m) => m.type === "dispatch").map((m) => m.customer!))];
  },
});
