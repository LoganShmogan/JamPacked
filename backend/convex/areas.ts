import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { diff, logAudit } from "./lib/audit";
import { inBusiness, requireMember, scoped } from "./lib/session";
import { areaKind } from "./schema";

/** Where a farm grows or raises what it harvests: paddocks, blocks, glasshouses, hives, herds. */
export const list = query({
  args: { ...scoped, includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, { sessionToken, businessId, includeInactive }) => {
    await requireMember(ctx, sessionToken, businessId);
    const all = await ctx.db.query("areas").withIndex("by_business", (q) => q.eq("businessId", businessId)).collect();
    return all.filter((a) => includeInactive || a.active).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: { ...scoped, name: v.string(), kind: areaKind, notes: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, businessId, name, kind, notes }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!name.trim()) throw new ConvexError("Name the area");
    const id = await ctx.db.insert("areas", {
      businessId,
      name: name.trim(),
      kind,
      notes: notes?.trim() || undefined,
      active: true,
      createdAt: Date.now(),
    });
    await logAudit(ctx, user, { businessId, action: "create", entityType: "area", entityId: id, summary: `Added growing area ${name.trim()} (${kind})` });
    return id;
  },
});

/** Areas are archived (`active: false`), never deleted, so past harvests still name them. */
export const update = mutation({
  args: {
    ...scoped,
    id: v.id("areas"),
    name: v.optional(v.string()),
    kind: v.optional(areaKind),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionToken, businessId, id, ...patch }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const before = inBusiness(await ctx.db.get(id), businessId, "Area");
    if (patch.name !== undefined && !patch.name.trim()) throw new ConvexError("Name the area");
    const changes = diff(before, patch);
    await ctx.db.patch(id, patch);
    await logAudit(ctx, user, {
      businessId,
      action: "update",
      entityType: "area",
      entityId: id,
      summary: `Updated growing area ${before.name} (${Object.keys(changes).join(", ") || "no changes"})`,
      changes,
    });
  },
});
