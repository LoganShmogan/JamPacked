import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { diff, logAudit } from "./lib/audit";
import { inBusiness, requireMember, scoped } from "./lib/session";

const fields = {
  name: v.string(),
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  address: v.optional(v.string()),
  registrationNumber: v.optional(v.string()),
  approved: v.boolean(),
  approvalNotes: v.optional(v.string()),
};

export const list = query({
  args: { ...scoped, includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, { sessionToken, businessId, includeInactive }) => {
    await requireMember(ctx, sessionToken, businessId);
    const all = await ctx.db.query("suppliers").withIndex("by_business_name", (q) => q.eq("businessId", businessId)).collect();
    return includeInactive ? all : all.filter((s) => s.active);
  },
});

export const get = query({
  args: { ...scoped, id: v.id("suppliers") },
  handler: async (ctx, { sessionToken, businessId, id }) => {
    await requireMember(ctx, sessionToken, businessId);
    const supplier = await ctx.db.get(id);
    if (!supplier || supplier.businessId !== businessId) return null;
    const recent = await ctx.db
      .query("deliveries")
      .withIndex("by_supplier", (q) => q.eq("supplierId", id))
      .order("desc")
      .take(20);
    return { supplier, recentDeliveries: recent.filter((d) => !d.voided) };
  },
});

export const create = mutation({
  args: { ...scoped, ...fields },
  handler: async (ctx, { sessionToken, businessId, ...data }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!data.name.trim()) throw new ConvexError("Supplier name is required");
    const id = await ctx.db.insert("suppliers", { ...data, businessId, active: true, createdAt: Date.now() });
    await logAudit(ctx, user, {
      businessId,
      action: "create",
      entityType: "supplier",
      entityId: id,
      summary: `Added supplier ${data.name}${data.approved ? " (approved)" : " (not approved)"}`,
      changes: data,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    ...scoped,
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    approved: v.optional(v.boolean()),
    approvalNotes: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionToken, businessId, id, ...patch }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const before = inBusiness(await ctx.db.get(id), businessId, "Supplier");
    const changes = diff(before, patch);
    await ctx.db.patch(id, patch);
    await logAudit(ctx, user, {
      businessId,
      action: "update",
      entityType: "supplier",
      entityId: id,
      summary: `Updated supplier ${before.name} (${Object.keys(changes).join(", ") || "no changes"})`,
      changes,
    });
  },
});
