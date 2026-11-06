# Hosting, backups & data location

**Priority:** High · **Status:** Decided, not started

## Problem
All data for every customer lives in one self-hosted Convex instance on loganserver (Docker volume
`foodsafe_convex-data`, reached through a Cloudflare tunnel; see
[DOCUMENTATION.md §14](../DOCUMENTATION.md#14-deployment-loganserver)).

- **Single machine:** if the server, its disk or its internet connection fails, every customer loses access.
- **Backups are manual:** the backup command in §14 only runs when someone runs it, and the archive is
  written to the same server.
- **Upload bandwidth is shared by everyone:** large downloads (e.g. exports, see
  [export-scalability.md](export-scalability.md)) slow the app down for all users.

## Why it matters
Businesses rely on the app to keep their food safety records for 7 years. Losing the volume means losing
records they're legally required to keep, and an outage stops them recording deliveries and temperatures.

## Decision
Production runs on **Convex Cloud** (database + functions) with the website and Flutter web build on
**Cloudflare Pages** (free plan, commercial use allowed; Vercel's free plan isn't, see [costs.md](../costs.md)). loganserver stays for development / staging if wanted.

## To do
- [ ] Production and development Convex Cloud deployments; `npx convex deploy` to production
- [ ] Convex deploy key in Cloudflare Pages and CI; build the apps with the production URL as `CONVEX_URL`
- [ ] Confirm Convex Cloud's backup schedule and test a restore
- [ ] Decide where the data is stored and state it in the privacy policy (NZ Privacy Act 2020 allows
  offshore storage, but customers should be told where it is). Check which regions Convex Cloud offers.
- [ ] Set the deployment's env vars there too (`backend/.env.example`), and move the Stripe webhook to
  `https://<deployment>.convex.site/stripe/webhook` (new signing secret)
- [ ] Copy the existing live data across (`npx convex export` from loganserver, `npx convex import` to cloud)
- [ ] Uptime monitoring / alerting for the website and backend

## Also on loganserver
- [ ] **The Convex image moved.** Convex now publishes the self-hosted backend as
  `ghcr.io/convex/convex-backend` (and the dashboard as `ghcr.io/convex/convex-dashboard`); the old
  `ghcr.io/get-convex/...` names that `deploy/docker-compose.yml` uses can't be pulled any more (found
  6 Nov 2026). loganserver keeps running its cached copy, but it can't be updated, and a rebuilt server
  couldn't start the backend. Fix: take a backup (§14), point `docker-compose.yml` at the new name **with
  a pinned version tag** (not `latest`, so a deploy never upgrades the database engine by surprise), and
  deploy. Moot once production is on Convex Cloud
- [x] Deploys from GitHub: `.github/workflows/release.yml` can run `deploy/deploy.sh` over Tailscale on
  every release, once its secrets are set ([DOCUMENTATION.md §17](../DOCUMENTATION.md#17-ci-versions--releases))

## Notes
- The apps don't store business data on the device, only the session token, so changing hosting only
  means changing `CONVEX_URL` (`app/lib/config.dart`) and rebuilding.
- Option not taken: staying self-hosted on loganserver would have needed scheduled off-server backups,
  tested restores, monitoring and a plan for disk, power and internet failures.
