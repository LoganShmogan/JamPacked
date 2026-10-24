# JamPacked: Flutter app

The Flutter client (Android, iOS, web) for JamPacked (by JamPacked and Co). The project docs live at the repo root:

- [`../README.md`](../README.md): overview and how to run it locally
- [`../docs/DOCUMENTATION.md`](../docs/DOCUMENTATION.md): technical & user documentation (see §11 for the Flutter app reference)
- [`../docs/TESTING.md`](../docs/TESTING.md): running and writing tests

The logo is `assets/logo.jpg`. After changing it, regenerate the Android, iOS and web icons with
`dart run flutter_launcher_icons` (settings in `pubspec.yaml`).
That also overwrites `web/favicon.png` with a 16px copy of the whole logo; the committed favicon is a
96px crop around the jar so it's readable in a browser tab, so re-crop it after regenerating.
