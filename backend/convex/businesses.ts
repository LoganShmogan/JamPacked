import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { createBusiness, newBusinessFields } from "./lib/business";
import { PROGRAMMES } from "./lib/programmes";
import { REGIONS } from "./lib/regions";
import { membership, requireMember, requireUser } from "./lib/session";
import { role } from "./schema";

/** The programmes to choose from at sign-up. Public: shown before an account exists. */
export const programmes = query({
  args: {},
  handler: () => PROGRAMMES,
});

/** Regions to choose from for each country. Public: shown at sign-up. */
export const regions = query({
  args: {},
  handler: () => REGIONS,
});

/** The business picker: every business this user belongs to, with what needs attention. */
export const mine = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireUser(ctx, sessionToken);
    const memberships = (
      await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()
    ).filter((m) => m.active);
    const out = [];
    for (const m of memberships) {
      const b = (await ctx.db.get(m.businessId))!;
      const openCAs = await ctx.db
        .query("correctiveActions")
        .withIndex("by_business_status", (q) => q.eq("businessId", b._id).eq("status", "open"))
        .collect();
      out.push({
        _id: b._id,
        name: b.name,
        programme: b.programme,
        sectors: b.sectors,
        archived: b.archived,
        isOwner: b.ownerId === user._id,
        role: m.role,
        openCorrectiveActions: openCAs.length,
      });
    }
    return out.sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
  },
});

/** "Add business": the creator becomes its admin. */
export const create = mutation({
  args: { sessionToken: v.string(), ...newBusinessFields },
  handler: async (ctx, { sessionToken, ...input }) => {
    const user = await requireUser(ctx, sessionToken);
    return await createBusiness(ctx, user, input);
  },
});

/** Businesses are archived (hidden from the picker), never deleted: their records are kept. */
export const setArchived = mutation({
  args: { sessionToken: v.string(), businessId: v.id("businesses"), archived: v.boolean() },
  handler: async (ctx, { sessionToken, businessId, archived }) => {
    const { user, business } = await requireMember(ctx, sessionToken, businessId, ["admin"]);
    await ctx.db.patch(businessId, { archived });
    await logAudit(ctx, user, {
      businessId,
      action: archived ? "archive" : "unarchive",
      entityType: "business",
      entityId: businessId,
      summary: `${archived ? "Archived" : "Restored"} ${business.name}`,
    });
  },
});

export const members = query({
  args: { sessionToken: v.string(), businessId: v.id("businesses") },
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const ms = await ctx.db.query("memberships").withIndex("by_business", (q) => q.eq("businessId", businessId)).collect();
    const people = [];
    for (const m of ms) {
      const u = (await ctx.db.get(m.userId))!;
      people.push({ _id: u._id, name: u.name, email: u.email, role: m.role, active: m.active, createdAt: m.createdAt });
    }
    const invites = (
      await ctx.db.query("invites").withIndex("by_business", (q) => q.eq("businessId", businessId)).collect()
    ).filter((i) => i.acceptedAt === undefined);
    return { members: people, invites };
  },
});

/** Adds someone by email: straight away if they have an account, otherwise when they sign up. */
export const invite = mutation({
  args: { sessionToken: v.string(), businessId: v.id("businesses"), email: v.string(), role },
  handler: async (ctx, { sessionToken, businessId, role, ...args }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin"]);
    const email = args.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ConvexError("Enter a valid email address");
    const existing = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (existing) {
      const m = await membership(ctx, existing._id, businessId);
      if (m?.active) throw new ConvexError(`${existing.name} is already a member`);
      if (m) await ctx.db.patch(m._id, { role, active: true });
      else await ctx.db.insert("memberships", { userId: existing._id, businessId, role, active: true, createdAt: Date.now() });
    } else {
      const pending = await ctx.db.query("invites").withIndex("by_email", (q) => q.eq("email", email)).collect();
      if (pending.some((i) => i.businessId === businessId && i.acceptedAt === undefined)) {
        throw new ConvexError(`${email} has already been invited`);
      }
      await ctx.db.insert("invites", { businessId, email, role, invitedByName: user.name, createdAt: Date.now() });
    }
    await logAudit(ctx, user, {
      businessId,
      action: "invite",
      entityType: "membership",
      entityId: existing?._id,
      summary: existing ? `Added ${existing.name} as ${role}` : `Invited ${email} as ${role}`,
    });
    return { added: existing !== null };
  },
});

export const updateMember = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
    userId: v.id("users"),
    role: v.optional(role),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionToken, businessId, userId, ...patch }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin"]);
    const m = await membership(ctx, userId, businessId);
    if (!m) throw new ConvexError("User not found");
    if (userId === user._id && (patch.role !== undefined || patch.active === false)) {
      throw new ConvexError("You can't change your own role or deactivate yourself");
    }
    const target = (await ctx.db.get(userId))!;
    await ctx.db.patch(m._id, patch);
    await logAudit(ctx, user, {
      businessId,
      action: "update",
      entityType: "membership",
      entityId: userId,
      summary: `Updated ${target.name}: ${Object.entries(patch)
        .filter(([, val]) => val !== undefined)
        .map(([k, val]) => `${k}=${val}`)
        .join(", ")}`,
      changes: patch,
    });
  },
});
