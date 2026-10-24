# Product name, domain & business setup

**Priority:** High (blocks the website, Stripe and the store listings) · **Status:** In progress

## Problem
The product is **JamPacked**, sold by **JamPacked and Co**, at `jampacked.co.nz` (the app runs at
`app.jampacked.co.nz`). Stripe, Apple, Google and the legal documents still need the legal business set up
behind that name.

## Why it matters
The name and domain go into the bundle IDs (hard to change after release), the Stripe account, invoices,
the legal documents and the store listings.

## To do
- [x] Product name: JamPacked; company name: JamPacked and Co
- [ ] Check JamPacked is free as a trademark (IPONZ, IP Australia) and on both stores
- [x] Domain: `jampacked.co.nz`, with `www.` for the website and `app.` for the Flutter web app
- [ ] Register JamPacked and Co as the legal entity that sells the licences (company or sole trader), NZBN
- [ ] GST: register when turnover is over NZ$60k (or earlier, voluntarily); check AU GST rules if selling
  to Australian businesses over the AU threshold
- [ ] Business email addresses (support@, privacy@, billing@)
- [x] Bundle ID / application ID: `nz.co.jampacked.app` (Android and iOS)
- [ ] Register the bundle ID in App Store Connect and the app in Google Play Console
- [x] Logo and app icons (`app/assets/logo.jpg`, generated with `flutter_launcher_icons`)
- [ ] App colours: the app is still orange (`app/lib/theme.dart`); the logo uses cream `#FDE5CD`,
  mustard `#BF9100` and jam red `#E06665`
- [ ] Rename the GitHub repo and folder (`NzSafteyHealthApp`) if wanted
- [ ] Server containers / volume are still named `foodsafe` (renaming means moving the live data volume)

## Notes
- Apple developer accounts for a company need a D-U-N-S number, which can take a while to get. Start early.
