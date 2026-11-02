# Legal research: what JamPacked needs

Research notes, 3 November 2026. **This is not legal advice.** It's a briefing to take to a NZ lawyer so
the review is quicker and cheaper. Each point says how sure it is; anything marked *check* needs confirming
against the primary source or by the lawyer. The current drafts are on the website under `/legal/`
(`web/src/app/legal/`); the to-do list is in [issues/legal-documents.md](issues/legal-documents.md).

---

## 1. Who the legal party is

- **The contracting party is Save Point Limited.** A trading name is not a legal person. Every document
  (terms, privacy policy, invoices, receipts, emails, store listings) should name *"Save Point Limited
  (trading as JamPacked)"*, not just "JamPacked". The drafts already do this.
- **Companies Act 1993, s 25:** if a document that creates an obligation for the company (an invoice, the
  terms, an order confirmation) leaves out the company's registered name, the person who signed or issued
  it can become **personally liable**. "Documents" includes emails and electronic records. So also put the
  company name in Stripe receipts, email footers and the website footer. *Check s 25 and s 206 on
  legislation.govt.nz: commentators disagree on which section covers invoices.*
- **Apple** shows *Save Point Limited* as the seller (organisation enrolment). **Google** can show
  "JamPacked" as the developer name, but the account is still Save Point's.
- ⚠️ **Founders agreement with Tim** (`~/Documents/JamPacked/Legal/`): make sure it says that the
  **JamPacked IP (code, brand, data) belongs to Save Point Limited**, and covers Tim's share of JamPacked
  revenue or equity if Save Point is also used for other work (MemeLine, QuillFin, client projects). The
  lawyer should read the founders agreement and the terms together. A messy IP position is a problem for
  investors, a sale, and even trademark ownership.

## 2. Privacy: JamPacked has two different roles

This shapes the whole privacy policy and the terms.

| Whose information | JamPacked's role | What that means |
|---|---|---|
| Account holders (admins, staff), website visitors, people who email support | **Agency** (it collects and decides) | All 13 privacy principles apply to us directly |
| What a business enters: staff names on records, supplier contacts, customers stock goes to | **Agent** of the business (Privacy Act s 11) | The information is treated as held by **the business**. We may only use it to provide the service. The business stays responsible for it, as Xero's terms put it |

**Confidence: high.** This is how the Privacy Commissioner treats cloud providers and how Xero and other
NZ SaaS products set up their terms.

**What follows from that:**
- **Stay an agent.** If we use customers' records for *our own* purposes, we stop being an agent for that
  use. The current privacy policy says task timings are looked at "across all businesses, without names, to
  make JamPacked quicker". That's fine **if it's truly de-identified/aggregated** and the terms give us a
  licence to create anonymised statistics (Xero's terms have exactly this clause). Add that clause.
- **Add a "Data processing" section to the terms** (Xero has separate data processing terms). It should say:
  - we process business records only on the business's instructions
  - security measures
  - a sub-processors list, and that we give notice before adding a new one
  - we tell the business promptly about a breach so it can decide whether to notify
  - we help with access and correction requests
  - what happens to the data at the end
- **The business must have the right to record the people it records.** The terms already say this. Keep it.

### NZ Privacy Act 2020: our own obligations
- **Privacy officer (s 201):** every agency must have one. Name the role (e.g. "Privacy Officer, Save Point
  Limited, privacy@jampacked.co.nz") in the policy.
- **IPP 3 (notice at collection):** at sign-up, say what we collect and why, and link the privacy policy
  next to the button, not only in a footer.
- **IPP 3A (new, in force 1 May 2026):** when we collect someone's information **from someone else**, we
  must tell them unless an exception applies. **This hits staff invites:** the admin gives us a staff
  member's email, so we've collected it indirectly. **Fix:** the invite email itself says who we are, why
  we have their email and links the privacy policy. The sign-up screen they land on does the same.
  Supplier and customer details entered by a business are probably the business's IPP 3A job, because we
  hold them as its agent. *Confirm with the lawyer, and read the OPC's IPP3A guidance (Oct 2025).*
- **IPP 5 (security):** reasonable safeguards. Keep a short internal security note covering:
  - encryption in transit
  - who at Save Point can access production
  - Convex/Clerk access controls
  - backups
  - the audit log
- **IPP 6/7 (access and correction):** respond within **20 working days**. Admin export already covers most
  of this.
- **IPP 9 (don't keep it longer than needed):** we keep records 7 years. The policy should say **why**.
  Check the actual legal requirement. The Food Act 2014 sets record retention in **ss 36 (food control
  plans) and 81 (national programmes)**, and *I couldn't confirm the period from search; I believe it's
  4 years*. Seven years matches the **tax record** rule (Tax Administration Act). Either justification
  works, but the policy should state the real one. Seven years is also a promise we must be able to keep
  (see §4, "if we stop trading").
- **IPP 12 (sending overseas):** storing data with **agents** overseas (Convex, Clerk, Stripe, Vercel,
  PostHog, Anthropic) is **not a disclosure under IPP 12**, as long as they only process it for us. We stay
  responsible for them. Still **name each provider and the country** in the policy: customers expect it,
  and the privacy issue already lists it as a gap.
- **Notifiable privacy breaches (Part 6):** if a breach is likely to cause **serious harm**, notify the
  Privacy Commissioner (through **NotifyUs**) and the affected people. The OPC expects this **within 72
  hours** of knowing. Failing to notify is an offence (up to $10,000). For data we hold as an agent, the
  business decides whether to notify, so we must tell it quickly. Write a one-page incident plan: who
  decides, who tells customers, and template emails.

### Australia
- **Privacy Act 1988 (APPs):** businesses with turnover **under A$3M are generally exempt** (the "small
  business exemption"), so Save Point probably isn't legally bound yet. But **many of our AU customers'
  own obligations still flow through to us**, and the exemption is being narrowed in reforms still under
  way. The draft already says we follow the APPs. Keep that; it's the safe position. *Confidence: medium,
  the AU reform timeline is moving.*

### AI support chatbot (planned)
- OPC guidance (2023, updated Sept 2023): don't put personal information into AI tools unless the
  provider commits **in writing** not to keep or reuse it, and say so in the privacy policy. Anthropic's
  commercial API terms are the thing to check (*check the current data-retention and no-training terms at
  launch*).
- **Say clearly it's an AI**, and give a way to reach a person. Pretending to be human risks breaching the
  Fair Trading Act.
- **You're responsible for what the chatbot says.** In *Moffatt v Air Canada* (2024, Canada) the airline
  had to honour a refund policy its chatbot made up. Keep the bot to the help guides, and don't let it
  promise refunds, discounts or compliance outcomes.
- Add Anthropic and the email provider to the sub-processors list when it's switched on.

## 3. Terms of Service

### Things NZ law lets us do
- **Contract out of the Consumer Guarantees Act (s 43):** allowed because customers buy for business
  purposes. The contract-out must be **in writing**, both parties must be **in trade**, and it must be
  **fair and reasonable**. The draft already has this.
- **Optionally contract out of some Fair Trading Act sections (s 5D):** the misleading-conduct sections
  (ss 9, 12A, 13, 14(1)), under the same three conditions. Many B2B SaaS terms do this. Ask the lawyer
  whether it's worth it. You can never contract out of the unfair-terms rules.
- **Limit liability:** e.g. capped at fees paid in the last 12 months, no indirect or consequential loss.
  This is standard (Xero does exactly this). Carve-outs for fraud and wilful misconduct make the cap more
  likely to stand up.
- **Online acceptance:** a **tick-box ("I agree to the Terms and Privacy Policy") with the version and
  timestamp recorded** is the strongest form. A link in the footer that you never actively accept
  ("browsewrap") is weak, and NZ courts haven't tested it. This is already on the to-do list. Do it.

### Things that limit what we can do
- **NZ unfair contract terms now cover small business contracts** (Fair Trading Act, since 16 Aug 2022):
  standard-form contracts in trade worth **under $250,000 a year**. That's **every** JamPacked customer. A
  term is unfair if it causes a significant imbalance, isn't reasonably needed to protect us, and would
  cause detriment. A court can strike it out, and including one breaches the Act. Clauses that are often
  challenged, and how ours stand:
  - *Changing prices or terms whenever we like.* Ours: 30 days' notice before a price change. **Add:** the
    customer can cancel before it takes effect, and the same for significant term changes. Xero gives 60
    days for material changes.
  - *Suspending or ending the service with no notice.* **Add** a clear process, e.g. a warning email, then
    read-only after X days unpaid. Immediate suspension only for serious misuse or security risk.
  - *One-sided liability.* Make the indemnity and the cap reasonably mutual.
- **Australia is stricter:**
  - **Unfair contract terms:** since **Nov 2023** these are **illegal with penalties** (up to A$50M per
    term for companies), not just void. They cover small businesses with **under 100 employees or under
    A$10M turnover**, which is all of our AU customers. Same fixes as above.
  - **Australian Consumer Law consumer guarantees:** a business buying services for **A$100,000 or less**
    counts as a "consumer". **So the NZ CGA contract-out does nothing for AU customers.** Consumer
    guarantees (services provided with due care and skill, fit for purpose) **can't be excluded**, though
    for non-household services liability can usually be **limited to re-supplying the service or paying
    for it to be re-supplied**. Choosing NZ law doesn't switch the ACL off for AU customers.
  - **Fix:** add an "If you're in Australia" clause written by the lawyer.
  - *Confidence: high on the thresholds, check how the ACL applies to an NZ-based supplier.*

### Clauses comparable products have that our draft is missing
Compared against Xero's NZ terms (the best local reference for B2B SaaS) and typical food-safety SaaS terms:

1. **Who can accept:** the person signing up confirms they're authorised to bind the business. Invited
   staff accept the terms too (via the tick-box on their sign-up).
2. **Admin is responsible for their users:** who has access and what they do. Xero ss 4–11 is the model.
3. **Data licence:** customers own their data and give us a licence to host, back up and process it to run
   the service. Also **create anonymised, aggregated statistics** (needed for Insights benchmarks and task
   timings).
4. **Data processing section** (see §2).
5. **Suspension process** (see above) and **termination by us** with notice, e.g. 30 days, plus a
   refund of any prepaid unused period if we end the service without cause.
6. **Data after the subscription ends:** ours promises read-only access and 7-year retention.
   - Define it: "read-only access and export for as long as JamPacked operates. If we stop operating
     JamPacked, at least 90 days' notice to export".
   - Otherwise this is an open-ended promise.
   - Xero archives data and lets you reactivate. It doesn't promise forever.
7. **Availability:** "we aim to" wording, no guaranteed SLA, planned maintenance, and no liability for
   third-party outages (Convex, Clerk, app stores). The draft mostly has this.
8. **Food safety disclaimer:** the draft is good. Also add:
   - **no reliance for regulatory outcomes**: passing a verification is the business's responsibility
   - **alerts and corrective actions are aids**: if the app doesn't flag something, the business is still
     responsible
9. **Acceptable use:** no reverse engineering, scraping, reselling, uploading unlawful content, or
   probing security.
10. **IP and feedback:** we own the software. If customers send ideas, we can use them.
11. **Third-party services:** Open Food Facts data, the app stores, Stripe, each under their own terms.
12. **AI features:** answers may be wrong, so check them against the guides. Don't enter sensitive
    personal information.
13. **Indemnity** from the customer for misuse and for data they had no right to enter.
14. **Force majeure, assignment** (we can transfer the contract if JamPacked is sold), **notices** (by
    email to the admin), **disputes** (talk first, then mediation, then NZ courts), **severability, entire
    agreement**.
15. **Apple's minimum EULA terms:** if we don't supply our own EULA in App Store Connect, Apple's
    standard EULA applies to the app, and our Terms govern the service. **Easiest: use Apple's standard
    EULA.** If we want our own Terms to be the EULA, they must include Apple's "minimum terms":
    - the agreement is between us and the user, not Apple
    - Apple has no support obligations
    - Apple is a third-party beneficiary

## 4. Things we can't do (or must be careful with)

- **No prices, purchase buttons or "subscribe on our website" prompts in the phone apps.** Apple's
  **guideline 3.1.3(f), "Free stand-alone apps"**, allows a free app that's a companion to a paid web tool
  **only if there's no purchasing in the app and no calls to action to buy outside it**.
  - Reviewers apply this inconsistently. B2B apps with no in-app purchase *do* get rejected under 3.1.1,
    so expect pushback.
  - **Mitigations:**
    - the free NP1 plan works fully in the app
    - lapsed businesses see a neutral "Ask your account admin"
    - write the review notes to say "B2B service, businesses subscribe through their organisation, no
      purchasing or calls to action in the app, see 3.1.3(f)"
    - give reviewers a demo account
  - *Check the current guideline text at submission.*
- **Account deletion is mandatory on both stores.** Google also needs a **web link** where people can ask
  for deletion without the app installed. Google *does* allow keeping data you're legally required to
  keep **if you disclose it** in the Data safety form. That matches the plan in
  [issues/account-deletion-and-retention.md](issues/account-deletion-and-retention.md): remove the person,
  keep the business's records as "Deleted user".
- **Don't imply MPI or FSANZ endorse us.** Don't use MPI's logo, and don't say "MPI-approved" or
  "guaranteed compliant". "Built from MPI's National Programme guidance" is fine.
  - Most MPI content is Crown copyright under **CC BY 4.0** (attribution required, logos excluded). *Check
    MPI's copyright page.*
  - If so, add an attribution line, e.g. "Programme modules adapted from MPI guidance, licensed CC BY 4.0",
    on the Programmes page and in the app's Legal screen.
- **Open Food Facts:** the data is under the **ODbL**. Requirements:
  - **Attribution:** "Product data from Open Food Facts" on screens that use it, the Legal page and the
    store listings.
  - A **custom User-Agent** on API calls.
  - ⚠️ **Share-alike:** if OFF data is **mixed into our database** (we do save looked-up products into
    the business's catalogue), the ODbL's share-alike *may* apply to that combined database if it's
    "publicly used". It's probably fine because each catalogue is private to its business. **Ask the
    lawyer, or email reuse@openfoodfacts.org.**
- **GST:** the website says prices "include GST", but Save Point isn't registered. **You can't charge or
  show GST until registered.** Either register now (voluntary) or change the wording to "NZD, no GST
  charged" until you do. Once registered, Stripe receipts must meet the **taxable supply information**
  rules, which require the GST number.
  - **AU customers:** selling only to AU **GST-registered businesses** generally means **no AU GST
    registration**: the customer reverse-charges.
  - **Collect their ABN at checkout.** If you start selling to AU businesses that aren't GST-registered,
    that changes. *Check with an accountant.*
- **Marketing emails (Unsolicited Electronic Messages Act 2007; AU Spam Act 2003):**
  - Receipts, password resets and service notices are fine.
  - Newsletters and promotions need **consent** (an unticked opt-in box at sign-up) and a **working
    unsubscribe** link.
  - They must **identify Save Point Limited** as the sender.
- **Cookies page will go out of date:** it says the website sets no cookies. **Clerk sign-in on the
  website will set cookies** (essential ones, so no banner is needed in NZ/AU), and Stripe Checkout does
  too. Update the page when Clerk goes in.
- **Don't record staff performance in ways the policy doesn't describe.** Task timings are per-person.
  The policy and the in-app Insights already say there are no league tables. Keep it that way, or you'd
  need to tell staff (and employment law gets involved).

## 5. Support: what's actually required

There's no NZ law that sets support hours or response times for B2B software. What *is* required:
- **The stores** need a **support URL** and a contact email on the listing (Apple: a support URL;
  Google: an email). Use `jampacked.co.nz/help` and support@.
- **Privacy requests** need a contact (privacy@) and a response within 20 working days.
- **Fair Trading Act:** don't promise support you don't give. If the website says "we reply within one
  business day", that's a representation.

**Recommended:** a short **Support policy** page covering:
- channels: email, in-app help, the chatbot once it's on
- hours (NZ business hours)
- *aimed-for* response times
- what's covered (the app) and what isn't (food safety advice, verifier disputes)
- how to report a security issue (security@ or a `/.well-known/security.txt`)

Link it from the terms ("support as described in our Support policy") so it can change without
re-accepting the terms.

## 6. The full document set

| Document | Have | Status / next step |
|---|---|---|
| Terms of Service | Draft | Add the clauses in §3, plus AU section; lawyer review |
| Privacy Policy | Draft | Add privacy officer, providers + countries, IPP 3A, breach handling, 7-year reason, AI |
| Data processing terms | No | New section in the terms (or separate page) |
| Sub-processors list | No | Convex, Clerk, Stripe, Vercel, PostHog, Open Food Facts (barcode only), later Anthropic + email |
| Cookies & data | Draft | Update when Clerk lands |
| Support policy | No | New, short |
| Acceptable use | No | Fold into the terms |
| Account deletion page | No | Needed for Google Play; explains what's deleted and what's kept |
| Attributions | No | MPI (CC BY), Open Food Facts (ODbL), open-source licences (Flutter has `showLicensePage()`) |
| Security / incident plan | No | Internal, one page |
| Store listings' privacy answers | No | Google Data safety + Apple privacy label; must match the privacy policy |

## 7. Other protection worth having
- **Trademark:** NZ filing is in progress. File in **Australia** too before marketing there.
- **Insurance:** **professional indemnity** (if the app's wrong, a food business could claim) and
  **cyber liability** (breach response costs). Cheap for a small SaaS company and often asked about by
  bigger customers.
- **Keep accepted versions:** you're already planning to log which terms version each person accepted.
  Keep old versions published at dated URLs.

## 8. Questions to take to the lawyer
1. Does the founders agreement put JamPacked's IP in Save Point Limited? Anything to fix?
2. Review the terms with the additions in §3: CGA s 43 and FTA s 5D contract-outs, unfair-terms risk of
   price changes, suspension and the liability cap.
3. What do AU customers need: the ACL consumer guarantees limitation, and AU unfair contract terms?
4. Is our agent (s 11) position right, and does the anonymised-statistics licence keep it intact?
5. IPP 3A: is the invite email notice enough? Are supplier and customer details the business's job?
6. Is the 7-year retention justified, and what should we promise if JamPacked stops trading?
7. Open Food Facts share-alike: does saving looked-up products into private catalogues trigger it?
8. Are the NP1 → NP2 when staff are added, money-back once per business, and allergen/use-by aid
   clauses OK?

---

## Sources
- Privacy Act: [IPP 3A guidance (OPC, Oct 2025)](https://www.privacy.org.nz/assets/DOCUMENTS/251104-IPP3A-guidance-A1128460.pdf) ·
  [IPP3A overview, Wynn Williams](https://wynnwilliams.co.nz/insights/general-business-smes/ipp3a-what-you-need-to-know/) ·
  [Enhancing the Privacy Act, Ministry of Justice](https://www.justice.govt.nz/justice-sector-policy/key-initiatives/enhancing-the-privacy-act) ·
  [Can I send information overseas? (OPC)](https://privacy.org.nz/tools/knowledge-base/view/219) ·
  [IPP 12 guidance (OPC)](https://www.privacy.org.nz/assets/New-order/Your-responsibilities/Sending-information-overseas/2020-10-23-Principle-12-Guidance-A715314.pdf) ·
  [What is a notifiable privacy breach? (OPC)](https://www.privacy.org.nz/resources-and-learning/knowledge-base/view/536/) ·
  [NotifyUs](https://www.privacy.org.nz/notifyus) ·
  [AI tools and the Privacy Act (OPC)](https://privacy.org.nz/news/statements-media-releases/ai-tools-and-the-privacy-act-commissioner-issues-new-guidance)
- Company name: [Use of company name and personal liability, Gallaway Cook Allan](https://www.gallawaycookallan.co.nz/library/publications/use-of-company-name-and-personal-liabili)
- Unfair terms: [Commerce Commission, small trade contracts (2022)](https://comcom.govt.nz/news-and-media/media-releases/2022/new-provisions-come-into-force-tackling-unfair-business-practices) ·
  [Bell Gully on B2B unfair terms](https://www.bellgully.com/Pages/Unfair-Contract-Terms-in-B2B-Contracts-Fair-Trading-Amendment-Act-passes-into-law-.aspx) ·
  [Consumer Affairs Victoria, AU UCT penalties](https://www.consumer.vic.gov.au/latest-news/new-penalties-from-today-for-businesses-using-unfair-contract-terms) ·
  [Hamilton Locke, AU UCT and SaaS](https://hamiltonlocke.com.au/unfair-contract-terms-regime-what-are-the-new-penalties-for-australian-businesses/)
- ACL consumer threshold: [Russell Kennedy, the $100,000 question](https://russellkennedy.com.au/insights-events/insights/the-100-000-question-are-you-a-consumer-for-the-purpose-of-the-australian-consumer-law) ·
  [HWL Ebsworth](https://hwlebsworth.com.au/a-key-change-to-the-definition-of-consumer-under-the-australian-consumer-law-will-lead-to-more-business-customers-being-able-to-rely-on-consumer-guarantees/)
- AU privacy: [Sprintlaw on AU privacy reforms and small business](https://sprintlaw.com.au/articles/privacy-law-reforms-small-business/)
- Online contracts: [Smith Partners, enforceable online terms](https://smithpartners.co.nz/business-law/enforceable-online-terms-and-conditions) ·
  [Contract and Commercial Law Act 2017](https://legislation.govt.nz/act/public/2017/5/en/latest/)
- Comparable terms: [Xero NZ Terms of Use](https://www.xero.com/nz/legal/terms/) ·
  [Safe Food Pro on the App Store](https://apps.apple.com/app/id1499423320) (developer ComplyPro Limited; their own policy couldn't be fetched)
- Stores: [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) ·
  [Apple forum: B2B SaaS rejected under 3.1.1](https://developer.apple.com/forums/thread/811018) ·
  [Apple forum: 3.1.3(f) clarification](https://developer.apple.com/forums/thread/781935)
- Spam: [DIA, NZ spam law](https://www.dia.govt.nz/SPAM-NZ-SPAM-Law)
- Food Act: [Food Act 2014](https://legislation.govt.nz/act/public/2014/32/en/latest/) (ss 36 and 81, record retention)
- Open Food Facts: [API licence, be on the legal side](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/) ·
  [Conditions to use the API](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api)
- AU GST (B2B reverse charge): [ATO, Australian business importing services](https://ato.gov.au/Business/International-tax-for-business/GST-on-imported-goods-and-services/Australian-business-importing-goods-and-services) ·
  [Anrok AU GST guide](https://www.anrok.com/vat-software-digital-services/australia)
