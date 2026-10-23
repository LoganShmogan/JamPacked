import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { diff, logAudit } from "./lib/audit";
import { checkSectors } from "./lib/business";
import { requireMember } from "./lib/session";
import { programmeKey } from "./schema";

/** The current business's settings: details, programme and temperature limits. */
export const get = query({
  args: { sessionToken: v.string(), businessId: v.id("businesses") },
  handler: async (ctx, { sessionToken, businessId }) => {
    const { business } = await requireMember(ctx, sessionToken, businessId);
    const { _creationTime, ownerId, ...rest } = business;
    return { ...rest, businessName: business.name };
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    businessId: v.id("businesses"),
    businessName: v.optional(v.string()),
    jurisdiction: v.optional(v.union(v.literal("NZ"), v.literal("AU"))),
    registrationNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    chilledMaxC: v.optional(v.number()),
    frozenMaxC: v.optional(v.number()),
    hotMinC: v.optional(v.number()),
    expiryWarningDays: v.optional(v.number()),
    programme: v.optional(programmeKey),
    sectors: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { sessionToken, businessId, businessName, ...rest }) => {
    const { user, business } = await requireMember(ctx, sessionToken, businessId, ["admin"]);
    const name = businessName?.trim();
    // Convex treats an undefined field in a patch as "remove it", so only set what was given.
    const patch = { ...rest, ...(name ? { name } : {}) };
    const programme = patch.programme ?? business.programme;
    // Switching programme drops sectors that belonged to the old one unless new ones are given.
    if (programme !== business.programme && !patch.sectors) patch.sectors = [];
    checkSectors(programme, patch.sectors ?? business.sectors);
    const changes = diff(business, patch);
    await ctx.db.patch(businessId, patch);
    await logAudit(ctx, user, {
      businessId,
      action: "update",
      entityType: "settings",
      entityId: businessId,
      summary: `Business settings updated (${Object.keys(changes).join(", ") || "no changes"})`,
      changes,
    });
  },
});
