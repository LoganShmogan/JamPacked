import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { requireUser } from "./lib/session";

export const list = query({
  args: { sessionToken: v.string(), status: v.optional(v.union(v.literal("open"), v.literal("closed"))) },
  handler: async (ctx, { sessionToken, status }) => {
    await requireUser(ctx, sessionToken);
    if (status) {
      return await ctx.db
        .query("correctiveActions")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(200);
    }
    return await ctx.db.query("correctiveActions").order("desc").take(200);
  },
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, { sessionToken, ...args }) => {
    const user = await requireUser(ctx, sessionToken);
    if (!args.title.trim()) throw new ConvexError("Title is required");
    const id = await ctx.db.insert("correctiveActions", {
      ...args,
      source: "manual",
      status: "open",
      raisedAt: Date.now(),
      raisedById: user._id,
      raisedByName: user.name,
    });
    await logAudit(ctx, user, {
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
  args: { sessionToken: v.string(), id: v.id("correctiveActions"), resolution: v.string() },
  handler: async (ctx, { sessionToken, id, resolution }) => {
    const user = await requireUser(ctx, sessionToken);
    if (!resolution.trim()) throw new ConvexError("Describe how it was resolved");
    const ca = await ctx.db.get(id);
    if (!ca) throw new ConvexError("Not found");
    if (ca.status === "closed") throw new ConvexError("Already closed");
    await ctx.db.patch(id, { status: "closed", resolution, closedAt: Date.now(), closedByName: user.name });
    await logAudit(ctx, user, {
      action: "close",
      entityType: "correctiveAction",
      entityId: id,
      summary: `Closed corrective action "${ca.title}": ${resolution}`,
    });
  },
});
