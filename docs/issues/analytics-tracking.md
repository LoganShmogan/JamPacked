# Website & in-app usage analytics

**Priority:** Medium · **Status:** Open

## Problem
There's no visibility into how people find the website, whether they reach checkout, or which app features
they use.

## Design
- **PostHog** for both: `posthog-js` on the website and `posthog_flutter` in the app, so a visitor can be
  followed from landing page to trial to daily use in one tool. Product analytics, funnels, retention and
  error tracking.
- Identify users by Clerk user ID and group them by `businessId` (PostHog groups), so usage is per business.
- **Privacy:** never send record contents (product names, temperatures, notes, batch codes) to analytics,
  only event names and counts. Turn off session recording on screens with customer data, or entirely.
- Choose the PostHog region and list it in the privacy policy.

## To do
- [ ] PostHog project (cloud), pick the region
- [ ] Website: page views, pricing viewed, checkout started / completed, sign-up
- [ ] App: a small `Analytics` service wrapping `posthog_flutter` (fake in tests, like `sharer` in
  `export_screen.dart`); events for delivery recorded, temp logged, audit completed, export, etc.
- [ ] Consent: cookie banner or cookieless mode on the website; opt-out in the app settings
- [ ] Funnel: landing → sign-up → trial → paid
- [ ] Update the privacy policy ([legal-documents.md](legal-documents.md)) and the stores' privacy forms
