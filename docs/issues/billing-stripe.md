# Licences & billing with Stripe

**Priority:** High · **Status:** Open

## Problem
There's no way to pay. Decision: a **monthly or yearly subscription per business**, priced by the
programme it follows, with a **30-day money-back guarantee** (no free trial), bought on the website through Stripe.

## Prices (decided 2026-10-31, NZD, shown incl. GST on the website)
| Plan | Monthly | Yearly | Who |
|---|---|---|---|
| NP1 | free | free | NP1 business with one user and no staff |
| NP2 | $50 | $500 | NP2, **or NP1 with staff** |
| NP3 | $100 | $1000 | NP3 |
| Custom | $120 | $1200 | Custom programme |

The website reads these from `web/src/lib/site.ts` (`pricing.plans`, one Stripe Payment Link per plan and period).

## Design
- **Licence = subscription status on a business**, not a download key. People install the app from the
  stores (or use `app.<domain>`), sign in, and the business they pick is unlocked if it has a live
  subscription.
- **Checkout:** the website creates a Stripe Checkout Session (subscription mode) for a business, with
  `metadata.businessId`. Monthly and yearly prices for NP2, NP3 and Custom; NP1 needs no checkout.
- **Managing billing:** Stripe Customer Portal (change card, switch monthly/yearly, cancel, invoices).
- **Source of truth:** Stripe webhooks hit a Convex `httpAction` (e.g. `/stripe/webhook`) that verifies the
  signature and upserts a `subscriptions` row: `businessId`, `stripeCustomerId`, `stripeSubscriptionId`,
  `status`, `priceId`, `interval`, `currentPeriodEnd`, `cancelAtPeriodEnd`. Events: `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`.
- **Plan for a business:** from `businesses.programme`, except NP1 with more than one active membership
  (or a pending invite) needs the NP2 plan. Adding staff to a free NP1 business should send the admin to
  checkout for NP2 rather than silently failing.
- **Money back:** refunds within 30 days of the first payment are done by hand in the Stripe dashboard
  (refund + cancel the subscription); the webhook then marks the business read-only like any cancellation.
- **Entitlements:** `requireMember` (`backend/convex/lib/session.ts`) also checks the business's subscription.
  `active` = full access. `past_due` = full access with a warning for a grace period.
  `canceled` / `unpaid` / no subscription = **read-only**: records can still be viewed and exported, because
  businesses must be able to get at 7 years of records even after they stop paying. Nothing is deleted.
- **Who pays:** only business admins can start checkout or open the billing portal; staff never see prices.
- **Tax:** Stripe Tax for NZ GST (15%) and AU GST; decide whether prices are shown GST-inclusive.

## To do
- [ ] Stripe account in the business's name (see [branding-and-business-setup.md](branding-and-business-setup.md))
- [x] Decide prices (above) and money-back period (30 days, no trial)
- [ ] Decide the past-due grace period
- [ ] Products & prices in Stripe (test mode first)
- [ ] `subscriptions` table + `stripe.ts` webhook `httpAction` in Convex (signature check, idempotent upserts)
- [ ] Convex action to create Checkout Sessions and Customer Portal sessions (called from the website)
- [ ] Entitlement check in `requireMember`, read-only mode for lapsed businesses, tests for every status
- [ ] NP1 with staff → NP2: block or redirect staff invites on a free NP1 business until it has an NP2 subscription
- [ ] Existing businesses: decide (free period, or grandfathered)
- [ ] Billing emails (receipts, failed payments) via Stripe's built-in emails
- [ ] Owner metrics (MRR, churn) come from these rows; see [owner-dashboard.md](owner-dashboard.md)

## Notes
- Depends on [clerk-authentication.md](clerk-authentication.md) (the website and app need the same sign-in)
  and [hosting-and-backups.md](hosting-and-backups.md) (webhooks need a public, reliable backend).
- Keep prices and purchase links **out of the phone apps**; see [app-store-release.md](app-store-release.md).
