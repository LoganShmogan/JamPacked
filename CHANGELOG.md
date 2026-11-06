# Changelog

What changed in each JamPacked release. One version covers the app (Android, iOS, web), the backend
and the website, because they ship together. Versions follow [semver](https://semver.org): PATCH for
fixes, MINOR for new features, MAJOR for changes people have to adapt to. 0.x while in testing; 1.0.0
is the public launch.

Add to **Unreleased** in the same pull request as the change, in plain words for the people who use
JamPacked. `scripts/prepare-release.sh` turns it into the next version, and its section becomes the
GitHub release notes ([DOCUMENTATION.md §17](docs/DOCUMENTATION.md#17-ci-versions--releases)).

## Unreleased

## 0.1.0 (2026-11-06)

The first tagged version: everything built so far, in web testing on app.jampacked.co.nz and
jampacked.co.nz.

### App (Android, iOS, web)
- Sign up with your main business and the programme it follows (NP1, NP2, NP3 or one you build), run
  several businesses from one account with a role in each, and invite staff by email.
- Goods inwards: supplier, vehicle and programme checks, then each item's temperature, batch, dates,
  condition and allergens, accepted or rejected. Barcode scanning, with Open Food Facts filling in
  products you haven't seen before. Anything entered once is picked or scanned after that.
- Stock by location, first expiring first: use, sell, dispatch, waste, adjust, move, hold and release,
  par levels, stocktakes, expiring stock, trace and one-tap recall.
- Production as its own tab (Kitchen, Production or Harvest, by business type): recipes, batches with
  their own batch codes and allergens, harvests from growing areas, production checks, planning with
  shortfalls, and voiding a batch recorded by mistake.
- Programme modules from MPI's National Programme 1, 2 and 3 guidance (Dec 2025 v2), narrowed to what
  the business does: the records each one needs with their limits, the Due list and the monthly
  self-check. Or a custom programme, reusable across your businesses.
- Audits that answer themselves from your records, corrective actions raised automatically, and
  temperature checks.
- Insights (7, 30 or 90 days) with how long everyday tasks take, and Help & support with step-by-step
  guides.
- Records kept 7 years: every change in the audit trail, nothing deleted (voided with a reason
  instead), and admins can export everything.
- Licences: a business without the licence its programme needs becomes read-only, once billing is
  switched on (`BILLING_ENFORCED`). Home says so.

### Website (jampacked.co.nz)
- Home, features, programme pages, pricing by programme with Stripe Payment Links, FAQ, the help guides
  with screenshots of the app, contact, and draft Terms, Privacy Policy and Cookies policy.
- The owner dashboard (`/admin`) for JamPacked staff.

### Behind the scenes
- A Stripe webhook keeps each business's licence in step with its subscription.
- Test accounts for every kind of business ([docs/test-accounts.md](docs/test-accounts.md)).
- CI on every pull request, and releases from version tags, with an optional deploy.
- A speed baseline for the backend and the live site ([docs/performance.md](docs/performance.md)).
