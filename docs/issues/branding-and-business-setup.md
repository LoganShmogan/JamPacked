# Product name, domain & business setup

**Priority:** High (blocks the website, Stripe and the store listings) · **Status:** In progress

## Problem
The product is **JamPacked**, at `jampacked.co.nz` (the app runs at `app.jampacked.co.nz`). It's sold by
**Save Point Limited** (company number 9392145, NZBN 9429053325013), Logan's existing NZ company, trading as
JamPacked. No new company is needed, but Stripe, Apple, Google and the legal documents need setting up in
Save Point Limited's name.

## Why it matters
The name and domain go into the bundle IDs (hard to change after release), the Stripe account, invoices,
the legal documents and the store listings.

## To do
- [x] Product name: JamPacked; legal entity: Save Point Limited (trading as JamPacked)
- [ ] Check JamPacked is free as a trademark (IPONZ, IP Australia) and on both stores; file the NZ word mark in classes 9 + 42 (in progress, 31 Oct 2026)
- [x] Domain: `jampacked.co.nz`, with `www.` for the website and `app.` for the Flutter web app
- [x] Legal entity: Save Point Limited (already incorporated, NZBN 9429053325013)
- [x] Add JamPacked as a trading name on Save Point Limited's NZBN record (done 31 Oct 2026, alongside MemeLine and QuillFin)
- [x] Replace "JamPacked and Co" with Save Point Limited where it reads as the legal name (login screen
  copyright, READMEs, DOCUMENTATION.md)
- [ ] GST: register when turnover is over NZ$60k (or earlier, voluntarily); check AU GST rules if selling
  to Australian businesses over the AU threshold
- [ ] Business email addresses (support@, privacy@, billing@)
- [x] Bundle ID / application ID: `nz.co.jampacked.app` (Android and iOS)
- [ ] Register the bundle ID in App Store Connect and the app in Google Play Console
- [x] Logo and app icons (`app/assets/logo.jpg`, generated with `flutter_launcher_icons`)
- [x] App colours: jam colours from the logo (`app/lib/theme.dart`)
- [x] Rename the GitHub repo to `JamPacked` (local folder is still `NzSafteyHealthApp`; rename it whenever)
- [ ] Server containers / volume are still named `foodsafe` (renaming means moving the live data volume)

## Notes
- Apple: enrol the developer account as an organisation under Save Point Limited (the seller name on the
  App Store will be Save Point Limited). Google Play shows the developer name, which can be "JamPacked".
- Stripe: one Save Point Limited account can hold JamPacked as a separate account/business profile, so
  JamPacked's statement descriptor, branding and payouts stay apart from Save Point's client work.
- Apple developer accounts for a company need a D-U-N-S number, which can take a while to get. Start early.
