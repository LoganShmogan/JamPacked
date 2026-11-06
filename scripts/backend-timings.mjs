#!/usr/bin/env node
// How long the backend takes: times the calls the app's screens make, against a deployment seeded with
// the test accounts (docs/test-accounts.md), and prints the fastest, average and slowest of each.
//
//   node scripts/backend-timings.mjs [convex-url] [runs]     (default http://127.0.0.1:3210, 20 runs)
//
// Every run uses its own session, so no read is answered from Convex's query cache: these are the times
// the app sees after data changes (a repeat of an identical read with nothing changed comes from the
// cache in under a millisecond). It signs in as the test accounts and writes records, so it refuses to
// run against production. Setting up a throwaway seeded deployment, and the last results:
// docs/performance.md.
const [url = "http://127.0.0.1:3210", runsArg = "20"] = process.argv.slice(2);
const RUNS = Number(runsArg);
if (/jampacked\.co\.nz/.test(url)) {
  console.error("This signs in as the test accounts and writes records: use a seeded test deployment, not production.");
  process.exit(1);
}

async function call(kind, path, args) {
  const started = performance.now();
  const res = await fetch(`${url}/api/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const body = await res.json();
  const ms = performance.now() - started;
  if (body.status !== "success") throw new Error(`${path}: ${body.errorMessage ?? res.status}`);
  return { ms, value: body.value };
}

const results = [];
/** Runs one call `runs` times (args can depend on the run) and records how long each took. */
async function time(name, where, kind, path, args, runs = RUNS) {
  const times = [];
  let value;
  for (let i = 0; i < runs; i++) {
    const r = await call(kind, path, typeof args === "function" ? args(i) : args);
    times.push(r.ms);
    value = r.value;
  }
  results.push({ name, where, times });
  return value;
}

const startOfToday = () => new Date().setHours(0, 0, 0, 0);
const DAY = 86_400_000;

async function signIn(email) {
  const { value } = await call("action", "auth:login", { email, password: "jampacked-test" });
  return value.token;
}

/** One session per run, so every read is a real execution rather than a cache hit. */
async function sessions(email) {
  const tokens = [];
  for (let i = 0; i < RUNS; i++) tokens.push(await signIn(email));
  return tokens;
}

/** Every screen's calls for one business, as the app makes them. */
async function screens(email, businessName) {
  const tokens = await sessions(email);
  const sessionToken = await signIn(email); // for the untimed lookups and writes, so no timed read is cached
  const mine = (await call("query", "businesses:mine", { sessionToken })).value;
  const business = mine.find((b) => b.name === businessName);
  if (!business) throw new Error(`${email} isn't in ${businessName}: seed the deployment first`);
  const as = { sessionToken, businessId: business._id };
  const run = (extra = {}) => (i) => ({ sessionToken: tokens[i], businessId: business._id, ...extra });
  const w = businessName;

  await time("Business picker (businesses:mine)", w, "query", "businesses:mine", (i) => ({ sessionToken: tokens[i] }));
  await time("Home (dashboard:summary)", w, "query", "dashboard:summary", run({ dayStart: startOfToday() }));
  await time("Due list (programmes:due)", w, "query", "programmes:due", run({ dayStart: startOfToday() }));
  await time("Programme (programmes:current)", w, "query", "programmes:current", run());
  await time("Goods In list (deliveries:list)", w, "query", "deliveries:list", run());
  const lots = await time("Stock on hand (stock:onHand)", w, "query", "stock:onHand", run());
  await time("Low stock (stock:lowStock)", w, "query", "stock:lowStock", run());
  await time("Expiring stock (stock:expiring)", w, "query", "stock:expiring", run());
  const runs = await time("Production list (production:list)", w, "query", "production:list", run());
  await time("Planned batches (production:planned)", w, "query", "production:planned", run());
  const products = await time("Products (products:list)", w, "query", "products:list", run());
  const suppliers = await time("Suppliers (suppliers:list)", w, "query", "suppliers:list", run());
  await time("Temperature checks (temperature:list)", w, "query", "temperature:list", run());
  await time("Corrective actions (correctiveActions:list)", w, "query", "correctiveActions:list", run({ status: "open" }));
  await time("Programme records (records:list)", w, "query", "records:list", run());
  await time("Audits (audits:list)", w, "query", "audits:list", run());
  await time("Audit templates (audits:templates)", w, "query", "audits:templates", run());
  await time("Insights, 30 days (analytics:insights)", w, "query", "analytics:insights", run({ days: 30 }));
  await time("Insights, 90 days (analytics:insights)", w, "query", "analytics:insights", run({ days: 90 }));
  await time("Audit trail (auditLog:list, 500)", w, "query", "auditLog:list", run({ limit: 500 }));
  const lot = lots.find((l) => l.batchCode) ?? lots[0];
  if (lot) {
    await time("Trace a batch (deliveries:trace)", w, "query", "deliveries:trace", run({ search: lot.batchCode ?? lot.productName }));
    await time("Trace a product (deliveries:trace)", w, "query", "deliveries:trace", run({ search: lot.productName }));
  }
  if (runs[0]) await time("Trace a batch made here (production:trace)", w, "query", "production:trace", run({ search: runs[0].batchCode }));
  const recipe = products.find((p) => p.recipe);
  if (recipe) await time("Plan a batch from a recipe (production:plan)", w, "query", "production:plan", run({ productId: recipe._id, qty: recipe.recipe.yieldQty }));

  // The whole export, table by table, 500 rows a page like the app (a new session each time).
  const exportAll = async (i) => {
    const as = { sessionToken: tokens[i], businessId: business._id };
    const { value: m } = await call("query", "exportData:manifest", as);
    const counts = {};
    const started = performance.now();
    for (const table of m.tables) {
      let cursor = null;
      counts[table] = 0;
      for (;;) {
        const { value: page } = await call("query", "exportData:page", { ...as, table, paginationOpts: { cursor, numItems: 500 } });
        counts[table] += page.page.length;
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
    }
    return { ms: performance.now() - started, counts };
  };
  const exportTimes = [];
  let counts = {};
  for (let i = 0; i < 3; i++) ({ ms: exportTimes[i], counts } = await exportAll(i));
  results.push({ name: "Export every record (exportData, all pages)", where: w, times: exportTimes });

  // Writes: a temperature check, a pest check, a delivery of one item, and a batch from the recipe.
  await time("Record a temperature (temperature:record)", w, "mutation", "temperature:record", { ...as, unitName: "Walk-in chiller", unitType: "chiller", temperatureC: 3 });
  await time("Record a pest check (records:create)", w, "mutation", "records:create", { ...as, recordType: "pest_check", values: { area: "Kitchen", found: false } });
  const supplier = suppliers.find((s) => s.approved) ?? suppliers[0];
  if (supplier) {
    await time("Receive goods, one item (deliveries:create)", w, "mutation", "deliveries:create", (i) => ({
      ...as, supplierId: supplier._id, vehicleClean: true,
      items: [{ productName: "Benchmark milk 2L", quantity: 6, unit: "ea", storageType: "chilled", temperatureC: 3, batchCode: `BENCH${i}`,
        useBy: Date.now() + 5 * DAY, packagingOk: true, labelOk: true, allergens: ["milk"], accepted: true }],
    }));
  }
  if (recipe) {
    // The recipe's checks, filled in with passing answers, as someone making the batch would.
    const types = (await call("query", "programmes:current", as)).value.recordTypes;
    const pass = (f) =>
      f.type === "yesno" ? f.failIf?.equals !== true
      : f.type === "number" ? (f.failIf?.below !== undefined ? f.failIf.below + 5 : f.failIf?.above !== undefined ? f.failIf.above - 0.5 : 1)
      : f.type === "date" ? Date.now() : "Benchmark";
    const times = [];
    for (let i = 0; i < 5; i++) {
      const plan = (await call("query", "production:plan", { ...as, productId: recipe._id, qty: 1 })).value;
      const checks = plan.checks.map((key) => {
        const type = types.find((t) => t.key === key);
        return { recordType: key, values: Object.fromEntries(type.fields.map((f) => [f.key, pass(f)])) };
      });
      const inputs = plan.ingredients.flatMap((ing) => ing.picks.map((p) => ({ lotId: p.lotId, qty: p.qty })));
      times.push((await call("mutation", "production:create", { ...as, productId: recipe._id, qty: 1, fromRecipe: true, inputs, checks })).ms);
    }
    results.push({ name: "Make a batch from a recipe, with its checks (production:create)", where: w, times });
  }
  return { sessionToken, counts };
}

const ms = (n) => (n < 10 ? n.toFixed(1) : Math.round(n).toString());

const { counts } = await screens("factory@jampacked.test", "Southern Preserves Ltd");
await screens("full@jampacked.test", "Harbour Kitchen & Farm");
await screens("cafe@jampacked.test", "Kai Corner Café");
const signInTimes = [];
for (let i = 0; i < 10; i++) signInTimes.push((await call("action", "auth:login", { email: "cafe@jampacked.test", password: "jampacked-test" })).ms);
results.push({ name: "Sign in (auth:login, password check)", where: "any", times: signInTimes });
const platform = await sessions("full@jampacked.test");
await time("Owner dashboard (platform:overview)", "all businesses", "query", "platform:overview", (i) => ({ sessionToken: platform[i] }));

const rows = results.map((r) => {
  const sorted = [...r.times].sort((a, b) => a - b);
  return { ...r, fastest: sorted[0], median: sorted[Math.floor(sorted.length / 2)], slowest: sorted.at(-1), average: sorted.reduce((a, b) => a + b, 0) / sorted.length };
}).sort((a, b) => b.average - a.average);

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`Backend timings against ${url}, ${RUNS} runs a call (export: 3, making a batch: 5, sign in: 10), no cached reads, ${new Date().toISOString().slice(0, 10)}`);
console.log(`Biggest business (Southern Preserves Ltd): ${total} records: ${Object.entries(counts).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`).join(", ")}\n`);
console.log("| Call | Business | Fastest ms | Median ms | Average ms | Slowest ms |");
console.log("|---|---|--:|--:|--:|--:|");
for (const r of rows) console.log(`| ${r.name} | ${r.where} | ${ms(r.fastest)} | ${ms(r.median)} | ${ms(r.average)} | ${ms(r.slowest)} |`);
