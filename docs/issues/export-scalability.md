# Exports for large businesses

**Priority:** Medium · **Status:** Open

## Problem
The admin export (`backend/convex/exportData.ts`, `app/lib/screens/export_screen.dart`) fetches every
table 500 rows at a time, holds it all in memory, pretty-prints one JSON string, then saves it.

Rough estimate for a busy business (~50 records/day for 7 years ≈ 128k rows): 50–100 MB of JSON and
~250 requests per export.

- **Phone memory:** the rows, the JSON string and the encoded bytes are all in memory together, which can
  be several hundred MB. Low-end Android phones may kill the app mid-export.
- **Server bandwidth:** 100 businesses exporting at once is roughly 5–10 GB leaving the server. On
  loganserver's home connection that's tens of minutes and slows the app for everyone (see
  [hosting-and-backups.md](hosting-and-backups.md)).
- The database side is fine: each page is a small indexed read and each client asks for one page at a time.

## Why it matters
Exports are how businesses get their records out (for verifiers, or if they leave). They need to work for
the biggest customers, not just small ones.

## To do
- [ ] Build the export on the server: a Convex action or scheduled job writes the file to Convex file
  storage and the app gets a download link when it's ready
- [ ] Only one export per business at a time
- [ ] Date-range exports (e.g. "last 12 months") so most exports are small
- [ ] Compressed output (zip / gzip), or one file per table
- [ ] Drop pretty-printing for large exports
- [ ] Load-test with the 7-year seed data from [growing-queries.md](growing-queries.md)

## Notes
- PDF/CSV reports for verifiers are on the roadmap in DOCUMENTATION.md §16 and could share the same
  server-side job.
