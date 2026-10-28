# Account deletion vs 7-year retention

**Priority:** High · **Status:** Open

## Problem
Apple and Google both require apps that let people create accounts to also let them delete their account
from inside the app. The app currently deletes nothing: `RETENTION_YEARS = 7`
(`backend/convex/lib/retention.ts`) and `backend/tests/retention.test.ts` fails if anything other than
sign-out deletes or replaces a document.

## Why it matters
Without account deletion the apps will be rejected from the stores. Deleting everything would break the
legal requirement to keep food safety records.

## To do
- [ ] Decide the rule. Suggested: deleting an account removes the **person's** details (name, email, Clerk
  account, sessions, memberships) but keeps the **business's** records, with the person shown as e.g.
  "Deleted user" in history
- [ ] Decide what happens when the last admin of a business deletes their account (block it, or require
  handing the business to another admin first)
- [ ] Decide what deleting / closing a whole business means (archive and keep records for 7 years, then purge?)
- [ ] Add a "Delete my account" screen in the app (and a web link Google Play can point to)
- [ ] Update `retention.test.ts` to allow exactly this deletion path and nothing else
- [ ] Explain it in the privacy policy and DOCUMENTATION.md §10

## Notes
- Keeping records you're legally required to keep is generally allowed under privacy law and the store
  rules, as long as it's explained to users.
