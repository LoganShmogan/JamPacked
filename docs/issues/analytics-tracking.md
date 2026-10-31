# Website & in-app usage analytics

**Priority:** Medium · **Status:** In progress

## Problem
There's no visibility into how people find the website, whether they reach checkout, or which app features
they use.

## Design
- **PostHog** for both: `posthog-js` on the website and `posthog_flutter` in the app, so a visitor can be
  followed from landing page to sign-up to daily use in one tool. Product analytics, funnels, retention and
  error tracking.
- Identify users by Clerk user ID and group them by `businessId` (PostHog groups), so usage is per business.
- **Task timings and Insights are in-house (decided 31 Oct 2026).** The app times receiving goods, making a
  batch, temperature checks and programme records from opening the form to saving it
  (`analytics:recordTask` → `taskTimings`), and each business sees its own numbers on **More › Insights**
  (`analytics:insights`): business totals plus the person's own times, never one staff member against
  another. The owner dashboard shows the typical times across all businesses. PostHog is still the plan for
  the website funnel and broader app events.
- **Privacy:** never send record contents (product names, temperatures, notes, batch codes) to analytics,
  only event names and counts. Turn off session recording on screens with customer data, or entirely.
- Choose the PostHog region and list it in the privacy policy.

## To do
- [ ] PostHog project (cloud), pick the region
- [x] Website: page views, wired up in `web/src/components/Analytics.tsx` but **off until**
  `NEXT_PUBLIC_POSTHOG_KEY` (and `NEXT_PUBLIC_POSTHOG_HOST` for the EU region) is set at build time.
  Memory-only persistence, so no cookies and no consent banner; session recording off
- [ ] Website: pricing viewed, checkout started / completed, sign-up (once those pages exist)
- [ ] App: a small `Analytics` service wrapping `posthog_flutter` (fake in tests, like `sharer` in
  `export_screen.dart`); events for delivery recorded, temp logged, audit completed, export, etc.
- [x] Consent on the website: cookieless (memory persistence), so no banner
- [x] Task timings (in-house, `taskTimings`), the Insights screen and task times on the owner dashboard
- [ ] Opt-out in the app settings
- [ ] Funnel: landing → store (plan viewed) → sign-up → paid (or free NP1 → paid when staff are added)
- [ ] Update the privacy policy ([legal-documents.md](legal-documents.md)) and the stores' privacy forms
