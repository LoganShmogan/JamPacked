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
- [ ] Google Play developer account (one-off fee) and Apple Developer Program (yearly fee)
- [x] App name (JamPacked), bundle ID / application ID (`nz.co.jampacked.app`), icons
- [ ] Screenshots, descriptions
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
  services) and Google Play's payments policy at submission time, as both change often
- [ ] Links to the Terms and Privacy Policy on sign-up and in More ([legal-documents.md](legal-documents.md))
- [ ] Camera permission text for barcode scanning (iOS `Info.plist` usage description, Android permission)
- [ ] Demo account for the store reviewers

Builds:
- [ ] Android signing key (keep it backed up, it can't be replaced), then
  `flutter build appbundle --dart-define=CONVEX_URL=<production URL>`
- [ ] iOS signing in Xcode, then `flutter build ipa --dart-define=CONVEX_URL=<production URL>`
- [ ] Internal testing tracks first (Play internal testing, TestFlight)
- [ ] Add the mobile builds to the deploy docs (DOCUMENTATION.md §14)

## Notes
- All three front ends (Android, iOS, web) talk to the same Convex backend; the device stores only the
  session token, so there's no per-platform database to set up.
