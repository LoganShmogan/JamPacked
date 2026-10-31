// Production: recipes, making batches from stock, and tracing them back to suppliers and on to customers.
// Also the "enter it once" pieces: one barcode per product, remembered units and customers.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { DAY, T, addBusiness, addSupplier, auditLog, getDoc, item, setup, signIn } from "./helpers";

type As = { sessionToken: string; businessId: Id<"businesses"> };

async function ready(role: "admin" | "manager" | "staff" = "manager") {
  const t = setup();
  const user = await signIn(t, role);
  const supplierId = await addSupplier(t);
  const as: As = { sessionToken: user.token, businessId: user.businessId };
  return { t, ...user, as, supplierId };
}

/** Receives flour and butter (two flour batches, the second expiring first) and returns their lots and products. */
async function stocked(t: T, as: As, supplierId: Id<"suppliers">) {
  await t.mutation(api.deliveries.create, {
    ...as, supplierId, vehicleClean: true,
    items: [
      item({ productName: "Flour", unit: "kg", quantity: 10, batchCode: "F1", storageType: "ambient", allergens: ["gluten"], useBy: undefined, bestBefore: Date.now() + 90 * DAY }),
      item({ productName: "Flour", unit: "kg", quantity: 3, batchCode: "F2", storageType: "ambient", allergens: ["gluten"], useBy: undefined, bestBefore: Date.now() + 30 * DAY }),
      item({ productName: "Butter", unit: "kg", quantity: 5, batchCode: "BU1", allergens: ["milk"] }),
    ],
  });
  const lots = await t.run((ctx) => ctx.db.query("stockLots").collect());
  const by = (batch: string) => lots.find((l) => l.batchCode === batch)!;
  return { f1: by("F1"), f2: by("F2"), butter: by("BU1"), flour: by("F1").productId!, butterId: by("BU1").productId! };
}

async function scones(t: T, as: As, flour: Id<"products">, butter: Id<"products">, shelfLifeDays?: number) {
  return await t.mutation(api.products.create, {
    ...as, name: "Scones", kind: "made", unit: "ea", storageType: "ambient", allergens: ["egg"],
    recipe: {
      yieldQty: 12, shelfLifeDays,
      ingredients: [
        { productId: flour, productName: "", qty: 2, unit: "kg" },
        { productId: butter, productName: "", qty: 0.5, unit: "KG" },
      ],
    },
  });
}

const lotOf = (t: T, id: Id<"stockLots">) => t.run((ctx) => ctx.db.get(id));

describe("recipes", () => {
  test("ingredient names come from the catalogue; recipes are checked", async () => {
    const { t, as, supplierId } = await ready();
    const { flour, butterId } = await stocked(t, as, supplierId);
    const id = await scones(t, as, flour, butterId);
    expect((await getDoc(t, id))?.recipe?.ingredients.map((i) => i.productName)).toEqual(["Flour", "Butter"]);

    const bad = (recipe: object) => t.mutation(api.products.update, { ...as, id, recipe: { yieldQty: 12, ingredients: [], ...recipe } });
    const flourIn = (o: object = {}) => ({ productId: flour, productName: "", qty: 1, unit: "kg", ...o });
    await expect(bad({ yieldQty: 0 })).rejects.toThrow("Say how much one batch makes");
    await expect(bad({ shelfLifeDays: -1 })).rejects.toThrow("Shelf life can't be negative");
    await expect(bad({})).rejects.toThrow("Add at least one ingredient");
    await expect(bad({ ingredients: [flourIn({ productId: id })] })).rejects.toThrow("can't be an ingredient of itself");
    await expect(bad({ ingredients: [flourIn({ qty: 0 })] })).rejects.toThrow("How much Flour does it take?");
    await expect(bad({ ingredients: [flourIn({ unit: " " })] })).rejects.toThrow("What unit is Flour measured in?");
    const theirs = await t.run((ctx) =>
      ctx.db.insert("products", { businessId: undefined, name: "X", storageType: "ambient", allergens: [], active: true, createdAt: 0 }),
    );
    await expect(bad({ ingredients: [flourIn({ productId: theirs })] })).rejects.toThrow("Ingredient not found");

    await t.mutation(api.products.update, { ...as, id, recipe: { yieldQty: 6, shelfLifeDays: 0, ingredients: [flourIn({ unit: " kg " })] } });
    expect((await getDoc(t, id))?.recipe).toEqual({ yieldQty: 6, shelfLifeDays: 0, ingredients: [{ productId: flour, productName: "Flour", qty: 1, unit: "kg" }] });
  });

  test("goods inwards remembers each product's unit, and keeps the first one", async () => {
    const { t, as, supplierId } = await ready();
    const { flour } = await stocked(t, as, supplierId);
    expect((await getDoc(t, flour))?.unit).toBe("kg");
    await t.mutation(api.deliveries.create, {
      ...as, supplierId, vehicleClean: true, items: [item({ productId: flour, productName: "Flour", unit: "bag" })],
    });
    expect((await getDoc(t, flour))?.unit).toBe("kg");
    // A product added by hand without a unit picks it up from its first delivery.
    const salt = await t.mutation(api.products.create, { ...as, name: "Salt", storageType: "ambient", allergens: [] });
    await t.mutation(api.deliveries.create, { ...as, supplierId, vehicleClean: true, items: [item({ productId: salt, productName: "Salt", unit: "g" })] });
    expect((await getDoc(t, salt))?.unit).toBe("g");
  });

  test("goods inwards can't use another business's product", async () => {
    const { t, as, supplierId, userId } = await ready();
    const other = await addBusiness(t, userId);
    const theirs = await t.run((ctx) =>
      ctx.db.insert("products", { businessId: other, name: "X", storageType: "ambient", allergens: [], active: true, createdAt: 0 }),
    );
    await expect(
      t.mutation(api.deliveries.create, { ...as, supplierId, vehicleClean: true, items: [item({ productId: theirs })] }),
    ).rejects.toThrow("Product not found");
  });

  test("a barcode belongs to one product, so scanning it always finds the same thing", async () => {
    const { t, as } = await ready();
    const base = { storageType: "ambient" as const, allergens: [] };
    const a = await t.mutation(api.products.create, { ...as, ...base, name: "A", barcode: "111" });
    await expect(t.mutation(api.products.create, { ...as, ...base, name: "B", barcode: "111" })).rejects.toThrow("Barcode 111 is already A");
    const b = await t.mutation(api.products.create, { ...as, ...base, name: "B" });
    await expect(t.mutation(api.products.update, { ...as, id: b, barcode: "111" })).rejects.toThrow("Barcode 111 is already A");
    await t.mutation(api.products.update, { ...as, id: a, barcode: "111", name: "A2" }); // its own barcode is fine
    await t.mutation(api.products.update, { ...as, id: b, barcode: "222" });
    expect((await getDoc(t, b))?.barcode).toBe("222");
  });
});

describe("plan", () => {
  test("scales the recipe and takes each ingredient first expiring first, skipping stock that can't be used", async () => {
    const { t, as, supplierId } = await ready();
    const { f1, f2, butter, flour, butterId } = await stocked(t, as, supplierId);
    const id = await scones(t, as, flour, butterId, 2);
    // Some flour that's on hold, some that's out of date and some in another unit are all left alone.
    await t.mutation(api.stock.addLot, { ...as, productId: flour, productName: "Flour", unit: "kg", qty: 50, storageType: "ambient", reason: "Opening", batchCode: "HELD" });
    const held = (await t.run((ctx) => ctx.db.query("stockLots").collect())).find((l) => l.batchCode === "HELD")!;
    await t.mutation(api.stock.hold, { ...as, lotId: held._id, reason: "Weevils" });
    await t.mutation(api.stock.addLot, { ...as, productId: flour, productName: "Flour", unit: "kg", qty: 50, storageType: "ambient", reason: "Opening", useBy: Date.now() - DAY });
    await t.mutation(api.stock.addLot, { ...as, productId: flour, productName: "Flour", unit: "bag", qty: 50, storageType: "ambient", reason: "Opening" });

    const p = await t.query(api.production.plan, { ...as, productId: id, qty: 36 });
    expect(p.product).toEqual({ _id: id, name: "Scones", unit: "ea", storageType: "ambient" });
    expect(p.useBy).toBeGreaterThan(Date.now() + DAY);
    expect(p.ingredients[0]).toMatchObject({
      productName: "Flour", unit: "kg", need: 6, short: 0,
      picks: [
        { lotId: f2._id, batchCode: "F2", supplierName: "Fresh Foods Ltd", qty: 3, qtyOnHand: 3 },
        { lotId: f1._id, batchCode: "F1", qty: 3 },
      ],
    });
    expect(p.ingredients[1]).toMatchObject({ productName: "Butter", need: 1.5, short: 0, picks: [{ lotId: butter._id, qty: 1.5 }] });

    const big = await t.query(api.production.plan, { ...as, productId: id, qty: 240 });
    expect(big.ingredients[0]).toMatchObject({ need: 40, short: 27 });
  });

  test("the same lot isn't promised twice when a recipe lists an ingredient twice", async () => {
    const { t, as, supplierId } = await ready();
    const { flour, butterId } = await stocked(t, as, supplierId);
    const id = await t.mutation(api.products.create, {
      ...as, name: "Roux", storageType: "chilled", allergens: [],
      recipe: { yieldQty: 1, ingredients: [
        { productId: flour, productName: "", qty: 3, unit: "kg" },
        { productId: flour, productName: "", qty: 11, unit: "kg" },
        { productId: butterId, productName: "", qty: 1, unit: "kg" },
      ] },
    });
    const p = await t.query(api.production.plan, { ...as, productId: id, qty: 1 });
    expect(p.useBy).toBeUndefined();
    expect(p.ingredients[0].picks.map((x) => x.qty)).toEqual([3]);
    expect(p.ingredients[1]).toMatchObject({ picks: [{ batchCode: "F1", qty: 10 }], short: 1 });
  });

  test("needs a recipe and a quantity", async () => {
    const { t, as } = await ready();
    const id = await t.mutation(api.products.create, { ...as, name: "Water", storageType: "ambient", allergens: [] });
    await expect(t.query(api.production.plan, { ...as, productId: id, qty: 1 })).rejects.toThrow("Water has no recipe");
    await t.run((ctx) => ctx.db.patch(id, { recipe: { yieldQty: 1, ingredients: [] } }));
    await expect(t.query(api.production.plan, { ...as, productId: id, qty: 0 })).rejects.toThrow("Quantity must be more than 0");
  });
});

describe("making a batch", () => {
  test("uses the inputs, puts the batch in stock and carries allergens through", async () => {
    const { t, as, supplierId } = await ready("staff");
    const { f2, butter, flour, butterId } = await stocked(t, as, supplierId);
    const mgr = await signIn(t, "manager");
    const id = await scones(t, { sessionToken: mgr.token, businessId: as.businessId }, flour, butterId, 2);
    const shelf = await t.mutation(api.locations.create, { sessionToken: mgr.token, businessId: as.businessId, name: "Shelf", kind: "dry" });
    expect(await t.query(api.production.batchCode, as)).toBe("P0001");

    const runId = await t.mutation(api.production.create, {
      ...as, productId: id, qty: 12, fromRecipe: true, locationId: shelf, notes: "  ",
      inputs: [{ lotId: f2._id, qty: 2 }, { lotId: butter._id, qty: 0.5 }],
    });
    const run = (await t.run((ctx) => ctx.db.get(runId)))!;
    expect(run).toMatchObject({
      productName: "Scones", batchCode: "P0001", qty: 12, unit: "ea", fromRecipe: true, allergens: ["egg", "gluten", "milk"],
      inputs: [
        { lotId: f2._id, productName: "Flour", batchCode: "F2", supplierName: "Fresh Foods Ltd", qty: 2, unit: "kg" },
        { lotId: butter._id, productName: "Butter", batchCode: "BU1", qty: 0.5, unit: "kg" },
      ],
      madeByName: "Staff 0",
    });
    expect(run.notes).toBeUndefined();
    expect(run.useBy).toBeGreaterThan(Date.now() + DAY);
    expect(await lotOf(t, f2._id)).toMatchObject({ qtyOnHand: 1 });
    const used = await t.run((ctx) => ctx.db.query("stockMovements").withIndex("by_lot", (q) => q.eq("lotId", f2._id)).collect());
    expect(used.at(-1)).toMatchObject({ type: "use", qty: -2, productionRunId: runId, reason: "Made Scones batch P0001" });
    expect(await lotOf(t, run.lotId!)).toMatchObject({
      productId: id, productName: "Scones", productionRunId: runId, batchCode: "P0001", qtyOnHand: 12, unit: "ea",
      storageType: "ambient", locationId: shelf, useBy: run.useBy,
    });
    expect((await getDoc(t, id))?.allergens).toEqual(["egg", "gluten", "milk"]);
    expect((await auditLog(t)).at(-1)).toMatchObject({
      action: "produce", entityType: "productionRun",
      summary: "Made 12 ea Scones, batch P0001, from 2 kg Flour (F2), 0.5 kg Butter (BU1)",
    });
    expect(await t.query(api.production.batchCode, as)).toBe("P0002");
    expect((await t.query(api.production.list, as)).map((r) => r._id)).toEqual([runId]);
  });

  test("a one-off batch of something new adds it to the catalogue as a made product", async () => {
    const { t, as, supplierId } = await ready();
    const { f1 } = await stocked(t, as, supplierId);
    await t.mutation(api.stock.addLot, { ...as, productName: "Mystery", unit: "kg", qty: 1, storageType: "ambient", reason: "Opening" });
    const mystery = (await t.run((ctx) => ctx.db.query("stockLots").collect())).find((l) => l.productName === "Mystery")!;
    const runId = await t.mutation(api.production.create, {
      ...as, productName: " Pizza dough ", qty: 4, unit: "kg", storageType: "frozen", batchCode: " PD-1 ", useBy: 123, bestBefore: 456, notes: "Trial",
      inputs: [{ lotId: f1._id, qty: 1 }, { lotId: f1._id, qty: 2 }, { lotId: mystery._id, qty: 1 }],
    });
    const run = (await t.run((ctx) => ctx.db.get(runId)))!;
    expect(run).toMatchObject({ batchCode: "PD-1", fromRecipe: false, allergens: ["gluten"], useBy: 123, bestBefore: 456, notes: "Trial" });
    expect(await lotOf(t, f1._id)).toMatchObject({ qtyOnHand: 7 }); // both lines came out of the same lot
    expect(await lotOf(t, mystery._id)).toMatchObject({ qtyOnHand: 0, status: "depleted" });
    expect(await getDoc(t, run.productId)).toMatchObject({ name: "Pizza dough", kind: "made", unit: "kg", storageType: "frozen", allergens: ["gluten"] });
    expect(await lotOf(t, run.lotId!)).toMatchObject({ storageType: "frozen", useBy: 123, bestBefore: 456 });
    // Naming it again makes more of the same product; a new name with no storage defaults to chilled.
    const again = await t.mutation(api.production.create, { ...as, productName: "Pizza dough", qty: 1, inputs: [{ lotId: f1._id, qty: 1 }] });
    expect((await t.run((ctx) => ctx.db.get(again)))!).toMatchObject({ productId: run.productId, batchCode: "P0001", unit: "kg" });
    const third = await t.mutation(api.production.create, { ...as, productName: "Gravy", qty: 1, unit: "L", inputs: [{ lotId: f1._id, qty: 1 }] });
    expect(await getDoc(t, (await t.run((ctx) => ctx.db.get(third)))!.productId)).toMatchObject({ storageType: "chilled" });
  });

  test("batch codes keep counting, and skip any that were typed in by hand", async () => {
    const { t, as, supplierId } = await ready();
    const { f1 } = await stocked(t, as, supplierId);
    const make = (batchCode?: string) =>
      t.mutation(api.production.create, { ...as, productName: "Dough", qty: 1, unit: "kg", batchCode, inputs: [{ lotId: f1._id, qty: 0.1 }] });
    await make("P0002");
    await make(); // the last code was P0002, so this is P0003
    await make("P0004-X");
    await make("P0005");
    await t.run(async (ctx) => {
      const last = (await ctx.db.query("productionRuns").collect()).find((r) => r.batchCode === "P0005")!;
      await ctx.db.patch(last._id, { madeAt: 0 }); // the most recent run is now P0004-X, which doesn't count
    });
    expect(await t.query(api.production.batchCode, as)).toBe("P0001");
    await make("P0001");
    expect(await t.query(api.production.batchCode, as)).toBe("P0004"); // P0002 and P0003 are taken
    await expect(make("P0001")).rejects.toThrow("Batch P0001 has already been used");
  });

  test("checks what was made and what went in", async () => {
    const { t, as, supplierId, userId } = await ready();
    const { f1, butter } = await stocked(t, as, supplierId);
    const make = (o: object) => t.mutation(api.production.create, { ...as, productName: "X", qty: 1, unit: "ea", inputs: [{ lotId: f1._id, qty: 1 }], ...o });
    await expect(make({ qty: 0 })).rejects.toThrow("Say how much you made");
    await expect(make({ inputs: [] })).rejects.toThrow("Add what went into it");
    await expect(make({ productName: " " })).rejects.toThrow("What did you make?");
    await expect(make({ unit: undefined })).rejects.toThrow("What unit is X counted in?");
    await expect(make({ inputs: [{ lotId: f1._id, qty: 0 }] })).rejects.toThrow("How much Flour went in?");
    await expect(make({ inputs: [{ lotId: f1._id, qty: 100 }] })).rejects.toThrow("Only 10 kg of Flour on hand");
    await t.mutation(api.stock.hold, { ...as, lotId: butter._id, reason: "Smells off" });
    await expect(make({ inputs: [{ lotId: butter._id, qty: 1 }] })).rejects.toThrow("Butter is on hold: Smells off");
    await t.mutation(api.stock.addLot, { ...as, productName: "Old", unit: "kg", qty: 1, storageType: "ambient", reason: "Opening", useBy: Date.now() - DAY, batchCode: "O1" });
    await t.mutation(api.stock.addLot, { ...as, productName: "Older", unit: "kg", qty: 1, storageType: "ambient", reason: "Opening", useBy: Date.now() - DAY });
    const lots = await t.run((ctx) => ctx.db.query("stockLots").collect());
    await expect(make({ inputs: [{ lotId: lots.find((l) => l.productName === "Old")!._id, qty: 1 }] })).rejects.toThrow("Old batch O1 can't be used");
    await expect(make({ inputs: [{ lotId: lots.find((l) => l.productName === "Older")!._id, qty: 1 }] })).rejects.toThrow("Older can't be used");
    const other = await addBusiness(t, userId);
    const elsewhere = await t.run((ctx) => ctx.db.insert("locations", { businessId: other, name: "X", kind: "dry", active: true, createdAt: 0 }));
    await expect(make({ locationId: elsewhere })).rejects.toThrow("Location not found");
    const theirProduct = await t.run((ctx) =>
      ctx.db.insert("products", { businessId: other, name: "X", storageType: "ambient", allergens: [], active: true, createdAt: 0 }),
    );
    await expect(make({ productId: theirProduct })).rejects.toThrow("Product not found");
    expect(await t.run((ctx) => ctx.db.query("productionRuns").collect())).toEqual([]);
  });
});

describe("trace", () => {
  test("a supplier batch shows what was made from it, and the made batch shows where it went", async () => {
    const { t, as, supplierId } = await ready();
    const { f2, flour, butterId, butter } = await stocked(t, as, supplierId);
    const id = await scones(t, as, flour, butterId);
    const runId = await t.mutation(api.production.create, {
      ...as, productId: id, qty: 12, inputs: [{ lotId: f2._id, qty: 2 }, { lotId: butter._id, qty: 0.5 }],
    });
    const run = (await t.run((ctx) => ctx.db.get(runId)))!;
    await t.mutation(api.stock.move, { ...as, lotId: run.lotId!, type: "dispatch", qty: 5, customer: "Corner Store" });

    const back = await t.query(api.deliveries.trace, { ...as, search: "F2" });
    expect(back[0].lot?.usedIn).toEqual([{ productionRunId: runId, reason: "Made Scones batch P0001", qty: 2, at: expect.any(Number) }]);

    const lot = { _id: run.lotId, status: "available", qtyOnHand: 7, dispatched: [{ customer: "Corner Store", qty: 5, at: expect.any(Number) }] };
    for (const search of ["p0001", "scones", "F2", "butter"]) {
      expect((await t.query(api.production.trace, { ...as, search })).map((r) => r.lot)).toEqual([lot]);
    }
    expect(await t.query(api.production.trace, { ...as, search: "nothing" })).toEqual([]);
    expect(await t.query(api.production.trace, { ...as, search: "  " })).toEqual([]);
    expect(await t.query(api.production.get, { ...as, id: runId })).toEqual({ run, lot });
  });

  test("a run from another business isn't found", async () => {
    const { t, as, userId, supplierId } = await ready();
    const { f1 } = await stocked(t, as, supplierId);
    const runId = await t.mutation(api.production.create, { ...as, productName: "Dough", qty: 1, unit: "kg", inputs: [{ lotId: f1._id, qty: 1 }] });
    const other = await signIn(t, "admin", {}, await addBusiness(t, userId));
    expect(await t.query(api.production.get, { sessionToken: other.token, businessId: other.businessId, id: runId })).toBeNull();
    await t.run((ctx) => ctx.db.delete(runId));
    expect(await t.query(api.production.get, { ...as, id: runId })).toBeNull();
  });
});

describe("customers", () => {
  test("everyone stock went to, most recent first, each once", async () => {
    const { t, as, supplierId } = await ready();
    const { f1 } = await stocked(t, as, supplierId);
    for (const customer of ["Cafe One", "Cafe Two", "Cafe One"]) {
      await t.mutation(api.stock.move, { ...as, lotId: f1._id, type: "dispatch", qty: 1, customer });
    }
    await t.mutation(api.stock.move, { ...as, lotId: f1._id, type: "use", qty: 1 });
    expect(await t.query(api.stock.customers, as)).toEqual(["Cafe One", "Cafe Two"]);
  });
});
