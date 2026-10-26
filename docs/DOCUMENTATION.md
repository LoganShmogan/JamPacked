# JamPacked: Technical & User Documentation

JamPacked, by Save Point Limited: food safety record-keeping for New Zealand and Australian food businesses. Mobile-first Flutter app
(Android, iOS, web) backed by Convex. **Goods inwards and stock are the core**: every delivery recorded
becomes stock you can rotate, use, dispatch, hold and recall, and feeds audits, corrective actions,
expiry alerts and tracing automatically. On top of that, each business follows a **programme module**
(MPI National Programme 1, 2 or 3, or a custom programme it builds) that decides which extra checks
and records the app asks for. One account can run several businesses.

Live: https://app.jampacked.co.nz

---

## Contents

1. [Concepts & workflow](#1-concepts--workflow)
2. [Architecture](#2-architecture)
3. [Repository layout](#3-repository-layout)
4. [Data model](#4-data-model)
5. [Backend (Convex) reference](#5-backend-convex-reference)
6. [Audit auto-fill engine](#6-audit-auto-fill-engine)
7. [Audit templates](#7-audit-templates)
8. [Compliance rules (NZ & AU)](#8-compliance-rules-nz--au)
9. [Authentication, roles & security](#9-authentication-roles--security)
10. [Audit trail, record integrity & 7-year retention](#10-audit-trail-record-integrity--7-year-retention)
11. [Flutter app reference](#11-flutter-app-reference)
12. [Screens: user guide](#12-screens-user-guide)
13. [Local development](#13-local-development)
14. [Deployment (loganserver)](#14-deployment-loganserver)
15. [Migrating to Clerk](#15-migrating-to-clerk)
16. [Known limitations & roadmap](#16-known-limitations--roadmap)

---

## 1. Concepts & workflow

```
 Sign up ─► your account + main business (programme: NP1 / NP2 / NP3 / custom, plus sectors)
            add more businesses later; each day pick the one you're working in
       │
       ▼
 GOODS INWARDS  ──► products catalogue (auto-created / barcode lookup)
 (per item: temp, batch,        │
  dates, condition, allergens,  ├──► STOCK LOTS (put away to a location)
  accept / reject; plus the     │      use · sell · dispatch · waste · adjust · move · hold
  programme's receiving checks) │      FIFO / expiry alerts · par levels · stocktakes · recall
       │                        ├──► CORRECTIVE ACTIONS (auto-raised on problems)
       │                        └──► TRACE & RECALL (one step back and one step forward)
       ▼
 PROGRAMME: "Due" list ─► records (pest checks, calibration, mock recall, cooking, pH...)
                         ─► checklists (self-check) and the built-in audits
       │
       ▼
 AUDITS pre-answer themselves from goods inwards, stock, temperatures, records and CAs
       │
       ▼
 AUDIT TRAIL records every action: who, what, when, field-level changes. Kept 7 years; nothing is deleted.
```

| Term | Meaning |
|---|---|
| **Business** | One site/company. Everything below belongs to exactly one business. |
| **Membership** | A user's role (admin / manager / staff) in one business. One person can be in several. |
| **Programme** | What the business follows: NP1, NP2 or NP3 (built in, from MPI's Dec 2025 guidance) or a custom programme. Sectors narrow it (e.g. NP2 ECE). |
| **Delivery** | One drop-off from one supplier (header: supplier, invoice, vehicle check, programme checks). |
| **Delivery item** | One product line on a delivery, checked individually and accepted or rejected. |
| **Stock lot** | What an accepted delivery item becomes: quantity on hand, batch, dates, location, status (available / hold / depleted). |
| **Movement** | Any change to a lot (receive, use, sell, dispatch, waste, adjust, stocktake, transfer, hold, release, void). Append-only. |
| **Record** | A programme record such as a pest check or mock recall. Fields come from the programme; answers outside limits raise CAs. |
| **Corrective action (CA)** | A recorded non-conformance and how it was resolved. Open → closed with a resolution. |
| **Audit** | A filled-in copy of a template or programme checklist covering a time period. In progress → completed (locked). |
| **Fact** | A value computed from records (e.g. "all deliveries in range?") used to auto-answer audit questions. |
| **Void** | The only way to "remove" a record. It stays in the database flagged void, with a reason, in the audit trail. |

## 2. Architecture

```
 ┌──────────────── Flutter app (web / Android / iOS) ───────────────┐
 │ screens ─► context.q / m / a ─► ConvexClient (HTTP JSON)        │
 │ AuthService: session token + business chosen for today           │
 └──────────────────────────────┬───────────────────────────────────┘
                                │  POST /api/query | /api/mutation | /api/action
                                ▼
 ┌──────────────────────── Convex backend ──────────────────────────┐
 │ queries (read) · mutations (transactional writes) · actions      │
 │ (password hashing, Open Food Facts fetch)                         │
 │ Every business function: requireMember(token, businessId) → ... │
 │ → logAudit(businessId, ...)                                      │
 └──────────────────────────────────────────────────────────────────┘
```

- **Why the HTTP API, not WebSockets?** It works identically on web, Android and iOS with zero native
  build requirements. Live reactivity is approximated: any successful mutation/action bumps
  `ConvexClient.changes`, and every mounted `QueryBuilder` refetches. Pull-to-refresh is on every list.
  Changes made on *another* device appear on refresh or the next local mutation.
- **Business logic lives server-side.** Temperature compliance, delivery status, auto-raised CAs, audit
  scoring and auto-fill are all computed in Convex so they can't be bypassed by a client.
  The item editor mirrors the temperature rule client-side only for instant feedback.

---

## 3. Repository layout

```
NZSafetyHealthApp/
├── README.md                    Quick start
├── docs/DOCUMENTATION.md        This file
├── docs/TESTING.md              Unit tests: running, structure, helpers, coverage
├── backend/                     Convex project (TypeScript)
│   ├── package.json             scripts: dev, deploy, typecheck, test, test:coverage
│   ├── vitest.config.mts        Test runner + 100% coverage thresholds
│   ├── tests/                   Vitest + convex-test unit tests (see docs/TESTING.md)
│   └── convex/
│       ├── schema.ts            Tables, indexes, shared validators
│       ├── auth.ts              Register (account + main business) / login / logout / me
│       ├── businesses.ts        Programme catalogue, my businesses, add, archive, members, invites
│       ├── settings.ts          The current business's settings and programme
│       ├── suppliers.ts         Approved supplier list
│       ├── products.ts          Product catalogue, par levels, barcode lookup (Open Food Facts)
│       ├── deliveries.ts        Goods inwards (creates stock lots), void, trace
│       ├── stock.ts             On hand, lot history, movements, hold/release, recall, low stock, expiring
│       ├── locations.ts         Chillers, freezers, dry store...
│       ├── stocktakes.ts        Count, correct, flag variances
│       ├── programmes.ts        The business's programme module and its "Due" list
│       ├── records.ts           Programme records (pest checks, calibration, mock recall...)
│       ├── customProgrammes.ts  Build, edit and reuse your own programmes
│       ├── temperature.ts       Temperature checks
│       ├── correctiveActions.ts Corrective actions
│       ├── audits.ts            Start / answer / refresh / complete audits
│       ├── auditLog.ts          Read-only audit trail
│       ├── dashboard.ts         Home screen summary
│       ├── exportData.ts        Admin export of every record a business has
│       ├── platform.ts          Owner dashboard numbers (platform admins only)
│       ├── migrations.ts        One-off: single-business install → multi-business
│       ├── lib/
│       │   ├── session.ts       requireUser / requireMember / requirePlatformAdmin / inBusiness
│       │   ├── business.ts      createBusiness, sector checks
│       │   ├── programmes.ts    NP1/NP2/NP3 catalogue and modules (from the MPI guides)
│       │   ├── module.ts        Load a business's module (built-in or custom)
│       │   ├── stock.ts         recordMovement, createLot, FIFO, below-par
│       │   ├── retention.ts     RETENTION_YEARS = 7
│       │   ├── password.ts      PBKDF2 hashing, random tokens
│       │   ├── audit.ts         logAudit() + diff()
│       │   ├── settings.ts      Default limits, temperature compliance rules
│       │   ├── templates.ts     Built-in audit templates
│       │   └── facts.ts         Auto-fill fact engine
│       └── _generated/          Convex codegen (committed, do not edit)
├── app/                         Flutter app
│   ├── pubspec.yaml
│   ├── test/                    Unit & widget tests (see docs/TESTING.md)
│   ├── tool/check_coverage.dart Fails unless line coverage is 100%
│   └── lib/
│       ├── main.dart            Providers, MaterialApp, auth gate (sign in → business → app)
│       ├── config.dart          CONVEX_URL (dart-define)
│       ├── theme.dart           Jam colours from the logo + colour tokens
│       ├── services/
│       │   ├── convex_client.dart
│       │   └── auth_service.dart  Session, businesses, today's business
│       ├── widgets/
│       │   ├── common.dart      QueryBuilder, Pill, helpers, constants
│       │   ├── business_form.dart  Name, programme cards, sectors
│       │   └── audit_history.dart
│       └── screens/             One file per screen (see §11)
├── web/                         Website: jampacked.co.nz (Next.js, static export to web/out/)
│   ├── next.config.ts           output: "export", so nginx (or Vercel) serves plain files
│   └── src/
│       ├── app/page.tsx         Landing page: features, programmes, FAQ
│       ├── app/admin/page.tsx   Owner dashboard (platform admins only)
│       ├── lib/site.ts          Company details, contact email, URLs
│       ├── lib/convex.ts        Convex client + the backend functions the site calls
│       └── components/Analytics.tsx  PostHog page views (off unless a key is set)
└── deploy/
    ├── docker-compose.yml       Self-hosted Convex + nginx
    ├── nginx.conf               Serves the website and the web app by hostname, proxies /api to Convex
    └── deploy.sh                One-command build & deploy
```

## 4. Data model

Defined in `backend/convex/schema.ts`. All timestamps are **milliseconds since epoch (UTC)**.
Every document also has Convex's `_id` and `_creationTime`.

**Every record table has `businessId`**, and every index starts with it (`by_business_...`), so one
business can never read another's data. `businessId` is declared optional only so data from before the
multi-business change still validates until `migrations:toMultiBusiness` has run (§14); every write sets it.

### Accounts and businesses
| Table | Fields | Notes |
|---|---|---|
| `users` | `email` (unique, `by_email`), `name`, `passwordHash`, `passwordSalt`, `active`, `createdAt`, legacy `role?` | Roles now live on memberships. |
| `sessions` | `userId`, `token` (`by_token`), `expiresAt` (7 days) | Deleted on logout (the only delete in the backend). |
| `businesses` | `name`, `jurisdiction` (NZ/AU), `region?` (NZ region or AU state, `lib/regions.ts`; asked for at sign-up, unset on older businesses), `registrationNumber?`, `address?`, `chilledMaxC` (5), `frozenMaxC` (-15), `hotMinC` (60), `expiryWarningDays` (3), `programme` (NP1/NP2/NP3/custom), `customProgrammeId?`, `sectors[]`, `ownerId`, `archived`, `createdAt` | Replaces the old single-row `settings` table (kept only for the migration). Archived, never deleted. |
| `memberships` | `userId`, `businessId`, `role` (admin/manager/staff), `active`, `createdAt` | `by_user`, `by_business`, `by_user_business`. |
| `invites` | `businessId`, `email`, `role`, `invitedByName`, `createdAt`, `acceptedAt?` | Claimed when that email signs up. |
| `customProgrammes` | `ownerId`, `name`, `description?`, `dailyChilledCheck`, `receivingPrompts[]`, `recordTypes[]`, `templates[]`, timestamps | Owned by a user, usable by any business they administer. |

### Receiving
- `suppliers`: `name`, `contactName?`, `phone?`, `email?`, `address?`, `registrationNumber?`, `approved`,
  `approvalNotes?`, `active`, `createdAt`.
- `products`: `name`, `brand?`, `barcode?`, `storageType` (chilled/frozen/hot/ambient), `allergens[]`,
  `ingredients?`, `novaGroup?`, `imageUrl?`, `defaultSupplierId?`, **`parLevel?`, `reorderQty?`**, `active`,
  `createdAt`. Created manually or **automatically on first delivery**.
- `deliveries`: `receivedAt`, `supplierId`, `supplierName`, `supplierApproved` (snapshot), `invoiceNumber?`,
  `vehicleClean`, `vehicleTempC?`, `notes?`, **`programmeAnswers?`** (`{key, text, value: true/false/null}`),
  `status` (accepted/partial/rejected), `receivedById/Name`, `voided`, `voidReason?`.
- `deliveryItems`: `deliveryId`, `receivedAt`, `supplierId`, `productId?`, `productName`, `barcode?`,
  `batchCode?`, `quantity`, `unit`, `useBy?`, `bestBefore?`, `storageType`, `temperatureC?`,
  `temperatureCompliant` (true/false/null for ambient), `packagingOk`, `labelOk`, `allergens[]`, `accepted`,
  `rejectionReason?`, `voided`.

### Stock
| Table | Fields | Notes |
|---|---|---|
| `locations` | `name`, `kind` (chiller/freezer/dry/display/other), `active` | Retired, not deleted. |
| `stockLots` | `productId?`, `productName`, `barcode?`, `deliveryId?`, `deliveryItemId?`, `supplierName?`, `batchCode?`, `useBy?`, `bestBefore?`, `locationId?`, `storageType`, `unit`, `qtyReceived`, `qtyOnHand`, `status` (available/hold/depleted), `holdReason?`, `receivedAt` | One per accepted delivery line, or opening stock. |
| `stockMovements` | `lotId`, `productName`, `type`, `qty` (signed change), `qtyAfter`, `reason?`, `customer?` (dispatch), `toLocationId?`, `at`, `byId/Name` | Append-only: a lot's movements always add up to what is on hand. |
| `stocktakes` | `locationId?`, `title`, `status`, `startedAt/ByName`, `completedAt?/ByName?`, `lines[]` (`lotId, productName, batchCode?, unit, expected, counted`) | |

### Checks and records
- `temperatureLogs`: `checkedAt`, `unitName`, `unitType` (chiller/freezer/hot_hold/cooking/cooling),
  `temperatureC`, `compliant`, `correctiveAction?`, `checkedById/Name`.
- `records`: `programme`, `recordType`, `recordName`, `values` (field key → answer), `issues[]` (limits
  it failed), `at`, `byId/Name`, `voided`, `voidReason?`. One table for every programme record type.
- `audits`: `templateKey`, `templateName`, `standardRef`, `title`, `periodStart/End`, `tzOffsetMinutes?`,
  `status`, `started*/completed*`, `score`, `answers[]`. Questions are **copied into the audit**, so later
  template or programme changes never alter past audits.
- `correctiveActions`: `title`, `description?`, `source` (goods_inward/temperature/audit/stock/record/manual),
  `sourceId?`, `severity`, `status`, `raised*`, `closed*`, `resolution?`.
- `auditLog`: `businessId?` (absent only for account events: register, sign-in, sign-out), `at`, `userId?`,
  `userName`, `action`, `entityType`, `entityId?`, `summary`, `changes?`.

## 5. Backend (Convex) reference

Function names are `module:function`. **Business-scoped functions take `sessionToken` and `businessId`**
(the app adds both to every call); they start with `requireMember`, which rejects anyone who isn't an active
member of that business, and every record fetched by id is checked with `inBusiness` so ids from another
business behave as "not found". User-level functions (sign-in, my businesses, my custom programmes) take
only `sessionToken`. Errors meant for users are `ConvexError("message")`, shown as a red snackbar.

Role legend (role **in that business**): **any** = any member, **mgr** = admin or manager, **admin**.

### `auth` (user-level)
| Function | Role | Description |
|---|---|---|
| `register(email, name, password, business?)` | public | Creates the account and its main business (`{name, programme, sectors?, jurisdiction?, ...}`), making the creator admin. Without `business`, only works if the email has pending invites, which are claimed. |
| `login(email, password)` | public | Constant-time hash check; logs `login` / `login_failed`. Returns `{token}`. |
| `logout()`, `me()` | user | `me` returns `{_id, email, name}`. |

### `businesses`
| Function | Role | Description |
|---|---|---|
| `programmes()` | public | NP1/NP2/NP3: name, risk, "use this if you...", sectors. Shown at sign-up. |
| `regions()` | public | NZ regions and AU states, per country. Shown at sign-up and in settings. |
| `mine()` | user | The business picker: each active membership with programme, role, archived flag and open CA count. |
| `create(name, programme, sectors?, jurisdiction?, region?, ...)` | user | Add another business; you become its admin. The region must be one of its country's. |
| `setArchived(archived)` | admin | Hide/restore a business. Nothing is deleted. |
| `members()` | mgr | Members with their role here, plus pending invites. |
| `invite(email, role)` | admin | Adds an existing user straight away (or reactivates them); otherwise stores an invite. |
| `updateMember(userId, role?, active?)` | admin | Can't change yourself. |

### `settings`
`get()` (any) returns the business (as `businessName`, limits, programme, sectors, archived...).
`update(...)` (admin): details, limits, `jurisdiction`, `region`, `programme`, `sectors`. Sectors must
belong to the programme; switching programme clears the old programme's sectors. The region must be one
of the country's, and changing country needs a new region if one was set.

### Receiving
| Function | Role | Description |
|---|---|---|
| `suppliers:list/get/create/update` | any / mgr to change | As before, scoped to the business. |
| `products:list/byBarcode/create` | any | |
| `products:update(id, ..., parLevel?, reorderQty?)` | mgr | |
| `products:lookupBarcode(barcode)` | any | Open Food Facts lookup. |
| `deliveries:create(supplierId, ..., programmeAnswers?, items[] (each with optional locationId))` | any | See below. |
| `deliveries:voidDelivery(id, reason)` | mgr | Voids the delivery and its items, and takes any remaining stock out (`void` movement). |
| `deliveries:updateNotes`, `list`, `get`, `suggestionsForSupplier` | any | |
| `deliveries:trace(search)` | any | Receipts matching batch/product/barcode, each with its lot: what's left and who it was dispatched to. |

**`deliveries:create`, in order:** validate (items, rejection reasons, supplier and locations belong to
the business, receiving-check keys belong to the programme) → status → insert delivery (with the
programme answers and their text) → per item: find/create product, compute temperature compliance, insert,
**create a stock lot for accepted items**, raise CAs (accepted out of temp: high; accepted past use-by: high;
rejected: medium) → CA per receiving check answered "No" (medium), unapproved supplier (medium), dirty
vehicle (low) → one audit-log entry.

### `stock`, `locations`, `stocktakes`
| Function | Role | Description |
|---|---|---|
| `stock:onHand(locationId?)` | any | Available + held lots, first-expiring first, with location name and `expired` / `expiringSoon`. |
| `stock:lot(id)` | any | Lot, its movements (newest first) and location. |
| `stock:move(lotId, type, qty, reason?, customer?)` | any | `use`/`sell`/`dispatch`/`waste` take stock out; `adjust` is signed. Waste and adjust need a reason, dispatch a customer. Held or past-use-by stock can only be wasted. |
| `stock:transfer(lotId, locationId)` | any | |
| `stock:hold(lotId, reason)` | any | Quarantine. |
| `stock:release(lotId, reason)` | mgr | |
| `stock:addLot(...)` | mgr | Opening stock / stock without a goods-inwards record. |
| `stock:lowStock()` | any | Active products whose available stock is below `parLevel`. |
| `stock:expiring()` | any | On-hand lots within the warning window or past date. |
| `stock:recall(lotIds, reason)` | mgr | Holds every available lot listed and raises one high CA ("Recall: ..."). |
| `locations:list/create/update` | any / mgr to change | |
| `stocktakes:list/get` | any | |
| `stocktakes:start(locationId?)` | mgr | Snapshots on-hand lots (everywhere or one location). |
| `stocktakes:count(id, lotId, counted)` | any | |
| `stocktakes:complete(id)` | mgr | All lines counted → each lot corrected to its count (against what is on hand *now*, so stock used mid-count isn't double counted). Lines off by ≥1 and ≥10% raise one low CA. Locks. |

### Programmes and records
| Function | Role | Description |
|---|---|---|
| `programmes:current()` | any | The business's module trimmed to its sectors: receiving prompts, record types, checklists (summaries), schedule, sector labels, custom programme id and whether you own it. |
| `programmes:due(dayStart?)` | any | Each schedule item with `done` and `lastAt` for its period (daily = the caller's local day; weekly/monthly/yearly = last 7/30/365 days). Satisfied by a record of that type, a completed audit of that checklist, or a chiller/freezer temperature check. |
| `records:list(recordType?, limit?)` | any | |
| `records:create(recordType, values)` | any | Checks the type is in the programme, required fields and answer kinds; trims text; each limit failed is listed in `issues` and raises a medium CA. |
| `records:voidRecord(id, reason)` | mgr | |
| `customProgrammes:mine()`, `get(id)` | user (owner) | |
| `customProgrammes:create(name, copyFrom?, businessId?)` | user (admin of `businessId` if given) | Blank or a copy of NP1/2/3 (sector tags dropped, checklist keys prefixed `custom_`); optionally put straight onto the business. |
| `customProgrammes:update(id, ...)` | owner | Validated: unique keys, names, ≥1 field per record and question per checklist, no clash with built-in audit keys. |
| `customProgrammes:useForBusiness(id)` | admin + owner | |

### Other modules
- `temperature:record/list/units` (any); rules in `lib/settings.ts → unitCompliant`.
- `correctiveActions:list/create/close` (any).
- `audits:templates/list/get/start/answer/refreshAutoFill/complete` (any). Templates are the built-in ones
  plus the programme's checklists. If a programme change removes an in-progress audit's checklist, refresh
  leaves its answers alone.
- `auditLog:list(...)`: entity history for any member; the full trail for mgr. Rows from other businesses
  are never returned.
- `dashboard:summary(dayStart?)`: today's deliveries/temps, CAs, expiring, plus `stockLines`, `onHold`,
  `lowStock`, `programme`.
- `exportData:manifest()`, `exportData:page(table, paginationOpts)` (admin): see §10.
- `migrations:toMultiBusiness(programme, sectors?)` (internal): see §14.
- `platform:overview()` (platform admin): users, businesses (active in the last 7/30 days, by programme,
  and by country then region), sign-ups per week for 12 weeks, and a per-business list (members, last activity) for
  support. Counts only, never a business's records. Activity is the newest audit log row per business.
- `platform:setPlatformAdmin(email, platformAdmin)`, `platform:createPlatformAdmin(email, name, password)` (internal): see §9.
- `platform:setBusinessRegion(businessId, region)` (internal): fill in the region of a business created
  before regions were asked for.

## 6. Audit auto-fill engine

`backend/convex/lib/facts.ts → computeFacts(ctx, business, start, end, tz)` reads non-void records in the period
and returns `{ [key]: { value, evidence } }`. A question with `autoFill: "<key>"` takes that value.
If the value is `null` (e.g. no deliveries that period) the question is left for a human, with the
evidence explaining why ("No deliveries recorded in this period").

| Key | Type | Value | Evidence example |
|---|---|---|---|
| `gi.count` | number | Deliveries in period | "4 deliveries, 11 line items (1 rejected)" |
| `gi.allApprovedSuppliers` | yes/no | No delivery from an unapproved supplier (snapshot) | "Unapproved: Bob's Veg" |
| `gi.tempChecked` | yes/no | Every chilled/frozen/hot item has a reading | "Missing: Milk 2L" |
| `gi.tempCompliant` | yes/no | No **accepted** item out of range | "Out of range: Chicken 7°C" |
| `gi.packagingLabels` | yes/no | All accepted items packaging & label OK | |
| `gi.noExpiredAccepted` | yes/no | No accepted item past use-by on receipt | |
| `gi.traceable` | yes/no | All accepted items have batch + a date mark | "Missing batch/date: Bread" |
| `gi.vehiclesClean` | yes/no | All vehicles clean | |
| `gi.rejectionsHandled` | yes/no | Every rejected item has a reason | Lists rejections |
| `gi.rejectionRate` | number | % of line items rejected | "1 of 11 line items rejected" |
| `gi.allergens` | text | Allergens on accepted goods | "egg, milk, sesame" |
| `stock.noExpired` | yes/no | No lot on hand is past its use-by | |
| `stock.noneOnHold` | yes/no | Nothing on hold awaiting a decision | Lists held lots and reasons |
| `stock.stocktakeDone` | yes/no | A stocktake was completed in the period | "1 stocktake(s) completed, last 2026-10-20" |
| `records.mockRecall` | yes/no | A mock recall recorded in the last 12 months | |
| `records.noPests` | yes/no | Pest checks in the period found nothing (null if none done) | Dates pests were found |
| `records.calibrated` | yes/no | Thermometer checked in the last 3 months | |
| `records.training` | yes/no | Training recorded in the last 12 months | |
| `records.issuesHandled` | yes/no | Every record that flagged a problem this period has its CA closed | |
| `temp.count` | number | Temperature checks in period | |
| `temp.compliant` | yes/no | All checks within limits | Lists out-of-range + actions |
| `temp.daily` | yes/no | At least one check every local day in period | "No checks on: 2026-10-09" |
| `ca.allClosed` | yes/no | No open corrective actions (any date) | Lists open CAs |

Evidence lists show up to 5 entries then "(+N more)".

**Adding a fact:** add a key to the object returned by `computeFacts`, then reference it with
`autoFill: "your.key"` in a template question.

---

## 7. Audit templates

Defined in `backend/convex/lib/templates.ts` (code, version-controlled). Each has `key`, `name`,
`description`, `standardRef`, `defaultPeriodDays`, `questions[]` (`id, section, text,
type: yesno|number|text, autoFill?, guidance?`).

| Key | Name | Period | Questions (auto) | Standard basis |
|---|---|---|---|---|
| `goods_receipt` | Goods Receipt & Supplier Verification | 7 days | 11 (10) | MPI FCP "Buying & receiving"; FSANZ 3.2.2 cl.5 & 12; 3.2.2A |
| `daily_check` | Daily Food Safety Check | today | 10 (5) | MPI FCP Diary; FSANZ 3.2.2 cl.4; 3.2.2A |
| `monthly_review` | Monthly Food Safety Review | 30 days | 13 (10) | MPI FCP "Checking for problems"; FSANZ 3.2.2A |
| `hygiene` | Cleaning, Pest & Personal Hygiene | today | 9 (0) | MPI FCP cleaning/pests; FSANZ 3.2.2 cl.13–24, 3.2.3 |

Each business also gets its **programme's checklists** (the NP self-check, or a custom programme's own),
listed after these. See §8.

**Writing questions:** phrase yes/no questions so **"Yes" = compliant** (scoring and CA-raising rely on it).

**Adding a template:** append to `TEMPLATES` and deploy. It appears in the app automatically. Keep
existing `key`/question `id`s stable, because `refreshAutoFill` matches on them.

---

## 8. Programmes & compliance rules

### Choosing a programme
At sign-up (and later under **Your programme → Change programme**, admins only) a business picks:

| Programme | For (from MPI's guidance, Dec 2025 v2) | Sectors that change the rules |
|---|---|---|
| **NP1** (lowest risk) | Honey, horticulture, sugar/syrups, hot drinks + packaged shelf-stable food, packaged ice cream, storage/transport only | honey (tutin records and receiving check), transport (transport temperature records) |
| **NP2** (low-medium) | Bread, cereals, snacks, spreads, confectionery, ice, frozen/dried produce, chilled/frozen retail, nuts & seeds, ECE / Kōhanga Reo | ECE and chilled/frozen retail don't need sickness or transport records; chilled/frozen retail skip the process-control questions |
| **NP3** (medium) | Brewing/distilling, non-alcoholic drinks, oils & fats, additives, grain, herbs & spices, retail food handling, dry mixes | retail food handling adds the reheating question |
| **Custom** | Anything else (Food Control Plans, AU businesses, your own rules) | none: you build it |

### What a module contains (`backend/convex/lib/programmes.ts`)
- **Receiving prompts**: extra yes / no / N/A checks on every delivery ("Someone was there to receive it",
  "Chilled first, then frozen, then ambient", "Allergen info on file", NP1 honey: tutin declaration).
  "No" raises a medium CA.
- **Record types**: field lists with limits. Every NP: pest check (weekly), thermometer check (monthly,
  ice slurry within ±1°C), maintenance, staff training, mock recall (yearly), self-supply water test,
  customer complaint. Then by programme: sickness, transport temperature, cooking (69-75°C time/temperature
  combinations), cooling (21°C in 2 h, 5°C in 6 h), reheating (75°C), water activity (< 0.85), pH (≤ 4.6),
  tutin. Each `failIf` limit raises a CA.
- **Checklists**: the NP self-check (monthly), built from "Checking the programme is working well" and each
  card's "Show" section, auto-filled from facts (§6).
- **Schedule**: drives the **Due** list: daily chilled check (any chiller/freezer temperature log),
  weekly pest check, monthly thermometer check and self-check, yearly mock recall.

Items tagged `sectors` only apply to businesses in one of those sectors; `excludeSectors` are exempt.
`moduleFor(key, sectors)` returns the trimmed module.

### Custom programmes
Built in the app (**Your programme → Build your programme**): start blank or copy NP1/2/3, then edit the
receiving checks, record types (fields: yes/no, number, text, date; problem when yes/no, or above/below a
number) with how often each is due, and checklists. A daily chilled check can be switched on. Keys never
change once created, so records stay linked if things are renamed. Owned by the user who made it and
reusable across their businesses; editing it changes what every business using it asks for (records
already kept are untouched).

### How the app meets the rules
| Requirement | How the app meets it |
|---|---|
| Trusted suppliers (NP "Sourcing, receiving and tracing"; FSANZ 3.2.2 cl.5) | Approved supplier list; approval snapshot on each delivery; CA if unapproved. |
| Check deliveries: temperature (≤5°C / >60°C / frozen), packaging, use-by | Per-item checks with live pass/fail; server-side compliance; CAs. |
| Records of what was received (type, quantity, date, chilled temperature) | Every delivery line; batch and date marks for batch-level recall. |
| Who you sold/delivered to (unless the final consumer) | `dispatch` movements record the customer; trace shows them. |
| Test tracing every 12 months | Mock recall record (yearly on the Due list); `records.mockRecall` fact. |
| Recall: identify, separate (HOLD), tell the supplier/verifier | Trace → **Recall** holds all matching stock and raises a high CA with the steps. |
| Use-by rotation; nothing used past use-by | FIFO on hand, expiring alerts, past-use-by stock can only be wasted. |
| Daily check that chilled food is ≤5°C | Temperature checks; daily item on the Due list. |
| Records of pests, maintenance, training, sickness, process controls | Programme record types with limits and CAs. |
| Allergens (FSANZ 1.2.3 / PEAL) | Per-item allergen capture; allergens-received audit answer. |
| Taking action when something goes wrong | Auto-raised CAs from every source; close-out needs a resolution. |
| Keep records (NP: 4 years) | Kept **7 years**, never deleted (§10). |

Limits are configurable in **Business settings**. The defaults and modules are a starting point. Confirm
them against your registration and your verifier's expectations.

## 9. Authentication, roles & security

**Development auth (current):**
- Passwords: PBKDF2-SHA256, 100,000 iterations, 16-byte random salt per user, 256-bit derived key,
  computed in Convex **actions** via Web Crypto. Plain-text passwords are never stored or logged.
- Comparison is constant-time.
- Sessions: 32 random bytes (hex), 7-day expiry, stored in `sessions`; the app keeps the token in
  `shared_preferences` (localStorage on web).
- Every public function resolves the user from the token; business functions also require an active
  membership of that business (`requireMember`). Inactive users, removed members and expired sessions are
  rejected, and ids from another business are "not found" (`inBusiness`).
- Failed sign-ins are logged (`login_failed`) with the attempted email.

**Roles are per business** (a membership): someone can be admin of their own café and staff at another.
Sign-up makes you admin of the business you create; admins add people under **More → Members** (an
existing account is added at once, a new email becomes an invite claimed when they sign up).

**Roles:**

| Capability | staff | manager | admin |
|---|:-:|:-:|:-:|
| Record deliveries, temps, audits, CAs, programme records | ✓ | ✓ | ✓ |
| Move stock (use, sell, dispatch, waste, move), put on hold, count stocktakes | ✓ | ✓ | ✓ |
| Add/edit suppliers, edit products & par levels, manage locations | | ✓ | ✓ |
| Release holds, adjust stock, add opening stock, start/complete stocktakes, recall | | ✓ | ✓ |
| Void deliveries and records | | ✓ | ✓ |
| View full audit trail & members | | ✓ | ✓ |
| Invite, change roles / remove members | | | ✓ |
| Business settings, change programme, build custom programmes, archive, export | | | ✓ |

**Platform admins** are JamPacked's own staff, not a business role: `users.platformAdmin` lets someone
see the owner dashboard (`jampacked.co.nz/admin`, `platform:overview`). It can't be set from the apps;
grant it from the CLI with the internal mutation (on the live server, through the same tunnel as §14's
migration):
```bash
npx convex run platform:setPlatformAdmin '{"email":"you@example.com","platformAdmin":true}'
```
Someone with no account yet (sign-up needs a business) gets one with the dashboard already on:
```bash
npx convex run platform:createPlatformAdmin '{"email":"…","name":"…","password":"…"}'
```

**Known gaps (acceptable for dev, fix before real use):** open registration (anyone with the URL can
create an account and a business of their own); no rate limiting on login; no password reset. Clerk (§15) resolves these.

---

## 10. Audit trail, record integrity & 7-year retention

- `logAudit()` is called by **every** mutation after it writes, tagged with the business. Entries contain
  user, time, action, entity, a readable summary and `changes` (field diffs or the create payload).
- **Records are kept for at least 7 years** (`lib/retention.ts → RETENTION_YEARS`; MPI requires 4). In
  practice nothing is ever removed:
  - there are **no delete endpoints** for records; deliveries and programme records are **voided** with a
    reason, locations retired, members removed (membership deactivated), businesses **archived**;
  - stock changes are **append-only movements**; completed audits and stocktakes are locked;
  - the only `db.delete` in the backend is the session on sign-out. A test (`tests/retention.test.ts`)
    scans the backend source and fails if any other delete or replace appears.
- Detail screens show **"Kept until"** (7 years after the record was made).
- **Export** (More → Export records, admin): pages through every table with a `businessId` (a test checks
  none is missed) and saves one JSON file with the business, retention period and all rows, via the share
  sheet on mobile or a download on web.
- Supplier approval is snapshotted on each delivery so later changes don't rewrite history.
- Where to see it: **More → Audit trail**, plus "Record history" on delivery, supplier and audit screens and
  the movement history on every stock lot.

Note: a Convex admin (dashboard / admin key) can still edit data directly. Protect the admin key
(`~/foodsafe/.admin_key` on the server), and keep server backups (§14) for at least as long.

## 11. Flutter app reference

### Services
- **`ConvexClient`** (`services/convex_client.dart`): `query`, `mutation`, `action` → POST
  `{baseUrl}/api/{kind}` with `{path, args, format: "json"}`. Strips `null` values recursively (Convex
  rejects explicit nulls for optional fields). Throws `ConvexException` with the server's `ConvexError`
  message, or a generic message for unexpected errors (details go to the debug console).
  `changes` (`ValueNotifier<int>`) increments after each mutation/action.
- **`AuthService`** (`services/auth_service.dart`, `ChangeNotifier`): `restore()` validates a saved token
  via `auth:me` and loads `businesses` (`businesses:mine`). The business chosen today is remembered in
  `shared_preferences` with the date, so the picker shows again tomorrow; with only one open business it is
  chosen automatically. `selectBusiness`, `switchBusiness`, `refreshCurrent`, `login`,
  `register(..., business:)`, `logout`. Exposes `user` (`AppUser`; `role`, `isManager`, `isAdmin` are the
  role **in the current business**), `business` and `token`.

### Shared widgets & helpers (`widgets/common.dart`)
| Name | Purpose |
|---|---|
| `context.q / m / a` | Query / mutation / action with the session token **and current `businessId`** added |
| `context.userQ / userM` | User-level calls (custom programmes): session token only |
| `context.run(fn, success:)` | Runs a call; shows errors (and optional success) as snackbars; returns null on failure |
| `context.toast(msg, error:)` | Snackbar |
| `QueryBuilder(path, args, builder, userScoped:)` | Loads a query, shows spinner/error+retry, refetches on any mutation, pull-to-refresh |
| `Pill(text, tone:, icon:)` | Status chip; tones `ok`, `warn`, `bad`, `neutral`, `brand` |
| `SectionTitle`, `EmptyState`, `InfoRow`, `Responsive` | Layout helpers; `Responsive` caps width on tablets/web |
| `promptText(context, ...)` | Text-input dialog |
| `fmtDateTime`, `fmtDate`, `fmtNum`, `fromMs`, `localDayStartMs`, `keptUntil` | Formatting |
| `storageLabels`, `storageIcons`, `allergenList` | Shared constants |

`widgets/audit_history.dart`: `AuditHistory(entries)` timeline and `auditActionIcon(action)`.

### Theme (`theme.dart`)
`AppColors`: `orange #F26B21`, `orangeDark #C94E0E`, `orangeLight #FFF1E8`, `ink`, `muted`, `border`,
`surface`, and ok/warn/bad pairs. `buildTheme()` sets Material 3 with orange app bars, white rounded
cards, 50px-tall buttons, filled inputs, and an orange-accented navigation bar.

### Navigation
`main.dart` shows a spinner while restoring, `LoginScreen` if signed out, `BusinessPickerScreen` until a
business is chosen, else `HomeShell` (keyed by business, so switching rebuilds everything).
`HomeShell` has 5 tabs (Home, Goods In, Stock, Checks, More) in an `IndexedStack`: **bottom bar under
900px width, side rail above** (desktop web). Other screens are pushed with `MaterialPageRoute`.
`HomeShell.of(context).go(i)` switches tab from inside a page.

### Screen files
| File | Screen(s) |
|---|---|
| `login_screen.dart` | Sign in / create account (account → business & programme, or "I've been invited") |
| `business_picker_screen.dart` | Your businesses (programme, role, open actions, archived) + `AddBusinessScreen` |
| `home_shell.dart` | Tab container |
| `dashboard_screen.dart` | Home: header (business · programme), today's KPIs, stock KPIs, Due list, quick actions |
| `goods_in_screen.dart` | Delivery list |
| `goods_in_form_screen.dart` | Receive goods form (incl. programme checks) + `ItemEditorScreen` (incl. put-away location) |
| `stock_screen.dart` | Stock tab: On hand / Low stock / Stocktakes; `AddStockScreen`, `LotCard`, `LocationPicker` |
| `lot_detail_screen.dart` | One lot: details, actions (use, sell, dispatch, waste, move, hold/release, adjust), history |
| `stocktake_screen.dart` | Count lines, complete |
| `locations_screen.dart` | Add / rename / retire locations |
| `programme_screen.dart` | Your programme: Due list, records, receiving checks, checklists; `ChangeProgrammeScreen`, `DueList` |
| `records_screen.dart` | `RecordsScreen` (history, void) and `RecordFormScreen` (generic form from fields) |
| `custom_programme_editor.dart` | Custom programme builder + `RecordTypeEditor`, `ChecklistEditor` |
| `export_screen.dart` | Export every record as JSON |
| `scanner_screen.dart` | Camera barcode scanner (with "Type it" fallback) |
| `delivery_detail_screen.dart` | Delivery record, items, edit notes, void, history |
| `audits_screen.dart` | Checks tab: programme card, Start-new (templates + programme checklists) / History; `startAudit()` |
| `audit_detail_screen.dart` | Answer questions, evidence, notes, refresh, sign off, trail |
| `corrective_actions_screen.dart` | Open / Closed tabs, raise, close out |
| `temperature_screen.dart` | Readings list + record sheet |
| `suppliers_screen.dart` | Supplier list + `SupplierFormScreen` |
| `products_screen.dart` | Catalogue with allergens & NOVA |
| `expiring_screen.dart` | Expiring / expired stock on hand |
| `trace_screen.dart` | Trace & recall: receipts, what's left, dispatched to; Recall button |
| `more_screen.dart` | Profile, business (switch / programme / add), records, compliance, sign out |
| `admin_screens.dart` | `AuditTrailScreen`, `MembersScreen` (invites), `SettingsScreen` (archive / restore) |

### Packages
`http`, `provider`, `shared_preferences`, `intl`, `mobile_scanner` (camera on Android/iOS/web),
`share_plus` (export file: share sheet on mobile, download on web).
Platform setup done: Android `INTERNET` + `CAMERA` permissions and `usesCleartextTraffic` (for local
http dev), iOS `NSCameraUsageDescription`, web title/theme colour.

---

## 12. Screens: user guide

### Sign up, sign in and choosing a business
- **Create an account**: your name, email and password, then **set up your main business**: its name, the
  programme it follows (each card lists who it's for) and which kinds of business apply. Someone invited
  by a manager ticks **"I've been invited"** instead and joins that business.
- After signing in you see **Your businesses** with each one's programme, your role and open actions. Pick
  the one you're working in today; the app remembers it until tomorrow (or until **More → Switch business**).
  **Add business** creates another one you run. Archived businesses are under "Show archived".

### Home
- Header: greeting, business name and programme, NZ/MPI or AU/FSANZ badge.
- **Today**: Deliveries, Temp checks, Open actions, Expiring soon. **Stock**: on hand, on hold, low stock.
- **Due**: what your programme still needs this period (tap to do it). **Programme** opens the full list.
- **Quick actions**: Receive goods, Temperature check, Stock, Start audit, Trace / recall, Suppliers,
  Expiring stock.

### Receive goods (the main workflow)
1. **Supplier**, invoice/docket, vehicle clean, vehicle temperature.
2. **Add items** (scan, manual, or "usually from this supplier" chips). The item check covers temperature,
   batch, dates, condition, allergens, accept/reject and, for accepted goods, **Put away to** a location.
3. **Programme checks**: answer each of your programme's receiving checks Yes / No / N/A.
4. **Save**: accepted goods go into stock; problems (and any "No") become corrective actions.

### Stock
- **On hand**: everything in stock, first-expiring first, filter by location. **DISCARD** = past use-by,
  **PAST BB** = past best-before, **ON HOLD** in red. Tap a lot to **Use, Sell, Dispatch** (who to),
  **Waste** (why), **Move**, **Hold** / **Release** (managers) or **Adjust** (managers), and see its history.
- **Low stock**: products below their par level (set par in **More → Products**, managers).
- **Stocktakes** (managers start): count everything or one location, enter counts, complete. Stock is
  corrected and big differences become a corrective action.
- Managers: **Locations** (chillers, freezers, dry store) and **Add stock** (opening stock).

### Checks (programme, records and audits)
- **Your programme**: the Due list, record types (tap for history, **Add record**), what's asked at goods
  inwards, and checklists. Admins can **Change programme**; on a custom programme, **Edit programme**.
- Record forms check your answers against the programme's limits (e.g. thermometer more than 1°C out,
  cooling not under 21°C in 2 h) and raise corrective actions for anything outside them.
- **Audits**: built-in templates plus your programme's checklist(s), pre-filled from your records. Sign-off
  locks the audit and raises a CA for each "No".

### Building a custom programme (admins)
On a business set to **Custom**: **Start blank** or **Copy NP1/2/3**, or reuse one you've built for another
business. In the editor add receiving checks, records (fields, whether each is required, and when an answer
is a problem) with how often they're due, and checklists (questions by section). Save applies it everywhere
the programme is used.

### Trace & recall
Search a batch code, product or barcode: where it came from, how much is left, and who it was dispatched
to. Managers can **Recall**: every matching lot still in stock goes on hold and a high-severity corrective
action is raised listing it.

### Corrective actions, temperature checks, suppliers, products, expiring stock
As before; corrective actions are now under **More** and the Home "Open actions" card.

### More
- **Business**: switch business, your programme, add another business.
- **Records**: corrective actions, temperature checks, suppliers, products, expiring stock, trace & recall.
- **Compliance** (managers): audit trail, **Members** (admins invite and change roles);
  admins also get **Business settings** (archive / restore at the bottom) and **Export records**.

## 13. Local development

```bash
# Backend (local Convex, no account) → http://127.0.0.1:3210
cd backend && npm install
CONVEX_AGENT_MODE=anonymous npx convex dev     # watches & redeploys on save, type-checks

# App
cd app && flutter pub get
flutter run -d chrome
flutter run -d emulator-5554 --dart-define=CONVEX_URL=http://10.0.2.2:3210   # Android emulator
flutter run -d <iphone>     --dart-define=CONVEX_URL=http://<your-LAN-ip>:3210
```

- `CONVEX_URL` defaults to `http://127.0.0.1:3210` (`app/lib/config.dart`).
- Backend type check: `cd backend && npm run typecheck`. App lints: `cd app && flutter analyze`.
- Unit tests (100% coverage enforced): `cd backend && npm run test:coverage` and
  `cd app && flutter test --coverage && dart run tool/check_coverage.dart`. See
  [TESTING.md](TESTING.md) for structure, helpers and how to add tests.
- Calling functions by hand:
  ```bash
  curl -X POST http://127.0.0.1:3210/api/query -H 'content-type: application/json' \
    -d '{"path":"dashboard:summary","args":{"sessionToken":"<token>","businessId":"<id>"},"format":"json"}'
  ```
- Convex dashboard for the local deployment: `npx convex dashboard`.
- Website: `cd web && npm install && NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 npm run dev`
  (http://localhost:3000; the owner dashboard is `/admin`). `npm run lint` and `npm run build` check it.
  Without `NEXT_PUBLIC_CONVEX_URL` it talks to production.
- After adding a backend module, regenerate `convex/_generated/api.d.ts` with
  `npx convex codegen --typecheck disable` (uses the local deployment) so tests can reference it.

---

## 14. Deployment (loganserver)

**Topology:**
```
Internet → Cloudflare → cloudflared tunnel (loganserver) → Caddy (127.0.0.1:80, ~/caddy)
   → http://app.jampacked.co.nz { reverse_proxy foodsafe:80 }   (Docker network "web")
     http://jampacked.co.nz, www { reverse_proxy foodsafe:80 }
     the old foodsafety.savepoint.co.nz redirects to app.jampacked.co.nz
   → foodsafe (nginx), by hostname:
       jampacked.co.nz, www → the website (web/out, in ~/foodsafe/site)
       anything else        → the Flutter web build; /api/* → foodsafe-convex:3210 (network "internal")
   → foodsafe-convex: self-hosted Convex backend, data in volume foodsafe_convex-data
```

- Files on server: `~/foodsafe/` (`docker-compose.yml`, `nginx.conf`, `web/` (app), `site/` (website),
  `.admin_key`).
- Convex is published only on `127.0.0.1:3210` on the server; deploys reach it through an SSH tunnel.
- Caddy routes are added to `~/caddy/Caddyfile` by the deploy (a timestamped backup is taken first).
- Each hostname also needs a **Public Hostname** on the Cloudflare tunnel (Zero Trust → Networks →
  Tunnels), pointing at the same service as the other loganserver sites. The tunnel runs from a token, so
  this is done in the Cloudflare dashboard, not on the server.

**Deploy / update** (from this repo, on a machine with Flutter, Node and SSH access):
```bash
./deploy/deploy.sh            # default host: loganserver
```
It builds the web app with `CONVEX_URL=https://app.jampacked.co.nz` and the website with the same
`NEXT_PUBLIC_CONVEX_URL`, rsyncs both builds and the configs, runs `docker compose up -d`, generates the Convex admin key on first run, adds the Caddy routes if
missing (and switches servers that still redirect jampacked.co.nz to the app over to the website), then pushes Convex functions via `npx convex deploy` over an SSH tunnel (local port 3299).
Re-running is safe.

`main.dart.js` and `flutter_bootstrap.js` are renamed with a content hash on each deploy, and nginx sends
`no-cache` for everything else. Otherwise Cloudflare caches the app's files at its edge and phones keep
running the old build for hours. Icons and `manifest.json` get a `?v=<hash>` the same way. If a deploy still looks stale, purge the Cloudflare
cache for `jampacked.co.nz` (Caching → Configuration → Purge Everything).

**Upgrading the live server to multi-business (one-off).** Data saved before this change has no
`businessId`: until it is migrated, existing users sign in to an empty business list. So run this
**straight after** `./deploy/deploy.sh`, choosing the programme (and sectors) the existing business follows:
```bash
ssh -fN -L 3299:127.0.0.1:3210 loganserver          # tunnel to the server's Convex
cd backend && CONVEX_DEPLOYMENT= CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3299 \
  CONVEX_SELF_HOSTED_ADMIN_KEY="$(ssh loganserver cat ~/foodsafe/.admin_key)" \
  npx convex run migrations:toMultiBusiness '{"programme":"NP2","sectors":["retail_chilled_frozen"]}'
```
It turns the old settings row into the first business (owned by the earliest admin), each user's role into
a membership, and stamps every existing record. It only touches data from before the upgrade (users with
no membership, records with no business), so accounts created in the meantime are left alone, and
re-running does nothing once that data is migrated. Try it on a
copy first (restore a backup into a local deployment). Once it has run, `businessId` can be made required
in `schema.ts` and the legacy `settings` table and `users.role` field removed.

**Operations:**
```bash
ssh loganserver
cd ~/foodsafe
docker compose ps                 # status
docker compose logs -f convex     # backend logs
docker compose restart            # restart both containers
docker run --rm -v foodsafe_convex-data:/d -v $PWD:/b alpine tar czf /b/convex-backup-$(date +%F).tgz -C /d .   # backup
```
Convex dashboard (self-hosted): `docker run --rm -p 6791:6791 -e NEXT_PUBLIC_DEPLOYMENT_URL=http://127.0.0.1:3210 ghcr.io/get-convex/convex-dashboard`
on the server, then SSH-forward port 6791 and log in with the admin key.

---

## 15. Migrating to Clerk

The app is structured so only auth plumbing changes:

1. **Clerk:** create an application, add a JWT template named `convex`.
2. **Convex:** add `backend/convex/auth.config.ts`:
   ```ts
   export default { providers: [{ domain: "https://<your-clerk-domain>", applicationID: "convex" }] };
   ```
3. **Backend:** change `getUser` in `lib/session.ts` to use `ctx.auth.getUserIdentity()` and find/create
   the `users` row by Clerk `subject` (add a `clerkId` field + index). `sessionToken` args can then be
   removed (or ignored); all permission checks keep working via `requireUser`/`requireMember`.
4. **Flutter:** add `clerk_flutter`, replace `AuthService.login/register` with Clerk sign-in, and send the
   Clerk JWT as `Authorization: Bearer <jwt>` in `ConvexClient` (the HTTP API accepts it).
   Screens depend only on `AuthService.user`, so they don't change.
5. Remove `passwordHash`/`passwordSalt` and the `sessions` table once migrated.

---

## 16. Known limitations & roadmap

- **No live push between devices**: data refreshes on any local change or pull-to-refresh.
  Option: `convex_flutter` WebSocket client (needs Rust toolchain for mobile).
- **No photo evidence**: Convex file storage could hold delivery/damage photos.
- **No offline mode**: receiving in a walk-in with no signal fails; a local queue would fix it.
- **Stock doesn't follow production**: using ingredients doesn't create finished-product lots, so tracing
  "what went into what" is by date rather than linked batches.
- **Exports are JSON**: PDF/CSV reports of audits and records for verifiers are a natural next step.
- **Large businesses**: some queries read whole indexes (e.g. stock on hand); pagination would be needed
  at very large scale.
- **Dev auth** (§9): no password reset, no rate limiting; Clerk resolves these.
