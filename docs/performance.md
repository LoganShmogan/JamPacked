# Performance baseline

How long JamPacked takes today, measured before any speed work so changes can be compared against it.
Measured 6 November 2026 on version 0.1.0 (the backend from this branch; the live site as deployed then).
Re-run the same scripts after a change and compare ([How to re-run](#how-to-re-run)).

## The short version

- **Slowest thing people wait for: the web app's first load on a phone.** About **17 seconds** to the
  sign-in screen on a weak 4G signal with a mid-range phone's CPU, and about **1.4 s** on a good
  connection. It downloads 2.65 MB first, mostly Flutter's CanvasKit engine (1.49 MB, from Google's CDN)
  and the app itself (0.99 MB, compressed).
- **The website is quick:** first paint in about **0.3 s** on a good connection; pages are 0.3 to 0.45 MB.
- **Every backend call costs about 100 ms of network** from here to the live server, more than the
  server spends on almost any call. A typical screen's call takes 5 to 20 ms on the server.
- **Slowest backend calls:** exporting every record (0.1 to 0.3 s on the server, plus a round trip per
  page, so about 2 s live even for a small business), Insights (up to 0.1 s), the audit trail, tracing
  a product, the Goods In list and the owner dashboard. These read more as history builds up
  ([issues/growing-queries.md](issues/growing-queries.md)).
- **Fastest:** suppliers, corrective actions, the programme and the business picker, 3 to 5 ms.
- **Writes** (receiving goods, a temperature, a record, making a batch with its checks) take 15 to 25 ms.
  Signing in takes about 25 ms (the password check).

What to look at first: [issues/speed.md](issues/speed.md).

## Backend: every screen's calls

Each call run 20 times on a throwaway copy of the backend seeded with the
[test accounts](test-accounts.md), on the development laptop (Intel i7-13620H). Every run used its own
session, so none was answered from Convex's cache: these are the times after data changes, which is
what the app sees (a repeat of an identical read with nothing changed comes back in under 1 ms). Times
are the server's work plus a local round trip of well under a millisecond; add about 100 ms on the live
server for the network.

The biggest business, Southern Preserves Ltd (60 simulated days), has about 1,900 records: 60 deliveries
(153 items), 194 stock lots, 540 stock movements, 46 batches, 120 temperature checks, 85 programme
records, 36 corrective actions and 499 audit log entries. Harbour Kitchen & Farm (45 days) has every
kind of record; Kai Corner Café (14 days) is small.

| Call | Business | Fastest ms | Median ms | Average ms | Slowest ms |
|---|---|--:|--:|--:|--:|
| Export every record (all pages) | Harbour Kitchen & Farm | 259 | 263 | 266 | 275 |
| Export every record (all pages) | Southern Preserves Ltd | 211 | 238 | 239 | 268 |
| Export every record (all pages) | Kai Corner Café | 112 | 128 | 124 | 131 |
| Insights, 90 days | Harbour Kitchen & Farm | 96 | 104 | 104 | 127 |
| Insights, 30 days | Harbour Kitchen & Farm | 62 | 69 | 69 | 99 |
| Insights, 90 days | Southern Preserves Ltd | 53 | 61 | 65 | 90 |
| Audit trail (500 entries) | Harbour Kitchen & Farm | 50 | 55 | 61 | 117 |
| Audit trail (500 entries) | Southern Preserves Ltd | 41 | 47 | 48 | 67 |
| Owner dashboard | all businesses | 39 | 45 | 46 | 65 |
| Trace a product | Harbour Kitchen & Farm | 36 | 45 | 44 | 67 |
| Goods In list | Harbour Kitchen & Farm | 25 | 40 | 39 | 58 |
| Goods In list | Southern Preserves Ltd | 22 | 39 | 36 | 47 |
| Insights, 30 days | Southern Preserves Ltd | 30 | 33 | 37 | 56 |
| Trace a product | Southern Preserves Ltd | 20 | 28 | 32 | 55 |
| Sign in (password check) | any | 23 | 26 | 25 | 28 |
| Make a batch from a recipe, with its checks | Harbour Kitchen & Farm | 20 | 22 | 23 | 27 |
| Planned batches | Harbour Kitchen & Farm | 17 | 22 | 22 | 30 |
| Trace a batch | Harbour Kitchen & Farm | 21 | 22 | 23 | 33 |
| Make a batch from a recipe, with its checks | Southern Preserves Ltd | 17 | 18 | 19 | 21 |
| Receive goods, one item | Harbour Kitchen & Farm | 12 | 17 | 18 | 24 |
| Record a pest check | Harbour Kitchen & Farm | 12 | 18 | 17 | 21 |
| Record a temperature | Harbour Kitchen & Farm | 13 | 17 | 17 | 21 |
| Low stock | Harbour Kitchen & Farm | 11 | 18 | 17 | 24 |
| Stock on hand | Harbour Kitchen & Farm | 13 | 13 | 16 | 28 |
| Home | Harbour Kitchen & Farm | 13 | 15 | 16 | 26 |
| Production list | Harbour Kitchen & Farm | 12 | 14 | 14 | 19 |
| Programme records | Harbour Kitchen & Farm | 10 | 12 | 14 | 43 |
| Trace a batch made here | Harbour Kitchen & Farm | 9.2 | 11 | 12 | 30 |
| Home | Southern Preserves Ltd | 9.5 | 11 | 11 | 16 |
| Stock on hand | Southern Preserves Ltd | 9.1 | 11 | 12 | 18 |
| Expiring stock | Harbour Kitchen & Farm | 9.0 | 10 | 11 | 20 |
| Plan a batch from a recipe | Harbour Kitchen & Farm | 9.5 | 11 | 11 | 14 |
| Due list | Southern Preserves Ltd | 6.5 | 9.2 | 9.8 | 15 |
| Temperature checks | Southern Preserves Ltd | 8.0 | 8.7 | 8.8 | 10 |
| Business picker | Harbour Kitchen & Farm | 6.4 | 7.8 | 8.1 | 12 |
| Home | Kai Corner Café | 6.6 | 7.6 | 7.8 | 9.9 |
| Audits | Harbour Kitchen & Farm | 4.8 | 7.0 | 8.5 | 15 |
| Products | Harbour Kitchen & Farm | 5.7 | 7.0 | 8.5 | 16 |
| Audit templates | Southern Preserves Ltd | 4.3 | 5.5 | 5.9 | 10 |
| Corrective actions | Harbour Kitchen & Farm | 3.9 | 5.2 | 5.2 | 6.4 |
| Programme | Southern Preserves Ltd | 4.0 | 4.9 | 5.1 | 7.7 |
| Suppliers | Harbour Kitchen & Farm | 2.9 | 3.7 | 3.8 | 5.2 |
| Corrective actions | Kai Corner Café | 2.9 | 3.5 | 3.6 | 5.1 |

That's the busiest business for each call; the script prints every call for all three businesses.
Bigger businesses are slower on the calls that read their history (export, Insights, the audit trail,
Goods In, trace); the others hardly change with size.

## The live site

Measured from the development laptop with `scripts/live-timings.mjs`: each page opened in Chrome with
an empty cache, as a first visit. "Phone" slows the network to a weak 4G signal (1.6 Mbps, 150 ms) and
the CPU 4×, like a mid-range phone.

| Page | First paint or frame, good connection: fastest · median · slowest | Phone: fastest · median | Downloaded |
|---|---|---|--:|
| Website: home | 0.28 · 0.32 · 0.33 s | 0.72 · 3.6 s | 0.33 MB |
| Website: pricing | 0.29 · 0.32 · 0.36 s | 3.6 · 3.7 s | 0.32 MB |
| Website: help | 0.26 · 0.30 · 0.33 s | 3.3 · 3.6 s | 0.44 MB |
| Web app: sign-in screen drawn | 1.31 · 1.40 · 1.55 s | 16.8 · 17.3 s | 2.65 MB |

What the web app downloads before its first screen: Flutter's CanvasKit engine 1.49 MB (from
www.gstatic.com), the app's code 0.99 MB (`main.dart.<hash>.js`, brotli, cached at Cloudflare's edge for
a year), the Roboto font 0.06 MB, the logo 0.04 MB, and the icon font, Flutter's loader and Cloudflare's
analytics beacon at 0.01 to 0.02 MB each.

**Round trip to the live backend** (a public query): 282 ms for the first call, which opens the
connection, then 83 ms fastest, 102 ms median and average, 120 ms slowest over 20 calls.

**A caution on these:** from this laptop about half of new connections to Cloudflare stall for about
3.1 s in the TLS handshake (plain `curl` shows it too; it's this network, not the server). The
good-connection numbers above come from a run that had none. The phone medians include some,
which is why the website's phone medians (about 3.6 s) are far from its fastest phone load (0.72 s).
Re-run from another network to check them.

## Builds and tests

On the development laptop:

| Step | Time |
|---|--:|
| Backend: type check | 1.0 s |
| Backend: 248 tests with coverage | 18 s |
| Website: lint | 3.7 s |
| Website: 66 tests with coverage | 4.8 s |
| Website: production build (with Next.js's build cache) | 3.5 s |
| App: analyze | 5.4 s |
| App: 329 tests with coverage | 28 s |
| App: web release build | 32 s |
| Seeding the test accounts on an empty backend | 30 to 50 s |

CI on GitHub runs the backend, website and app jobs side by side; times are in each run on the Actions
tab ([DOCUMENTATION.md §17](DOCUMENTATION.md#17-ci-versions--releases)).

## How to re-run

**Backend timings** need a seeded deployment you don't mind wiping. Never use production: the script
refuses to, because it signs in as the test accounts and writes records. The way these numbers were
made, a throwaway local backend with its own data and ports (the Convex CLI's local backend binary,
already downloaded by `npx convex dev`):

```bash
B=$(ls -d ~/.cache/convex/binaries/*/ | tail -1)convex-local-backend
D=$(mktemp -d); SECRET=$(openssl rand -hex 32)
KEY=$($B keygen admin-key --instance-name bench --instance-secret $SECRET)
$B --port 3310 --site-proxy-port 3311 --instance-name bench --instance-secret $SECRET \
  --local-storage $D/storage --disable-beacon $D/db.sqlite3 &          # stop it with: kill %1
cd backend && export CONVEX_DEPLOYMENT= CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3310 CONVEX_SELF_HOSTED_ADMIN_KEY=$KEY
npx convex deploy -y && npx convex env set SEED_ALLOWED true
npx convex run seed:run '{"confirm":"wipe everything"}'   # builds in the background: wait about a minute
cd .. && node scripts/backend-timings.mjs http://127.0.0.1:3310 20
```

**Live timings** only open public pages and call a public query, so they're safe to run any time:

```bash
node scripts/live-timings.mjs 5            # good connection
node scripts/live-timings.mjs 5 --phone    # weak 4G, slower CPU
```

When comparing, use the same machine and network, and look at the medians.
