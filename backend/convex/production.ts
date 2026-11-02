import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { loadModule } from "./lib/module";
import { inBusiness, requireMember, scoped } from "./lib/session";
import { createLot, lotsOnHand, recordMovement, usable } from "./lib/stock";
import { saveRecord } from "./records";
import { answerValue, runKind, storageType } from "./schema";

const DAY = 86_400_000;
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Batch codes run P0001, P0002... per business, so nobody has to make one up. */
async function nextBatchCode(ctx: QueryCtx, businessId: Id<"businesses">) {
  const last = await ctx.db
    .query("productionRuns")
    .withIndex("by_business_madeAt", (q) => q.eq("businessId", businessId))
    .order("desc")
    .first();
  let n = Number(/^P(\d+)$/.exec(last?.batchCode ?? "")?.[1] ?? 0);
  for (;;) {
    const code = `P${String(++n).padStart(4, "0")}`;
    if (!(await batchTaken(ctx, businessId, code))) return code;
  }
}

const batchTaken = async (ctx: QueryCtx, businessId: Id<"businesses">, batchCode: string) =>
  (await ctx.db
    .query("productionRuns")
    .withIndex("by_business_batch", (q) => q.eq("businessId", businessId).eq("batchCode", batchCode))
    .first()) !== null;

/** A batch's stock: how much is left and who it was dispatched to (tracing one step forward). */
async function batchStock(ctx: QueryCtx, run: Doc<"productionRuns">) {
  const lot = (await ctx.db.get(run.lotId!))!; // set in the same mutation that records the run
  const movements = await ctx.db.query("stockMovements").withIndex("by_lot", (q) => q.eq("lotId", lot._id)).collect();
  return {
    _id: lot._id,
    status: lot.status,
    qtyOnHand: lot.qtyOnHand,
    dispatched: movements.filter((m) => m.type === "dispatch").map((m) => ({ customer: m.customer!, qty: -m.qty, at: m.at })),
  };
}

/** What the next batch will be called, for the app to show before anything is saved. */
export const batchCode = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId);
    return await nextBatchCode(ctx, businessId);
  },
});

/**
 * Making `qty` of a product from its recipe: how much of each ingredient that takes and which
 * lots to take it from, first expiring first. Held, used-up and out-of-date stock is skipped;
 * anything still needed after that is `short`.
 */
export const plan = query({
  args: { ...scoped, productId: v.id("products"), qty: v.number() },
  handler: async (ctx, { sessionToken, businessId, productId, qty }) => {
    await requireMember(ctx, sessionToken, businessId);
    const product = inBusiness(await ctx.db.get(productId), businessId, "Product");
    if (!product.recipe) throw new ConvexError(`${product.name} has no recipe`);
    if (!(qty > 0)) throw new ConvexError("Quantity must be more than 0");
    const now = Date.now();
    return {
      product: { _id: product._id, name: product.name, unit: product.unit, storageType: product.storageType },
      ingredients: await pickLots(ctx, businessId, product.recipe, qty, now),
      useBy: product.recipe.shelfLifeDays === undefined ? undefined : now + product.recipe.shelfLifeDays * DAY,
      checks: product.recipe.checks ?? [],
    };
  },
});

async function pickLots(
  ctx: QueryCtx,
  businessId: Id<"businesses">,
  recipe: NonNullable<Doc<"products">["recipe"]>,
  qty: number,
  now: number,
) {
  const scale = qty / recipe.yieldQty;
  const lots = (await lotsOnHand(ctx, businessId)).filter((l) => usable(l, now));
  const taken = new Map<Id<"stockLots">, number>();
  return recipe.ingredients.map((i) => {
    const need = round(i.qty * scale);
    let left = need;
    const picks = [];
    for (const lot of lots) {
      if (left <= 0) break;
      if (lot.productId !== i.productId || lot.unit.toLowerCase() !== i.unit.toLowerCase()) continue;
      const free = round(lot.qtyOnHand - (taken.get(lot._id) ?? 0));
      if (free <= 0) continue;
      const take = Math.min(free, left);
      taken.set(lot._id, round((taken.get(lot._id) ?? 0) + take));
      left = round(left - take);
      picks.push({
        lotId: lot._id,
        batchCode: lot.batchCode,
        supplierName: lot.supplierName,
        useBy: lot.useBy,
        bestBefore: lot.bestBefore,
        qtyOnHand: lot.qtyOnHand,
        qty: take,
      });
    }
    return { productId: i.productId, productName: i.productName, unit: i.unit, need, picks, short: left };
  });
}

/**
 * Records a production run. The inputs are used out of their lots and the batch goes into stock
 * as a new lot. Make an existing product (`productId`, from its recipe or as a one-off) or name a
 * new one (`productName`), which is added to the catalogue as a made product.
 *
 * A harvest (`kind: "harvest"`) comes from a growing area and needs no inputs. `checks` are the
 * programme's production checks, each saved as a record linked to the run (failures raise
 * corrective actions); the recipe's `checks` must all be there.
 */
export const create = mutation({
  args: {
    ...scoped,
    productId: v.optional(v.id("products")),
    productName: v.optional(v.string()),
    qty: v.number(),
    unit: v.optional(v.string()),
    storageType: v.optional(storageType),
    batchCode: v.optional(v.string()),
    useBy: v.optional(v.number()),
    bestBefore: v.optional(v.number()),
    locationId: v.optional(v.id("locations")),
    fromRecipe: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    inputs: v.array(v.object({ lotId: v.id("stockLots"), qty: v.number() })),
    kind: v.optional(runKind),
    areaId: v.optional(v.id("areas")),
    plannedId: v.optional(v.id("plannedBatches")),
    checks: v.optional(v.array(v.object({ recordType: v.string(), values: v.record(v.string(), answerValue) }))),
  },
  handler: async (ctx, { sessionToken, businessId, inputs, kind = "make", areaId, plannedId, checks = [], ...args }) => {
    const { user, business } = await requireMember(ctx, sessionToken, businessId);
    const harvest = kind === "harvest";
    if (!(args.qty > 0)) throw new ConvexError(harvest ? "Say how much you harvested" : "Say how much you made");
    const area = areaId && inBusiness(await ctx.db.get(areaId), businessId, "Area");
    if (harvest && !area) throw new ConvexError("Where was it harvested from?");
    if (!harvest && inputs.length === 0) throw new ConvexError("Add what went into it");
    if (args.locationId) inBusiness(await ctx.db.get(args.locationId), businessId, "Location");
    const planned = plannedId && inBusiness(await ctx.db.get(plannedId), businessId, "Planned batch");
    if (planned && planned.status !== "planned") throw new ConvexError("That planned batch has already been done or cancelled");
    const product = await productFor(ctx, businessId, args);
    const m = await loadModule(ctx, business);
    for (const c of checks) {
      const type = m.recordTypes.find((r) => r.key === c.recordType);
      if (!type?.production || (type.production !== kind && type.production !== "both")) {
        throw new ConvexError(`${type?.name ?? c.recordType} isn't a ${harvest ? "harvest" : "batch"} check`);
      }
    }
    for (const key of product.recipe?.checks ?? []) {
      const type = m.recordTypes.find((r) => r.key === key);
      // A check the programme no longer has can't be filled in, so it isn't asked for.
      if (type && !checks.some((c) => c.recordType === key)) throw new ConvexError(`Fill in the ${type.name} check`);
    }
    const unit = args.unit?.trim() || product.unit;
    if (!unit) throw new ConvexError(`What unit is ${product.name} counted in?`);
    const batchCode = args.batchCode?.trim() || (await nextBatchCode(ctx, businessId));
    if (await batchTaken(ctx, businessId, batchCode)) throw new ConvexError(`Batch ${batchCode} has already been used`);
    const now = Date.now();
    const useBy =
      args.useBy ?? (product.recipe?.shelfLifeDays === undefined ? undefined : now + product.recipe.shelfLifeDays * DAY);

    const lots: Doc<"stockLots">[] = [];
    const allergens = new Set(product.allergens);
    for (const i of inputs) {
      const lot = inBusiness(await ctx.db.get(i.lotId), businessId, "Stock");
      if (!(i.qty > 0)) throw new ConvexError(`How much ${lot.productName} went in?`);
      if (lot.status === "hold") throw new ConvexError(`${lot.productName} is on hold: ${lot.holdReason}`);
      if (!usable(lot, now)) throw new ConvexError(`${lot.productName}${lot.batchCode ? ` batch ${lot.batchCode}` : ""} can't be used`);
      const from = lot.productId && (await ctx.db.get(lot.productId));
      for (const a of from ? from.allergens : []) allergens.add(a);
      lots.push(lot);
    }

    const runId = await ctx.db.insert("productionRuns", {
      businessId,
      productId: product._id,
      productName: product.name,
      batchCode,
      qty: args.qty,
      unit,
      fromRecipe: args.fromRecipe ?? false,
      ...(harvest ? { kind } : {}),
      ...(area ? { areaId: area._id, areaName: area.name } : {}),
      ...(planned ? { plannedId: planned._id } : {}),
      inputs: inputs.map((i, n) => ({
        lotId: i.lotId,
        productName: lots[n].productName,
        batchCode: lots[n].batchCode,
        supplierName: lots[n].supplierName,
        qty: i.qty,
        unit: lots[n].unit,
      })),
      allergens: [...allergens].sort(),
      useBy,
      bestBefore: args.bestBefore,
      notes: args.notes?.trim() || undefined,
      madeAt: now,
      madeById: user._id,
      madeByName: user.name,
    });
    for (const [n, i] of inputs.entries()) {
      // Re-read: the same lot can be listed twice.
      const lot = (await ctx.db.get(lots[n]._id))!;
      await recordMovement(ctx, user, lot, {
        type: "use",
        qty: -i.qty,
        reason: `${harvest ? "Used for harvest" : "Made"} ${product.name} batch ${batchCode}`,
        productionRunId: runId,
      });
    }
    const lotId = await createLot(
      ctx,
      user,
      {
        businessId,
        productId: product._id,
        productName: product.name,
        barcode: product.barcode,
        productionRunId: runId,
        batchCode,
        useBy,
        bestBefore: args.bestBefore,
        locationId: args.locationId,
        storageType: args.storageType ?? product.storageType,
        unit,
        qtyReceived: args.qty,
        receivedAt: now,
      },
      harvest ? `Harvested from ${area!.name}, batch ${batchCode}` : `Made in batch ${batchCode}`,
    );
    await ctx.db.patch(runId, { lotId });
    if (planned) await ctx.db.patch(planned._id, { status: "done", runId });
    for (const c of checks) {
      // Checks name the food or batch they're about; on a batch that's this one unless typed.
      const values = { ...c.values };
      for (const k of ["food", "batch"]) values[k] ||= `${product.name} ${batchCode}`;
      await saveRecord(ctx, user, businessId, m, c.recordType, values, runId);
    }
    // Whatever went in is in the product too, and its unit is remembered for next time.
    await ctx.db.patch(product._id, { allergens: [...allergens].sort(), unit: product.unit ?? unit });
    await logAudit(ctx, user, {
      businessId,
      action: "produce",
      entityType: "productionRun",
      entityId: runId,
      summary: `${harvest ? "Harvested" : "Made"} ${args.qty} ${unit} ${product.name}, batch ${batchCode}${
        area ? `, from ${area.name}` : ""
      }${
        lots.length
          ? `${area ? " using" : ", from"} ${lots
              .map((l, n) => `${inputs[n].qty} ${l.unit} ${l.productName}${l.batchCode ? ` (${l.batchCode})` : ""}`)
              .join(", ")}`
          : ""
      }`,
    });
    return runId;
  },
});

/** The product a run makes: an existing one, or a new made product added to the catalogue. */
async function productFor(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  args: { productId?: Id<"products">; productName?: string; storageType?: Doc<"products">["storageType"] },
) {
  if (args.productId) return inBusiness(await ctx.db.get(args.productId), businessId, "Product");
  const name = args.productName?.trim();
  if (!name) throw new ConvexError("What did you make?");
  const existing = await ctx.db
    .query("products")
    .withIndex("by_business_name", (q) => q.eq("businessId", businessId).eq("name", name))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("products", {
    businessId,
    name,
    kind: "made",
    storageType: args.storageType ?? "chilled",
    allergens: [],
    active: true,
    createdAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

export const list = query({
  args: { ...scoped, limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, businessId, limit }) => {
    await requireMember(ctx, sessionToken, businessId);
    return await ctx.db
      .query("productionRuns")
      .withIndex("by_business_madeAt", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(limit ?? 100);
  },
});

/** One run with its batch's stock: how much is left and who it went to. */
export const get = query({
  args: { ...scoped, id: v.id("productionRuns") },
  handler: async (ctx, { sessionToken, businessId, id }) => {
    await requireMember(ctx, sessionToken, businessId);
    const run = await ctx.db.get(id);
    if (!run || run.businessId !== businessId) return null;
    const checks = await ctx.db.query("records").withIndex("by_productionRun", (q) => q.eq("productionRunId", id)).collect();
    return { run, lot: await batchStock(ctx, run), checks };
  },
});

/**
 * Traceability for things made here: runs whose batch, product, growing area or any input
 * (product or supplier batch) matches. Pairs with deliveries.trace, which covers what came in.
 */
export const trace = query({
  args: { ...scoped, search: v.string() },
  handler: async (ctx, { sessionToken, businessId, search }) => {
    await requireMember(ctx, sessionToken, businessId);
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const runs = await ctx.db
      .query("productionRuns")
      .withIndex("by_business_madeAt", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(2000);
    const out = [];
    for (const run of runs) {
      const hit = (s?: string) => s?.toLowerCase().includes(term);
      if (!hit(run.batchCode) && !hit(run.productName) && !hit(run.areaName) && !run.inputs.some((i) => hit(i.batchCode) || hit(i.productName))) {
        continue;
      }
      out.push({ ...run, lot: await batchStock(ctx, run) });
    }
    return out;
  },
});

/**
 * Undoes a batch recorded by mistake, while its stock is untouched: each input goes back on its
 * lot and the batch lot is emptied, both as `void` movements. The run and its batch code are kept.
 */
export const voidRun = mutation({
  args: { ...scoped, id: v.id("productionRuns"), reason: v.string() },
  handler: async (ctx, { sessionToken, businessId, id, reason }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!reason.trim()) throw new ConvexError("Say why the batch is being voided");
    const run = inBusiness(await ctx.db.get(id), businessId, "Batch");
    if (run.voided) throw new ConvexError(`Batch ${run.batchCode} is already voided`);
    const lot = (await ctx.db.get(run.lotId!))!;
    const moves = await ctx.db.query("stockMovements").withIndex("by_lot", (q) => q.eq("lotId", lot._id)).collect();
    if (moves.length > 1) {
      throw new ConvexError(`Batch ${run.batchCode} has already been used, moved or dispatched: waste or adjust it instead`);
    }
    const why = `Batch ${run.batchCode} voided: ${reason.trim()}`;
    await recordMovement(ctx, user, lot, { type: "void", qty: -lot.qtyOnHand, reason: why, productionRunId: id });
    for (const i of run.inputs) {
      const input = (await ctx.db.get(i.lotId))!; // lots are never deleted; re-read as one can be listed twice
      await recordMovement(ctx, user, input, { type: "void", qty: i.qty, reason: why, productionRunId: id });
    }
    await ctx.db.patch(id, { voided: true, voidReason: reason.trim(), voidedAt: Date.now(), voidedByName: user.name });
    await logAudit(ctx, user, { businessId, action: "void", entityType: "productionRun", entityId: id, summary: why });
  },
});

/** Batches planned ahead (not yet done), soonest first, each with any ingredient shortfall today. */
export const planned = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId);
    const rows = await ctx.db
      .query("plannedBatches")
      .withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", "planned"))
      .collect();
    const now = Date.now();
    const out = [];
    for (const p of rows) {
      const product = (await ctx.db.get(p.productId))!;
      // ponytail: each plan is checked against all stock on its own; two plans can both claim the same lot.
      const short =
        p.kind === "make" && product.recipe
          ? (await pickLots(ctx, businessId, product.recipe, p.qty, now))
              .filter((i) => i.short > 0)
              .map((i) => ({ productName: i.productName, unit: i.unit, short: i.short }))
          : [];
      const area = p.areaId && (await ctx.db.get(p.areaId));
      out.push({ ...p, areaName: area ? area.name : undefined, hasRecipe: !!product.recipe, short });
    }
    return out;
  },
});

/** Plans a batch or harvest for a day. Managers plan; anyone can start a planned batch. */
export const planBatch = mutation({
  args: {
    ...scoped,
    productId: v.id("products"),
    qty: v.number(),
    unit: v.optional(v.string()),
    kind: v.optional(runKind),
    areaId: v.optional(v.id("areas")),
    dueOn: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, businessId, kind = "make", ...args }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const product = inBusiness(await ctx.db.get(args.productId), businessId, "Product");
    if (!(args.qty > 0)) throw new ConvexError("Say how much to make");
    if (args.areaId) inBusiness(await ctx.db.get(args.areaId), businessId, "Area");
    const id = await ctx.db.insert("plannedBatches", {
      businessId,
      ...args,
      productName: product.name,
      unit: args.unit?.trim() || product.unit,
      notes: args.notes?.trim() || undefined,
      kind,
      status: "planned",
      createdAt: Date.now(),
      createdByName: user.name,
    });
    await logAudit(ctx, user, {
      businessId,
      action: "create",
      entityType: "plannedBatch",
      entityId: id,
      summary: `Planned ${kind === "harvest" ? "harvest" : "batch"}: ${args.qty} ${product.name} on ${new Date(args.dueOn).toISOString().slice(0, 10)}`,
    });
    return id;
  },
});

export const cancelPlanned = mutation({
  args: { ...scoped, id: v.id("plannedBatches") },
  handler: async (ctx, { sessionToken, businessId, id }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const p = inBusiness(await ctx.db.get(id), businessId, "Planned batch");
    if (p.status !== "planned") throw new ConvexError("That planned batch has already been done or cancelled");
    await ctx.db.patch(id, { status: "cancelled" });
    await logAudit(ctx, user, { businessId, action: "cancel", entityType: "plannedBatch", entityId: id, summary: `Cancelled planned ${p.productName}` });
  },
});
