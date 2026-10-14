import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { diff, logAudit } from "./lib/audit";
import { loadSettings } from "./lib/settings";
import { requireRole, requireUser } from "./lib/session";

export const get = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireUser(ctx, sessionToken);
    return await loadSettings(ctx);
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    businessName: v.optional(v.string()),
    jurisdiction: v.optional(v.union(v.literal("NZ"), v.literal("AU"))),
    registrationNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    chilledMaxC: v.optional(v.number()),
    frozenMaxC: v.optional(v.number()),
    hotMinC: v.optional(v.number()),
    expiryWarningDays: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, ...patch }) => {
    const user = await requireRole(ctx, sessionToken, ["admin"]);
    const current = await loadSettings(ctx);
    const row = await ctx.db.query("settings").first();
    const changes = diff(current, patch);
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("settings", { ...current, ...patch });
    await logAudit(ctx, user, {
      action: "update",
      entityType: "settings",
      summary: `Business settings updated (${Object.keys(changes).join(", ") || "no changes"})`,
      changes,
    });
  },
});
