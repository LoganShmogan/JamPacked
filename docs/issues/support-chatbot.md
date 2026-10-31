# Support chatbot (website and app), handing over to a person

**Priority:** Medium · **Status:** Planned, not built (decided 31 Oct 2026: plan first)

## Problem
Help today is the guides (app Help screen and the website's `/help/`, both from `app/assets/help/guides.json`)
and an email address. People with a question have to find the right guide or wait for an email reply. We want
a chat assistant on the website and in the app that answers from our own guides, and hands over to a person
(a support ticket plus an email to us) when it can't help or the person asks.

## Design

### Where it runs
- **One Convex action** (`backend/convex/support.ts`, `"use node"`) calls Claude with the official TypeScript
  SDK (`@anthropic-ai/sdk`). The website and the app both call it; neither ever sees the API key.
- **API key:** `ANTHROPIC_API_KEY` as a Convex environment variable (`npx convex env set ...` on loganserver,
  later Convex Cloud). Unset = the chat is switched off and both front ends show the email address instead,
  so nothing is charged until we turn it on.
- **App:** a "Ask a question" box at the top of Help & support (signed in, so we know the person and business).
- **Website:** a chat panel on `/help/` (and later a button on every page). Visitors aren't signed in, so it
  has stricter limits (see Abuse and cost limits).

### Model
- **Default: Claude Opus 5.5 (`claude-opus-5-5`)**, effort `low` (chat answers from a fixed set of guides don't
  need deep reasoning; on Opus 5.5 thinking can't be switched off and effort defaults to `medium`, so set
  `output_config: { effort: "low" }` explicitly).
- Cheaper models are a choice to make **after measuring answer quality** on our own questions (see Before
  launch): Claude Sonnet 5.5 (`claude-sonnet-5-5`) or Claude Haiku 5.5 (`claude-haiku-5-5`). Costs for all
  three are below. Haiku 5.5 has no server-side fallback when it declines a request.
- **Refusal fallbacks on:** `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`, so a safety
  decline on Opus 5.5 is retried on another model in the same call. Always check `stop_reason` before reading
  the answer (`"refusal"` means the whole chain declined: show the email address).

### What it knows (the system prompt)
One fixed system prompt, identical for every conversation so it can be cached:
1. Who it is and the rules (below).
2. The guides, rendered from `guides.json` (about 11 KB, roughly 3,000 to 4,000 tokens).
3. The FAQ and the licence FAQ from `web/src/lib/content.ts`, and the plan prices from `web/src/lib/site.ts`.
   Move these into a shared JSON next to `guides.json` (same sync approach) so the bot, the app and the
   website say the same thing.

About **6,000 tokens** in total. Anything that varies (the person's name, their business's programme and
role, which screen they came from) goes in the **first user message**, never in the system prompt, so the
cached prefix stays byte-identical.

Rules in the prompt:
- Answer only from the guides, FAQ and prices. If it isn't covered, say so and offer a person.
- Never give a food-safety compliance ruling (whether something is safe or allowed): point to their
  verifier or EHO, MPI or FSANZ, and offer a person. For an urgent food-safety incident (suspected illness,
  a recall), say to follow their recall steps and contact MPI, and hand over straight away.
- It can't see the business's records and can't change anything in the app.
- Short, plain answers in New Zealand English, with where to tap (`More › Production`).

### Prompt caching
- One explicit `cache_control` breakpoint on the last block of the system prompt, plus top-level automatic
  caching for the growing conversation (the pattern recommended for multi-turn chats).
- **5-minute TTL.** Turns within a conversation are usually under 5 minutes apart, so each turn reads the
  cache. A new conversation after a quiet spell pays one cache write (1.25x input price), then reads.
  The 1-hour TTL (2x write) only pays off if conversations start 5 to 60 minutes apart; check once we
  have traffic.
- The prefix (about 6,000 tokens) is well over the 512-token minimum for these models.
- Check `usage.cache_read_input_tokens` in the logs: zero on repeat turns means something in the prefix is
  changing (a timestamp, unsorted JSON).

### Handing over to a person (tool use)
Yes, this is a good fit for one custom tool:
- `escalate_to_human` with `strict: true`, input `{ summary: string, category: "billing" | "how-to" |
  "bug" | "food-safety" | "account" | "other", urgent: boolean }`, `additionalProperties: false`.
- `tool_choice: { type: "auto" }` (forced tool choice returns a 400 on Opus 5.5). The prompt says when to
  call it: the person asks for a person, the answer isn't in the guides after one try, anything about
  billing or refunds, a bug, or a food-safety incident (urgent).
- When it's called, the Convex action: saves a `supportTickets` row (summary, category, urgent, transcript,
  who, which business, website or app) → schedules an email to the support inbox (Convex scheduler + an
  email provider such as Resend or Postmark; needs the support@ mailbox from
  [branding-and-business-setup.md](branding-and-business-setup.md)) → returns the ticket number to Claude,
  which tells the person a human will reply by email (website visitors are asked for their email first).
- The owner dashboard (`/admin`) gets a ticket list (open / answered) for us.
- Parse tool input with `JSON.parse`, never string matching.

### Data and privacy
- Conversations are stored (`supportConversations`) so a ticket carries its transcript. Unlike food safety
  records they don't need keeping for 7 years: decide a retention period (e.g. 12 months) and make it the
  second allowed delete path in `tests/retention.test.ts` (see
  [account-deletion-and-retention.md](account-deletion-and-retention.md)).
- What people type is sent to Anthropic to generate the answer: add Anthropic to the sub-processors list and
  the Privacy Policy before launch ([legal-documents.md](legal-documents.md)), and check Anthropic's
  commercial terms and data retention for API traffic. Tell people in the chat box not to type customer or
  staff personal details.
- No business records go to the model.

### Abuse and cost limits
- Per person / per browser session: e.g. 30 messages a day in the app, 10 per visitor on the website, and a
  short cooldown between messages (a rate-limit table in Convex).
- `max_tokens` about 2,000 per answer (answers are short; thinking at low effort is included in output).
- A daily spend cap: count tokens from each response's `usage` and switch the website chat off for the day
  past a set amount (the app keeps working for signed-in users up to its own limit).
- Website chat only after a first message is typed (no calls on page load).

## Cost estimate (US dollars, Claude API list prices, 31 Oct 2026)

Assumptions: 6,000-token cached system prompt; a conversation is 4 questions; about 400 output tokens per
answer including thinking at low effort; about 600 tokens of earlier conversation per turn; the first
turn writes the cache and the other three read it. Real numbers come from the `usage` logs.

| Model | Input / output per MTok | Cache read per MTok | Per conversation | 500 conversations a month | 2,000 a month |
|---|---|---|---|---|---|
| Claude Opus 5.5 (default) | $4 / $20 | $0.20 | about $0.07 | about $37 | about $146 |
| Claude Sonnet 5.5 | $2 / $10 | $0.20 | about $0.04 | about $19 | about $77 |
| Claude Haiku 5.5 | $0.10 / $0.50 | about $0.01 | about $0.002 | about $1 | about $4 |

Output is most of the cost on the bigger models, so keeping answers short and effort low matters more than
the prompt size. Without caching, Opus 5.5 would cost about $0.14 per conversation (the 6,000-token prompt
at full price on every turn).

## Before launch
- An eval set: 30 to 50 real questions (from support emails once we have them, plus the guides), each with
  the expected answer or "should hand over". Run each candidate model at low effort and compare answer
  quality, wrong-handover and missed-handover rates, and cost per conversation. Pick the model from that.
- Try to break it: off-topic requests, prompt injection ("ignore your instructions"), requests for
  compliance rulings, abusive messages.

## To do
- [ ] Decide the model from the eval (default Opus 5.5) and the transcript retention period
- [ ] Anthropic account for Save Point Limited, API key, monthly spend limit in the Console
- [ ] Shared FAQ/prices JSON alongside `guides.json`, synced to the website like the guides
- [ ] `support.ts` action (official SDK, cached system prompt, `escalate_to_human` tool, fallbacks, limits)
- [ ] `supportConversations`, `supportTickets` and rate-limit tables; retention rule and test
- [ ] Email provider and support@ mailbox; ticket email
- [ ] App: "Ask a question" on Help & support; website: chat panel on `/help/`
- [ ] Owner dashboard: tickets list
- [ ] Privacy Policy and sub-processors (Anthropic, email provider); Terms if needed
- [ ] Eval set and red-team pass, then switch it on
