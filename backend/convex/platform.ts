// The owner dashboard: how JamPacked itself is doing (sign-ups, businesses, activity), for platform
// admins only. Counts come from users, businesses and memberships, which grow with customers, not with
// their records; activity reads one audit log row per business. No business's records are returned.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { QueryCtx, internalAction, internalMutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { hashPassword } from "./lib/password";
import { checkRegion } from "./lib/regions";
import { TASKS, median } from "./analytics";
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

/** Live businesses per country, biggest first, each split by region ("Not set" for older businesses). */
function byCountry(businesses: { jurisdiction: string; region: string | null }[]) {
  const countries = new Map<string, Map<string, number>>();
  for (const b of businesses) {
    const regions = countries.get(b.jurisdiction) ?? new Map<string, number>();
    const region = b.region ?? "Not set";
    regions.set(region, (regions.get(region) ?? 0) + 1);
    countries.set(b.jurisdiction, regions);
  }
  const sorted = <T extends { count: number }>(rows: T[]) => rows.sort((a, b) => b.count - a.count);
  return sorted(
    [...countries].map(([country, regions]) => ({
      country,
      count: [...regions.values()].reduce((n, c) => n + c, 0),
      regions: sorted([...regions].map(([region, count]) => ({ region, count }))),
    })),
  );
}

async function taskTimes(ctx: QueryCtx, now: number) {
  const timings = await ctx.db.query("taskTimings").withIndex("by_at", (q) => q.gte("at", now - 30 * DAY)).collect();
  return TASKS.map((task) => {
    const durations = timings.filter((t) => t.task === task).map((t) => t.durationMs);
    return { task, count: durations.length, medianMs: median(durations), businesses: new Set(timings.filter((t) => t.task === task).map((t) => t.businessId)).size };
  });
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
        region: b.region ?? null,
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
        byCountry: byCountry(live),
      },
      signupsByWeek: {
        users: weekly(users.map((u) => u.createdAt), now),
        businesses: weekly(businesses.map((b) => b.createdAt), now),
      },
      // How long tasks take across every business, last 30 days. Durations only: no records.
      taskTimes: await taskTimes(ctx, now),
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

/**
 * An account for JamPacked staff, with the owner dashboard switched on. Unlike sign-up it needs no
 * business. Internal only: `npx convex run platform:createPlatformAdmin '{"email":…,"name":…,"password":…}'`.
 */
export const createPlatformAdmin = internalAction({
  args: { email: v.string(), name: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ created: boolean }> => {
    if (args.password.length < 8) throw new ConvexError("Password must be at least 8 characters");
    const { hash, salt } = await hashPassword(args.password);
    return await ctx.runMutation(internal.platform.insertPlatformAdmin, {
      email: args.email.trim().toLowerCase(),
      name: args.name.trim(),
      passwordHash: hash,
      passwordSalt: salt,
    });
  },
});

export const insertPlatformAdmin = internalMutation({
  args: { email: v.string(), name: v.string(), passwordHash: v.string(), passwordSalt: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", args.email)).unique();
    if (existing) return { created: false };
    const userId = await ctx.db.insert("users", { ...args, active: true, platformAdmin: true, createdAt: Date.now() });
    await logAudit(ctx, null, {
      action: "platform_admin_created",
      entityType: "user",
      entityId: userId,
      summary: `Platform admin account created for ${args.email}`,
    });
    return { created: true };
  },
});

/** Support: set a business's region, e.g. for businesses created before regions were asked for. */
export const setBusinessRegion = internalMutation({
  args: { businessId: v.id("businesses"), region: v.string() },
  handler: async (ctx, { businessId, region }) => {
    const business = await ctx.db.get(businessId);
    if (!business) throw new ConvexError("Business not found");
    checkRegion(business.jurisdiction, region);
    await ctx.db.patch(businessId, { region });
    await logAudit(ctx, null, {
      businessId,
      action: "update",
      entityType: "settings",
      entityId: businessId,
      summary: `Region set to ${region} by JamPacked support`,
      changes: { region: { from: business.region ?? null, to: region } },
    });
  },
});
