import { ConvexError } from "convex/values";
import { Doc } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";

declare const process: { env: Record<string, string | undefined> }; // Convex functions can read env vars

// One licence per business, priced by its programme (docs/issues/billing-stripe.md). Bought on the website
// through Stripe; the webhook (convex/http.ts → billing.ts) keeps a `subscriptions` row per business.

/** Paid plans, cheapest first: a dearer plan covers a cheaper one. Keys match web/src/lib/site.ts. */
export const PLANS = ["np2", "np3", "custom"] as const;
export type Plan = (typeof PLANS)[number];

/**
 * Stripe price (cents, incl. GST) → plan, for monthly and yearly. Keep in step with `pricing.plans` in
 * web/src/lib/site.ts and the prices in Stripe.
 * ponytail: matched by amount; switch to Stripe price lookup keys if two plans ever share a price.
 */
export const PLAN_BY_AMOUNT: Record<number, Plan> = {
  5000: "np2", 50000: "np2",
  10000: "np3", 100000: "np3",
  12000: "custom", 120000: "custom",
};

/** Stripe statuses that keep a business unlocked. past_due is the grace period while a card is retried. */
const LIVE = ["active", "trialing", "past_due"];

/** Off until billing goes live, so existing businesses and the test accounts keep working. */
export const billingEnforced = () => process.env.BILLING_ENFORCED === "true";

/** The plan a business needs: NP1 is free for one person; NP1 with staff pays the NP2 price. */
export async function planNeeded(ctx: QueryCtx, business: Doc<"businesses">): Promise<Plan | null> {
  if (business.programme === "NP1") {
    const members = await ctx.db.query("memberships").withIndex("by_business", (q) => q.eq("businessId", business._id)).collect();
    return members.filter((m) => m.active).length > 1 ? "np2" : null;
  }
  return business.programme === "custom" ? "custom" : business.programme === "NP3" ? "np3" : "np2";
}

/** The business's licence: what it needs, what it has, and whether it's unlocked. */
export async function licence(ctx: QueryCtx, business: Doc<"businesses">) {
  const needs = await planNeeded(ctx, business);
  const subs = await ctx.db.query("subscriptions").withIndex("by_business", (q) => q.eq("businessId", business._id)).collect();
  // The best live plan wins; otherwise show the newest, so a lapsed licence says why.
  const rank = (s: (typeof subs)[number]) => (LIVE.includes(s.status) && s.plan ? PLANS.indexOf(s.plan) : -1);
  const sub = subs.reduce<(typeof subs)[number] | undefined>((best, s) => (!best || rank(s) >= rank(best) ? s : best), undefined);
  const has = sub ? rank(sub) : -1;
  const covered = !needs || has >= PLANS.indexOf(needs);
  return {
    needs,
    plan: has >= 0 ? PLANS[has] : null,
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    enforced: billingEnforced(),
    readOnly: billingEnforced() && !covered,
  };
}

/** Writes on an unlicensed business are refused; reading and exporting always work (records are kept 7 years). */
export async function requireLicence(ctx: QueryCtx, business: Doc<"businesses">) {
  if (!billingEnforced()) return;
  const l = await licence(ctx, business);
  if (!l.readOnly) return;
  const why =
    business.programme === "NP1"
      ? "An NP1 business with staff needs the NP2 licence"
      : `This business needs the ${l.needs === "custom" ? "Custom" : l.needs!.toUpperCase()} licence`;
  throw new ConvexError(`${why}, so its records are read-only for now. They can still be viewed and exported.`);
}
