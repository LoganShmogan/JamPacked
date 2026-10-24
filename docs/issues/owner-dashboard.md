# Owner dashboard (business metrics)

**Priority:** Medium · **Status:** Open

## Problem
There's no way for us to see how the business is doing: sign-ups, trials, paying businesses, revenue.

## Design
- Private pages on the website under `/admin`, only for platform owners (a new `platformAdmin` flag on
  `users`, checked in Convex, not just in the page).
- Data from Convex: users, businesses, programmes chosen, active businesses (activity in the last 7/30 days).
- Revenue from the `subscriptions` rows that Stripe webhooks keep up to date (see
  [billing-stripe.md](billing-stripe.md)): MRR, active / trialing / past-due / cancelled counts, churn,
  trial conversion. Stripe's own dashboard covers the detail.
- Usage and funnel charts live in PostHog ([analytics-tracking.md](analytics-tracking.md)); link to it rather
  than rebuilding them.

## To do
- [ ] `platformAdmin` flag and a `requirePlatformAdmin` helper, with tests
- [ ] Convex queries for counts that don't read whole tables (keep running totals updated on write; see
  [growing-queries.md](growing-queries.md))
- [ ] `/admin` page: KPIs, sign-ups over time, subscriptions by status, MRR
- [ ] Per-business view for support (status, plan, last activity) without exposing their records
