# Owner dashboard (business metrics)

**Priority:** Medium · **Status:** In progress

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
- [x] `platformAdmin` flag and a `requirePlatformAdmin` helper, with tests; granted from the CLI with
  `platform:setPlatformAdmin` (DOCUMENTATION.md §9)
- [x] `platform:overview`: users, businesses, active in the last 7 / 30 days, by programme and country,
  sign-ups per week. Reads `users`, `businesses` and `memberships` whole (they grow with customers, not
  records) and one audit log row per business
- [ ] Switch to running totals updated on write once there are thousands of businesses (see
  [growing-queries.md](growing-queries.md))
- [x] `/admin` page (`web/src/app/admin/page.tsx`): KPI tiles, sign-ups per week, programme and country
  breakdown, business list
- [ ] Subscriptions by status, MRR, churn and trial conversion (needs [billing-stripe.md](billing-stripe.md))
- [x] Per-business view for support (programme, members, signed up, last activity) without their records
- [ ] Grant yourself platform admin on the live server after deploying
- [ ] Move the `/admin` sign-in to Clerk with [clerk-authentication.md](clerk-authentication.md)
