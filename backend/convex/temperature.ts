import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { loadSettings, unitCompliant } from "./lib/settings";
import { requireUser } from "./lib/session";

const unitType = v.union(
  v.literal("chiller"),
  v.literal("freezer"),
  v.literal("hot_hold"),
  v.literal("cooking"),
  v.literal("cooling"),
);

export const record = mutation({
  args: {
    sessionToken: v.string(),
    unitName: v.string(),
    unitType,
    temperatureC: v.number(),
    correctiveAction: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, ...args }) => {
    const user = await requireUser(ctx, sessionToken);
    const settings = await loadSettings(ctx);
    const compliant = unitCompliant(settings, args.unitType, args.temperatureC);
    if (!compliant && !args.correctiveAction?.trim()) {
      throw new ConvexError("Out of range. Record what you did about it (corrective action)");
    }
    const id = await ctx.db.insert("temperatureLogs", {
      ...args,
      compliant,
      checkedAt: Date.now(),
      checkedById: user._id,
      checkedByName: user.name,
    });
    if (!compliant) {
      const caId = await ctx.db.insert("correctiveActions", {
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
        action: "create",
        entityType: "correctiveAction",
        entityId: caId,
        summary: `Auto-raised corrective action for ${args.unitName}`,
      });
    }
    await logAudit(ctx, user, {
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
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireUser(ctx, sessionToken);
    return await ctx.db.query("temperatureLogs").withIndex("by_checkedAt").order("desc").take(200);
  },
});

/** Distinct units used before, so staff can pick rather than type. */
export const units = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireUser(ctx, sessionToken);
    const logs = await ctx.db.query("temperatureLogs").withIndex("by_checkedAt").order("desc").take(500);
    const map = new Map<string, string>();
    for (const l of logs) if (!map.has(l.unitName)) map.set(l.unitName, l.unitType);
    return [...map].map(([unitName, unitType]) => ({ unitName, unitType }));
  },
});
