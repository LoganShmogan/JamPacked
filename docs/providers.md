# Outside providers

Every outside service JamPacked uses or plans to use: what it does, what data it sees, and where things
stand. The ones that handle personal information are also listed publicly in the Privacy Policy, from
`providers` in `web/src/lib/legal.ts`. Keep the two in step, and change the Privacy Policy's date
(`legalDocs.privacy.updated`) when that list changes. Costs: [costs.md](costs.md).

| Provider | What for | Personal information it sees | Status | Set up in |
|---|---|---|---|---|
| **Stripe** | Licence payments: Payment Links on `/store/`, receipts, refunds; a webhook keeps licences in step | Buyer's name, email, card (Stripe only), business name typed at checkout | **Live**: account, products, prices and the six Payment Links. Webhook built, not yet registered | `web/src/lib/site.ts`, `backend/convex/http.ts`, `billing.ts`, [billing-stripe.md](issues/billing-stripe.md) |
| **Convex** | The backend: database and functions | Everything: accounts, businesses, every record | **Self-hosted** on loganserver today (Save Point's own server). Convex Cloud decided, not set up | `deploy/`, `backend/.env.example`, [hosting-and-backups.md](issues/hosting-and-backups.md) |
| **Clerk** | Sign-in for the app and website (passwords, resets, Google / Apple sign-in) | Name, email, sign-in history | **Not set up.** Sign-in is the development system in `lib/password.ts` / `lib/session.ts` | `backend/.env.example`, `web/.env.example`, [clerk-authentication.md](issues/clerk-authentication.md) |
| **Cloudflare** | DNS for `jampacked.co.nz`, the tunnel to loganserver, caching | All traffic passes through it (encrypted to Cloudflare) | **Live** (DNS, tunnel). Cloudflare Pages for the website and web app decided, not set up | Cloudflare dashboard, [DOCUMENTATION.md §14](DOCUMENTATION.md#14-deployment-loganserver) |
| **Google Workspace** | Email (Save Point's: contact@ and support@savepoint.co.nz; JamPacked addresses to come) | Whatever people email us | **Live** | [email-addresses.md](email-addresses.md) |
| **Open Food Facts** | Filling in a product from its barcode | The barcode number only | **Live** | `backend/convex/products.ts` (`lookupBarcode`) |
| **PostHog** | Website page views (memory only, no cookies) | Pages visited, IP address | **Built, off** until `NEXT_PUBLIC_POSTHOG_KEY` is set | `web/src/components/Analytics.tsx`, [analytics-tracking.md](issues/analytics-tracking.md) |
| **Apple App Store / Google Play** | Delivering the phone apps | Download and device data, under their own policies | **Not yet**: apps not listed | [app-store-release.md](issues/app-store-release.md) |
| **Anthropic** | The support chatbot on `/help/` | What people type into the chat | **Planned**, not built | [support-chatbot.md](issues/support-chatbot.md) |
| **Email delivery service** | Sign-in and billing emails, if Clerk's and Stripe's own aren't enough | Name, email | **Not chosen** | [email-addresses.md](email-addresses.md) |
| **GitHub** | Hosts this repository (public) | None (code only, no customer data, no secrets) | **Live** | [SECURITY.md](../SECURITY.md) |
| **Vercel** | Was the plan for hosting the website | None | **Not used.** Its free plan doesn't allow commercial use, so Cloudflare Pages replaced it ([costs.md](costs.md)) | n/a |

## Before launch
- [ ] Decide where Convex Cloud stores data and say so in the Privacy Policy (the list says "United States")
- [ ] Have the provider list checked by the lawyer reviewing the legal documents ([legal-documents.md](issues/legal-documents.md))
- [ ] Move each "coming soon" provider out of `soon` in `web/src/lib/legal.ts` when it's switched on
