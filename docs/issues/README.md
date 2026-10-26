# Issues & to-dos

Things to fix or decide before (and while) the app goes to real customers. One file per issue; check this
folder while developing and add to it as new problems turn up.

| Issue | Priority | Status |
|---|---|---|
| [Product name, domain & business setup](branding-and-business-setup.md) | High | In progress |
| [Hosting, backups & data location](hosting-and-backups.md) | High | Decided, not started |
| [Move sign-in to Clerk](clerk-authentication.md) | High | Open |
| [Account deletion vs 7-year retention](account-deletion-and-retention.md) | High | Open |
| [Licences & billing with Stripe](billing-stripe.md) | High | Open |
| [Website (landing, pricing, legal, account)](website.md) | High | Open |
| [Legal documents](legal-documents.md) | High | Open |
| [Queries that grow with the data](growing-queries.md) | Medium | Open |
| [Exports for large businesses](export-scalability.md) | Medium | Open |
| [Releasing to the Play Store & App Store](app-store-release.md) | Medium | Open |
| [Website & in-app usage analytics](analytics-tracking.md) | Medium | Open |
| [Owner dashboard (business metrics)](owner-dashboard.md) | Medium | Open |
| [Customer compliance reports](customer-reports.md) | Medium | Open |
| [Finish the multi-business migration](multi-business-cleanup.md) | Low | Open |

## Launch plan

Decisions so far: subscription per business (monthly / yearly, free trial) sold on the website with Stripe;
Next.js website on Vercel; Convex Cloud; Clerk for sign-in everywhere; PostHog for analytics.

```
www.<domain>   Next.js (Vercel): landing, pricing, legal, checkout, billing, reports, owner dashboard
app.<domain>   Flutter web app (same code as the store apps)
Convex Cloud   one backend for everything, incl. subscriptions kept in sync by Stripe webhooks
Clerk          one sign-in for the website, web app and phone apps
Stripe         Checkout, Customer Portal, Stripe Tax (GST)
PostHog        website + in-app usage analytics
```

Order (each step depends on the ones before it):

1. **Foundations:** [business setup](branding-and-business-setup.md), [Convex Cloud](hosting-and-backups.md),
   [Clerk](clerk-authentication.md)
2. **Billing backend:** [Stripe subscriptions & entitlements](billing-stripe.md)
3. **Website:** [landing, pricing, checkout](website.md) and [legal documents](legal-documents.md)
4. **Store readiness:** [account deletion](account-deletion-and-retention.md), [store release](app-store-release.md)
5. **Analytics & reports:** [PostHog](analytics-tracking.md), [owner dashboard](owner-dashboard.md),
   [customer reports](customer-reports.md), with [growing queries](growing-queries.md) and
   [exports](export-scalability.md) fixed alongside
6. **Cleanup:** [multi-business migration](multi-business-cleanup.md)

Product features still to build (live updates, photos, offline mode, PDF/CSV reports...) are listed in
[DOCUMENTATION.md §16](../DOCUMENTATION.md#16-known-limitations--roadmap).

## Adding an issue

Create `docs/issues/<short-name>.md` with the sections below, then add a row to the table above.

```markdown
# Title

**Priority:** High / Medium / Low · **Status:** Open / In progress / Done

## Problem
What's wrong or missing, and where in the code.

## Why it matters
What happens to users or the business if it's left.

## To do
- [ ] Concrete steps

## Notes
Links, decisions, anything learned along the way.
```

When an issue is done, set its status to **Done** (here and in the file) rather than deleting it, so the
decision and what was changed stay on record.
