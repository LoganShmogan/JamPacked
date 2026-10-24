# Website (landing, pricing, legal, account)

**Priority:** High · **Status:** Open

## Problem
There's no public website: `jampacked.co.nz` and `www` redirect to the Flutter app at `app.jampacked.co.nz`. Decision: a separate
**Next.js** site on **Vercel**, sharing the Convex backend and Clerk sign-in.

## Design
- New folder `web/` in this repo (Next.js App Router, TypeScript), deployed to Vercel from `web/`.
- `www.<domain>` is the website; `app.<domain>` is the Flutter web app (also on Vercel or any static host).
- Uses the `convex` npm client against the same deployment (`backend/convex`), and `@clerk/nextjs`.

Pages:
- **Public:** home / landing, features, NP1 / NP2 / NP3 explainers, pricing, FAQ, contact / support,
  download (links to App Store, Google Play and `app.<domain>`)
- **Legal:** see [legal-documents.md](legal-documents.md)
- **Signed in:** pick a business, start a trial / checkout, billing (Stripe Customer Portal), team summary
- **Reports:** see [customer-reports.md](customer-reports.md)
- **Owner only:** see [owner-dashboard.md](owner-dashboard.md)

## To do
- [ ] Scaffold `web/` (Next.js, Clerk, Convex client, Tailwind), add to the README and tests/CI
- [ ] Landing, features, pricing, FAQ, contact, download pages
- [ ] Sign in / sign up with Clerk, then choose or create a business and go to checkout
- [ ] Billing page (Checkout + Customer Portal; see [billing-stripe.md](billing-stripe.md))
- [ ] SEO basics: titles, descriptions, Open Graph images, sitemap, robots.txt
- [ ] Vercel project, domains, preview deployments per branch
- [ ] Move the Flutter web build to `app.<domain>` and update `deploy/` and DOCUMENTATION.md §14

## Notes
- Write the copy carefully: say the programme modules are *based on* MPI guidance; don't imply MPI or
  FSANZ endorse the product.
