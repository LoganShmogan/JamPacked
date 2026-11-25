# Hosting, backups & data location

**Priority:** High · **Status:** Live on Convex Cloud + Cloudflare Pages since 26 Nov 2026; checks left below

## Problem
All data for every customer lives in one self-hosted Convex instance on loganserver (Docker volume
`foodsafe_convex-data`, reached through a Cloudflare tunnel; see
[DOCUMENTATION.md §14](../DOCUMENTATION.md#14-deployment)).

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
- [x] Production (Sydney, `adjoining-alligator-324`) and development (`insightful-dodo-192`) Convex Cloud
  deployments; functions deployed to production (26 Nov 2026)
- [x] `deploy/deploy.sh` builds both apps against production and uploads them to Cloudflare Pages; the
  release workflow runs it with a Convex deploy key and a Cloudflare token (DOCUMENTATION.md §14, §17)
- [x] Cloudflare: API token (`jampacked-pages`, Pages Edit only, **expires late Nov 2027**: roll it and update
  the GitHub secret), Pages projects `jampacked-site` / `jampacked-app`, custom domains, www redirect rule.
  First deploy done from the laptop 26 Nov 2026
- [x] GitHub: `production` environment (tags `v*` only) with `CONVEX_DEPLOY_KEY`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`; `DEPLOY_ENABLED=true`. The next version tag deploys itself (needs PR #10 merged)
- [ ] Confirm Convex Cloud's backup schedule and test a restore
- [ ] Decide where the data is stored and state it in the privacy policy (NZ Privacy Act 2020 allows
  offshore storage, but customers should be told where it is). Production is in Sydney (`aws-ap-southeast-2`).
- [ ] Stripe webhook on production: in progress, see [billing-stripe.md](billing-stripe.md). No other env
  vars are needed yet (`BILLING_ENFORCED` stays off, `SEED_ALLOWED` only for the demo logins)
- [x] Copy the existing live data across: not needed, loganserver only held seeded test accounts
- [ ] Uptime monitoring / alerting for the website and backend

## loganserver
- [ ] Stop the old JamPacked containers (`~/foodsafe`) and remove its Caddy routes. Not urgent: loganserver
  is offline and nothing points at it (tunnel hostnames and DNS records removed 26 Nov 2026).
  The deploy files for it (`docker-compose.yml`, `nginx.conf`) were deleted 26 Nov 2026; they are in git
  history if loganserver is ever wanted for staging.

## Notes
- The apps don't store business data on the device, only the session token, so changing hosting only
  means changing `CONVEX_URL` (`app/lib/config.dart`) and rebuilding.
- Option not taken: staying self-hosted on loganserver would have needed scheduled off-server backups,
  tested restores, monitoring and a plan for disk, power and internet failures.
