# Finish the multi-business migration

**Priority:** Low · **Status:** Open

## Problem
`businessId` is still optional in `backend/convex/schema.ts`, and the legacy `settings` table and
`users.role` field are still there, so data from before multi-business could be migrated by
`migrations:toMultiBusiness` (it ran on loganserver on 27 Oct 2026; production moved to Convex Cloud with fresh data).

## Why it matters
Optional `businessId` means the schema doesn't guarantee every record belongs to a business; leftover
fields and tables are confusing to work with.

## To do
- [x] Run `migrations:toMultiBusiness` on the live server, and confirm existing users see their business
  (checked 27 Oct 2026: no `settings` rows left and every delivery has a `businessId`)
- [ ] Make `businessId` required in `schema.ts`
- [ ] Remove the legacy `settings` table and `users.role`
- [ ] Remove the migration
