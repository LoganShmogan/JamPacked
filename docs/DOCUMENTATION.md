# NZSafetyHealthApp — Technical & User Documentation

Food safety record-keeping for New Zealand and Australian food businesses. Mobile-first Flutter app
(Android, iOS, web) backed by Convex. **Goods inwards is the core workflow**: every delivery recorded feeds
audits, corrective actions, expiry alerts, the product catalogue and recall tracing automatically.

Live: https://foodsafety.savepoint.co.nz

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
10. [Audit trail & record integrity](#10-audit-trail--record-integrity)
11. [Flutter app reference](#11-flutter-app-reference)
12. [Screens — user guide](#12-screens--user-guide)
13. [Local development](#13-local-development)
14. [Deployment (loganserver)](#14-deployment-loganserver)
15. [Migrating to Clerk](#15-migrating-to-clerk)
16. [Known limitations & roadmap](#16-known-limitations--roadmap)

---

## 1. Concepts & workflow

```
 Delivery arrives
       │
       ▼
 GOODS INWARDS  ──► products catalogue (auto-created / barcode lookup)
 (per item: temp, batch,        │
  dates, condition, allergens,  ├──► CORRECTIVE ACTIONS (auto-raised on problems)
  accept / reject)              ├──► EXPIRING STOCK alerts
       │                        └──► TRACE & RECALL search
       ▼
 AUDITS pre-answer themselves from goods inwards + temperature logs + corrective actions
       │
       ▼
 Sign-off locks audit; "No" answers raise corrective actions
       │
       ▼
 AUDIT TRAIL records every action: who, what, when, field-level changes
```

| Term | Meaning |
|---|---|
| **Delivery** | One drop-off from one supplier (header: supplier, invoice, vehicle check). |
| **Delivery item** | One product line on a delivery, checked individually and accepted or rejected. |
| **Corrective action (CA)** | A recorded non-conformance and how it was resolved. Open → closed with a resolution. |
| **Audit** | A filled-in copy of a template covering a time period. In progress → completed (locked). |
| **Fact** | A value computed from records (e.g. "all deliveries in range?") used to auto-answer audit questions. |
| **Void** | The only way to "remove" a record. It stays in the database flagged void, with a reason, in the audit trail. |

---

## 2. Architecture

```
 ┌──────────────── Flutter app (web / Android / iOS) ───────────────┐
 │ screens ─► context.q / m / a ─► ConvexClient (HTTP JSON)        │
 │ AuthService holds session token (shared_preferences)             │
 └──────────────────────────────┬───────────────────────────────────┘
                                │  POST /api/query | /api/mutation | /api/action
                                ▼
 ┌──────────────────────── Convex backend ──────────────────────────┐
 │ queries (read) · mutations (transactional writes) · actions      │
 │ (password hashing, Open Food Facts fetch)                         │
 │ Every public function: requireUser(sessionToken) → logAudit()    │
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
├── backend/                     Convex project (TypeScript)
│   ├── package.json             scripts: dev, deploy, typecheck
│   └── convex/
│       ├── schema.ts            Tables, indexes, shared validators
│       ├── auth.ts              Register / login / logout / me / users
│       ├── settings.ts          Business settings
│       ├── suppliers.ts         Approved supplier list
│       ├── products.ts          Product catalogue + barcode lookup (Open Food Facts)
│       ├── deliveries.ts        Goods inwards, void, expiring stock, trace
│       ├── temperature.ts       Temperature checks
│       ├── correctiveActions.ts Corrective actions
│       ├── audits.ts            Start / answer / refresh / complete audits
│       ├── auditLog.ts          Read-only audit trail
│       ├── dashboard.ts         Home screen summary
│       ├── lib/
│       │   ├── session.ts       getUser / requireUser / requireRole
│       │   ├── password.ts      PBKDF2 hashing, random tokens
│       │   ├── audit.ts         logAudit() + diff()
│       │   ├── settings.ts      Defaults, temperature compliance rules
│       │   ├── templates.ts     Built-in audit templates
│       │   └── facts.ts         Auto-fill fact engine
│       └── _generated/          Convex codegen (committed, do not edit)
├── app/                         Flutter app
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart            Providers, MaterialApp, auth gate
│       ├── config.dart          CONVEX_URL (dart-define)
│       ├── theme.dart           Orange/white theme + colour tokens
│       ├── services/
│       │   ├── convex_client.dart
│       │   └── auth_service.dart
│       ├── widgets/
│       │   ├── common.dart      QueryBuilder, Pill, helpers, constants
│       │   └── audit_history.dart
│       └── screens/             One file per screen (see §11)
└── deploy/
    ├── docker-compose.yml       Self-hosted Convex + nginx
    ├── nginx.conf               Serves web build, proxies /api to Convex
    └── deploy.sh                One-command build & deploy
```

---

## 4. Data model

Defined in `backend/convex/schema.ts`. All timestamps are **milliseconds since epoch (UTC)**.
Every document also has Convex's `_id` and `_creationTime`.

### `users`
| Field | Type | Notes |
|---|---|---|
| email | string | Lower-cased, unique (index `by_email`) |
| name | string | Shown on every record they create |
| role | `admin` \| `manager` \| `staff` | First registered user = admin |
| passwordHash / passwordSalt | string (hex) | PBKDF2-SHA256, 100k iterations |
| active | boolean | Deactivated users can't sign in; their history remains |
| createdAt | number | |

### `sessions`
`userId`, `token` (64 hex chars, index `by_token`), `expiresAt` (7 days). Deleted on logout.

### `settings` (single row; defaults used until first save)
| Field | Default | Notes |
|---|---|---|
| businessName | "My Food Business" | |
| jurisdiction | `NZ` | `NZ` or `AU` — changes labels (MPI vs FSANZ) |
| registrationNumber, address | — | FCP/NP number (NZ) or council licence (AU) |
| chilledMaxC | 5 | Chilled food received/stored at or below |
| frozenMaxC | -15 | Frozen food received at or below |
| hotMinC | 60 | Hot food at or above |
| expiryWarningDays | 3 | Window for "expiring soon" |

### `suppliers`
`name`, `contactName?`, `phone?`, `email?`, `address?`, `registrationNumber?`, `approved`,
`approvalNotes?`, `active`, `createdAt`. Index `by_name`.

### `products`
`name`, `brand?`, `barcode?` (index `by_barcode`), `storageType` (`chilled`|`frozen`|`hot`|`ambient`),
`allergens[]`, `ingredients?`, `novaGroup?` (1–4, 4 = ultra-processed), `imageUrl?`,
`defaultSupplierId?`, `active`, `createdAt`. Created manually or **automatically on first delivery**.

### `deliveries` (goods inwards header)
| Field | Notes |
|---|---|
| receivedAt | Index `by_receivedAt` |
| supplierId, supplierName | Name denormalised so history survives renames |
| supplierApproved | **Snapshot** of approval status at time of receipt |
| invoiceNumber?, vehicleClean, vehicleTempC?, notes? | |
| status | `accepted` (all items) / `partial` / `rejected` (none) — computed server-side |
| receivedById, receivedByName | Who received it |
| voided, voidReason? | See §10 |

### `deliveryItems`
| Field | Notes |
|---|---|
| deliveryId, receivedAt, supplierId | Copied for indexed queries |
| productId?, productName, barcode? | |
| batchCode? | Index `by_batch` — used for recalls |
| quantity, unit | |
| useBy?, bestBefore? | Date marks (end of selected day, local) |
| storageType, temperatureC? | |
| temperatureCompliant | `true` / `false` / `null` (ambient → no requirement). Missing temp on chilled/frozen/hot = `false` |
| packagingOk, labelOk, allergens[] | |
| accepted, rejectionReason? | Reason mandatory when rejected |
| voided | Mirrors parent delivery |

### `temperatureLogs`
`checkedAt`, `unitName`, `unitType` (`chiller`|`freezer`|`hot_hold`|`cooking`|`cooling`),
`temperatureC`, `compliant`, `correctiveAction?` (mandatory if non-compliant), `checkedById`, `checkedByName`.

### `audits`
| Field | Notes |
|---|---|
| templateKey, templateName, standardRef | Copied from template at start |
| title | e.g. "Goods Receipt & Supplier Verification — 7/10/2026 to 14/10/2026" |
| periodStart, periodEnd | Records in this window feed auto-fill |
| tzOffsetMinutes? | Client UTC offset, so day boundaries are local |
| status | `in_progress` → `completed` (locked) |
| started*/completed* | Who and when |
| score | % of yes/no questions answered "Yes" |
| answers[] | `questionId, section, text, type, guidance?, value, autoFilled, evidence?, notes?, answeredByName?, answeredAt?` |

Questions are **copied into the audit**, so editing a template later never changes past audits.

### `correctiveActions`
`title`, `description?`, `source` (`goods_inward`|`temperature`|`audit`|`manual`), `sourceId?`
(the delivery/log/audit ID), `severity` (`low`|`medium`|`high`), `status` (`open`|`closed`),
`raisedAt`, `raisedById`, `raisedByName`, `closedAt?`, `closedByName?`, `resolution?`.

### `auditLog`
`at`, `userId?`, `userName` ("system" for unauthenticated events), `action`, `entityType`,
`entityId?`, `summary` (human-readable), `changes?` (diff or payload).
Indexes: `by_at`, `by_entity (entityType, entityId, at)`, `by_user (userId, at)`.

---

## 5. Backend (Convex) reference

Function names are `module:function`. **Every public function except `auth:register`/`auth:login`
takes `sessionToken`.** Errors meant for users are thrown as `ConvexError("message")`; the app shows the
message as a red snackbar.

Role legend: **any** = any signed-in user, **mgr** = admin or manager, **admin** = admin only.

### `auth`
| Function | Kind | Role | Description |
|---|---|---|---|
| `register(email, name, password)` | action | public | Validates (email format, password ≥ 8), hashes, creates user + session. First user → admin. Returns `{token}`. |
| `login(email, password)` | action | public | Verifies hash (constant-time compare). Logs `login` or `login_failed` either way. Returns `{token}`. |
| `logout()` | mutation | any | Deletes the session, logs it. |
| `me()` | query | any | Current user `{_id,email,name,role}` or null. |
| `listUsers()` | query | mgr | All users with active status. |
| `updateUser(userId, role?, active?)` | mutation | admin | Change role / deactivate. Can't change yourself. |
| `createUserAndSession`, `userByEmail`, `recordLogin` | internal | — | Helpers called by the actions; not callable from clients. |

### `settings`
| `get()` | query | any | Current settings (or defaults). |
|---|---|---|---|
| `update(...fields)` | mutation | admin | Partial update; diff logged. |

### `suppliers`
| Function | Kind | Role | Description |
|---|---|---|---|
| `list(includeInactive?)` | query | any | Sorted by name. |
| `get(id)` | query | any | Supplier + last 20 non-void deliveries. |
| `create(...)` | mutation | mgr | |
| `update(id, ...)` | mutation | mgr | Includes `approved` and `active`. Diff logged. |

### `products`
| Function | Kind | Role | Description |
|---|---|---|---|
| `list()` | query | any | Active products. |
| `byBarcode(barcode)` | query | any | Catalogue lookup. |
| `create(...)` | mutation | any | |
| `update(id, ...)` | mutation | mgr | |
| `lookupBarcode(barcode)` | action | any | Calls Open Food Facts v2. Returns `{name, brand, allergens, ingredients, novaGroup, imageUrl, storageType}` or null. Storage type is guessed from OFF categories (frozen / chilled for dairy-meat-fish / else ambient). OFF allergen tags are mapped to the app's allergen names. |

### `deliveries` (goods inwards)
| Function | Kind | Role | Description |
|---|---|---|---|
| `create(supplierId, receivedAt?, invoiceNumber?, vehicleClean, vehicleTempC?, notes?, items[])` | mutation | any | See below. Returns delivery ID. |
| `voidDelivery(id, reason)` | mutation | mgr | Flags delivery + items void. Reason required. |
| `updateNotes(id, notes)` | mutation | any | Before/after logged. |
| `list(limit?)` | query | any | Newest first, with `itemCount` and `tempIssues` (accepted items out of range). |
| `get(id)` | query | any | Delivery, items and its audit-log history. |
| `suggestionsForSupplier(supplierId)` | query | any | Distinct products from that supplier's last 10 deliveries — used as tap-to-add chips. |
| `expiring()` | query | any | Accepted, non-void items from the last 90 days whose use-by/best-before falls within `expiryWarningDays` (or has passed). |
| `trace(search)` | query | any | Exact batch-code match plus substring match on product name / batch / exact barcode across the last 2,000 items. Includes supplier and receiver. |

**What `deliveries:create` does, in order:**
1. Validates: at least one item; every rejected item has a reason; supplier exists.
2. Computes status (`accepted` / `partial` / `rejected`).
3. Inserts the delivery with a **snapshot** of supplier approval.
4. For each item:
   - finds a product by barcode (or exact name) or **creates one** in the catalogue;
   - computes `temperatureCompliant` with the current settings;
   - inserts the item;
   - auto-raises CAs: **high** if accepted out of temperature, **high** if accepted past use-by,
     **medium** for each rejected item.
5. Auto-raises **medium** CA if the supplier is not approved, **low** if the vehicle wasn't clean.
6. Writes one audit-log entry with a summary of issues and the full payload.

### `temperature`
| Function | Kind | Role | Description |
|---|---|---|---|
| `record(unitName, unitType, temperatureC, correctiveAction?)` | mutation | any | Computes compliance; if out of range, a corrective action text is **required** and a high CA is auto-raised. |
| `list()` | query | any | Last 200 readings. |
| `units()` | query | any | Distinct unit names used before (quick-pick chips). |

Rules (`lib/settings.ts → unitCompliant`): chiller ≤ chilledMaxC; freezer ≤ frozenMaxC;
hot_hold ≥ hotMinC; cooking ≥ 75°C (core); cooling ≤ 21°C (first stage of 2-stage cooling).

### `correctiveActions`
| `list(status?)` | query | any | Last 200, optionally by status. |
|---|---|---|---|
| `create(title, description?, severity)` | mutation | any | Manual CA. |
| `close(id, resolution)` | mutation | any | Resolution required; can't re-close. |

### `audits`
| Function | Kind | Role | Description |
|---|---|---|---|
| `templates()` | query | any | Template summaries with question/auto-fill counts. |
| `list()` | query | any | Last 100 audits with answered/total. |
| `get(id)` | query | any | Full audit. |
| `start(templateKey, periodStart?, periodEnd?, tzOffsetMinutes?)` | mutation | any | Copies template, computes facts for the period, pre-answers. Default period = template's `defaultPeriodDays` back from now (the app sends local midnight for daily templates). |
| `answer(id, questionId, value, notes?)` | mutation | any | Sets an answer; marks it manual (`autoFilled=false`); logs old → new and whether it overrode auto-fill. Rejected if completed. |
| `refreshAutoFill(id)` | mutation | any | Recomputes facts up to now and updates answers **no human has touched**. |
| `complete(id)` | mutation | any | Requires all yes/no answered. Scores, raises a medium CA per "No", locks. |

### `auditLog`
`list(entityType?, entityId?, userId?, limit?)` — entity history is readable by any user (used on detail
screens); the global trail and per-user filters are **mgr** only. Max 1,000 rows. **No write functions exist.**

### `dashboard`
`summary(dayStart?)` → `businessName, jurisdiction, deliveriesToday, rejectionsToday, tempChecksToday,
tempIssuesToday, openCorrectiveActions, highSeverityOpen, expiringSoon, expired, inProgressAudits`.
`dayStart` is local midnight from the client (server runs UTC).

### `lib/` helpers
| File | Exports |
|---|---|
| `session.ts` | `getUser(ctx, token)`, `requireUser`, `requireRole(ctx, token, roles)` |
| `password.ts` | `hashPassword(pw, salt?)`, `verifyPassword`, `randomHex(bytes)` |
| `audit.ts` | `logAudit(ctx, user, {action, entityType, entityId?, summary, changes?})`, `diff(before, patch)` |
| `settings.ts` | `DEFAULT_SETTINGS`, `loadSettings`, `isTempCompliant`, `unitCompliant` |
| `templates.ts` | `TEMPLATES`, `Question`, `Template` types |
| `facts.ts` | `computeFacts(ctx, start, end, tz)` |

---

## 6. Audit auto-fill engine

`backend/convex/lib/facts.ts → computeFacts(ctx, start, end, tz)` reads non-void records in the period
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
| `stock.noExpired` | yes/no | No accepted stock (last 90 days) now past use-by | |
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
| `monthly_review` | Monthly Food Safety Review | 30 days | 10 (7) | MPI FCP "Checking for problems"; FSANZ 3.2.2A |
| `hygiene` | Cleaning, Pest & Personal Hygiene | today | 9 (0) | MPI FCP cleaning/pests; FSANZ 3.2.2 cl.13–24, 3.2.3 |

**Writing questions:** phrase yes/no questions so **"Yes" = compliant** (scoring and CA-raising rely on it).

**Adding a template:** append to `TEMPLATES` and deploy. It appears in the app automatically. Keep
existing `key`/question `id`s stable — `refreshAutoFill` matches on them.

---

## 8. Compliance rules (NZ & AU)

| Requirement | How the app meets it |
|---|---|
| Buy from approved/registered suppliers (MPI FCP; FSANZ 3.2.2 cl.5) | Approved supplier list; approval snapshot on each delivery; CA if unapproved. |
| Receive potentially hazardous food at ≤5°C or ≥60°C, frozen food frozen (FSANZ 3.2.2 cl.5) | Probe temperature per item, live pass/fail, server-side compliance flag, CA if accepted out of range. |
| Protect food from contamination on receipt (FSANZ 3.2.2 cl.5) | Packaging & label checks, vehicle cleanliness. |
| Traceability "one step back" (Food Act 2014; FSANZ 3.2.2 cl.12 recall) | Batch + date mark per item; Trace & Recall search. |
| Allergen information (FSANZ 1.2.3 / PEAL) | Per-item allergen capture against the 21 declarable allergens; allergens-received audit answer. |
| Temperature control of storage, cooking, cooling | Temperature checks with corrective actions. Cooking ≥75°C, cooling ≤21°C stage 1. |
| Keep records & show they're accurate (Food Act record keeping; FSANZ 3.2.2A cl.10) | Every record attributed to a user and timestamped; immutable audit trail; voids not deletes; locked audits. |
| Identify and fix problems (corrective action) | Auto-raised CAs from every source; close-out requires a resolution. |
| Regular verification / review | Daily, monthly and hygiene audit templates with scores. |

Limits are configurable in **Business settings**. The defaults and templates are a starting point —
confirm against your registered FCP/National Programme or local council requirements.

---

## 9. Authentication, roles & security

**Development auth (current):**
- Passwords: PBKDF2-SHA256, 100,000 iterations, 16-byte random salt per user, 256-bit derived key,
  computed in Convex **actions** via Web Crypto. Plain-text passwords are never stored or logged.
- Comparison is constant-time.
- Sessions: 32 random bytes (hex), 7-day expiry, stored in `sessions`; the app keeps the token in
  `shared_preferences` (localStorage on web).
- Every public function resolves the user from the token (`requireUser`/`requireRole`). Inactive users
  and expired sessions are rejected.
- Failed sign-ins are logged (`login_failed`) with the attempted email.

**Roles:**

| Capability | staff | manager | admin |
|---|:-:|:-:|:-:|
| Record deliveries, temps, audits, CAs | ✓ | ✓ | ✓ |
| Add/edit suppliers, edit products | | ✓ | ✓ |
| Void deliveries | | ✓ | ✓ |
| View full audit trail & users | | ✓ | ✓ |
| Change roles / deactivate users | | | ✓ |
| Business settings | | | ✓ |

**Known gaps (acceptable for dev, fix before real use):** open registration (anyone with the URL can
create a staff account); no rate limiting on login; no password reset. Clerk (§15) resolves these.

---

## 10. Audit trail & record integrity

- `logAudit()` is called by **every** mutation after it writes. Entries contain user, time, action,
  entity, a readable summary and `changes` (field diffs `{field: {from, to}}` or the create payload).
- Actions logged: `register`, `login`, `login_failed`, `logout`, `create`, `update`, `void`, `answer`,
  `refresh`, `complete`, `close`.
- **There are no delete functions** for business records and **no functions that modify `auditLog`**.
- Deliveries are **voided** (manager+, reason required), never deleted; voided records are excluded from
  stats/audits but remain viewable and greyed out.
- Completed audits reject further changes.
- Supplier approval is snapshotted on each delivery so later changes don't rewrite history.
- Where to see it: **More → Audit trail** (filter by area, tap for change details), plus a "Record history"
  section on delivery, supplier and audit screens.

Note: a Convex admin (dashboard / admin key) can still edit data directly. Protect the admin key
(`~/foodsafe/.admin_key` on the server).

---

## 11. Flutter app reference

### Services
- **`ConvexClient`** (`services/convex_client.dart`): `query`, `mutation`, `action` → POST
  `{baseUrl}/api/{kind}` with `{path, args, format: "json"}`. Strips `null` values recursively (Convex
  rejects explicit nulls for optional fields). Throws `ConvexException` with the server's `ConvexError`
  message, or a generic message for unexpected errors (details go to the debug console).
  `changes` (`ValueNotifier<int>`) increments after each mutation/action.
- **`AuthService`** (`services/auth_service.dart`, `ChangeNotifier`): `restore()` on startup validates a
  saved token via `auth:me`; `login`, `register`, `logout`. Exposes `user` (`AppUser` with `isManager`,
  `isAdmin`) and `token`.

### Shared widgets & helpers (`widgets/common.dart`)
| Name | Purpose |
|---|---|
| `context.q / m / a` | Query / mutation / action with the session token added |
| `context.run(fn, success:)` | Runs a call; shows errors (and optional success) as snackbars; returns null on failure |
| `context.toast(msg, error:)` | Snackbar |
| `QueryBuilder(path, args, builder)` | Loads a query, shows spinner/error+retry, refetches on any mutation, pull-to-refresh |
| `Pill(text, tone:, icon:)` | Status chip — tones `ok`, `warn`, `bad`, `neutral`, `brand` |
| `SectionTitle`, `EmptyState`, `InfoRow`, `Responsive` | Layout helpers; `Responsive` caps width on tablets/web |
| `promptText(context, ...)` | Text-input dialog |
| `fmtDateTime`, `fmtDate`, `fmtNum`, `fromMs`, `localDayStartMs` | Formatting |
| `storageLabels`, `storageIcons`, `allergenList` | Shared constants |

`widgets/audit_history.dart` — `AuditHistory(entries)` timeline and `auditActionIcon(action)`.

### Theme (`theme.dart`)
`AppColors`: `orange #F26B21`, `orangeDark #C94E0E`, `orangeLight #FFF1E8`, `ink`, `muted`, `border`,
`surface`, and ok/warn/bad pairs. `buildTheme()` sets Material 3 with orange app bars, white rounded
cards, 50px-tall buttons, filled inputs, and an orange-accented navigation bar.

### Navigation
`main.dart` shows a spinner while restoring, `LoginScreen` if signed out, else `HomeShell`.
`HomeShell` has 5 tabs (Home, Goods In, Audits, Actions, More) in an `IndexedStack`: **bottom bar under
900px width, side rail above** (desktop web). Other screens are pushed with `MaterialPageRoute`.
`HomeShell.of(context).go(i)` switches tab from inside a page.

### Screen files
| File | Screen(s) |
|---|---|
| `login_screen.dart` | Sign in / create account |
| `home_shell.dart` | Tab container |
| `dashboard_screen.dart` | Home: greeting header, today's KPIs, quick-action tiles |
| `goods_in_screen.dart` | Delivery list |
| `goods_in_form_screen.dart` | Receive goods form + `ItemEditorScreen` |
| `scanner_screen.dart` | Camera barcode scanner (with "Type it" fallback) |
| `delivery_detail_screen.dart` | Delivery record, items, edit notes, void, history |
| `audits_screen.dart` | Start-new (templates) / History tabs |
| `audit_detail_screen.dart` | Answer questions, evidence, notes, refresh, sign off, trail |
| `corrective_actions_screen.dart` | Open / Closed tabs, raise, close out |
| `temperature_screen.dart` | Readings list + record sheet |
| `suppliers_screen.dart` | Supplier list + `SupplierFormScreen` |
| `products_screen.dart` | Catalogue with allergens & NOVA |
| `expiring_screen.dart` | Expiring / expired stock |
| `trace_screen.dart` | Trace & recall search |
| `more_screen.dart` | Profile, record links, compliance links, sign out |
| `admin_screens.dart` | `AuditTrailScreen`, `UsersScreen`, `SettingsScreen` |

### Packages
`http`, `provider`, `shared_preferences`, `intl`, `mobile_scanner` (camera on Android/iOS/web).
Platform setup done: Android `INTERNET` + `CAMERA` permissions and `usesCleartextTraffic` (for local
http dev), iOS `NSCameraUsageDescription`, web title/theme colour.

---

## 12. Screens — user guide

### Sign in
Email + password. **Create an account** for new staff; the first account on a fresh deployment becomes
admin. Others start as staff until an admin promotes them.

### Home
- Header: greeting, business name, NZ/MPI or AU/FSANZ badge.
- **Today** cards (tap to jump): Deliveries (warn if any rejections), Temp checks (red if none yet or any
  out of range), Open actions (red if any high severity), Expiring soon (red if anything past use-by).
- **Quick actions**: Receive goods, Temperature check (opens the record sheet directly), Start audit,
  Trace / recall, Suppliers, Expiring stock.
- In-progress audits shortcut.

### Receive goods (the main workflow)
1. **Supplier** — pick from list (unapproved ones are labelled, with a warning), or **+** to add one.
2. Invoice/docket number, vehicle clean toggle, optional vehicle temperature.
3. **Add items**:
   - **Scan** — scans a barcode. The app checks your catalogue, then Open Food Facts, and pre-fills name,
     storage type and allergens.
   - **Add item** — manual entry.
   - **"Usually from this supplier"** chips — one tap pre-fills a previous product.
4. **Item check** screen: product, quantity/unit, batch code, storage type, probe temperature (required
   unless ambient; tick/cross shows pass/fail against your limits), use-by / best-before, packaging and
   label switches, allergens, then **Accept / Reject**. If there's a problem the app warns you to reject
   and pre-fills the reason.
5. **Save delivery** — problems automatically become corrective actions.

### Delivery record
Header details, every item with temperature/batch/date/allergen pills, rejection reasons,
**Edit notes**, **Void record** (managers; reason required), and full record history.

### Audits
- **Start new**: pick a template; it opens pre-filled.
- Each question shows guidance, the **evidence** box (orange, ✨) explaining the auto-answer, and the answer.
  Tap Yes/No or tap the field for number/text. Changing an auto-answer is allowed and logged as an override.
- **Note** adds a comment. **Refresh** re-pulls auto answers you haven't changed (e.g. after more deliveries).
- **Complete & sign off** — needs all yes/no answered; locks the audit under your name and raises a CA
  for each "No". Score = % "Yes".
- **History** tab: all audits with status and score.

### Corrective actions
Open/Closed tabs with severity and source. **+** raises a manual action. **Close out** records how it was
fixed; who closed it and when is saved.

### Temperature checks
**Record**: tap a previously used unit or type a name, choose type, enter °C. Out of range → you must
enter what you did; a high-severity CA is raised.

### Suppliers / Products / Expiring stock / Trace & recall
- Suppliers: list with Approved / Not approved / Inactive; managers can edit and see history.
- Products: searchable catalogue with allergens and NOVA group (4 = ultra-processed).
- Expiring stock: sorted by date. **DISCARD** = past use-by (unsafe), **PAST BB** = past best-before.
- Trace & recall: search a batch code, product or barcode to find every receipt — when, from whom, how
  much, who received it. Tap through to the delivery.

### More (admin/manager)
- **Audit trail** — every action, filter by area, tap for field-level change details.
- **Users** — admins change roles and deactivate/reactivate accounts.
- **Business settings** — name, NZ/AU, registration number, address, temperature limits, expiry warning days.

---

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
- Calling functions by hand:
  ```bash
  curl -X POST http://127.0.0.1:3210/api/query -H 'content-type: application/json' \
    -d '{"path":"dashboard:summary","args":{"sessionToken":"<token>"},"format":"json"}'
  ```
- Convex dashboard for the local deployment: `npx convex dashboard`.

---

## 14. Deployment (loganserver)

**Topology:**
```
Internet → Cloudflare → cloudflared tunnel (loganserver) → Caddy (127.0.0.1:80, ~/caddy)
   → http://foodsafety.savepoint.co.nz { reverse_proxy foodsafe:80 }   (Docker network "web")
   → foodsafe (nginx): serves Flutter web build; /api/* → foodsafe-convex:3210 (network "internal")
   → foodsafe-convex: self-hosted Convex backend, data in volume foodsafe_convex-data
```

- Files on server: `~/foodsafe/` (`docker-compose.yml`, `nginx.conf`, `web/`, `.admin_key`).
- Convex is published only on `127.0.0.1:3210` on the server; deploys reach it through an SSH tunnel.
- Caddy route was appended to `~/caddy/Caddyfile` (a timestamped backup was taken first).

**Deploy / update** (from this repo, on a machine with Flutter, Node and SSH access):
```bash
./deploy/deploy.sh            # default host: loganserver
```
It builds the web app with `CONVEX_URL=https://foodsafety.savepoint.co.nz`, rsyncs the build and
configs, runs `docker compose up -d`, generates the Convex admin key on first run, adds the Caddy route if
missing, then pushes Convex functions via `npx convex deploy` over an SSH tunnel (local port 3299).
Re-running is safe.

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
   removed (or ignored) — all permission checks keep working via `requireUser`/`requireRole`.
4. **Flutter:** add `clerk_flutter`, replace `AuthService.login/register` with Clerk sign-in, and send the
   Clerk JWT as `Authorization: Bearer <jwt>` in `ConvexClient` (the HTTP API accepts it).
   Screens depend only on `AuthService.user`, so they don't change.
5. Remove `passwordHash`/`passwordSalt` and the `sessions` table once migrated.

---

## 16. Known limitations & roadmap

- **No live push between devices** — data refreshes on any local change or pull-to-refresh.
  Option: `convex_flutter` WebSocket client (needs Rust toolchain for mobile).
- **Single business/site** — add an `organizationId` to every table for multi-site / multi-tenant.
- **No photo evidence** — Convex file storage could hold delivery/damage photos.
- **No offline mode** — receiving in a walk-in with no signal fails; a local queue would fix it.
- **Templates are code-defined** — a template editor UI could store custom templates in a table.
- **Reports/exports** — PDF/CSV export of audits and records for verifiers is a natural next step.
- **Stock depletion isn't tracked** — "expiring stock" assumes received items are still on hand
  (last 90 days). Mark-as-used/discarded would make it exact.
- Dev-auth gaps listed in §9.
