# Email addresses

Which `@jampacked.co.nz` addresses JamPacked needs, what each is for, and everywhere it has to appear.
All of them are free on Save Point's Google Workspace once `jampacked.co.nz` is added as a domain:
**aliases** go to Logan's inbox, **Google Groups** can have several people (e.g. Tim later). Research
behind this: [legal-research.md](legal-research.md). Costs: [costs.md](costs.md).

**Today**, until those exist: **contact@savepoint.co.nz** for general enquiries and buying a licence
(`site.contactEmail`: footer, Contact, Legal, Store fallback, search-engine details) and
**support@savepoint.co.nz** for help with the app, privacy and security (`site.supportEmail`, and
`supportEmail` in `app/assets/help/guides.json`: the app's Help screen, `/help/`, the FAQ, Welcome, privacy
requests, the Contact page's help and privacy topics, README and SECURITY.md).

## The addresses

| Address | Type | Why it's needed | Used for |
|---|---|---|---|
| **support@** | Group | **Required:** Apple (support link with up-to-date contact details), Google Play (public developer email, verified, must keep working), Stripe (support email on receipts and card statements; missing details lead to chargebacks) | Customer help, store listings, the Help screen, later the chatbot handing over to a person |
| **privacy@** | Alias | **Required:** NZ Privacy Act (a privacy officer people can contact; access and correction requests answered within 20 working days). Google Play account deletion (a way to ask without the app) | Privacy requests, account deletion, customers' data requests, the Privacy Commissioner |
| **security@** | Group | **Required by RFC 9116** (`security.txt` needs a contact). Good practice | Vulnerability reports, breach notices from Convex / Clerk / Stripe |
| **postmaster@** | Alias | **Required** by the email standards (RFC 2142 / SMTP) | Mail delivery problems |
| **abuse@** | Alias | Expected (RFC 2142) | Spam and abuse complaints |
| **billing@** | Alias (or fold into support@ at first) | Not required | Reply-to on Stripe receipts, money-back refund requests, failed payments |
| **legal@** | Alias | Not required | The "notices by email" address in the terms, the lawyer, trademarks, takedown requests |
| **admin@** | Group (Logan + Tim) | Best practice | **The login for every service**, so no account depends on one person's inbox. 2-step sign-in everywhere |
| **dmarc@** | Alias, auto-archived | Not required | Receives DMARC reports (`rua=` in the DNS record) |
| **logan@** | Alias | Google asks that an organisation's private contact not be a free or personal address; Apple's account holder is a named person | Google Play private contact, Apple account holder and App Review contact |
| **tim@** | Group forwarding to Tim's own email (free) | Optional | A paid Workspace user only if he needs to *send* as tim@ |

**Smallest set for launch:** support@, security@ and admin@ as groups; privacy@, legal@, billing@,
postmaster@ and abuse@ as aliases. Plus logan@ and dmarc@.

For each group, set **Who can post → Anyone on the web**, or outside email bounces. For replying as an
address, add it in Gmail under **Settings → Accounts → Send mail as** (tick "Treat as an alias").

## Where each address appears

### Store listings
| Where | Field | Address |
|---|---|---|
| Google Play Console | Developer email (public) | support@ |
| Google Play Console | Contact email (private, Google only) | logan@ |
| Google Play Console | Account deletion web link | `jampacked.co.nz/delete-account/` (page to build), which names privacy@ |
| Google Play Console | Console login | admin@ |
| App Store Connect | Support URL | `https://jampacked.co.nz/help/` (lists support@) |
| App Store Connect | App Review contact | logan@ |
| Apple Developer | Account holder Apple ID | logan@ |

### Stripe (JamPacked account)
| Field | Address |
|---|---|
| Public details: support email | support@ |
| Customer emails: reply-to | billing@ |
| Team login | admin@ (or Logan's own login, plus Tim invited to the JamPacked account only) |

### Services (logins and alerts)
| Service | Login | Alerts / security contact |
|---|---|---|
| Convex | admin@ | security@ |
| Clerk | admin@ | security@ |
| Cloudflare | admin@ | security@ |
| Google Workspace admin | Logan's existing admin login | – |
| PostHog, Resend, and anything later | admin@ | security@ |

### Website (`web/`)
| Page | Address |
|---|---|
| Footer, Contact, Help, Welcome, Store fallback (`site.contactEmail` / `site.supportEmail` in `web/src/lib/site.ts`) | support@ |
| Privacy Policy: privacy officer and requests | privacy@ |
| Terms: notices | legal@ |
| Terms and Store: refunds / billing questions | billing@ |
| Cookies & data | privacy@ |
| Account deletion page (to build) | privacy@ |
| `/.well-known/security.txt` (to add) | security@ |

### App (`app/`)
| Where | Address |
|---|---|
| Help & support screen (`app/assets/help/guides.json`, shared with `web/src/lib/guides.json`) | support@ |
| Delete my account screen (to build) | privacy@ |
| More → Legal | links to the website's legal pages |

### Repo
| File | Address |
|---|---|
| `SECURITY.md` | security@ |
| `README.md` contact section | support@ |

### Email the app sends (later)
- From a subdomain such as `notifications@mail.jampacked.co.nz`, sent through a transactional email service
  (e.g. Resend), so its sending reputation stays separate from the main inbox
- **Reply-to: support@**, not a "noreply" address
- Footer names **Save Point Limited (trading as JamPacked)**

## Rules for marketing email
Receipts, invites, password resets and service notices aren't marketing. Newsletters and product promotions
are (Unsolicited Electronic Messages Act 2007; AU Spam Act 2003). They need:
- **Consent:** an unticked opt-in box at sign-up
- **Sender identified** as Save Point Limited (s 10)
- A free **unsubscribe** that works for at least 30 days and takes effect within 5 working days (s 11)
- For Gmail's bulk-sender rules: one-click unsubscribe, SPF / DKIM / DMARC

Use a newsletter tool and a separate address such as news@. Not needed for launch.

## DNS (Cloudflare) for jampacked.co.nz
| Record | Value |
|---|---|
| TXT (Google verification) | from the Workspace admin console |
| MX | `smtp.google.com`, priority 1 |
| TXT (SPF) | `v=spf1 include:_spf.google.com ~all` (add the transactional email service's include later) |
| TXT `google._domainkey` (DKIM) | from Admin console → Gmail → Authenticate email |
| TXT `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@jampacked.co.nz`, tightened to `p=quarantine` once reports look clean |

## To do
- [ ] Sort out the "domain already in use" error in Workspace, then add `jampacked.co.nz`
- [ ] DNS records above
- [ ] Create the groups and aliases
- [ ] Switch the website, app, README and SECURITY.md from `contact@` / `support@savepoint.co.nz`
- [ ] Add `/.well-known/security.txt`
- [ ] Update Stripe's public details and reply-to
- [ ] Move service logins to admin@
