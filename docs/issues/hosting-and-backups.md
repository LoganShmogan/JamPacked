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
**Vercel**. loganserver stays for development / staging if wanted.

## To do
- [ ] Production and development Convex Cloud deployments; `npx convex deploy` to production
- [ ] Deploy keys in Vercel and CI; build the apps with the production URL as `CONVEX_URL`
- [ ] Confirm Convex Cloud's backup schedule and test a restore
- [ ] Decide where the data is stored and state it in the privacy policy (NZ Privacy Act 2020 allows
  offshore storage, but customers should be told where it is). Check which regions Convex Cloud offers.
- [ ] Copy the existing live data across (`npx convex export` from loganserver, `npx convex import` to cloud)
- [ ] Uptime monitoring / alerting for the website and backend

## Notes
- The apps don't store business data on the device, only the session token, so changing hosting only
  means changing `CONVEX_URL` (`app/lib/config.dart`) and rebuilding.
- Option not taken: staying self-hosted on loganserver would have needed scheduled off-server backups,
  tested restores, monitoring and a plan for disk, power and internet failures.
