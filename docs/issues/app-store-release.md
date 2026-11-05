# Releasing to the Play Store & App Store

**Priority:** Medium · **Status:** Open

## Problem
Only the web build is deployed (`deploy/deploy.sh`). The Android and iOS apps haven't been set up for store
release.

## Why it matters
Most staff will use the app on a phone in the chiller or at the back door, so the store apps are the main
way customers will use it.

## To do
Accounts & listings:
- [ ] Google Play developer account (one-off fee) and Apple Developer Program (yearly fee), both as an
  organisation (Save Point Limited), which needs a D-U-N-S number: start early. A *personal* Play account
  would first need a closed test with 12+ testers for 14 days. *Check both at sign-up.*
- [x] App name (JamPacked), bundle ID / application ID (`nz.co.jampacked.app`), icons
- [ ] Screenshots, descriptions. The website's screenshots (390×844 at 2×, so 780×1688) can't be reused:
  Play allows at most 2:1, and the App Store wants its own sizes (e.g. 6.9" iPhone). Play also needs a
  1024×500 feature graphic
- [ ] Play: content rating, target audience, app access (the demo login), account deletion URL.
  Apple: age rating, support URL (`https://jampacked.co.nz/help/`), review notes (B2B, no purchasing in
  the app, guideline 3.1.3(f)), and either Apple's standard EULA or Apple's minimum terms in ours
- [ ] Privacy policy URL (what's collected, where it's stored, how long; see
  [hosting-and-backups.md](hosting-and-backups.md))
- [ ] Google Play data-safety form and Apple privacy "nutrition label"

Requirements that need code:
- [ ] In-app account deletion: see [account-deletion-and-retention.md](account-deletion-and-retention.md)
- [ ] Sign in with Apple if any other social login is offered on iOS (see
  [clerk-authentication.md](clerk-authentication.md))
- [ ] **No prices, "buy" buttons or purchase links in the phone apps.** Licences are sold on the website
  ([billing-stripe.md](billing-stripe.md)). A business without a licence sees a neutral message (e.g. "Ask your
  account admin"). Check Apple's App Review Guidelines 3.1 (3.1.3 covers enterprise / multiplatform
  services) and Google Play's payments policy at submission time, as both change often. The app has none
  today (checked 6 Nov 2026), and Home's read-only banner for an unlicensed business is neutral
- [ ] Links to the Terms and Privacy Policy on sign-up and in More ([legal-documents.md](legal-documents.md))
- [x] Camera permission text for barcode scanning: iOS `NSCameraUsageDescription` ("Scan product barcodes
  when receiving goods."), Android `CAMERA`. Three stray copies pasted inside the iOS scene manifest were
  removed (6 Nov 2026)
- [ ] "Product data from Open Food Facts" where looked-up products show, on the Legal page and in the
  listings (ODbL; [legal-research.md §4](../legal-research.md)). The custom User-Agent is done (`products.ts`)
- [ ] Demo account for the store reviewers

Builds:
- [ ] Android release signing: `android/app/build.gradle.kts` still signs release builds with the
  **debug** key. Create an upload keystore (keep it backed up, it can't be replaced) in a git-ignored
  `key.properties`, then
  `flutter build appbundle --dart-define=CONVEX_URL=<production URL>`
- [ ] Move `android:usesCleartextTraffic="true"` from the main `AndroidManifest.xml` to the debug one, so
  store builds only use HTTPS (it's there for local `http://` development)
- [ ] Target SDK is Flutter's default (36 on Flutter 3.47): check Play's current requirement at submission
- [ ] iOS: set the Apple team (`DEVELOPMENT_TEAM`), and decide iPad. The project targets iPhone and iPad
  (`TARGETED_DEVICE_FAMILY = "1,2"`), which means iPad screenshots and review on an iPad; or make it
  iPhone-only
- [ ] iOS: `ITSAppUsesNonExemptEncryption` = `NO` in `Info.plist` (HTTPS only), so each upload skips the
  export-compliance question
- [ ] iOS signing in Xcode, then `flutter build ipa --dart-define=CONVEX_URL=<production URL>` (needs a Mac)
- [ ] Internal testing tracks first (Play internal testing, TestFlight)
- [ ] Add the mobile builds to the deploy docs (DOCUMENTATION.md §14)
- [ ] Once listed: set `playStoreUrl` / `appStoreUrl` in `web/src/lib/site.ts`, so the after-payment page
  sends phones to the right store, and add the download badges ([website.md](website.md))

## Notes
- All three front ends (Android, iOS, web) talk to the same Convex backend; the device stores only the
  session token, so there's no per-platform database to set up.
