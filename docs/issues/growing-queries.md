# Queries that grow with the data

**Priority:** Medium · **Status:** Open

## Problem
The backend has 33 `.collect()` calls, which read every matching row with no limit. Most are fine because
the index range is naturally small (today's deliveries, one delivery's items, one lot's movements, a
user's memberships). These ones can keep growing as a business builds up years of data:

| Where | What it reads | Grows when |
|---|---|---|
| `lib/stock.ts:59` `lotsOnHand` | every available + held lot | usage isn't recorded, so old lots never leave "available" |
| `lib/facts.ts:22-30` | deliveries, items and temp logs in the audit period | audits cover long periods / busy sites |
| `lib/facts.ts:65` | a full year of programme records | busy sites with many records per day |
| `lib/facts.ts:30`, `dashboard.ts:17`, `businesses.ts:26` | all open corrective actions | CAs are raised but never closed |
| `deliveries.ts:340` `trace` | all delivery items with a batch code | common batch codes across years |
| `suppliers.ts:21`, `products.ts:13`, `lib/stock.ts:74`, `locations.ts:12` | whole catalogue | large catalogues (usually fine) |

`migrations.ts` reads whole tables, but it's a one-off admin migration.

## Why it matters
These run on everyday screens (dashboard, stock on hand, audits). They get slower each year, and Convex
limits how much one function can read, so a busy business could eventually see errors instead of slowness.

## To do
- [ ] Seed a local deployment with ~7 years of realistic data for one busy business and time the dashboard,
  stock on hand, audit start and trace
- [ ] For anything slow: paginate, add `.take()` limits, narrower indexes, or keep running counts/summaries
  updated on write instead of recounting
- [ ] Consider nudging users to close old CAs and record usage / stocktake so lots don't pile up
- [ ] Add a test that fails when a new unbounded `.collect()` is added on a business-wide index without a
  comment explaining why it's bounded

## Notes
- Line numbers are as of commit `4a92528`; re-check with `grep -rn "\.collect()" backend/convex`.
