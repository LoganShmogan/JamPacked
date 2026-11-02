// Test accounts for a deployment that isn't live yet. Wipes every table, then builds each account through
// the app's own mutations, a simulated day at a time: each day's records are moved back to that day, so
// the accounts have history (Insights, the Due list, expiring stock, closed corrective actions).
//
//   npx convex env set SEED_ALLOWED true          # once, on a deployment that isn't live
//   npx convex run seed:run '{"confirm":"wipe everything"}'
//
// Every account's password is SEED_PASSWORD. Internal only: it can't be called from the app, and it
// refuses to run unless the deployment has SEED_ALLOWED=true. Remove that variable before launch.
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id, TableNames } from "./_generated/dataModel";
import { ActionCtx, internalAction, internalMutation, internalQuery } from "./_generated/server";
import schema from "./schema";

declare const process: { env: Record<string, string | undefined> }; // Convex functions can read env vars

export const SEED_PASSWORD = "jampacked-test";
const DAY = 86_400_000;

// ---------------------------------------------------------------------------------------------
// Low-level helpers: wipe, move a day's records back in time, read what a day created
// ---------------------------------------------------------------------------------------------

/** Deletes up to 500 documents from one table; the action repeats until it's empty. */
export const wipeTable = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    if (process.env.SEED_ALLOWED !== "true") throw new ConvexError("Seeding is turned off on this deployment");
    const docs = await ctx.db.query(table as TableNames).take(500);
    for (const d of docs) await ctx.db.delete(d._id);
    return docs.length;
  },
});

/** Every time on a record, by table. Dates a record is about (use-by, best-before) move with it. */
const TIMES: Partial<Record<TableNames, string[]>> = {
  deliveries: ["receivedAt"],
  deliveryItems: ["receivedAt", "useBy", "bestBefore"],
  stockLots: ["receivedAt", "useBy", "bestBefore"],
  stockMovements: ["at"],
  productionRuns: ["madeAt", "useBy", "bestBefore", "voidedAt"],
  temperatureLogs: ["checkedAt"],
  records: ["at"],
  correctiveActions: ["raisedAt", "closedAt"],
  audits: ["startedAt", "completedAt", "periodStart", "periodEnd"],
  stocktakes: ["startedAt", "completedAt"],
  auditLog: ["at"],
  taskTimings: ["at"],
};

/** Moves everything created since `since` back by `ms`. */
export const shift = internalMutation({
  args: { since: v.number(), ms: v.number() },
  handler: async (ctx, { since, ms }) => {
    for (const [table, fields] of Object.entries(TIMES)) {
      const docs = await ctx.db
        .query(table as TableNames)
        .withIndex("by_creation_time", (q) => q.gte("_creationTime", since))
        .collect();
      for (const d of docs) {
        const patch: Record<string, number> = {};
        for (const f of fields) {
          const t = (d as Record<string, unknown>)[f];
          if (typeof t === "number") patch[f] = t - ms;
        }
        await ctx.db.patch(d._id, patch);
      }
    }
  },
});

/** Lots a business has had created since `since` (that day's deliveries, batches and harvests). */
export const lotsSince = internalQuery({
  args: { businessId: v.id("businesses"), since: v.number() },
  handler: async (ctx, { businessId, since }) =>
    (
      await ctx.db
        .query("stockLots")
        .withIndex("by_creation_time", (q) => q.gte("_creationTime", since))
        .collect()
    ).filter((l) => l.businessId === businessId),
});

/** Closing a corrective action changes an older record, so its close time is moved back separately. */
export const backdateClosed = internalMutation({
  args: { ids: v.array(v.id("correctiveActions")), ms: v.number() },
  handler: async (ctx, { ids, ms }) => {
    for (const id of ids) {
      const ca = (await ctx.db.get(id))!;
      await ctx.db.patch(id, { closedAt: ca.closedAt! - ms });
    }
  },
});

export const openCAs = internalQuery({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) =>
    await ctx.db
      .query("correctiveActions")
      .withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", "open"))
      .collect(),
});

export const makePlatformAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const u = (await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique())!;
    await ctx.db.patch(u._id, { platformAdmin: true });
  },
});

// ---------------------------------------------------------------------------------------------
// Catalogue: what businesses buy, make and grow
// ---------------------------------------------------------------------------------------------

type Storage = "chilled" | "frozen" | "ambient";
/** A supply: name, unit, storage, allergens, shelf life in days (undefined = no date), usual delivery qty. */
type Supply = [string, string, Storage, string[], number | undefined, number];

const SUPPLIES: Record<string, Supply> = {
  flour: ["Flour", "kg", "ambient", ["gluten"], 180, 25],
  butter: ["Butter", "kg", "chilled", ["milk"], 21, 10],
  eggs: ["Eggs", "doz", "chilled", ["egg"], 21, 10],
  milk: ["Milk 2L", "ea", "chilled", ["milk"], 10, 12],
  sugar: ["Sugar", "kg", "ambient", [], 365, 25],
  chicken: ["Chicken thighs", "kg", "chilled", [], 4, 10],
  mince: ["Beef mince", "kg", "chilled", [], 4, 10],
  onions: ["Onions", "kg", "ambient", [], 30, 20],
  tomatoes: ["Chopped tomatoes 400g", "ea", "ambient", [], 365, 48],
  peas: ["Frozen peas", "kg", "frozen", [], 180, 10],
  rice: ["Rice", "kg", "ambient", [], 365, 20],
  strawberries: ["Strawberries", "kg", "chilled", [], 5, 40],
  pectin: ["Pectin", "kg", "ambient", [], 365, 5],
  vinegar: ["Malt vinegar", "L", "ambient", ["gluten"], 365, 20],
  jars: ["Jars 500 ml", "ea", "ambient", [], undefined, 200],
  bread: ["Sandwich loaf", "ea", "ambient", ["gluten", "soy"], 5, 20],
  icecream: ["Vanilla ice cream 2L", "ea", "frozen", ["milk"], 180, 12],
  pies: ["Mince pies", "ea", "frozen", ["gluten"], 120, 24],
  sandwiches: ["Ham sandwiches", "ea", "chilled", ["gluten", "milk"], 3, 20],
  chocolate: ["Chocolate bars", "ea", "ambient", ["milk", "soy"], 270, 48],
  yoghurt: ["Yoghurt 1kg", "ea", "chilled", ["milk"], 14, 12],
  bananas: ["Bananas", "kg", "ambient", [], 6, 10],
};

/** A recipe: what one batch makes and takes, its shelf life, and the checks every batch needs. */
type Recipe = {
  name: string;
  unit: string;
  storage: Storage;
  yieldQty: number;
  shelfLifeDays: number;
  ingredients: [string, number][]; // supply key, qty per batch
  checks: string[];
};

const RECIPES: Record<string, Recipe> = {
  scones: { name: "Cheese scones", unit: "ea", storage: "ambient", yieldQty: 24, shelfLifeDays: 2, ingredients: [["flour", 2], ["butter", 0.5], ["milk", 1], ["eggs", 0.5]], checks: ["allergen_label"] },
  lasagne: { name: "Beef lasagne", unit: "portion", storage: "chilled", yieldQty: 20, shelfLifeDays: 3, ingredients: [["mince", 3], ["onions", 1], ["tomatoes", 6], ["flour", 0.5], ["milk", 2], ["butter", 0.3]], checks: ["cooking", "cooling"] },
  curry: { name: "Chicken curry", unit: "portion", storage: "chilled", yieldQty: 15, shelfLifeDays: 3, ingredients: [["chicken", 3], ["onions", 1], ["tomatoes", 4], ["rice", 2]], checks: ["cooking"] },
  jam: { name: "Strawberry jam 500 ml", unit: "jar", storage: "ambient", yieldQty: 60, shelfLifeDays: 365, ingredients: [["strawberries", 20], ["sugar", 15], ["pectin", 0.4], ["jars", 60]], checks: ["ph_test", "allergen_label"] },
  chutney: { name: "Tomato chutney 500 ml", unit: "jar", storage: "ambient", yieldQty: 40, shelfLifeDays: 365, ingredients: [["tomatoes", 30], ["onions", 6], ["sugar", 4], ["vinegar", 3], ["jars", 40]], checks: ["ph_test"] },
  porridge: { name: "Banana porridge", unit: "portion", storage: "chilled", yieldQty: 30, shelfLifeDays: 1, ingredients: [["milk", 3], ["bananas", 2], ["sugar", 0.2]], checks: [] },
};

/** Passing answers for each production check (`fail` makes the reading out of limits). */
const checkValues = (key: string, fail: boolean): Record<string, string | number | boolean | null> =>
  ({
    cooking: { coreTempC: fail ? 64 : 78, timeMet: !fail },
    cooling: { temp2h: fail ? 26 : 18, temp6h: 4 },
    reheating: { tempC: fail ? 68 : 80 },
    ph_test: { ph: fail ? 4.9 : 3.4, heatTreated: true },
    allergen_label: { cleanDown: true, allergenLabel: !fail, batchLabel: true },
    harvest_check: { containersClean: true, withholding: !fail, offGround: true, washWater: true, notes: null },
    tutin: { evidence: "Supplier declaration and low-risk harvest timing", meets: !fail },
  })[key] ?? {};

type Area = [string, "paddock" | "block" | "glasshouse" | "orchard" | "hive" | "herd" | "other"];
/** A crop: product name, unit, the area it comes from, typical harvest. */
type Crop = { name: string; unit: string; storage: Storage; area: string; qty: number; shelfLifeDays: number };

// ---------------------------------------------------------------------------------------------
// The accounts
// ---------------------------------------------------------------------------------------------

type Scenario = {
  email: string;
  name: string;
  business: {
    name: string;
    programme: "NP1" | "NP2" | "NP3";
    sectors?: string[];
    operation: "kitchen" | "manufacturer" | "farm" | "retail" | "mixed";
    region: string;
  };
  days: number; // history to simulate
  busy: number; // 1 = a delivery a day; 0.5 = every other day...
  suppliers: string[];
  supplies: string[];
  recipes?: string[];
  areas?: Area[];
  crops?: Crop[];
  customers?: string[];
  staff?: { email: string; name: string; role: "manager" | "staff" }[];
};

const SCENARIOS: Scenario[] = [
  {
    // Everything the app can do, at volume.
    email: "full@jampacked.test",
    name: "Fiona Fuller",
    business: { name: "Harbour Kitchen & Farm", programme: "NP3", operation: "mixed", region: "Otago" },
    days: 45,
    busy: 1,
    suppliers: ["Bidfood Dunedin", "Otago Meats", "Fresh Direct", "Southern Dry Goods"],
    supplies: ["flour", "butter", "eggs", "milk", "sugar", "chicken", "mince", "onions", "tomatoes", "peas", "rice", "jars", "pectin", "strawberries"],
    recipes: ["scones", "lasagne", "curry", "jam"],
    areas: [["Glasshouse 1", "glasshouse"], ["North paddock", "paddock"], ["Creek hives", "hive"]],
    crops: [
      { name: "Cherry tomatoes", unit: "kg", storage: "chilled", area: "Glasshouse 1", qty: 12, shelfLifeDays: 7 },
      { name: "Free-range eggs", unit: "doz", storage: "chilled", area: "North paddock", qty: 8, shelfLifeDays: 21 },
      { name: "Raw honey", unit: "kg", storage: "ambient", area: "Creek hives", qty: 25, shelfLifeDays: 730 },
    ],
    customers: ["Harbour Café", "St Clair Deli", "Saturday market"],
    staff: [
      { email: "manager@jampacked.test", name: "Manu Manager", role: "manager" },
      { email: "staff@jampacked.test", name: "Sam Staff", role: "staff" },
    ],
  },
  {
    email: "cafe@jampacked.test",
    name: "Kiri Cafe",
    business: { name: "Kai Corner Café", programme: "NP2", operation: "kitchen", region: "Wellington" },
    days: 14,
    busy: 0.5,
    suppliers: ["Gilmours Wellington", "Moore Wilson's"],
    supplies: ["flour", "butter", "eggs", "milk", "sugar", "chicken", "onions", "tomatoes", "rice"],
    recipes: ["scones", "curry"],
  },
  {
    email: "farm@jampacked.test",
    name: "Rangi Farmer",
    business: { name: "Riverbend Orchard & Apiary", programme: "NP1", sectors: ["horticulture", "honey"], operation: "farm", region: "Hawke's Bay" },
    days: 30,
    busy: 0.3,
    suppliers: ["Farmlands Hastings"],
    supplies: ["jars"],
    areas: [["Block A apples", "orchard"], ["Block B pears", "orchard"], ["Riverbank hives", "hive"], ["Tunnel house", "glasshouse"]],
    crops: [
      { name: "Braeburn apples", unit: "kg", storage: "chilled", area: "Block A apples", qty: 400, shelfLifeDays: 60 },
      { name: "Packham pears", unit: "kg", storage: "chilled", area: "Block B pears", qty: 250, shelfLifeDays: 45 },
      { name: "Mānuka honey", unit: "kg", storage: "ambient", area: "Riverbank hives", qty: 60, shelfLifeDays: 730 },
      { name: "Salad greens", unit: "kg", storage: "chilled", area: "Tunnel house", qty: 15, shelfLifeDays: 5 },
    ],
    customers: ["Hastings Farmers' Market", "FreshChoice Havelock North", "Packhouse export"],
    staff: [{ email: "picker@jampacked.test", name: "Pita Picker", role: "staff" }],
  },
  {
    email: "factory@jampacked.test",
    name: "Morgan Maker",
    business: { name: "Southern Preserves Ltd", programme: "NP2", sectors: ["spreads"], operation: "manufacturer", region: "Canterbury" },
    days: 60,
    busy: 1,
    suppliers: ["Canterbury Berries", "Sugar Co NZ", "Pack-It Packaging", "Veg Wholesale Ltd"],
    supplies: ["strawberries", "sugar", "pectin", "jars", "tomatoes", "onions", "vinegar"],
    recipes: ["jam", "chutney"],
    customers: ["New World Riccarton", "PAK'nSAVE Hornby", "Moore Wilson's", "Online orders"],
    staff: [
      { email: "line@jampacked.test", name: "Lee Line", role: "staff" },
      { email: "qa@jampacked.test", name: "Quinn QA", role: "manager" },
    ],
  },
  {
    email: "shop@jampacked.test",
    name: "Sunita Shop",
    business: { name: "Corner Dairy", programme: "NP2", sectors: ["retail_chilled_frozen"], operation: "retail", region: "Auckland" },
    days: 21,
    busy: 1,
    suppliers: ["Foodstuffs", "Tip Top", "Bakers Delight"],
    supplies: ["milk", "bread", "icecream", "pies", "sandwiches", "chocolate", "yoghurt"],
  },
  {
    email: "ece@jampacked.test",
    name: "Erin Educator",
    business: { name: "Little Kiwis ECE", programme: "NP2", sectors: ["ece"], operation: "kitchen", region: "Waikato" },
    days: 10,
    busy: 0.8,
    suppliers: ["Countdown Hamilton"],
    supplies: ["milk", "bananas", "sugar", "bread", "yoghurt"],
    recipes: ["porridge"],
  },
];

// ---------------------------------------------------------------------------------------------
// The simulation
// ---------------------------------------------------------------------------------------------

/** Deterministic randomness, so a re-seed gives the same data. */
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

type As = { sessionToken: string; businessId: Id<"businesses"> };

async function register(ctx: ActionCtx, email: string, name: string, business?: Scenario["business"]) {
  return (await ctx.runAction(api.auth.register, { email, name, password: SEED_PASSWORD, business })).token;
}

async function businessOf(ctx: ActionCtx, sessionToken: string, name: string) {
  return (await ctx.runQuery(api.businesses.mine, { sessionToken })).find((b) => b.name === name)!._id;
}

/** One account and its business, built day by day. */
async function build(ctx: ActionCtx, s: Scenario) {
  const random = rng(s.email.length * 7919);
  const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const token = await register(ctx, s.email, s.name, s.business);
  const as: As = { sessionToken: token, businessId: await businessOf(ctx, token, s.business.name) };
  const m = <T>(fn: T, args: object) => ctx.runMutation(fn as never, { ...as, ...args } as never) as Promise<never>;

  // Staff: invited, then they sign up and join.
  for (const p of s.staff ?? []) {
    await m(api.businesses.invite, { email: p.email, role: p.role });
    await register(ctx, p.email, p.name);
  }

  // Set-up: locations, suppliers (one not yet approved), growing areas.
  const locations: Record<Storage, Id<"locations">> = {
    chilled: await m(api.locations.create, { name: "Walk-in chiller", kind: "chiller" }),
    frozen: await m(api.locations.create, { name: "Freezer", kind: "freezer" }),
    ambient: await m(api.locations.create, { name: "Dry store", kind: "dry" }),
  };
  const suppliers: Id<"suppliers">[] = [];
  for (const [n, name] of s.suppliers.entries()) {
    suppliers.push(
      await m(api.suppliers.create, {
        name,
        contactName: `${name.split(" ")[0]} accounts`,
        phone: `03 555 01${String(n).padStart(2, "0")}`,
        approved: n < s.suppliers.length - 1 || s.suppliers.length === 1,
        registrationNumber: `FCP-${1000 + n}`,
      }),
    );
  }
  const areas: Record<string, Id<"areas">> = {};
  for (const [name, kind] of s.areas ?? []) areas[name] = await m(api.areas.create, { name, kind });

  const programme = await ctx.runQuery(api.programmes.current, as);
  const programmeChecks = programme.recordTypes.map((r) => r.key);
  const products = async () => await ctx.runQuery(api.products.list, as);
  const productId = async (name: string) => (await products()).find((p) => p.name === name)?._id;
  const produces = !!s.recipes?.length;
  const now = Date.now();

  for (let d = s.days - 1; d >= 0; d--) {
    const since = Date.now();
    const closed: Id<"correctiveActions">[] = [];
    const timed = async (task: "goodsIn" | "production" | "temperature" | "record", base: number) =>
      m(api.analytics.recordTask, { task, durationMs: Math.round(base * (0.6 + random())) });

    // Temperatures: chiller and freezer every day; a reading out of range now and then.
    const warm = random() < 0.08;
    await m(api.temperature.record, {
      unitName: "Walk-in chiller", unitType: "chiller", temperatureC: warm ? 7.5 : 2 + Math.round(random() * 20) / 10,
      ...(warm ? { correctiveAction: "Door left ajar. Closed it, moved stock to the reach-in, rechecked after 30 minutes at 4°C." } : {}),
    });
    await m(api.temperature.record, { unitName: "Freezer", unitType: "freezer", temperatureC: -18 - Math.round(random() * 3) });
    await timed("temperature", 25_000);

    // A delivery (or not, on a quiet day), and its stock.
    if (random() < s.busy || d === 0) {
      // Dry goods come in less often than fresh.
      const lines = s.supplies.filter((k) => random() < (SUPPLIES[k][2] === "ambient" ? 0.3 : produces ? 0.85 : 0.6));
      const items = (lines.length ? lines : [s.supplies[0]]).map((k, n) => {
        const [productName, unit, storageType, allergens, shelf, qty] = SUPPLIES[k];
        const reject = storageType === "chilled" && random() < 0.05;
        return {
          productName, unit, storageType, allergens,
          quantity: Math.max(1, Math.round(qty * (0.5 + random()))),
          batchCode: `${productName.slice(0, 2).toUpperCase()}${(s.days - d) * 10 + n}`,
          ...(shelf === undefined ? {} : storageType === "chilled" ? { useBy: now + shelf * DAY } : { bestBefore: now + shelf * DAY }),
          temperatureC: storageType === "chilled" ? (reject ? 9 : 3) : storageType === "frozen" ? -19 : undefined,
          packagingOk: true, labelOk: true,
          accepted: !reject,
          ...(reject ? { rejectionReason: "Arrived at 9°C" } : { locationId: locations[storageType] }),
          barcode: k === "milk" ? "9415007005455" : k === "chocolate" ? "9300605000155" : undefined,
        };
      });
      const deliveryId = await m(api.deliveries.create, {
        supplierId: pick(suppliers), invoiceNumber: `INV-${5000 + s.days - d}`, vehicleClean: true,
        vehicleTempC: 3, items,
        programmeAnswers: programme.receivingPrompts.map((p) => ({ key: p.key, value: true })),
      });
      if (d === Math.floor(s.days / 2)) {
        await m(api.deliveries.voidDelivery, { id: deliveryId, reason: "Entered twice by mistake" });
      }
      await timed("goodsIn", 140_000);
    }

    // Recipes are written once there's something in the catalogue to make them from.
    if (produces) {
      for (const key of s.recipes ?? []) {
        const r = RECIPES[key];
        if (await productId(r.name)) continue;
        const ingredients = [];
        for (const [k, qty] of r.ingredients) {
          const id = await productId(SUPPLIES[k][0]);
          if (id) ingredients.push({ productId: id, productName: "", qty, unit: SUPPLIES[k][1] });
        }
        if (ingredients.length < r.ingredients.length) continue;
        await m(api.products.create, {
          name: r.name, kind: "made", unit: r.unit, storageType: r.storage, allergens: [],
          recipe: { yieldQty: r.yieldQty, shelfLifeDays: r.shelfLifeDays, ingredients, checks: r.checks.filter((c) => programmeChecks.includes(c)) },
        });
      }
    }

    // Production: one or two batches from recipes, with their checks (now and then a failed one).
    for (const key of produces ? [pick(s.recipes!), ...(s.busy >= 1 ? [pick(s.recipes!)] : [])] : []) {
      const r = RECIPES[key];
      const id = await productId(r.name);
      if (!id) continue;
      const plan = await ctx.runQuery(api.production.plan, { ...as, productId: id, qty: r.yieldQty });
      if (plan.ingredients.some((i) => i.short > 0)) continue;
      const fail = random() < 0.07;
      await m(api.production.create, {
        productId: id, qty: r.yieldQty, fromRecipe: true, locationId: locations[r.storage],
        inputs: plan.ingredients.flatMap((i) => i.picks.map((p) => ({ lotId: p.lotId, qty: p.qty }))),
        checks: plan.checks.filter((c) => programmeChecks.includes(c)).map((c, n) => ({ recordType: c, values: checkValues(c, fail && n === 0) })),
      });
      await timed("production", 300_000);
    }

    // Harvests: farms most days, mixed businesses now and then.
    if (s.crops && random() < (s.business.operation === "farm" ? 0.7 : 0.35)) {
      const c = pick(s.crops);
      const fail = random() < 0.05;
      const checks = ["harvest_check", ...(c.name.includes("oney") ? ["tutin"] : [])].filter((k) => programmeChecks.includes(k));
      await m(api.production.create, {
        kind: "harvest", areaId: areas[c.area], productName: c.name, storageType: c.storage, unit: c.unit,
        productId: await productId(c.name),
        qty: Math.round(c.qty * (0.6 + random() * 0.8)), useBy: now + c.shelfLifeDays * DAY,
        locationId: locations[c.storage], inputs: [],
        checks: checks.map((k) => ({ recordType: k, values: checkValues(k, fail) })),
      });
      await timed("production", 180_000);
    }

    // Stock out: what came in or was made today is mostly sold or dispatched, apart from the last few days.
    if (d > 2) {
      for (const lot of await ctx.runQuery(internal.seed.lotsSince, { businessId: as.businessId, since })) {
        if (lot.status !== "available" || lot.qtyOnHand <= 0) continue;
        const made = !!lot.productionRunId;
        if (!made && lot.storageType === "ambient" && produces) continue; // dry goods last
        const qty = lot.qtyOnHand;
        const waste = random() < 0.05;
        const type = waste ? "waste" : made ? (s.customers ? "dispatch" : "sell") : produces ? "use" : "sell";
        await m(api.stock.move, {
          lotId: lot._id, type, qty: waste ? Math.min(qty, Math.ceil(qty * 0.2)) : qty,
          ...(type === "dispatch" ? { customer: pick(s.customers!) } : {}),
          ...(waste ? { reason: "Damaged in storage" } : {}),
        });
      }
    }

    // Programme records on their schedule.
    const record = (recordType: string, values: object) =>
      programmeChecks.includes(recordType) ? m(api.records.create, { recordType, values }) : null;
    if (d % 7 === 0) await record("pest_check", { area: "Kitchen, dry store and bins", found: d === 14, type: d === 14 ? "Mouse droppings by the dry store" : null, action: d === 14 ? "Bait stations checked, pest contractor called" : null });
    if (d % 30 === 3) await record("calibration", { thermometer: "Probe 1", iceReading: d === 33 ? 1.6 : 0.2, action: null });
    if (d === Math.floor(s.days * 0.7)) await record("training", { staff: s.staff?.[0]?.name ?? s.name, topic: "Allergens and labelling", trainer: s.name, competent: true });
    if (d === Math.floor(s.days * 0.4)) await record("complaint", { customer: "Walk-in customer", complaint: "Found a hair in a scone", investigation: "Hairnets not worn on the early shift", foodUnsafe: false });
    if (d % 5 === 1) await timed("record", 60_000);

    // A completed stocktake a week ago; a self-check audit three weeks ago.
    if (d === 7 && s.days > 7 && (await ctx.runQuery(api.stock.onHand, as)).length > 0) {
      const id = await m(api.stocktakes.start, {});
      const take = await ctx.runQuery(api.stocktakes.get, { ...as, id });
      for (const l of take!.lines) await m(api.stocktakes.count, { id, lotId: l.lotId, counted: Math.max(0, l.expected - (random() < 0.2 ? 1 : 0)) });
      await m(api.stocktakes.complete, { id });
    }
    if (d === 21 && s.days > 21) {
      const key = `${s.business.programme.toLowerCase()}_self_check`;
      const id = await m(api.audits.start, { templateKey: key, periodStart: Date.now() - 30 * DAY, periodEnd: Date.now() });
      const audit = await ctx.runQuery(api.audits.get, { ...as, id });
      for (const a of audit!.answers) if (a.value === null) await m(api.audits.answer, { id, questionId: a.questionId, value: a.type === "yesno" ? true : a.type === "number" ? 0 : "Reviewed, no changes" });
      await m(api.audits.complete, { id });
    }

    // Corrective actions are closed out a day or three after they're raised; the last few days' stay open.
    if (d > 4) {
      const due = Date.now() - (1 + Math.floor(random() * 3)) * DAY;
      for (const ca of (await ctx.runQuery(internal.seed.openCAs, { businessId: as.businessId })).filter((c) => c.raisedAt < due)) {
        closed.push(ca._id);
        await m(api.correctiveActions.close, { id: ca._id, resolution: "Dealt with on the day; staff reminded and checked again." });
      }
    }

    await ctx.runMutation(internal.seed.shift, { since, ms: d * DAY });
    await ctx.runMutation(internal.seed.backdateClosed, { ids: closed, ms: d * DAY });
  }

  // Today: what a manager would see open.
  const onHand = (await ctx.runQuery(api.stock.onHand, as)).filter((l) => l.status === "available" && !l.expired);
  if (onHand.length > 2) {
    await m(api.stock.hold, { lotId: onHand[0]._id, reason: "Packaging damaged: waiting on supplier" });
    await m(api.stock.transfer, { lotId: onHand[1]._id, locationId: locations.ambient });
  }
  for (const key of s.supplies.slice(0, 2)) {
    const id = await productId(SUPPLIES[key][0]);
    if (id) await m(api.products.update, { id, parLevel: SUPPLIES[key][5] * 3, reorderQty: SUPPLIES[key][5] * 2 });
  }
  if (produces || s.crops) {
    // Start of today in New Zealand, as the app sends it.
    const nz = new Date(new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
    const offset = Math.round((nz.getTime() - Date.now()) / 60_000) * 60_000; // Convex runs in UTC
    const today = Date.UTC(nz.getFullYear(), nz.getMonth(), nz.getDate()) - offset;
    for (const [n, key] of (s.recipes ?? []).entries()) {
      const id = await productId(RECIPES[key].name);
      if (id) await m(api.production.planBatch, { productId: id, qty: RECIPES[key].yieldQty * (n === 0 ? 10 : 1), dueOn: today + n * DAY, notes: n === 0 ? "Big order" : undefined });
    }
    for (const c of (s.crops ?? []).slice(0, 2)) {
      const id = await productId(c.name);
      if (id) await m(api.production.planBatch, { productId: id, qty: c.qty, kind: "harvest", areaId: areas[c.area], dueOn: today + DAY });
    }
    // A batch recorded by mistake, then voided: a harvest if they grow things, else the first recipe they can make.
    let runId: Id<"productionRuns"> | undefined;
    const crop = s.crops?.[0];
    if (crop) {
      runId = await m(api.production.create, {
        kind: "harvest", areaId: areas[crop.area], productId: await productId(crop.name), productName: crop.name,
        unit: crop.unit, qty: 1, inputs: [],
      });
    }
    for (const key of runId ? [] : (s.recipes ?? [])) {
      const id = await productId(RECIPES[key].name);
      if (!id) continue;
      const plan = await ctx.runQuery(api.production.plan, { ...as, productId: id, qty: 1 });
      if (plan.ingredients.some((i) => i.short > 0)) continue;
      runId = await m(api.production.create, {
        productId: id, qty: 1, fromRecipe: true,
        inputs: plan.ingredients.flatMap((i) => i.picks.map((p) => ({ lotId: p.lotId, qty: p.qty }))),
        checks: plan.checks.map((c) => ({ recordType: c, values: checkValues(c, false) })),
      });
      break;
    }
    if (runId) await m(api.production.voidRun, { id: runId, reason: "Recorded under the wrong product" });
  }
  if (s.days > 7) {
    if (onHand.length > 0) await m(api.stocktakes.start, {}); // left in progress
    await m(api.audits.start, { templateKey: "goods_receipt", periodStart: Date.now() - 7 * DAY, periodEnd: Date.now() }); // left in progress
  }
  return as;
}

/** Wipes the deployment and creates every test account. Only for a deployment that isn't live. */
export const run = internalAction({
  args: { confirm: v.literal("wipe everything"), only: v.optional(v.array(v.string())) },
  handler: async (ctx, { only }) => {
    if (process.env.SEED_ALLOWED !== "true") throw new ConvexError("Seeding is turned off on this deployment");
    for (const table of Object.keys(schema.tables)) {
      while ((await ctx.runMutation(internal.seed.wipeTable, { table })) > 0);
    }
    const accounts: string[] = [];
    const built: Record<string, As> = {};
    for (const s of SCENARIOS.filter((x) => !only || only.includes(x.email))) {
      built[s.email] = await build(ctx, s);
      accounts.push(s.email, ...(s.staff ?? []).map((p) => `${p.email} (${p.role} at ${s.business.name})`));
    }

    const full = built["full@jampacked.test"];
    if (full) {
      const m = <T>(fn: T, args: object) => ctx.runMutation(fn as never, { ...full, ...args } as never) as Promise<never>;
      // An invite nobody has taken up yet; staff also works at the factory.
      await m(api.businesses.invite, { email: "pending@jampacked.test", role: "staff" });
      const factory = built["factory@jampacked.test"];
      if (factory) await ctx.runMutation(api.businesses.invite, { ...factory, email: "staff@jampacked.test", role: "staff" });
      // A second business on a custom programme, and an archived one.
      const shopId = await ctx.runMutation(api.businesses.create, {
        sessionToken: full.sessionToken, name: "Fiona's Farm Shop", programme: "NP1", sectors: ["horticulture"], operation: "farm", region: "Otago",
      });
      const custom = await ctx.runMutation(api.customProgrammes.create, {
        sessionToken: full.sessionToken, name: "Farm shop plan", copyFrom: "NP1", businessId: shopId,
      });
      const p = (await ctx.runQuery(api.customProgrammes.get, { sessionToken: full.sessionToken, id: custom }))!;
      await ctx.runMutation(api.customProgrammes.update, {
        sessionToken: full.sessionToken, id: custom,
        recordTypes: [
          ...p.recordTypes,
          { key: "brix", name: "Brix reading", description: "Sugar level of fruit at harvest.", production: "harvest", fields: [{ key: "brix", label: "Brix", type: "number", unit: "°Bx", required: true, failIf: { below: 10, message: "Fruit not ripe enough" } }] },
        ],
      });
      const oldId = await ctx.runMutation(api.businesses.create, { sessionToken: full.sessionToken, name: "Old Town Café", programme: "NP2", operation: "kitchen", region: "Otago" });
      await ctx.runMutation(api.businesses.setArchived, { sessionToken: full.sessionToken, businessId: oldId, archived: true });
      await ctx.runMutation(internal.seed.makePlatformAdmin, { email: "full@jampacked.test" });
      accounts.push("pending@jampacked.test (invited, not signed up)");
    }

    // A brand new account with an empty business, for trying sign-up and the empty screens.
    if (!only || only.includes("new@jampacked.test")) {
      await register(ctx, "new@jampacked.test", "Nina New", { name: "Fresh Start Foods", programme: "NP2", operation: "mixed", region: "Nelson" });
      accounts.push("new@jampacked.test");
    }
    return { password: SEED_PASSWORD, accounts };
  },
});
