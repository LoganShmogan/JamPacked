# Pre-launch audit, 13 Nov 2026

**Priority:** High · **Status:** Open

## Problem
A read through the backend, app, website, deploy and CI on 13 Nov 2026 (v0.1.0). All three test suites
pass at 100% coverage, `npm audit` is clean for the backend and website, and every business function
checks membership through `requireMember`. These are the things it found that weren't already in this
folder. Things already tracked (Clerk, backups, the Convex image, Android signing, growing queries) aren't
repeated here.

## Why it matters
The first two let a stranger in and leave us without our own accounts.

## To do
- [ ] **A platform admin login is published.** The live server holds the seeded test accounts, the
  repository is public, and it prints their password (`seed.ts`, DOCUMENTATION.md §14, test-accounts.md).
  `full@jampacked.test` is a platform admin, so anyone can sign in to `jampacked.co.nz/admin` (checked:
  it works). Only test data today. Before the first real sign-up: wipe the test accounts, remove
  `SEED_ALLOWED`, and make sure no `@jampacked.test` account is left
- [ ] **Logan and Tim have no platform admin account.** The seed on 2 Nov wiped every table, including the
  accounts made on 27 Oct; the server has only the 12 test accounts. Re-create them with
  `platform:createPlatformAdmin` (DOCUMENTATION.md §9), and note in §14 that the seed removes them
- [x] **A discounted payment could lose who paid.** `billing.ts` worked out the plan from the amount
  paid, so with a promotion code the checkout event had no plan. With a business on the Payment Link the
  later subscription event still filled it in; without one the event was ignored and the buyer's email and
  business name were lost, leaving nothing to match by hand. Fixed 13 Nov: the plan comes from
  `amount_subtotal`, the price before discounts
- [x] **No security headers.** Fixed 13 Nov: `deploy/security-headers.conf`, included from every server and
  location in `deploy/nginx.conf`, sends `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options: DENY` and `Referrer-Policy`. Cloudflare Pages will need the same as a `_headers` file
- [ ] **Failed sign-ins fill the audit log.** Each one writes a `login_failed` row with no business, with
  no limit on attempts, so guessing passwords also grows the database. Clerk's rate limiting ends it
  ([clerk-authentication.md](clerk-authentication.md)); don't take real customers before then
- [ ] **Expired sessions are never removed.** `sessions` only loses a row on sign-out. Goes away with
  Clerk; if Clerk slips, a daily cron that deletes expired rows
- [ ] **The phone apps keep the session token in `shared_preferences`**, which isn't encrypted storage.
  Use the platform keystore (Clerk's SDK does) before the store release
- [ ] **CI actions are pinned by tag, not commit.** The release workflow holds the deploy SSH key and the
  Tailscale secret; pin `subosito/flutter-action` and `tailscale/github-action` to a commit SHA before
  switching `DEPLOY_ENABLED` on

## Notes
- Checked and fine: Stripe webhook signature and replay window, out-of-order events, `inBusiness` on every
  id, the export being admin-only, barcode lookups validated before the request, no secrets in git, the
  owner dashboard returning no records.
- The owner dashboard shows business names, programme, member counts and last activity (for support) next
  to the task times. Task times themselves are totals across every business, so they say nothing about one
  business unless only one business did that task in the period.
