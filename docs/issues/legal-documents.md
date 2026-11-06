# Legal documents

**Priority:** High (needed for the stores, Stripe and launch) · **Status:** In progress (drafts live, need a lawyer)

## Problem
Apple, Google and Stripe all require at least a privacy policy and terms before launch. Drafts of the
Terms, Privacy Policy and Cookies & data policy are live on the website, but haven't been reviewed by a lawyer.

## To do
Research notes and the gaps found in the drafts (3 Nov 2026): [../legal-research.md](../legal-research.md).

**Drafts are on the website** under `/legal/` (an index page, linked from the header menu and every
document): Terms and Privacy dated 6 November 2026, Cookies 31 October 2026. Dates and titles live in `web/src/lib/legal.ts`; change a date whenever
that document's wording changes. They now cover: plans by programme, the free NP1 plan and NP1 with staff
needing NP2, plan changes on a programme change, 30 days' notice of price changes, the 30-day money-back
guarantee (once per business), production and allergen information being aids rather than checks, Open Food
Facts barcode lookups, and supplier / customer details held on the business's behalf. Terms, Privacy Policy, and
Cookies & data. They still need a lawyer's review, the data storage location, and a sub-processors list.

Documents (published on the website under `/legal/...`, linked from the app's sign-up screen and More menu):
- [ ] **Terms of Service / subscription agreement:** licence per business priced by programme, the free
  NP1 plan (one user, no staff), billing, renewals, cancellation, the 30-day money-back guarantee, refunds, what happens to data when a subscription ends (read-only, records kept 7 years,
  export available), acceptable use, liability limits, governing law (NZ)
- [ ] **Privacy Policy** (NZ Privacy Act 2020; also AU Privacy Act if selling there): what's collected,
  where it's stored (Convex region, Clerk, Stripe, PostHog, Cloudflare), how long, who it's shared with,
  access/correction requests, account deletion
- [ ] **Cookie / analytics notice** (PostHog; see [analytics-tracking.md](analytics-tracking.md))
- [ ] **Data retention & deletion statement** (7-year records, account deletion rules; see
  [account-deletion-and-retention.md](account-deletion-and-retention.md))
- [ ] **Compliance disclaimer:** the app helps keep records but doesn't replace the business's registered
  programme, verifier or EHO; templates are a starting point; not endorsed by MPI / FSANZ
- [ ] **Refund & cancellation policy** (can sit inside the terms)
- [x] **Sub-processors list**: in the Privacy Policy, from `providers` in `web/src/lib/legal.ts` (6 Nov 2026);
  the full list with status is [../providers.md](../providers.md). Still needs the Convex data location
- [x] Terms: NP1 needs NP2 once anyone else *joins* (it said "is invited", but invites can't be cancelled
  in the app, so the licence counts members) (6 Nov 2026)
- [x] Privacy Policy covers task timings (how long forms are open, shown on Insights) (31 Oct 2026)
- [ ] In-app: tick box to accept the terms at sign-up, record which version and when (audit log)
- [ ] In-app: a "Legal" entry in More (and on sign-up) opening `https://jampacked.co.nz/legal/` (needs `url_launcher`)
- [ ] Lawyer to check the new clauses: NP1 → NP2 when staff are added (read-only until paid), plan change
  on a programme change, price-change notice, money-back once per business, allergen / use-by aids

## Notes
- The provider in every document is **Save Point Limited** (trading as JamPacked; see
  [branding-and-business-setup.md](branding-and-business-setup.md)). Save Point already has a Privacy
  Policy, Terms and Disclaimer (effective 13 May 2026, in `~/Documents/Save Point/01 Company/Legal Policies/`),
  written for client projects. Use them as a starting point, but JamPacked needs its own subscription
  terms and a privacy policy covering customers' staff and records.
- The website footer names Save Point Limited and its NZBN, and links each `/legal/...` document.
- Drafts can be written here, but **have a NZ lawyer review them before launch**. Business-to-business
  terms can contract out of the Consumer Guarantees Act; the Fair Trading Act still applies.
- Keep each document versioned (date at the top) so accepted versions can be shown later.
