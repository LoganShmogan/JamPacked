# Move sign-in to Clerk

**Priority:** High · **Status:** Open

## Problem
Sign-in is the development system: passwords hashed in Convex (`backend/convex/lib/password.ts`) and
session tokens (`backend/convex/lib/session.ts`). Known gaps
([DOCUMENTATION.md §9](../DOCUMENTATION.md#9-authentication-roles--security)):

- open registration: anyone with the URL can create an account and a business
- no rate limiting on sign-in
- no password reset

## Why it matters
Not safe for real customers. Clerk handles passwords, resets, rate limiting, and Google / Apple sign-in,
and the same account works on the website and both phone apps.

## To do
Steps from [DOCUMENTATION.md §15](../DOCUMENTATION.md#15-migrating-to-clerk):

- [ ] Clerk: create the application and a JWT template named `convex`
- [ ] Add `backend/convex/auth.config.ts` with the Clerk issuer domain and `applicationID: "convex"`
- [ ] Add `clerkId` (+ index) to `users`; change `getUser` in `lib/session.ts` to use
  `ctx.auth.getUserIdentity()` and find/create the user by Clerk subject
- [ ] Flutter: add `clerk_flutter`, replace login/register in `app/lib/services/auth_service.dart`, send the
  Clerk JWT as `Authorization: Bearer <jwt>` from `ConvexClient`
- [ ] Link existing live accounts to Clerk (e.g. match by email on first Clerk sign-in). **Not covered in
  §15 yet**
- [ ] If offering Google sign-in on iOS, also offer Sign in with Apple (see
  [app-store-release.md](app-store-release.md))
- [ ] Remove `passwordHash` / `passwordSalt` and the `sessions` table once everyone has moved
- [ ] Update §9, §15 and the tests

## Notes
- Clerk holds identity (email, password, social logins); Convex keeps the `users` row, memberships, roles
  and all business data.
- Screens only use `AuthService.user` / `token`, so they shouldn't need changes.
