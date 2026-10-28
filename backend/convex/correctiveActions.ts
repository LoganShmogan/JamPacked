import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { inBusiness, requireMember, scoped } from "./lib/session";

export const list = query({
  args: { ...scoped, status: v.optional(v.union(v.literal("open"), v.literal("closed"))) },
  handler: async (ctx, { sessionToken, businessId, status }) => {
    await requireMember(ctx, sessionToken, businessId);
    if (status) {
      return await ctx.db
        .query("correctiveActions")
        .withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", status))
        .order("desc")
        .take(200);
    }
    return await ctx.db
      .query("correctiveActions")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(200);
  },
});

export const create = mutation({
  args: {
    ...scoped,
    title: v.string(),
    description: v.optional(v.string()),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, { sessionToken, businessId, ...args }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    if (!args.title.trim()) throw new ConvexError("Title is required");
    const id = await ctx.db.insert("correctiveActions", {
      ...args,
      businessId,
      source: "manual",
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
      summary: `Raised corrective action: ${args.title}`,
      changes: args,
    });
    return id;
  },
});

export const close = mutation({
  args: { ...scoped, id: v.id("correctiveActions"), resolution: v.string() },
  handler: async (ctx, { sessionToken, businessId, id, resolution }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    if (!resolution.trim()) throw new ConvexError("Describe how it was resolved");
    const ca = inBusiness(await ctx.db.get(id), businessId, "Corrective action");
    if (ca.status === "closed") throw new ConvexError("Already closed");
    await ctx.db.patch(id, { status: "closed", resolution, closedAt: Date.now(), closedByName: user.name });
    await logAudit(ctx, user, {
      businessId,
      action: "close",
      entityType: "correctiveAction",
      entityId: id,
      summary: `Closed corrective action "${ca.title}": ${resolution}`,
    });
  },
});
