# Test accounts

The accounts `backend/convex/seed.ts` builds on a deployment that isn't live yet. Use them to try the app,
take screenshots, demo it, and test each kind of business and each role. How to run the seed:
[DOCUMENTATION.md §14](DOCUMENTATION.md#14-deployment-loganserver).

- **Password for every account:** `jampacked-test` (`SEED_PASSWORD` in `seed.ts`).
- **Sign in at:** the web app or phone apps, on a deployment the seed has been run on.
- **The emails are fake** (`@jampacked.test`). Nothing is ever sent to them.
- **Re-seeding wipes every table first**, real data included. It only runs with `SEED_ALLOWED=true` set
  on the deployment. **Remove that variable, and these accounts, before launch.**
- The seed builds each business through the app's own functions, one simulated day at a time. That gives
  each one real history: Insights, the Due list, expiring stock, and open and closed corrective actions.
  The random numbers are fixed, so a re-seed gives the same data.
- **Licences:** the seed creates no subscriptions. While `BILLING_ENFORCED` is unset (it's new, so it
  isn't set anywhere yet), every business works. Turn it on and every one becomes read-only, including the
  NP1 farm, because it has staff. To test billing, link a test subscription to a business with
  `billing:link`. Turn it off again before re-seeding, or the seed's own writes are refused part-way
  through, after it has wiped everything.

## Who's who

| Email | Name | Role | Business(es) | Use it to test |
|---|---|---|---|---|
| `full@jampacked.test` | Fiona Fuller | Admin; **platform admin** | Harbour Kitchen & Farm; Fiona's Farm Shop; Old Town Café (archived) | Everything at once, the business picker, custom programmes, archived businesses, and the owner dashboard (`jampacked.co.nz/admin`) |
| `manager@jampacked.test` | Manu Manager | Manager | Harbour Kitchen & Farm | What managers can do, and what's left to admins (settings, invites, export) |
| `staff@jampacked.test` | Sam Staff | Staff | Harbour Kitchen & Farm; Southern Preserves Ltd | Staff limits, and one person working at two businesses with a picker each day |
| `pending@jampacked.test` | (none yet) | Invited staff | Harbour Kitchen & Farm | An invite nobody has taken up: sign up with this email and tick "I've been invited" |
| `factory@jampacked.test` | Morgan Maker | Admin | Southern Preserves Ltd | A busy manufacturer |
| `qa@jampacked.test` | Quinn QA | Manager | Southern Preserves Ltd | A QA manager: holds, releases, voids, stocktakes |
| `line@jampacked.test` | Lee Line | Staff | Southern Preserves Ltd | Production line staff making batches |
| `farm@jampacked.test` | Rangi Farmer | Admin | Riverbend Orchard & Apiary | A farm: the Harvest tab and growing areas |
| `picker@jampacked.test` | Pita Picker | Staff | Riverbend Orchard & Apiary | Recording harvests as staff |
| `cafe@jampacked.test` | Kiri Cafe | Admin | Kai Corner Café | A small kitchen with two weeks of history |
| `shop@jampacked.test` | Sunita Shop | Admin | Corner Dairy | Retail: no Production tab, goods in and sales only |
| `ece@jampacked.test` | Erin Educator | Admin | Little Kiwis ECE | An early childhood centre on NP2 ECE |
| `new@jampacked.test` | Nina New | Admin | Fresh Start Foods | A brand new account: the empty screens and first-time setup |

## The businesses

| Business | Type | Programme | Region | History | What's in it |
|---|---|---|---|---|---|
| **Harbour Kitchen & Farm** | Mixed | NP3 | Otago | 45 days, busy | Everything. Deliveries from four suppliers, including partial, rejected and voided ones. Recipes with their checks (scones, lasagne, curry, jam), batches and harvests from a glasshouse, a paddock and hives, a voided batch, planned batches with a shortfall, holds, a transfer, dispatches to three customers, a completed stocktake and one in progress, audits (one in progress), programme records, and open and closed corrective actions. |
| **Fiona's Farm Shop** | Farm | Custom ("Farm shop plan", copied from NP1) | Otago | New | A custom programme with its own Brix reading harvest check (fails under 10 °Bx). |
| **Old Town Café** | Kitchen | NP2 | Otago | New | Archived: under "Show archived" on the business picker. |
| **Southern Preserves Ltd** | Manufacturer | NP2, spreads | Canterbury | 60 days, busy (the biggest) | Strawberry jam and tomato chutney from recipes with pH checks (now and then a failed one), dispatches to four customers including supermarkets, and a QA manager and line staff. |
| **Riverbend Orchard & Apiary** | Farm | NP1, horticulture + honey | Hawke's Bay | 30 days, quiet | Four growing areas (two orchard blocks, hives, a tunnel house), harvests of apples, pears, mānuka honey and salad greens with harvest and tutin checks, sold to a market, a supermarket and a packhouse. |
| **Corner Dairy** | Retail | NP2, chilled and frozen retail | Auckland | 21 days, busy | Goods in from three suppliers and sales only. No Production tab (it's under More). |
| **Kai Corner Café** | Kitchen | NP2 | Wellington | 14 days, half as busy | A small café: scones and chicken curry from recipes. |
| **Little Kiwis ECE** | Kitchen | NP2, ECE | Waikato | 10 days | Banana porridge for the children. No sickness or transport records (ECE doesn't need them). |
| **Fresh Start Foods** | Mixed | NP2 | Nelson | None | Empty, for first-time use. |

Every business with history also has, from its simulated days: daily chiller and freezer checks (with the odd
reading out of range), records on the programme's schedule (pest checks, thermometer checks, a staff
training record and a customer complaint), and corrective actions closed a day or three after they were
raised, with the last few days' still open. Businesses with more than a week of history also have a
stocktake left in progress and a goods receipt audit left in progress.

## Roles at a glance

| | Staff | Manager | Admin |
|---|:-:|:-:|:-:|
| Receive goods, temperatures, records, audits, make batches and harvests | ✓ | ✓ | ✓ |
| Use, sell, dispatch, waste and move stock, put it on hold | ✓ | ✓ | ✓ |
| Suppliers, products, recipes, locations, growing areas, plans | | ✓ | ✓ |
| Release holds, adjust stock, stocktakes, recalls, void | | ✓ | ✓ |
| Audit trail and members list | | ✓ | ✓ |
| Invite and change members, business settings, programme, export | | | ✓ |

The full table is in [DOCUMENTATION.md §9](DOCUMENTATION.md#9-authentication-roles--security).
