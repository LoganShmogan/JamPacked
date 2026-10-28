import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { inBusiness, requireMember, scoped } from "./lib/session";
import { lotsOnHand, recordMovement } from "./lib/stock";

/** A count is "large" when it is off by at least 1 and by 10% or more of what was expected. */
export const isLargeVariance = (expected: number, counted: number) => {
  const off = Math.abs(counted - expected);
  return off >= 1 && off >= expected * 0.1;
};

export const list = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId);
    const rows = await ctx.db
      .query("stocktakes")
      .withIndex("by_business_startedAt", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(50);
    return rows.map(({ lines, ...s }) => ({
      ...s,
      counted: lines.filter((l) => l.counted !== null).length,
      total: lines.length,
      variances: lines.filter((l) => l.counted !== null && l.counted !== l.expected).length,
    }));
  },
});

export const get = query({
  args: { ...scoped, id: v.id("stocktakes") },
  handler: async (ctx, { sessionToken, businessId, id }) => {
    await requireMember(ctx, sessionToken, businessId);
    const s = await ctx.db.get(id);
    return s?.businessId === businessId ? s : null;
  },
});

/** Snapshots what the system thinks is on hand (everywhere, or in one location) to count against. */
export const start = mutation({
  args: { ...scoped, locationId: v.optional(v.id("locations")) },
  handler: async (ctx, { sessionToken, businessId, locationId }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const location = locationId ? inBusiness(await ctx.db.get(locationId), businessId, "Location") : null;
    const lots = (await lotsOnHand(ctx, businessId)).filter((l) => !locationId || l.locationId === locationId);
    if (lots.length === 0) throw new ConvexError("There is no stock on hand to count");
    const title = `Stocktake${location ? `: ${location.name}` : ""}`;
    const id = await ctx.db.insert("stocktakes", {
      businessId,
      locationId,
      title,
      status: "in_progress",
      startedAt: Date.now(),
      startedByName: user.name,
      lines: lots.map((l) => ({
        lotId: l._id,
        productName: l.productName,
        batchCode: l.batchCode,
        unit: l.unit,
        expected: l.qtyOnHand,
        counted: null,
      })),
    });
    await logAudit(ctx, user, { businessId, action: "create", entityType: "stocktake", entityId: id, summary: `Started ${title} (${lots.length} lines)` });
    return id;
  },
});

export const count = mutation({
  args: { ...scoped, id: v.id("stocktakes"), lotId: v.id("stockLots"), counted: v.number() },
  handler: async (ctx, { sessionToken, businessId, id, lotId, counted }) => {
    await requireMember(ctx, sessionToken, businessId);
    const s = inBusiness(await ctx.db.get(id), businessId, "Stocktake");
    if (s.status === "completed") throw new ConvexError("Completed stocktakes are locked");
    if (counted < 0) throw new ConvexError("Counts can't be negative");
    if (!s.lines.some((l) => l.lotId === lotId)) throw new ConvexError("That stock is not in this stocktake");
    await ctx.db.patch(id, { lines: s.lines.map((l) => (l.lotId === lotId ? { ...l, counted } : l)) });
  },
});

/**
 * Locks the stocktake and corrects each lot to what was counted. Large variances raise a
 * corrective action so someone looks into where the stock went.
 */
export const complete = mutation({
  args: { ...scoped, id: v.id("stocktakes") },
  handler: async (ctx, { sessionToken, businessId, id }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const s = inBusiness(await ctx.db.get(id), businessId, "Stocktake");
    if (s.status === "completed") return;
    const uncounted = s.lines.filter((l) => l.counted === null).length;
    if (uncounted) throw new ConvexError(`Count every line first (${uncounted} remaining)`);
    let adjusted = 0;
    for (const line of s.lines) {
      const lot = (await ctx.db.get(line.lotId))!;
      // Correct against what is on hand now, in case stock moved while counting.
      const delta = line.counted! - lot.qtyOnHand;
      if (delta !== 0) {
        await recordMovement(ctx, user, lot, { type: "stocktake", qty: delta, reason: s.title });
        adjusted++;
      }
    }
    const large = s.lines.filter((l) => isLargeVariance(l.expected, l.counted!));
    if (large.length) {
      const caId = await ctx.db.insert("correctiveActions", {
        businessId,
        title: `Stocktake variance: ${large.length} line(s)`,
        description: large.map((l) => `${l.productName}: expected ${l.expected}, counted ${l.counted} ${l.unit}`).join("; "),
        source: "stock",
        sourceId: id,
        severity: "low",
        status: "open",
        raisedAt: Date.now(),
        raisedById: user._id,
        raisedByName: user.name,
      });
      await logAudit(ctx, user, { businessId, action: "create", entityType: "correctiveAction", entityId: caId, summary: `Auto-raised from ${s.title}: large variances` });
    }
    await ctx.db.patch(id, { status: "completed", completedAt: Date.now(), completedByName: user.name });
    await logAudit(ctx, user, {
      businessId,
      action: "complete",
      entityType: "stocktake",
      entityId: id,
      summary: `Completed ${s.title}: ${adjusted} lot(s) adjusted, ${large.length} large variance(s)`,
    });
  },
});
