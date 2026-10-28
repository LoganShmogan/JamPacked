# Licences & billing with Stripe

**Priority:** High · **Status:** Open

## Problem
There's no way to pay. Decision: a **monthly or yearly subscription per business**, with a free trial,
bought on the website through Stripe.

## Design
- **Licence = subscription status on a business**, not a download key. People install the app from the
  stores (or use `app.<domain>`), sign in, and the business they pick is unlocked if it has a live
  subscription.
- **Checkout:** the website creates a Stripe Checkout Session (subscription mode) for a business, with
  `metadata.businessId`. Monthly and yearly prices; trial via Stripe's `trial_period_days`.
- **Managing billing:** Stripe Customer Portal (change card, switch monthly/yearly, cancel, invoices).
- **Source of truth:** Stripe webhooks hit a Convex `httpAction` (e.g. `/stripe/webhook`) that verifies the
  signature and upserts a `subscriptions` row: `businessId`, `stripeCustomerId`, `stripeSubscriptionId`,
  `status`, `priceId`, `interval`, `currentPeriodEnd`, `cancelAtPeriodEnd`. Events: `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`.
- **Entitlements:** `requireMember` (`backend/convex/lib/session.ts`) also checks the business's subscription.
  `trialing` / `active` = full access. `past_due` = full access with a warning for a grace period.
  `canceled` / `unpaid` / no subscription = **read-only**: records can still be viewed and exported, because
  businesses must be able to get at 7 years of records even after they stop paying. Nothing is deleted.
- **Who pays:** only business admins can start checkout or open the billing portal; staff never see prices.
- **Tax:** Stripe Tax for NZ GST (15%) and AU GST; decide whether prices are shown GST-inclusive.

## To do
- [ ] Stripe account in the business's name (see [branding-and-business-setup.md](branding-and-business-setup.md))
- [ ] Decide prices, trial length and grace period
- [ ] Products & prices in Stripe (test mode first)
- [ ] `subscriptions` table + `stripe.ts` webhook `httpAction` in Convex (signature check, idempotent upserts)
- [ ] Convex action to create Checkout Sessions and Customer Portal sessions (called from the website)
- [ ] Entitlement check in `requireMember`, read-only mode for lapsed businesses, tests for every status
- [ ] Existing businesses: decide (free period, or grandfathered)
- [ ] Billing emails (receipts, failed payments) via Stripe's built-in emails
- [ ] Owner metrics (MRR, churn) come from these rows; see [owner-dashboard.md](owner-dashboard.md)

## Notes
- Depends on [clerk-authentication.md](clerk-authentication.md) (the website and app need the same sign-in)
  and [hosting-and-backups.md](hosting-and-backups.md) (webhooks need a public, reliable backend).
- Keep prices and purchase links **out of the phone apps**; see [app-store-release.md](app-store-release.md).
