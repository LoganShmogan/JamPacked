import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { diff, logAudit } from "./lib/audit";
import { inBusiness, requireMember, scoped } from "./lib/session";
import { locationKind } from "./schema";

/** Where stock is kept: chillers, freezers, dry store, display. */
export const list = query({
  args: { ...scoped, includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, { sessionToken, businessId, includeInactive }) => {
    await requireMember(ctx, sessionToken, businessId);
    const all = await ctx.db.query("locations").withIndex("by_business", (q) => q.eq("businessId", businessId)).collect();
    return all.filter((l) => includeInactive || l.active).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: { ...scoped, name: v.string(), kind: locationKind },
  handler: async (ctx, { sessionToken, businessId, name, kind }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!name.trim()) throw new ConvexError("Location name is required");
    const id = await ctx.db.insert("locations", { businessId, name: name.trim(), kind, active: true, createdAt: Date.now() });
    await logAudit(ctx, user, { businessId, action: "create", entityType: "location", entityId: id, summary: `Added location ${name.trim()} (${kind})` });
    return id;
  },
});

export const update = mutation({
  args: {
    ...scoped,
    id: v.id("locations"),
    name: v.optional(v.string()),
    kind: v.optional(locationKind),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionToken, businessId, id, ...patch }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const before = inBusiness(await ctx.db.get(id), businessId, "Location");
    if (patch.name !== undefined && !patch.name.trim()) throw new ConvexError("Location name is required");
    const changes = diff(before, patch);
    await ctx.db.patch(id, patch);
    await logAudit(ctx, user, {
      businessId,
      action: "update",
      entityType: "location",
      entityId: id,
      summary: `Updated location ${before.name} (${Object.keys(changes).join(", ") || "no changes"})`,
      changes,
    });
  },
});
