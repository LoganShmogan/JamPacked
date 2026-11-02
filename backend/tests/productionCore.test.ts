// Production as a core use case: growing areas and harvests, production checks, planning and voiding.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { DAY, T, addBusiness, addSupplier, auditLog, cas, item, setup, signIn } from "./helpers";

type As = { sessionToken: string; businessId: Id<"businesses"> };

async function ready(role: "admin" | "manager" | "staff" = "manager") {
  const t = setup();
  const user = await signIn(t, role);
  const as: As = { sessionToken: user.token, businessId: user.businessId };
  return { t, ...user, as };
}

/** 10 kg of flour in stock, plus a "Bread" product whose recipe takes 1 kg per loaf. */
async function bakery(t: T, as: As, checks?: string[]) {
  const supplierId = await addSupplier(t);
  await t.mutation(api.deliveries.create, {
    ...as, supplierId, vehicleClean: true,
    items: [item({ productName: "Flour", unit: "kg", quantity: 10, batchCode: "F1", storageType: "ambient", allergens: ["gluten"] })],
  });
  const flourLot = (await t.run((ctx) => ctx.db.query("stockLots").collect()))[0];
  const bread = await t.mutation(api.products.create, {
    ...as, name: "Bread", kind: "made", unit: "ea", storageType: "ambient", allergens: [],
    recipe: { yieldQty: 1, checks, ingredients: [{ productId: flourLot.productId!, productName: "", qty: 1, unit: "kg" }] },
  });
  return { flourLot, bread };
}

const lot = (t: T, id: Id<"stockLots">) => t.run(async (ctx) => (await ctx.db.get(id))!);
const run = (t: T, id: Id<"productionRuns">) => t.run(async (ctx) => (await ctx.db.get(id))!);

describe("business type", () => {
  test("is set at sign-up or in settings, and unset means mixed", async () => {
    const { t, as, token } = await ready("admin");
    expect((await t.query(api.businesses.mine, { sessionToken: token }))[0].operation).toBe("mixed");
    await t.mutation(api.settings.update, { ...as, operation: "farm" });
    expect((await t.query(api.settings.get, as)).operation).toBe("farm");
    const id = await t.mutation(api.businesses.create, { sessionToken: token, name: "Kitchen", programme: "NP3", operation: "kitchen" });
    expect((await t.run((ctx) => ctx.db.get(id)))?.operation).toBe("kitchen");
  });
});

describe("growing areas", () => {
  test("managers add, rename and archive areas; the list hides archived ones", async () => {
    const { t, as } = await ready();
    const id = await t.mutation(api.areas.create, { ...as, name: " North paddock ", kind: "paddock", notes: "  " });
    await t.mutation(api.areas.create, { ...as, name: "Hives", kind: "hive", notes: " By the creek " });
    expect((await t.query(api.areas.list, as)).map((a) => [a.name, a.notes])).toEqual([
      ["Hives", "By the creek"],
      ["North paddock", undefined],
    ]);
    await t.mutation(api.areas.update, { ...as, id, active: false });
    expect((await t.query(api.areas.list, as)).map((a) => a.name)).toEqual(["Hives"]);
    expect(await t.query(api.areas.list, { ...as, includeInactive: true })).toHaveLength(2);
    await t.mutation(api.areas.update, { ...as, id });
    expect((await auditLog(t)).map((l) => l.summary)).toEqual([
      "Added growing area North paddock (paddock)",
      "Added growing area Hives (hive)",
      "Updated growing area North paddock (active)",
      "Updated growing area North paddock (no changes)",
    ]);
    await expect(t.mutation(api.areas.create, { ...as, name: " ", kind: "block" })).rejects.toThrow("Name the area");
    await expect(t.mutation(api.areas.update, { ...as, id, name: "" })).rejects.toThrow("Name the area");
  });

  test("staff can't change areas, and another business's areas aren't found", async () => {
    const { t, as, userId } = await ready();
    const id = await t.mutation(api.areas.create, { ...as, name: "Block A", kind: "block" });
    const staff = await signIn(t, "staff");
    await expect(t.mutation(api.areas.create, { sessionToken: staff.token, businessId: as.businessId, name: "X", kind: "other" })).rejects.toThrow();
    const other = await addBusiness(t, userId);
    const boss = await signIn(t, "admin", {}, other);
    await expect(t.mutation(api.areas.update, { sessionToken: boss.token, businessId: other, id, name: "Mine" })).rejects.toThrow("Area not found");
  });
});

describe("harvest", () => {
  test("comes from an area with no inputs, goes into stock and traces by area", async () => {
    const { t, as } = await ready();
    const area = await t.mutation(api.areas.create, { ...as, name: "Glasshouse 2", kind: "glasshouse" });
    const id = await t.mutation(api.production.create, {
      ...as, kind: "harvest", areaId: area, productName: "Tomatoes", qty: 40, unit: "kg", storageType: "ambient", inputs: [],
    });
    const r = await run(t, id);
    expect(r).toMatchObject({ kind: "harvest", areaId: area, areaName: "Glasshouse 2", qty: 40, inputs: [] });
    expect(await lot(t, r.lotId!)).toMatchObject({ productName: "Tomatoes", qtyOnHand: 40, unit: "kg" });
    const moves = await t.run((ctx) => ctx.db.query("stockMovements").collect());
    expect(moves[0].reason).toBe("Harvested from Glasshouse 2, batch P0001");
    expect((await auditLog(t)).at(-1)?.summary).toBe("Harvested 40 kg Tomatoes, batch P0001, from Glasshouse 2");
    expect((await t.query(api.production.trace, { ...as, search: "glasshouse" })).map((x) => x._id)).toEqual([id]);
  });

  test("can use inputs too (seed, feed), and must say where and how much", async () => {
    const { t, as } = await ready();
    const { flourLot } = await bakery(t, as);
    const area = await t.mutation(api.areas.create, { ...as, name: "Orchard", kind: "orchard" });
    await t.mutation(api.production.create, {
      ...as, kind: "harvest", areaId: area, productName: "Apples", qty: 5, unit: "kg", inputs: [{ lotId: flourLot._id, qty: 1 }],
    });
    expect((await auditLog(t)).at(-1)?.summary).toBe("Harvested 5 kg Apples, batch P0001, from Orchard using 1 kg Flour (F1)");
    const used = await t.run((ctx) => ctx.db.query("stockMovements").withIndex("by_lot", (q) => q.eq("lotId", flourLot._id)).collect());
    expect(used.at(-1)?.reason).toBe("Used for harvest Apples batch P0001");
    const harvest = { ...as, kind: "harvest" as const, productName: "Apples", unit: "kg", inputs: [] };
    await expect(t.mutation(api.production.create, { ...harvest, qty: 1 })).rejects.toThrow("Where was it harvested from?");
    await expect(t.mutation(api.production.create, { ...harvest, areaId: area, qty: 0 })).rejects.toThrow("Say how much you harvested");
  });
});

describe("production checks", () => {
  test("are saved as records on the batch; failures raise corrective actions", async () => {
    const { t, as } = await ready();
    const { flourLot, bread } = await bakery(t, as);
    const id = await t.mutation(api.production.create, {
      ...as, productId: bread, qty: 2, inputs: [{ lotId: flourLot._id, qty: 2 }],
      checks: [
        { recordType: "cooking", values: { coreTempC: 60, timeMet: true } },
        { recordType: "allergen_label", values: { cleanDown: true, allergenLabel: true, batchLabel: true } },
      ],
    });
    const { checks } = (await t.query(api.production.get, { ...as, id }))!;
    expect(checks.map((c) => [c.recordType, c.values.food ?? null, c.issues])).toEqual([
      ["cooking", "Bread P0001", ["Food not cooked to a safe temperature"]],
      ["allergen_label", null, []],
    ]);
    expect((await cas(t)).map((c) => c.title)).toEqual(["Cooking / pasteurising: Food not cooked to a safe temperature"]);
    // A typed-in name is kept.
    const id2 = await t.mutation(api.production.create, {
      ...as, productId: bread, qty: 1, inputs: [{ lotId: flourLot._id, qty: 1 }],
      checks: [{ recordType: "cooking", values: { food: "Loaves", coreTempC: 80, timeMet: true } }],
    });
    expect((await t.query(api.production.get, { ...as, id: id2 }))!.checks[0].values.food).toBe("Loaves");
  });

  test("only production checks for the right kind of run, and a recipe's checks are required", async () => {
    const { t, as } = await ready();
    const { flourLot, bread } = await bakery(t, as, ["cooking", "gone_from_programme"]);
    const make = { ...as, productId: bread, qty: 1, inputs: [{ lotId: flourLot._id, qty: 1 }] };
    await expect(t.mutation(api.production.create, make)).rejects.toThrow("Fill in the Cooking / pasteurising check");
    await expect(
      t.mutation(api.production.create, { ...make, checks: [{ recordType: "pest_check", values: {} }] }),
    ).rejects.toThrow("Pest check isn't a batch check");
    await expect(
      t.mutation(api.production.create, { ...make, checks: [{ recordType: "harvest_check", values: {} }] }),
    ).rejects.toThrow("Harvest check isn't a batch check");
    await expect(
      t.mutation(api.production.create, { ...make, checks: [{ recordType: "nope", values: {} }] }),
    ).rejects.toThrow("nope isn't a batch check");
    const area = await t.mutation(api.areas.create, { ...as, name: "Hives", kind: "hive" });
    await expect(
      t.mutation(api.production.create, {
        ...as, kind: "harvest", areaId: area, productName: "Honey", qty: 1, unit: "kg", inputs: [],
        checks: [{ recordType: "cooking", values: {} }],
      }),
    ).rejects.toThrow("Cooking / pasteurising isn't a harvest check");
    expect((await t.query(api.production.plan, { ...as, productId: bread, qty: 1 })).checks).toEqual(["cooking", "gone_from_programme"]);
    await t.mutation(api.production.create, { ...make, checks: [{ recordType: "cooking", values: { coreTempC: 80, timeMet: true } }] });
  });

  test("custom programmes can mark their own record types as checks, and copies keep the built-in ones", async () => {
    const { t, as, token } = await ready("admin");
    const pid = await t.mutation(api.customProgrammes.create, { sessionToken: token, name: "Ours", copyFrom: "NP3", businessId: as.businessId });
    const p = (await t.query(api.customProgrammes.get, { sessionToken: token, id: pid }))!;
    expect(p.recordTypes.find((r) => r.key === "cooling")?.production).toBe("make");
    expect(p.recordTypes.find((r) => r.key === "harvest_check")?.production).toBe("harvest");
    await t.mutation(api.customProgrammes.update, {
      sessionToken: token, id: pid,
      recordTypes: [{ key: "brix", name: "Brix", description: "Sugar", fields: [{ key: "b", label: "Brix", type: "number" }], production: "both" }],
    });
    const area = await t.mutation(api.areas.create, { ...as, name: "Vines", kind: "block" });
    const id = await t.mutation(api.production.create, {
      ...as, kind: "harvest", areaId: area, productName: "Grapes", qty: 1, unit: "t", inputs: [], checks: [{ recordType: "brix", values: { b: 22 } }],
    });
    expect((await t.query(api.production.get, { ...as, id }))!.checks[0].values).toEqual({ b: 22 });
  });
});

describe("planning", () => {
  test("managers plan batches; the plan shows shortfalls, and starting one marks it done", async () => {
    const { t, as } = await ready();
    const { flourLot, bread } = await bakery(t, as);
    const area = await t.mutation(api.areas.create, { ...as, name: "Hives", kind: "hive" });
    const honey = await t.mutation(api.products.create, { ...as, name: "Honey", kind: "made", storageType: "ambient", allergens: [] });
    const today = new Date("2026-11-03").getTime();
    const big = await t.mutation(api.production.planBatch, { ...as, productId: bread, qty: 12, dueOn: today + DAY, notes: " " });
    const small = await t.mutation(api.production.planBatch, { ...as, productId: bread, qty: 3, unit: " loaf ", dueOn: today, notes: " Rye " });
    await t.mutation(api.production.planBatch, { ...as, productId: honey, qty: 20, kind: "harvest", areaId: area, dueOn: today });
    const plans = await t.query(api.production.planned, as);
    expect(plans.map((p) => [p.productName, p.qty, p.unit, p.notes, p.areaName, p.hasRecipe, p.short])).toEqual([
      ["Bread", 3, "loaf", "Rye", undefined, true, []],
      ["Honey", 20, undefined, undefined, "Hives", false, []],
      ["Bread", 12, "ea", undefined, undefined, true, [{ productName: "Flour", unit: "kg", short: 2 }]],
    ]);
    expect((await auditLog(t)).at(-1)?.summary).toBe("Planned harvest: 20 Honey on 2026-11-03");

    const runId = await t.mutation(api.production.create, { ...as, productId: bread, qty: 3, plannedId: small, inputs: [{ lotId: flourLot._id, qty: 3 }] });
    expect((await run(t, runId)).plannedId).toBe(small);
    expect(await t.run((ctx) => ctx.db.get(small))).toMatchObject({ status: "done", runId });
    await expect(
      t.mutation(api.production.create, { ...as, productId: bread, qty: 1, plannedId: small, inputs: [{ lotId: flourLot._id, qty: 1 }] }),
    ).rejects.toThrow("already been done or cancelled");

    await t.mutation(api.production.cancelPlanned, { ...as, id: big });
    await expect(t.mutation(api.production.cancelPlanned, { ...as, id: big })).rejects.toThrow("already been done or cancelled");
    expect((await t.query(api.production.planned, as)).map((p) => p.productName)).toEqual(["Honey"]);
    await expect(t.mutation(api.production.planBatch, { ...as, productId: bread, qty: 0, dueOn: today })).rejects.toThrow("Say how much to make");
  });

  test("staff can't plan or cancel", async () => {
    const { t, as } = await ready();
    const { bread } = await bakery(t, as);
    const id = await t.mutation(api.production.planBatch, { ...as, productId: bread, qty: 1, dueOn: 0 });
    const staff = await signIn(t, "staff");
    const s = { sessionToken: staff.token, businessId: as.businessId };
    await expect(t.mutation(api.production.planBatch, { ...s, productId: bread, qty: 1, dueOn: 0 })).rejects.toThrow();
    await expect(t.mutation(api.production.cancelPlanned, { ...s, id })).rejects.toThrow();
  });
});

describe("voiding a batch", () => {
  test("puts the ingredients back, empties the batch and keeps the record", async () => {
    const { t, as } = await ready();
    const { flourLot, bread } = await bakery(t, as);
    // Uses all the flour (lot depleted), listing the lot twice.
    const id = await t.mutation(api.production.create, {
      ...as, productId: bread, qty: 10, inputs: [{ lotId: flourLot._id, qty: 4 }, { lotId: flourLot._id, qty: 6 }],
    });
    expect((await lot(t, flourLot._id)).status).toBe("depleted");
    await t.mutation(api.production.voidRun, { ...as, id, reason: " Wrong product " });
    const r = await run(t, id);
    expect(r).toMatchObject({ voided: true, voidReason: "Wrong product", voidedByName: "Manager 0" });
    expect(await lot(t, flourLot._id)).toMatchObject({ qtyOnHand: 10, status: "available" });
    expect(await lot(t, r.lotId!)).toMatchObject({ qtyOnHand: 0, status: "depleted" });
    expect((await auditLog(t)).at(-1)).toMatchObject({ action: "void", summary: "Batch P0001 voided: Wrong product" });
    expect(await t.query(api.analytics.insights, as)).toMatchObject({ batchesMade: 0 });
    expect(await t.query(api.production.batchCode, as)).toBe("P0002");
    await expect(t.mutation(api.production.voidRun, { ...as, id, reason: "again" })).rejects.toThrow("already voided");
  });

  test("not once the batch has been used, and only by managers with a reason", async () => {
    const { t, as } = await ready();
    const { flourLot, bread } = await bakery(t, as);
    const id = await t.mutation(api.production.create, { ...as, productId: bread, qty: 2, inputs: [{ lotId: flourLot._id, qty: 2 }] });
    const staff = await signIn(t, "staff");
    await expect(t.mutation(api.production.voidRun, { sessionToken: staff.token, businessId: as.businessId, id, reason: "x" })).rejects.toThrow();
    await expect(t.mutation(api.production.voidRun, { ...as, id, reason: " " })).rejects.toThrow("Say why");
    const batchLot = (await run(t, id)).lotId!;
    await t.mutation(api.stock.move, { ...as, lotId: batchLot, type: "dispatch", qty: 1, customer: "Cafe" });
    await expect(t.mutation(api.production.voidRun, { ...as, id, reason: "x" })).rejects.toThrow("waste or adjust it instead");
  });
});
