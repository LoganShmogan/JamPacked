// The owner dashboard: how JamPacked itself is doing (sign-ups, businesses, activity), for platform
// admins only. Counts come from users, businesses and memberships, which grow with customers, not with
// their records; activity reads one audit log row per business. No business's records are returned.
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { requirePlatformAdmin } from "./lib/session";

const DAY = 86_400_000;
const WEEK = 7 * DAY;
export const WEEKS = 12;

/** How many of `times` fall in each of the last `WEEKS` weeks, oldest first. */
function weekly(times: number[], now: number) {
  const counts = Array<number>(WEEKS).fill(0);
  for (const t of times) {
    const ago = Math.floor((now - t) / WEEK);
    if (ago >= 0 && ago < WEEKS) counts[WEEKS - 1 - ago]++;
  }
  return counts.map((count, i) => ({ weekStart: now - (WEEKS - i) * WEEK, count }));
}

export const overview = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requirePlatformAdmin(ctx, sessionToken);
    const now = Date.now();
    const users = await ctx.db.query("users").collect();
    const businesses = await ctx.db.query("businesses").collect();

    const perBusiness = [];
    for (const b of businesses) {
      const members = (
        await ctx.db.query("memberships").withIndex("by_business", (q) => q.eq("businessId", b._id)).collect()
      ).filter((m) => m.active);
      const last = await ctx.db
        .query("auditLog")
        .withIndex("by_business_at", (q) => q.eq("businessId", b._id))
        .order("desc")
        .first();
      perBusiness.push({
        _id: b._id,
        name: b.name,
        programme: b.programme,
        jurisdiction: b.jurisdiction,
        archived: b.archived,
        createdAt: b.createdAt,
        members: members.length,
        lastActivityAt: last?.at ?? null,
      });
    }
    const live = perBusiness.filter((b) => !b.archived);
    const activeWithin = (days: number) =>
      live.filter((b) => b.lastActivityAt !== null && b.lastActivityAt >= now - days * DAY).length;
    const tally = (keys: string[]) =>
      keys.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});

    return {
      generatedAt: now,
      users: { total: users.length, active: users.filter((u) => u.active).length },
      businesses: {
        total: businesses.length,
        archived: businesses.length - live.length,
        active7d: activeWithin(7),
        active30d: activeWithin(30),
        byProgramme: tally(live.map((b) => b.programme)),
        byJurisdiction: tally(live.map((b) => b.jurisdiction)),
      },
      signupsByWeek: {
        users: weekly(users.map((u) => u.createdAt), now),
        businesses: weekly(businesses.map((b) => b.createdAt), now),
      },
      // Newest first: the support view (status and activity, not records).
      businessList: perBusiness.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

/**
 * Make someone a platform admin (or take it away). Internal only, so it can't be called from the
 * apps: run it from the CLI, e.g. `npx convex run platform:setPlatformAdmin '{"email":"…","platformAdmin":true}'`.
 */
export const setPlatformAdmin = internalMutation({
  args: { email: v.string(), platformAdmin: v.boolean() },
  handler: async (ctx, { email, platformAdmin }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email.trim().toLowerCase()))
      .unique();
    if (!user) return { updated: false };
    await ctx.db.patch(user._id, { platformAdmin });
    await logAudit(ctx, null, {
      action: platformAdmin ? "platform_admin_granted" : "platform_admin_revoked",
      entityType: "user",
      entityId: user._id,
      summary: `${user.name} ${platformAdmin ? "is now" : "is no longer"} a platform admin`,
    });
    return { updated: true };
  },
});
