# Customer compliance reports on the website

**Priority:** Medium · **Status:** Open

## Problem
Customers can only see their records inside the app. Managers and owners want trends and summaries on a
bigger screen, and verifiers want printable reports.

## Design
- Signed-in pages on the website under `/dashboard/<business>`, using the same Convex permission checks as
  the app (`requireMember`, roles from DOCUMENTATION.md §9).
- Reports: temperature compliance over time, deliveries accepted / rejected by supplier, open and overdue
  corrective actions, programme records due vs done, audit results, stock wastage and expiries.
- Printable / PDF versions for verifiers (the PDF/CSV roadmap item in DOCUMENTATION.md §16).
- Trends over months and years need **daily summary rows** kept up to date on write, not recounting raw
  records each time (see [growing-queries.md](growing-queries.md)).

## To do
- [ ] Decide the first three reports with real users
- [ ] Daily summary table per business + backfill for existing data
- [ ] Report queries and pages, with date-range pickers
- [ ] PDF / CSV export (can share the server-side job in [export-scalability.md](export-scalability.md))
- [ ] Read-only access still works for lapsed subscriptions (records must stay reachable)
