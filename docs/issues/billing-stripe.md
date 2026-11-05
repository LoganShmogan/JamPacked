# Licences & billing with Stripe

**Priority:** High · **Status:** In progress

## Problem
Stripe is set up and people can pay (Payment Links on `/store/`). The backend side is built but off:
a webhook keeps a `subscriptions` row per business, and `BILLING_ENFORCED=true` makes an unlicensed business
read-only ([DOCUMENTATION.md §5 `billing`](../DOCUMENTATION.md#5-backend-convex-reference)). Until the website
has sign-in, a payment can't say which business it's for, so payments are matched by hand. Decision: a **monthly or yearly subscription per business**, priced by the
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
- **Checkout:** Stripe Payment Links (one per plan and period, `web/src/lib/site.ts`). `/store/?business=<id>`
  adds `client_reference_id=<id>`, which the webhook uses to unlock that business. Once the website has
  Clerk sign-in, it sends signed-in admins there with their business; until then payments are matched by
  hand with `billing:link` (the buyer's email, and the business name if the Payment Link asks for it).
  Moving to Checkout Sessions created by Convex is only needed if Payment Links fall short.
- **Managing billing:** Stripe Customer Portal (change card, switch monthly/yearly, cancel, invoices).
- **Source of truth:** Stripe webhooks hit `POST /stripe/webhook` (`backend/convex/http.ts`), which verifies
  the signature and upserts a `subscriptions` row: `businessId`, `stripeCustomerId`, `stripeSubscriptionId`,
  `email`, `businessHint`, `plan` (from the price amount), `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`. Events: `checkout.session.completed`,
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
- **Tax:** Save Point Limited is GST-registered. Prices are GST-inclusive (Stripe prices set to "inclusive",
  Stripe Tax on with the NZ registration, SaaS business-use tax code). Overseas business customers are
  generally zero-rated, at the same NZ$ price. The GST number goes on receipts (taxable supply information).

## To do
- [x] Stripe account (live Payment Links). Check it's in Save Point Limited's name, with the GST number on receipts
- [x] Decide prices (above) and money-back period (30 days, no trial)
- [ ] Decide the past-due grace period
- [x] Products & prices in Stripe, with a live Payment Link per plan and period (`checkoutUrls` in `web/src/lib/site.ts`)
- [ ] Tie a payment to a business: Payment Links don't carry `metadata.businessId`, so either move the website to Checkout Sessions (as designed above) or match payments to businesses by hand until then
- [x] `subscriptions` table + webhook in `http.ts` / `billing.ts` (signature check, upserts in any order), tested
- [ ] Register the webhook in Stripe → Developers → Webhooks: `https://app.jampacked.co.nz/http/stripe/webhook`
  (after the next `./deploy/deploy.sh`, which adds nginx's `/http/` route), events `checkout.session.completed`
  and `customer.subscription.created/updated/deleted`; then `npx convex env set STRIPE_WEBHOOK_SECRET whsec_...`.
  On Convex Cloud the URL becomes `https://<deployment>.convex.site/stripe/webhook`
- [ ] Add a "Business name in JamPacked" text field to each Payment Link, for matching payments by hand
- [ ] Convex action to create Checkout Sessions and Customer Portal sessions (called from the website)
- [x] Entitlement check in `requireMember`, read-only mode for lapsed businesses, tests for every status
  (behind `BILLING_ENFORCED`; Home shows "Read-only for now")
- [ ] Turn on `BILLING_ENFORCED` once existing businesses have licences (or are grandfathered)
- [x] NP1 with staff → NP2: an NP1 business with more than one active member needs np2, and is read-only
  without it; the admin can still remove staff to go back to free
- [ ] Say so before it happens: warn the admin when inviting someone to a free NP1 business
- [ ] Existing businesses: decide (free period, or grandfathered)
- [ ] Billing emails (receipts, failed payments) via Stripe's built-in emails
- [ ] Owner metrics (MRR, churn) come from these rows; see [owner-dashboard.md](owner-dashboard.md)

## Notes
- Depends on [clerk-authentication.md](clerk-authentication.md) (the website and app need the same sign-in)
  and [hosting-and-backups.md](hosting-and-backups.md) (webhooks need a public, reliable backend).
- Keep prices and purchase links **out of the phone apps**; see [app-store-release.md](app-store-release.md).
