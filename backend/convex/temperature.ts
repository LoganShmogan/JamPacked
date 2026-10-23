import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { unitCompliant } from "./lib/settings";
import { requireMember, scoped } from "./lib/session";

const unitType = v.union(
  v.literal("chiller"),
  v.literal("freezer"),
  v.literal("hot_hold"),
  v.literal("cooking"),
  v.literal("cooling"),
);

export const record = mutation({
  args: {
    ...scoped,
    unitName: v.string(),
    unitType,
    temperatureC: v.number(),
    correctiveAction: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, businessId, ...args }) => {
    const { user, business } = await requireMember(ctx, sessionToken, businessId);
    const compliant = unitCompliant(business, args.unitType, args.temperatureC);
    if (!compliant && !args.correctiveAction?.trim()) {
      throw new ConvexError("Out of range. Record what you did about it (corrective action)");
    }
    const id = await ctx.db.insert("temperatureLogs", {
      ...args,
      businessId,
      compliant,
      checkedAt: Date.now(),
      checkedById: user._id,
      checkedByName: user.name,
    });
    if (!compliant) {
      const caId = await ctx.db.insert("correctiveActions", {
        businessId,
        title: `${args.unitName} out of range (${args.temperatureC}°C)`,
        description: args.correctiveAction,
        source: "temperature",
        sourceId: id,
        severity: "high",
        status: "open",
        raisedAt: Date.now(),
        raisedById: user._id,
        raisedByName: user.name,
      });
      await logAudit(ctx, user, {
        businessId,
        action: "create",
        entityType: "correctiveAction",
        entityId: caId,
        summary: `Auto-raised corrective action for ${args.unitName}`,
      });
    }
    await logAudit(ctx, user, {
      businessId,
      action: "create",
      entityType: "temperatureLog",
      entityId: id,
      summary: `${args.unitName}: ${args.temperatureC}°C ${compliant ? "OK" : "OUT OF RANGE"}`,
      changes: args,
    });
    return { id, compliant };
  },
});

export const list = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId);
    return await ctx.db
      .query("temperatureLogs")
      .withIndex("by_business_checkedAt", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(200);
  },
});

/** Distinct units used before, so staff can pick rather than type. */
export const units = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId);
    const logs = await ctx.db
      .query("temperatureLogs")
      .withIndex("by_business_checkedAt", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(500);
    const map = new Map<string, string>();
    for (const l of logs) if (!map.has(l.unitName)) map.set(l.unitName, l.unitType);
    return [...map].map(([unitName, unitType]) => ({ unitName, unitType }));
  },
});
