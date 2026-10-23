import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember, scoped } from "./lib/session";

export const summary = query({
  // dayStart: start of "today" in the user's local time zone (the server runs in UTC)
  args: { ...scoped, dayStart: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, businessId, dayStart }) => {
    const { business: settings } = await requireMember(ctx, sessionToken, businessId);
    const now = Date.now();
    const startOfDay = dayStart ?? now - 86_400_000;
    const todayDeliveries = (
      await ctx.db.query("deliveries").withIndex("by_business_receivedAt", (q) => q.eq("businessId", businessId).gte("receivedAt", startOfDay)).collect()
    ).filter((d) => !d.voided);
    const todayTemps = await ctx.db.query("temperatureLogs").withIndex("by_business_checkedAt", (q) => q.eq("businessId", businessId).gte("checkedAt", startOfDay)).collect();
    const openCAs = await ctx.db.query("correctiveActions").withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", "open")).collect();
    const horizon = now + settings.expiryWarningDays * 86_400_000;
    const stock = (
      await ctx.db.query("deliveryItems").withIndex("by_business_receivedAt", (q) => q.eq("businessId", businessId).gt("receivedAt", now - 90 * 86_400_000)).collect()
    ).filter((i) => i.accepted && !i.voided);
    const expiring = stock.filter((i) => {
      const e = i.useBy ?? i.bestBefore;
      return e !== undefined && e <= horizon;
    });
    const inProgressAudits = (await ctx.db.query("audits").withIndex("by_business_startedAt", (q) => q.eq("businessId", businessId)).order("desc").take(50)).filter(
      (a) => a.status === "in_progress",
    ).length;
    return {
      businessName: settings.name,
      jurisdiction: settings.jurisdiction,
      programme: settings.programme,
      deliveriesToday: todayDeliveries.length,
      rejectionsToday: todayDeliveries.filter((d) => d.status !== "accepted").length,
      tempChecksToday: todayTemps.length,
      tempIssuesToday: todayTemps.filter((t) => !t.compliant).length,
      openCorrectiveActions: openCAs.length,
      highSeverityOpen: openCAs.filter((c) => c.severity === "high").length,
      expiringSoon: expiring.length,
      expired: expiring.filter((i) => (i.useBy ?? Infinity) < now).length,
      inProgressAudits,
    };
  },
});
