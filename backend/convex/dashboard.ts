import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember, scoped } from "./lib/session";
import { belowPar, expiryOf, lotsOnHand } from "./lib/stock";

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
    const stock = await lotsOnHand(ctx, businessId);
    const expiring = stock.filter((l) => {
      const e = expiryOf(l);
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
      stockLines: stock.length,
      onHold: stock.filter((l) => l.status === "hold").length,
      lowStock: (await belowPar(ctx, businessId)).length,
      inProgressAudits,
    };
  },
});
