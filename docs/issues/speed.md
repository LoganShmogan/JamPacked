# Speed

**Priority:** Medium · **Status:** Open (baseline measured 6 Nov 2026, nothing changed yet)

## Problem
The numbers are in [../performance.md](../performance.md). The backend is quick (most screens take 5 to
20 ms on the server), so what people feel is:

- **The web app's first load on a phone:** about 17 s to the sign-in screen on a weak 4G signal, 1.4 s
  on a good connection. It downloads 2.65 MB first: Flutter's CanvasKit engine (1.49 MB, from Google's
  CDN) and the app's code (0.99 MB).
- **About 100 ms of network per backend call** from the development laptop to loganserver, more than
  the server spends on almost any call. A screen that waits on several calls in turn pays it each time.
- **Calls that read a business's whole history:** export (one round trip per page per table, about 2 s
  live even for a small business), Insights, the audit trail, Goods In, trace and the owner dashboard.

## Why it matters
Staff use the app on phones in chillers and at the back door, often on a poor signal. A first load that
takes 17 s there feels broken, and the history-reading calls slow down every month a business uses it.

## To do
- [ ] Decide the target (for example: sign-in screen in under 5 s on the phone profile)
- [ ] Web app first load: try loading CanvasKit from our own domain (one less connection), Flutter's
  WebAssembly build, deferred loading for screens not needed at sign-in, and caching the engine for
  repeat visits. The store apps avoid this download altogether
- [ ] Fewer round trips: check which screens wait on calls one after another, and combine them
- [ ] The history-reading calls: see [growing-queries.md](growing-queries.md) and
  [export-scalability.md](export-scalability.md)
- [ ] After each change, re-run `scripts/backend-timings.mjs` and `scripts/live-timings.mjs` and update
  [../performance.md](../performance.md)

## Notes
- The live numbers were measured from a laptop whose network stalls about half of new TLS connections
  for 3 s; re-measure from another network before trusting the phone medians.
- Cloudflare's Web Analytics beacon is on `app.jampacked.co.nz` (set in the Cloudflare dashboard, not the
  code). It's small and cookieless, but it is one more provider: see [../providers.md](../providers.md).
