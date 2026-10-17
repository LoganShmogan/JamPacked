# NZSafetyHealthApp: Unit Tests

Both halves of the project have unit tests with a **100% coverage gate**:

| Part | Framework | Tests | Coverage (enforced) |
|---|---|---|---|
| Backend (`backend/`) | Vitest + [`convex-test`](https://www.npmjs.com/package/convex-test) | 108 | 100% statements, branches, functions and lines |
| App (`app/`) | `flutter_test` (unit + widget tests) | 161 | 100% lines (the Dart VM reports lines only) |

No test needs a running Convex deployment, a network connection, a device or a camera.

---

## Contents

1. [Running the tests](#1-running-the-tests)
2. [Backend tests](#2-backend-tests)
3. [App tests](#3-app-tests)
4. [Writing a new test](#4-writing-a-new-test)
5. [Keeping coverage at 100%](#5-keeping-coverage-at-100)
6. [Bugs the tests found](#6-bugs-the-tests-found)

---

## 1. Running the tests

```bash
# Backend
cd backend
npm install
npm test                 # run once
npm run test:watch       # re-run on save
npm run test:coverage    # run with coverage; fails below 100%
npm run typecheck        # type-checks convex/ and tests/

# App
cd app
flutter pub get
flutter test                                              # run once
flutter test test/screens/login_screen_test.dart          # one file
flutter test --plain-name "signs in"                      # tests whose name contains the text
flutter test --coverage && dart run tool/check_coverage.dart   # coverage; fails below 100%
flutter analyze                                           # lints lib/, test/ and tool/
```

Coverage reports:

- Backend: printed in the terminal, plus an HTML report at `backend/coverage/index.html`
  and `backend/coverage/lcov.info`.
- App: `app/coverage/lcov.info`. For HTML, `genhtml coverage/lcov.info -o coverage/html`
  (from the `lcov` package).

Both `coverage/` folders are git-ignored.

---

## 2. Backend tests

### How they run

`convex-test` runs the real Convex functions against an in-memory database built from
`convex/schema.ts`, so queries, mutations, actions, indexes, validators and `internal.*` calls
behave like a deployment. Tests run in the `edge-runtime` environment (the same Web Crypto
APIs the Convex runtime has), which means PBKDF2 password hashing is tested for real.

Configuration lives in `backend/vitest.config.mts`. Coverage is measured over `convex/**/*.ts`,
excluding the generated `convex/_generated/` code, with all four thresholds set to 100.

Tests live in `backend/tests/`, outside `convex/`, so `npx convex deploy` never bundles them.
`backend/tests/tsconfig.json` type-checks them against the Convex sources.

### Layout

| File | What it covers |
|---|---|
| `helpers.ts` | Shared setup (see below). |
| `lib.test.ts` | `lib/password` (hashing, verify, constant-time compare), `lib/audit` (`diff`, `logAudit`), `lib/settings` (defaults, every `isTempCompliant` / `unitCompliant` rule), `lib/session` (valid, unknown, expired, orphaned and deactivated sessions; role checks), `lib/templates` (unique ids). |
| `auth.test.ts` | Register (validation, first user is admin, duplicate email), login (success, wrong password, unknown email, deactivated user, failed attempts logged), logout, `me`, `listUsers`, `updateUser` and its self-demotion guards. |
| `catalogue.test.ts` | Business settings (insert vs patch, diffs, admin-only), suppliers (create, list, get, update, permissions), products (create, list, barcode lookup, update) and the Open Food Facts `lookupBarcode` action with `fetch` stubbed. |
| `deliveries.test.ts` | Goods inwards: validation, status (accepted / partial / rejected), product auto-cataloguing, every auto-raised corrective action, voiding, notes, list, get, supplier suggestions, expiring stock and trace & recall. |
| `operations.test.ts` | Temperature checks (compliant, out of range, units), corrective actions (create, list, close), the audit log query (per entity, full trail, filters) and the dashboard summary. |
| `audits.test.ts` | Templates, list, get, start (pre-fill, periods, titles), answer (overrides, locking), refresh auto-fill (keeps manual answers), complete (scoring, findings raise CAs). |
| `facts.test.ts` | The audit auto-fill engine `computeFacts`, fed raw rows: empty period, clean period, a period where every check fails, list truncation and time-zone-aware "missing days". |

### Helpers (`backend/tests/helpers.ts`)

| Helper | Purpose |
|---|---|
| `setup()` | A fresh in-memory backend. Call once per test so tests never share data. |
| `signIn(t, role?, overrides?)` | Inserts a user and a live session directly (skips PBKDF2, which is slow) and returns `{ userId, token }`. Names follow `"<Role> <n>"`, e.g. `"Staff 0"`. |
| `addSupplier(t, overrides?)` | Inserts an approved, active supplier. |
| `item(overrides?)` | A valid, compliant delivery line (chilled milk at 3°C, batch, use-by in 5 days). |
| `auditLog(t)`, `cas(t)`, `getDoc(t, id)` | Read back the audit trail, corrective actions or one document. |
| `DAY` | Milliseconds in a day. |

A typical test:

```ts
test("rejected items need a reason", async () => {
  const t = setup();
  const { token } = await signIn(t, "staff");
  const supplierId = await addSupplier(t);
  await expect(
    t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true,
      items: [item({ accepted: false, rejectionReason: "  " })],
    }),
  ).rejects.toThrow("Give a reason for rejecting Milk 2L");
});
```

Things to know:

- To test "not found" paths, insert a row and `ctx.db.delete` it inside `t.run`, then use its id.
- Values that are `undefined` are dropped when Convex stores a document, so assert absence
  with `not.toHaveProperty("field")` rather than `{ field: undefined }`.
- Convex does not preserve the key order of function arguments, so don't assert on strings
  built from `Object.entries(args)` in a fixed order.
- Stub external HTTP with `vi.stubGlobal("fetch", ...)` and undo it with
  `vi.unstubAllGlobals()` in `afterEach`.

---

## 3. App tests

### How they run

Screens get their data through `context.q / m / a`, which call the `ConvexClient` found in
the widget tree. The tests swap in **`FakeConvex`**, a subclass that answers each function path
from a map of handlers and records every call. Nothing goes over the network.

`ConvexClient` itself is tested against `package:http/testing.dart`'s `MockClient` using
`http.runWithClient`, which covers the real JSON protocol and error handling.

`AuthService` uses `SharedPreferences.setMockInitialValues` for its stored token.

The barcode scanner (`mobile_scanner`) has no camera in tests. The tests read the
`MobileScanner` widget from the tree and call its `onDetect` / `errorBuilder` callbacks
directly to simulate a scan or a camera error.

### Layout

```
app/test/
├── helpers.dart          FakeConvex, pumpScreen, tapOn, answerDialog, ...
├── fixtures.dart         Sample server responses + baseHandlers()/fakeWith()
├── app_test.dart         main(), CONVEX_URL default, the auth gate (spinner / login / home)
├── services/
│   ├── convex_client_test.dart   HTTP protocol, null-stripping, every error path, change counter
│   └── auth_service_test.dart    restore, login, register, logout, AppUser roles
├── widgets/
│   ├── common_test.dart          formatters, context helpers, QueryBuilder, Pill, promptText, ...
│   └── audit_history_test.dart   action icons, timeline
└── screens/              One file per screen (two for goods inwards: form and item editor)
```

| Screen test | Highlights |
|---|---|
| `login_screen_test` | Validation, sign in (button and keyboard), register mode, busy spinner, error toast, password visibility. |
| `home_dashboard_test` | Phone (bottom bar) and wide (rail) layouts; every KPI state; every KPI / quick-action tile navigates correctly. |
| `more_screen_test` | Menu per role (staff, manager, admin), every entry opens its screen, sign out returns to the login screen. |
| `goods_in_screen_test` | Delivery list states; delivery detail (all item checks, void with reason, edit notes, role rules). |
| `goods_in_form_screen_test` | Loading, supplier choice and warning, suggestions, add / edit / delete items, save (success, validation, server error), add supplier inline, scan-to-add via catalogue, Open Food Facts, unknown barcode and lookup errors. |
| `item_editor_screen_test` | Live temperature check for each storage type, problems list, auto-filled rejection reason, allergens, units, date pickers, saved output. |
| `audits_screen_test`, `audit_detail_screen_test` | Starting audits (daily vs rolling period), history scores, answering every question type, notes, refresh, sign-off, locked audits. |
| `corrective_actions_screen_test` | Open / closed tabs, severity and source labels, close out, raise a manual action. |
| `temperature_screen_test` | Readings list, recording via known units or the type dropdown, local validation, server errors, auto-open. |
| `suppliers_screen_test` | List, role permissions, create / edit form, history, pop results. |
| `record_lists_test` | Expiring stock labels, trace & recall search, product list and filter. |
| `admin_screens_test` | Audit trail filters and change-detail dialog, user role / activation menu, business settings form. |
| `scanner_screen_test` | Scan pops once, "Type it" entry, camera error message. |

### Helpers (`app/test/helpers.dart`, `app/test/fixtures.dart`)

| Helper | Purpose |
|---|---|
| `FakeConvex(handlers)` | Fake client. A `Handler` is `(args) => value`; throw to fail. Mutations and actions bump `changes` like the real client, so `QueryBuilder`s refetch. `calls` / `callsTo(path)` show what was sent (args include `sessionToken`). |
| `fakeWith(overrides)` | A `FakeConvex` that answers every query the app makes with sample data from `fixtures.dart`, plus your overrides. Use this for screens so navigation never hits a missing handler. |
| `fails(message)` / `fakeError(message)` | A handler / exception that behaves like a `ConvexError` from the server. |
| `signedIn(convex, role:)` / `userWith(role)` | An `AuthService` already signed in as "Sam Cook". |
| `pumpScreen(tester, widget, convex:, role:, auth:, size:)` | Pumps a widget inside the real providers and theme, on an 800×2000 screen by default, and settles. Returns the `FakeConvex`. |
| `wrapProviders(convex, auth, child)` | The same wrapper without pumping, for tests that must control frames (e.g. to see a spinner). |
| `tapOn(tester, finder)` | Scrolls into view, taps, settles. |
| `answerDialog(tester, text, button:)` | Types into the open dialog's text field and presses a button. |
| `msAgo(d)` / `msFromNow(d)` | Timestamps relative to now, for date-dependent UI. |

A typical screen test:

```dart
testWidgets('close out needs a resolution', (tester) async {
  final convex = await pumpScreen(
    tester,
    const CorrectiveActionsScreen(),
    convex: fakeWith({
      'correctiveActions:list': (a) => a['status'] == 'open' ? [ca()] : [],
      'correctiveActions:close': (_) => null,
    }),
  );
  await tapOn(tester, find.text('Close out'));
  await answerDialog(tester, 'Binned it', button: 'Close');
  expect(convex.callsTo('correctiveActions:close').single.args,
      {'id': 'c1', 'resolution': 'Binned it', 'sessionToken': 'tok'});
});
```

Things to know:

- To check what a screen pops with, push it from a small launcher page and record the
  result (see `openForm` / `openEditor` / `openScanner` in the screen tests).
- Screens that read `context.watch<AuthService>().user!` (More, Dashboard) must be signed in.
  To test sign-out, pump `NzSafetyHealthApp` so the real auth gate swaps the screen out.
- The item editor is a full-screen dialog: close it with `find.byType(CloseButton)`, not
  `tester.pageBack()`.
- Never use `pumpAndSettle` while a `CircularProgressIndicator` is on screen (it animates
  forever). Use `pump()` and complete a `Completer` to release the fake response.
- Flutter tests render text in the square "Ahem" font, which is wider than real fonts, so
  layout overflows show up early. Treat them as real bugs, not test noise.

---

## 4. Writing a new test

**Backend function**: add a `describe` block to the test file for that area (or a new
`tests/<module>.test.ts`). Start with `const t = setup()` and `signIn`, call the function
through `api.<module>.<fn>`, then assert on the return value and on side effects:
`auditLog(t)` for the audit trail, `cas(t)` for corrective actions, `getDoc` for the record.
Every error path (`ConvexError`) should have a `rejects.toThrow("message")` test.

**App screen**: add a file under `app/test/screens/`. Pump with `pumpScreen(... convex: fakeWith({...}))`,
drive it like a user (`tapOn`, `enterText`, `answerDialog`) and assert on both the UI and
`convex.callsTo(path)`. If the screen calls a new backend function, add a default handler to
`baseHandlers()` in `fixtures.dart` when it's a query other screens may hit.

---

## 5. Keeping coverage at 100%

- Backend: `npm run test:coverage` fails if any of statements, branches, functions or lines
  drops below 100%. The report lists the uncovered lines.
- App: `dart run tool/check_coverage.dart` (after `flutter test --coverage`) exits non-zero
  and prints each file and line that was never run. Because `app_test.dart` imports
  `main.dart`, every library in `lib/` is loaded, so an untested new file shows up as 0% rather
  than being silently left out.
- A `const` constructor that is only ever used as `const` never runs, so Dart reports it as
  uncovered. Construct it once without `const` (e.g. with a `UniqueKey`), as in
  `goods_in_form_screen_test.dart`.
- Prefer a real test over an ignore comment. If a branch truly can't be reached, consider
  whether the code is needed.

To run both gates in CI:

```bash
(cd backend && npm ci && npm run typecheck && npm run test:coverage)
(cd app && flutter pub get && flutter analyze && flutter test --coverage && dart run tool/check_coverage.dart)
```

---

## 6. Bugs the tests found

Fixed while the tests were being written:

| Where | Problem | Fix |
|---|---|---|
| `app/lib/screens/goods_in_screen.dart`, `corrective_actions_screen.dart` | Both tabs have a floating action button with Flutter's default hero tag. `HomeShell` keeps every tab alive in one route, so any navigation from the shell hit the "multiple heroes share the same tag" assertion in debug builds. | Each FAB now has its own `heroTag`. |
| `app/lib/widgets/common.dart` (`Pill`) | Pill text could not wrap, so long pills (e.g. "Not on approved supplier list. A corrective action will be raised") overflowed narrow screens. | The text is wrapped in `Flexible`. |
| `backend/convex/products.ts` (`lookupBarcode`) | The storage guess matched `/dairy/`, but Open Food Facts tags dairy as `en:dairies`, so dairy products were guessed as `ambient`. | The pattern now matches `dair(y\|ies)`. |

