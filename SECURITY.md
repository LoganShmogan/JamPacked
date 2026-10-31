# Security Policy

JamPacked is maintained by **Save Point Limited**. It holds food safety records that businesses rely on for compliance, so we take reports seriously.

## Reporting a problem

If you find a security issue in JamPacked (the app, the website or this repository), please email **[support@savepoint.co.nz](mailto:support@savepoint.co.nz)** with the subject line "Security: JamPacked". **Do not** open a public GitHub issue for it.

Please include:

- what you found and how to reproduce it
- what an attacker could do with it (for example, read or change another business's records)
- your contact details, if you'd like us to follow up

We will acknowledge your report within 2 working days and keep you updated until it is fixed. Please give us a reasonable time to fix the issue before sharing it publicly.

## Secrets

Nothing secret belongs in this repository. Local settings live in `backend/.env.local` and `web/.env*`, which are git-ignored, as are Android keystores (`*.jks`, `key.properties`) and Firebase/Google config files. Production configuration lives only on the server.

## If a secret leaks

| Secret | What to do |
|---|---|
| Convex admin / deploy key | Generate a new admin key on the server, update the deploy machine, and remove the old one |
| Android upload keystore | Contact Google Play support to reset the upload key; never commit the new one |
| A user's session token | Sessions are random tokens with a 7-day expiry; sign the user out (delete the session row) to revoke it immediately |
| Server SSH access | Remove the key from `~/.ssh/authorized_keys` on loganserver and issue a new one |

## How JamPacked is protected

Password hashing, sessions, roles, business membership checks and the audit trail are described in [docs/DOCUMENTATION.md §9–10](docs/DOCUMENTATION.md#9-authentication-roles--security).
