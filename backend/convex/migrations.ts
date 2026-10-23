import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { checkSectors } from "./lib/business";
import { DEFAULT_SETTINGS } from "./lib/settings";
import { programmeKey } from "./schema";

const RECORD_TABLES = [
  "suppliers",
  "products",
  "deliveries",
  "deliveryItems",
  "temperatureLogs",
  "audits",
  "correctiveActions",
  "auditLog",
] as const;

/**
 * One-off: turns a single-business install into the first business of the multi-business model.
 * The old settings row becomes the business, each user's role becomes a membership and every
 * existing record is stamped with the business id. Safe to re-run: it stops once a business exists.
 *
 *   npx convex run migrations:toMultiBusiness '{"programme":"NP2","sectors":["retail_chilled_frozen"]}'
 */
export const toMultiBusiness = internalMutation({
  args: { programme: programmeKey, sectors: v.optional(v.array(v.string())) },
  handler: async (ctx, { programme, sectors = [] }) => {
    if (await ctx.db.query("businesses").first()) return { migrated: false };
    checkSectors(programme, sectors);
    const users = await ctx.db.query("users").collect();
    const owner = users.filter((u) => u.role === "admin").sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!owner) throw new ConvexError("No admin user to own the business");
    const settings = await ctx.db.query("settings").first();
    const businessId = await ctx.db.insert("businesses", {
      ...DEFAULT_SETTINGS,
      jurisdiction: settings?.jurisdiction ?? DEFAULT_SETTINGS.jurisdiction,
      registrationNumber: settings?.registrationNumber,
      address: settings?.address,
      chilledMaxC: settings?.chilledMaxC ?? DEFAULT_SETTINGS.chilledMaxC,
      frozenMaxC: settings?.frozenMaxC ?? DEFAULT_SETTINGS.frozenMaxC,
      hotMinC: settings?.hotMinC ?? DEFAULT_SETTINGS.hotMinC,
      expiryWarningDays: settings?.expiryWarningDays ?? DEFAULT_SETTINGS.expiryWarningDays,
      name: settings?.businessName ?? "My Food Business",
      programme,
      sectors,
      ownerId: owner._id,
      archived: false,
      createdAt: Date.now(),
    });
    for (const u of users) {
      await ctx.db.insert("memberships", {
        userId: u._id,
        businessId,
        role: u.role ?? "staff",
        active: u.active,
        createdAt: u.createdAt,
      });
    }
    const counts: Record<string, number> = {};
    for (const table of RECORD_TABLES) {
      const rows = await ctx.db.query(table).collect();
      const legacy = rows.filter((r) => r.businessId === undefined);
      for (const r of legacy) await ctx.db.patch(r._id, { businessId });
      counts[table] = legacy.length;
    }
    await logAudit(ctx, null, {
      businessId,
      action: "migrate",
      entityType: "business",
      entityId: businessId,
      summary: `Migrated to multi-business: ${users.length} member(s), ${programme}`,
      changes: counts,
    });
    return { migrated: true, businessId, counts };
  },
});
