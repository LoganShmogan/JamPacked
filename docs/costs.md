# Running costs

What JamPacked costs to run, as of 3 November 2026. Prices come from each provider's pricing page and
change from time to time, so check them again before upgrading. USD amounts are converted at roughly
NZ$1.70 = US$1.

## Summary

| | Now (building) | At launch | Notes |
|---|---|---|---|
| Convex (backend) | $0 | **US$25/mo** | Pro, for daily backups. Per developer |
| Clerk (sign-in) | $0 | $0 | Free up to 50,000 users |
| Cloudflare Pages (website + web app) | $0 | $0 | Free plan allows commercial use |
| Cloudflare DNS | $0 | $0 | Already in use |
| Google Workspace (email) | already paid | +$0 | JamPacked addresses are aliases/groups on Save Point's Workspace |
| Domain (jampacked.co.nz) | already paid | already paid | |
| Apple Developer | – | US$99/yr | About NZ$14/mo spread over the year |
| Google Play | – | US$25 once | |
| Stripe | ~4% of sales | ~4% of sales | No monthly fee |
| **Fixed total** | **$0** | **about US$25/mo + US$99/yr ≈ NZ$57/mo** | One NP2 monthly customer covers it |

## Stripe (NZ, NZD)

No monthly fee. Charged per payment:

| Fee | Rate |
|---|---|
| NZ card | 2.65% + 30c |
| Overseas card (e.g. Australian customers) | 3.5% + 30c |
| Stripe Billing (subscriptions) | +0.7% of billing volume |
| Stripe Tax (no-code, where we collect GST) | +0.5% |
| Currency conversion | +2%, only if a conversion happens (we charge in NZD, so usually not) |
| Payment Links, payouts | free (a custom checkout domain is US$10/mo; not needed) |
| Refunds | no fee, but the **original processing fee isn't returned** |
| Disputes (chargebacks) | $25 each |

What a sale costs, for an NZ card:

| Plan | Price | Stripe takes | You keep (before GST) |
|---|---|---|---|
| NP2 monthly | $50 | ~$2.23 (4.5%) | $41.25 |
| NP2 yearly | $500 | ~$19.55 (3.9%) | $415.23 |
| NP3 monthly | $100 | ~$4.15 | $82.81 |
| Custom yearly | $1,200 | ~$46.50 | $996.98 |

"You keep" = price less the 15% GST in it, less Stripe's fees. Stripe charges GST on its fees, which Save
Point claims back. A money-back refund costs us the original fee.

## Convex (USD)

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | 1M function calls/mo, 0.5 GB database, 1 GB bandwidth, 1 GB file storage, up to 6 developers. Overage: $2.20 per extra 1M calls, $0.22/GB storage, $0.132/GB bandwidth. **No daily backups** |
| **Professional** | **$25 per developer/mo** | 25M calls, 50 GB database, 50 GB bandwidth, 100 GB files, **daily backups** |
| Business | from $2,500/mo | Not needed |

**Plan:** Free while building. **Pro before real customers move across**, because the records are kept 7
years and need backups ([issues/hosting-and-backups.md](issues/hosting-and-backups.md)). Only people who
work on the code need to be developers on the team.

## Clerk (USD)

| Plan | Price | Includes |
|---|---|---|
| **Hobby** | **$0** | 50,000 retained users per app (a user counts once they come back a day or more after signing up), custom domain, up to 3 social logins, fixed 7-day sessions, 3 dashboard seats |
| Pro | $25/mo ($20/mo yearly) | Remove "Secured by Clerk", MFA, passkeys, custom session length, custom email templates |
| Extra users | $0.02 each/mo past 50,000 | |

**Plan:** Hobby at launch. Upgrade to Pro when we want MFA for admins or our own branding on sign-in
emails.

## Cloudflare (hosting + DNS)

The website (`web/`, Next.js `output: "export"`) and the Flutter web app (`app/build/web`) are both
static files, so **Cloudflare Pages** hosts them on the free plan:

- 500 builds/month, 1 build at a time, up to 20,000 files and 25 MiB per file per site, 100 custom
  domains per project, no bandwidth limit
- Two projects: `jampacked-site` → `jampacked.co.nz` (+ `www.`), `jampacked-app` → `app.jampacked.co.nz`
- DNS, SSL and the CDN are free and already in use

This replaces the plan to use Vercel. **Vercel's free Hobby plan doesn't allow commercial use**, so it would
have been Pro at about US$20/mo. Convex Cloud stays the backend, so Cloudflare only serves the front ends.
Moving off loganserver: see [issues/hosting-and-backups.md](issues/hosting-and-backups.md).

## Google Workspace

Save Point already pays for Workspace (Business Starter is NZ$12.60 per user/mo, or NZ$10.50 on a yearly
plan). Adding `jampacked.co.nz` as a domain and using **aliases and Google Groups** for the JamPacked
addresses costs nothing extra. A second paid user only if someone (e.g. Tim) needs to *send* from their own
JamPacked address. See [email-addresses.md](email-addresses.md).

Email the app sends (invites, alerts) later needs a transactional email service (e.g. Resend, which has a
free tier of a few thousand emails a month).

## Later, if needed

| Item | Cost | When |
|---|---|---|
| Convex Pro for a second developer | +US$25/mo | If Tim works on the code |
| Clerk Pro | US$20–25/mo | MFA, own branding |
| Workspace user for Tim | NZ$10.50–12.60/mo | If he sends as tim@jampacked |
| Transactional email | $0 to ~US$20/mo | Once the app sends its own email |
| PostHog (analytics) | free tier | [issues/analytics-tracking.md](issues/analytics-tracking.md) |
| Anthropic API (support chatbot) | per use | [issues/support-chatbot.md](issues/support-chatbot.md) |
| Professional indemnity + cyber insurance | quote needed | Before launch ([legal-research.md](legal-research.md) §7) |
| Lawyer review of the legal documents | quote needed | Before launch |

## Sources
[Stripe NZ pricing](https://stripe.com/nz/pricing) · [Convex pricing](https://www.convex.dev/pricing) ·
[Clerk pricing](https://clerk.com/pricing) · [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) ·
[Google Workspace NZ pricing](https://workspace.google.com/intl/en_nz/pricing)
