// Usage analytics kept in our own database: how long tasks take (timed by the app from opening a form
// to saving it), and the numbers behind each business's Insights screen. Business totals only: nothing
// here compares one staff member with another. platform.ts reads the timings across businesses.
import { Infer, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember, scoped } from "./lib/session";
import { timedTask } from "./schema";

const DAY = 86_400_000;
export type Task = Infer<typeof timedTask>;
export const TASKS: Task[] = ["goodsIn", "production", "temperature", "record"];

// Shorter than this was a double tap; longer, the form was left open. Neither says how long the task takes.
export const MIN_MS = 1_000;
export const MAX_MS = 4 * 60 * 60_000;

/** The middle value (the mean of the middle two for an even count), or null for none. */
export function median(values: number[]) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The app reports how long a task took once it's saved. Outliers are dropped rather than stored. */
export const recordTask = mutation({
  args: { ...scoped, task: timedTask, durationMs: v.number() },
  handler: async (ctx, { sessionToken, businessId, task, durationMs }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    if (!(durationMs >= MIN_MS && durationMs <= MAX_MS)) return false;
    await ctx.db.insert("taskTimings", { businessId, userId: user._id, task, durationMs: Math.round(durationMs), at: Date.now() });
    return true;
  },
});

/**
 * The Insights screen: what the business did over the last `days` (7 to 365), and how long its tasks
 * took (the business's median, and the signed-in person's own).
 */
export const insights = query({
  args: { ...scoped, days: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, businessId, days }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    const period = Math.min(365, Math.max(7, Math.round(days ?? 30)));
    const since = Date.now() - period * DAY;
    const deliveries = (
      await ctx.db.query("deliveries").withIndex("by_business_receivedAt", (q) => q.eq("businessId", businessId).gte("receivedAt", since)).collect()
    ).filter((d) => !d.voided);
    const items = (
      await ctx.db.query("deliveryItems").withIndex("by_business_receivedAt", (q) => q.eq("businessId", businessId).gte("receivedAt", since)).collect()
    ).filter((i) => !i.voided);
    const runs = await ctx.db.query("productionRuns").withIndex("by_business_madeAt", (q) => q.eq("businessId", businessId).gte("madeAt", since)).collect();
    const temps = await ctx.db.query("temperatureLogs").withIndex("by_business_checkedAt", (q) => q.eq("businessId", businessId).gte("checkedAt", since)).collect();
    const records = (
      await ctx.db.query("records").withIndex("by_business_at", (q) => q.eq("businessId", businessId).gte("at", since)).collect()
    ).filter((r) => !r.voided);
    const movements = await ctx.db.query("stockMovements").withIndex("by_business_at", (q) => q.eq("businessId", businessId).gte("at", since)).collect();
    const cas = [];
    for (const status of ["open", "closed"] as const) {
      cas.push(
        ...(await ctx.db
          .query("correctiveActions")
          .withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", status).gte("raisedAt", since))
          .collect()),
      );
    }
    const closed = cas.filter((c) => c.closedAt !== undefined);
    const timings = await ctx.db.query("taskTimings").withIndex("by_business_at", (q) => q.eq("businessId", businessId).gte("at", since)).collect();

    return {
      days: period,
      deliveries: deliveries.length,
      itemsReceived: items.length,
      itemsRejected: items.filter((i) => !i.accepted).length,
      batchesMade: runs.length,
      temperatureChecks: temps.length,
      temperatureInRange: temps.filter((t) => t.compliant).length,
      records: records.length,
      wasteMovements: movements.filter((m) => m.type === "waste").length,
      dispatches: movements.filter((m) => m.type === "dispatch").length,
      correctiveActions: {
        raised: cas.length,
        closed: closed.length,
        medianHoursToClose: median(closed.map((c) => (c.closedAt! - c.raisedAt) / 3_600_000)),
      },
      tasks: TASKS.map((task) => {
        const all = timings.filter((t) => t.task === task);
        const mine = all.filter((t) => t.userId === user._id);
        return { task, count: all.length, medianMs: median(all.map((t) => t.durationMs)), myCount: mine.length, myMedianMs: median(mine.map((t) => t.durationMs)) };
      }),
    };
  },
});
