# NZSafetyHealthApp: food safety records for NZ & AU businesses

Mobile-first Flutter app (Android, iOS, web) with a Convex backend. Goods inwards is the core workflow:
every delivery you record feeds the audits, corrective actions, expiry alerts and recall tracing.

```
backend/   Convex functions + schema (TypeScript)
app/       Flutter app
```

## Run it locally

```bash
# 1. Backend: local Convex deployment (no account needed), serves http://127.0.0.1:3210
cd backend && npm install
CONVEX_AGENT_MODE=anonymous npx convex dev      # or `npx convex dev` to log in and use a cloud dev deployment

# 2. App (in another terminal)
cd app && flutter pub get
flutter run -d chrome                                                 # web
flutter run -d <android-device> --dart-define=CONVEX_URL=http://10.0.2.2:3210   # Android emulator
flutter run --dart-define=CONVEX_URL=https://<your-deployment>.convex.cloud     # cloud deployment
```

Create an account on the sign-in screen. **The first account becomes admin**; later sign-ups are `staff`
until an admin changes their role (More → Users).

## What's in it

| Area | What it does |
|---|---|
| **Goods inwards** | Supplier, invoice, vehicle check, then per item: barcode scan, batch/lot, use-by/best-before, probe temp, packaging/label checks, allergens, accept/reject. Live pass/fail against your temperature limits. |
| **Auto-fill** | Barcode → your product catalogue, then Open Food Facts (name, allergens, NOVA/ultra-processed group). Picking a supplier suggests what they usually deliver. New products are added to the catalogue automatically. |
| **Audits** | 4 templates (goods receipt, daily FCP check, monthly review, hygiene). Starting one pre-answers questions from goods inwards / temperature logs / corrective actions and shows the evidence. Sign-off locks the audit; "No" answers raise corrective actions. |
| **Corrective actions** | Raised automatically for rejected goods, out-of-range temps accepted, expired goods, unapproved suppliers, dirty vehicles, failed temp checks and audit findings. Close out with a resolution. |
| **Temperature checks** | Chillers, freezers, hot holding, cooking (≥75°C), cooling. Out-of-range readings require a corrective action. |
| **Trace & recall** | Search batch code / product / barcode → which deliveries, when, from whom, received by whom. |
| **Expiring stock** | Accepted items approaching or past use-by / best-before. |
| **Audit trail** | Every write (and sign-in, sign-out, failed sign-in) is logged with who, when, what and a field-level diff. No delete endpoints exist: records are **voided with a reason**, never removed. Completed audits are locked. |

### Compliance basis
Defaults follow NZ Food Act 2014 / MPI Food Control Plan and FSANZ Food Standards Code
(Std 3.2.2 cl.5 receiving, 3.2.2A record-keeping, 1.2.3 allergen declarations incl. PEAL):
chilled ≤5°C, hot ≥60°C, frozen received frozen hard (≤-15°C, configurable). Switch NZ/AU and adjust limits in
More → Business settings. The templates are a starting point; check them against your registered plan or
your verifier/EHO's expectations.

## Auth: development now, Clerk later
See `docs/DOCUMENTATION.md` for full documentation.

Accounts are local: passwords are hashed with PBKDF2-SHA256 (100k iterations, per-user salt) in Convex actions
(`backend/convex/lib/password.ts`), and sessions are random 256-bit tokens with a 7-day expiry. Every function takes
`sessionToken` and resolves the user via `requireUser` (`backend/convex/lib/session.ts`).

To move to Clerk:
1. Add `backend/convex/auth.config.ts` with your Clerk issuer domain and `applicationID: "convex"`.
2. Change `getUser` in `lib/session.ts` to use `ctx.auth.getUserIdentity()` and look users up by Clerk subject.
3. In Flutter, swap the login/register calls in `app/lib/services/auth_service.dart` for `clerk_flutter` sign-in
   and send the Clerk JWT. Screens only use `AuthService.user`/`token`, so they don't change.

## Notes on the Convex client
`app/lib/services/convex_client.dart` calls Convex's HTTP API, so it works on web, Android and iOS with no
native build steps. Screens refetch after any mutation and support pull-to-refresh. For live push updates
across devices you can swap in the `convex_flutter` package (WebSocket subscriptions), which needs a Rust
toolchain for mobile builds.
