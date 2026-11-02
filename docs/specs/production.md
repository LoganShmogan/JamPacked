# Spec: Production as a core use case

Status: **approved** · 2026-11-03

## Objective

JamPacked is moving from "goods in + stock, with some production" to **production as a headline use case**:
a kitchen making batches, a manufacturer running lines, a farm harvesting what it grows. Today production
exists (recipes, batch runs from stock, batch codes P0001…, allergen carry-through, trace back and forward)
but it is buried under **More**, assumes every batch is made *from* stock, has no in-process checks, can't be
planned ahead and can't be undone.

Success: a kitchen, a farm or a mixed business can sign up, see production on the main nav in its own words,
plan the day's batches, record each batch or harvest with the checks its programme needs, fix mistakes, and
trace any batch back to suppliers or growing areas and forward to customers.

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `business-type` | What kind of operation a business is; drives wording, nav and which production features show | — |
| `production-tab` | Production as a main nav tab: a hub with today's plan, recent batches, make/harvest, recipes | business-type |
| `harvest` | Growing areas, and recording a harvest with no stock inputs | business-type |
| `production-checks` | Programme-driven checks on each batch (CCPs); failures raise corrective actions | — |
| `plan-and-void` | Planned batches with shortfall warnings; voiding a batch recorded by mistake | — |
| `production-web-docs` | Website copy, help guides, DOCUMENTATION.md, TESTING.md | all of the above |

Build order: `business-type` → `production-checks`, `harvest`, `plan-and-void` → `production-tab` → `production-web-docs`

---

## Module specs

### `business-type`

- `businesses.operation?`: `"kitchen" | "manufacturer" | "farm" | "retail" | "mixed"`. **Unset = `mixed`**, so
  existing businesses keep every feature they have now. No migration needed.
- Set in the business form (signup and business settings, admins).
- `mixed` (shown as **"Mixed / other"**) = the full feature set: both *Make a batch* and *Harvest*, every
  production check, the Production tab.

| Operation | Production tab | Primary action | Harvest | Make a batch |
|---|---|---|---|---|
| kitchen | "Kitchen" | Make a batch | hidden | ✓ |
| manufacturer | "Production" | Make a batch | hidden | ✓ |
| farm | "Harvest" | Harvest | ✓ | ✓ (e.g. packing, honey extraction) |
| retail | not on nav (stays in More) | — | hidden | ✓ via More |
| mixed / unset | "Production" | Make a batch + Harvest | ✓ | ✓ |

Hiding only affects the UI. The backend accepts any run kind for any operation.

### `production-tab`

- Nav for producing businesses: **Home · Goods In · Production · Stock · Checks · More** (6 destinations;
  retail keeps today's 5). Tab label per the table above, kept short.
- Hub screen: today's planned batches (with shortfall badge), "Make a batch" / "Harvest" buttons, recent
  batches, a link to recipes. Replaces the existing `ProductionScreen` list as the entry point; More → Production
  stays as a link to it.
- Home dashboard: "Make a batch" / "Harvest" tile follows the operation.

### `harvest`

- New table `areas`: `businessId`, `name`, `kind` (`paddock | block | glasshouse | orchard | hive | herd | other`),
  `notes?`, `active`, `createdAt`. Managers create/edit/archive (same pattern as `locations`).
- `productionRuns.kind?`: `"make" | "harvest"` (unset = make). `productionRuns.areaId?` + `areaName?` snapshot.
- `production:create` with `kind: "harvest"` requires `areaId`, allows `inputs: []`. Inputs are still allowed
  (e.g. seed or feed lots) and work as today.
- Harvest products are `kind: "made"` products (shown as "Grown here" for farms).
- Trace: searching an area name finds its harvests; a harvest shows its area and date as the origin.

### `production-checks`

Production checks **are programme records**, so there is no second checks system:

- `RecordType.production?`: `"make" | "harvest" | "both"`. Record types with it show on the batch / harvest form.
- Each check filled in on a batch is saved as an ordinary `records` row with `productionRunId`, so it appears in
  Records, failures raise corrective actions as usual, and the run lists its checks.
- `recipe.checks?: string[]`: record types the recipe always needs; required on its batches.
- Custom programmes: each record type gets a "Use on batches / harvests" choice in the editor.

Approved list (limits unchanged from MPI):

| When | Check | Programmes | Fails when |
|---|---|---|---|
| make | Cooking (existing) | NP2, NP3 | centre < 69 °C; not held long enough |
| make | Cooling (existing) | NP2, NP3 | > 21 °C at 2 h; > 5 °C at 6 h |
| make | Reheating (existing) | NP2, NP3 | < 75 °C |
| make | Water activity (existing) | NP2, NP3 | > 0.85 |
| make | pH (existing) | NP2, NP3 | > 4.6; 3.6–4.6 not heat treated |
| make | **Allergen & label check** (new) | all | clean-down, allergen label, batch code + date: any "no" |
| harvest | **Harvest check** (new) | all | containers clean, withholding periods, kept off ground, wash water (optional): any "no" |
| harvest | Tutin in honey (existing) | NP1 honey | doesn't meet the standard |

### `plan-and-void`

- New table `plannedBatches`: `businessId`, `productId`, `productName`, `qty`, `unit`, `kind`, `areaId?`,
  `dueOn` (date), `notes?`, `status` (`planned | done | cancelled`), `runId?`, `createdBy*`.
- `production:planned(from?, to?)` lists them with the shortfall from the existing `plan` logic (recipes only).
- "Start" opens the batch form pre-filled; `production:create({plannedId})` marks it `done` with `runId`.
- `production:void(id, reason)` (manager): allowed only while the batch's lot is untouched (nothing used,
  dispatched, sold or wasted). It puts each input back on its lot (`void` movements, re-opening depleted lots),
  zeroes the batch lot with a `void` movement, and sets `voided`, `voidReason` and `voidedBy*` on the run. The
  batch code stays taken. The run is still listed (struck through) and kept for 7 years. Audit-logged.

### `production-web-docs`

- Website: home hero and features lead with "goods in, production and stock"; a kitchens / manufacturers /
  farms section; FAQ entries for harvests, production checks and voiding. Screenshots re-rendered.
- Help guides (`app/assets/help/guides.json`, synced to web): Production hub, Harvest, Production checks,
  Planning, Voiding a batch.
- DOCUMENTATION.md data model, API and user guide sections; TESTING.md counts; remove "production can't be
  voided" from known limitations.

---

## Commands

```bash
cd backend && npm test && npm run test:coverage && npm run typecheck
cd app && flutter analyze && flutter test --coverage && dart run tool/check_coverage.dart
cd web && npm run lint && npm run test:coverage
```

## Project structure (touched)

```
backend/convex/schema.ts, production.ts, areas.ts (new), businesses.ts, customProgrammes.ts, lib/programmes.ts, lib/module.ts
backend/tests/production.test.ts, areas.test.ts (new), businesses.test.ts, customProgrammes.test.ts
app/lib/screens/home_shell.dart, production_screen.dart, areas_screen.dart (new), dashboard_screen.dart,
  custom_programme_editor.dart, trace_screen.dart, widgets/business_form.dart
app/test/screens/… matching tests
web/src/lib/content.ts, app/page.tsx, features/page.tsx, faq; app/assets/help/guides.json
docs/DOCUMENTATION.md, docs/TESTING.md
```

## Code style

Follow the existing code: one Convex file per feature, guards from `lib/session.ts` (`requireMember`, `inBusiness`),
plain NZ-English error messages ("Say how much you made"), snapshots of names on records, append-only
movements, and `logAudit` on every write.

## Testing strategy

- Backend: convex-test for each new query and mutation: happy path, auth and role, cross-business refusal,
  and every validation message. Coverage stays at 100%.
- App: widget tests for the nav per operation, the hub, the harvest form, the checks UI, planning and void.
  Coverage stays at 100%.
- Web: page tests for the new copy. Coverage stays at 100%.

## Boundaries

- **Always:** keep old data valid (every new field optional), keep the 100% coverage gates, use the existing
  `Field`/`failures` machinery for checks.
- **Ask first:** new dependencies, making any existing field required, changing a check's critical limit
  away from what the MPI guides say.
- **Never:** hard-delete runs or areas, edit a run's inputs after the fact (voiding is the only correction),
  commit secrets.

## Success criteria

1. A new business can choose Kitchen / Manufacturer / Farm / Retail / Mixed-other. Existing businesses behave as Mixed.
2. A producing business sees Production on the main nav, labelled for its operation.
3. A farm can add a paddock and record a harvest with no inputs. Searching the paddock or the batch code in
   Trace shows the harvest, what's left and who it was dispatched to.
4. A kitchen on NP2 is asked its production checks when making a batch. A cook temp below 75 °C saves the batch
   and raises a corrective action linked to it.
5. A manager can plan tomorrow's batches, see shortfalls, start one pre-filled, and void an untouched batch
   with all its ingredient stock restored.
6. All three test suites pass with 100% coverage. Website and help describe all of the above.

## Decisions

1. **Nav:** 6 tabs with short labels for producing businesses; retail keeps 5 and reaches Production from More.
2. **Check list:** drafted below and signed off by the owner before it goes into code.
3. **Mixed / other:** the full feature set, and the default for businesses with no type set.
