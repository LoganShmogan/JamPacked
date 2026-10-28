# Legal documents

**Priority:** High (needed for the stores, Stripe and launch) · **Status:** Open

## Problem
There are no terms, privacy policy or other legal pages. Apple, Google and Stripe all require at least a
privacy policy and terms before launch.

## To do
**Drafts are on the website** (`web/src/app/legal/`, dated 28 October 2026): Terms, Privacy Policy, and
Cookies & data. They still need a lawyer's review, the data storage location, and a sub-processors list.

Documents (published on the website under `/legal/...`, linked from the app's sign-up screen and More menu):
- [ ] **Terms of Service / subscription agreement:** licence per business, trials, billing, renewals,
  cancellation, refunds, what happens to data when a subscription ends (read-only, records kept 7 years,
  export available), acceptable use, liability limits, governing law (NZ)
- [ ] **Privacy Policy** (NZ Privacy Act 2020; also AU Privacy Act if selling there): what's collected,
  where it's stored (Convex region, Clerk, Stripe, PostHog, Vercel), how long, who it's shared with,
  access/correction requests, account deletion
- [ ] **Cookie / analytics notice** (PostHog; see [analytics-tracking.md](analytics-tracking.md))
- [ ] **Data retention & deletion statement** (7-year records, account deletion rules; see
  [account-deletion-and-retention.md](account-deletion-and-retention.md))
- [ ] **Compliance disclaimer:** the app helps keep records but doesn't replace the business's registered
  programme, verifier or EHO; templates are a starting point; not endorsed by MPI / FSANZ
- [ ] **Refund & cancellation policy** (can sit inside the terms)
- [ ] **Sub-processors list** (Convex, Clerk, Stripe, Vercel, PostHog, Open Food Facts lookups)
- [ ] In-app: tick box to accept the terms at sign-up, record which version and when (audit log)

## Notes
- The provider in every document is **Save Point Limited** (trading as JamPacked; see
  [branding-and-business-setup.md](branding-and-business-setup.md)). Save Point already has a Privacy
  Policy, Terms and Disclaimer (effective 13 May 2026, in `~/Documents/Save Point/01 Company/Legal Policies/`),
  written for client projects. Use them as a starting point, but JamPacked needs its own subscription
  terms and a privacy policy covering customers' staff and records.
- The website footer already names Save Point Limited and its NZBN; add `/legal/...` links there when the
  documents exist.
- Drafts can be written here, but **have a NZ lawyer review them before launch**. Business-to-business
  terms can contract out of the Consumer Guarantees Act; the Fair Trading Act still applies.
- Keep each document versioned (date at the top) so accepted versions can be shown later.
