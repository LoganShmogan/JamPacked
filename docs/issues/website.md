# Website (landing, pricing, legal, account)

**Priority:** High · **Status:** In progress

## Problem
`jampacked.co.nz` and `www` redirected to the Flutter app at `app.jampacked.co.nz`, with nothing to tell
visitors what JamPacked is. Decision: a separate **Next.js** site, sharing the Convex backend and (later)
Clerk sign-in.

**Done so far:** `web/` has the landing page (how it works, features, programmes, FAQ) and the owner
dashboard (`/admin`). It's a static export (`web/out/`), so for now `deploy/deploy.sh` serves it from the
loganserver nginx on `jampacked.co.nz` and `www`; the same build can move to Vercel unchanged.

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
- [x] Scaffold `web/` (Next.js, Convex client, Tailwind), add to the README and DOCUMENTATION.md
- [x] Landing page with features, programmes and FAQ; contact by email
- [x] Store page (`/store/`): one licence per business, monthly / yearly. Prices, trial length and Stripe
  Payment Links are set in `web/src/lib/site.ts` (`pricing`); until then it says "price on request" and Buy
  opens an email
- [x] After-payment page (`/welcome/`): sends Android to Google Play, iPhone/iPad to the App Store, and
  everything else to the web app (phones also go to the web app until the store URLs are set in `site.ts`).
  Set each Payment Link's confirmation page to `https://jampacked.co.nz/welcome/` in Stripe
- [ ] Decide prices and trial length, create the Payment Links, and fill in `pricing` in `site.ts`
- [x] Programme pages (`/programmes/`, `/programmes/np1|np2|np3|custom/`), contact page, legal pages
  (`/legal/terms|privacy|cookies/`, drafts), mobile menu
- [x] SEO: per-page titles, descriptions and canonical URLs; JSON-LD (Organization, SoftwareApplication with
  offers, FAQPage, BreadcrumbList); every public page in the sitemap; `/welcome/` and `/admin/` not indexed
- [ ] Download section with App Store / Google Play badges (once the apps are listed)
- [ ] JamPacked email addresses: the site uses `contact@savepoint.co.nz` until they exist (`web/src/lib/site.ts`)
- [ ] Add Clerk (`@clerk/nextjs`) once [clerk-authentication.md](clerk-authentication.md) is done
- [ ] Sign in / sign up with Clerk, then choose or create a business and go to checkout
- [ ] Billing page (Checkout + Customer Portal; see [billing-stripe.md](billing-stripe.md))
- [x] SEO basics: titles, descriptions, Open Graph image (the logo), sitemap, robots.txt
- [ ] A proper 1200×630 Open Graph image and a Google Search Console property
- [x] Serve the site on `jampacked.co.nz` / `www` from loganserver (`deploy/`, DOCUMENTATION.md §14)
- [x] Put it live with `./deploy/deploy.sh` (27 Oct 2026): `jampacked.co.nz` and `www` now serve the site
- [ ] Vercel project, domains, preview deployments per branch (when moving off loganserver, see
  [hosting-and-backups.md](hosting-and-backups.md))
- [x] Flutter web build on `app.<domain>`

## Notes
- Write the copy carefully: say the programme modules are *based on* MPI guidance; don't imply MPI or
  FSANZ endorse the product.
