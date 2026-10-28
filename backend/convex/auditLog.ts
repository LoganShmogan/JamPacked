import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember, scoped } from "./lib/session";

/** Read-only. There is intentionally no mutation that edits or deletes audit log rows. */
export const list = query({
  args: {
    ...scoped,
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, businessId, entityType, entityId, userId, limit }) => {
    const take = Math.min(limit ?? 200, 1000);
    if (entityType && entityId) {
      await requireMember(ctx, sessionToken, businessId);
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) => q.eq("entityType", entityType).eq("entityId", entityId))
        .order("desc")
        .take(take);
      return rows.filter((r) => r.businessId === businessId);
    }
    await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (userId) {
      return await ctx.db
        .query("auditLog")
        .withIndex("by_business_user", (q) => q.eq("businessId", businessId).eq("userId", userId))
        .order("desc")
        .take(take);
    }
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_business_at", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(take);
    return entityType ? rows.filter((r) => r.entityType === entityType) : rows;
  },
});
