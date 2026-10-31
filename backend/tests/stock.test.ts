// Stock management: lots from goods inwards, movements, holds & recalls, locations, par levels and stocktakes.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { expiryOf, fifo } from "../convex/lib/stock";
import { isLargeVariance } from "../convex/stocktakes";
import { DAY, T, addBusiness, addSupplier, auditLog, cas, item, setup, signIn } from "./helpers";

async function ready(role: "admin" | "manager" | "staff" = "manager") {
  const t = setup();
  const user = await signIn(t, role);
  const supplierId = await addSupplier(t);
  const as = { sessionToken: user.token, businessId: user.businessId };
  return { t, ...user, as, supplierId };
}

/** Receives one delivery and returns the lots it created, in item order. */
async function receive(t: T, as: { sessionToken: string; businessId: Id<"businesses"> }, supplierId: Id<"suppliers">, items = [item()]) {
  const deliveryId = await t.mutation(api.deliveries.create, { ...as, supplierId, vehicleClean: true, items });
  const lots = await t.run((ctx) => ctx.db.query("stockLots").collect());
  return { deliveryId, lots: lots.filter((l) => l.deliveryId === deliveryId) };
}

const lotOf = (t: T, id: Id<"stockLots">) => t.run((ctx) => ctx.db.get(id));
const movementsOf = (t: T, id: Id<"stockLots">) =>
  t.run((ctx) => ctx.db.query("stockMovements").withIndex("by_lot", (q) => q.eq("lotId", id)).collect());

describe("goods inwards → stock", () => {
  test("accepted lines become lots with a receive movement; rejected lines don't", async () => {
    const { t, as, supplierId } = await ready();
    const chiller = await t.mutation(api.locations.create, { ...as, name: "Chiller 1", kind: "chiller" });
    const { deliveryId, lots } = await receive(t, as, supplierId, [
      item({ locationId: chiller }),
      item({ productName: "Bad", accepted: false, rejectionReason: "Warm" }),
    ]);
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({
      productName: "Milk 2L", batchCode: "B1", supplierName: "Fresh Foods Ltd", deliveryId, locationId: chiller,
      qtyReceived: 6, qtyOnHand: 6, status: "available", unit: "ea", storageType: "chilled",
    });
    expect(lots[0].productId).toBeDefined();
    expect(await movementsOf(t, lots[0]._id)).toMatchObject([{ type: "receive", qty: 6, qtyAfter: 6, byName: "Manager 0" }]);
    // The location isn't stored on the delivery line itself.
    const [line] = await t.run((ctx) => ctx.db.query("deliveryItems").collect());
    expect(line).not.toHaveProperty("locationId");
  });

  test("a put-away location must belong to the business", async () => {
    const { t, userId, as, supplierId } = await ready();
    const other = await addBusiness(t, userId);
    const elsewhere = await t.run((ctx) =>
      ctx.db.insert("locations", { businessId: other, name: "X", kind: "dry", active: true, createdAt: 0 }),
    );
    await expect(receive(t, as, supplierId, [item({ locationId: elsewhere })])).rejects.toThrow("Location not found");
  });

  test("voiding a delivery takes its remaining stock out", async () => {
    const { t, as, supplierId } = await ready();
    const { deliveryId, lots } = await receive(t, as, supplierId, [item(), item({ productName: "Cream" })]);
    await t.mutation(api.stock.move, { ...as, lotId: lots[1]._id, type: "use", qty: 6 });
    await t.mutation(api.deliveries.voidDelivery, { ...as, id: deliveryId, reason: "Wrong supplier" });
    expect(await lotOf(t, lots[0]._id)).toMatchObject({ qtyOnHand: 0, status: "depleted" });
    expect((await movementsOf(t, lots[0]._id)).at(-1)).toMatchObject({ type: "void", qty: -6, reason: "Delivery voided: Wrong supplier" });
    expect(await movementsOf(t, lots[1]._id)).toHaveLength(2); // already used up: no void movement
  });

  test("trace shows what is left and who stock was dispatched to", async () => {
    const { t, as, supplierId } = await ready();
    const { lots } = await receive(t, as, supplierId, [item({ batchCode: "LOT-9" })]);
    await t.mutation(api.stock.move, { ...as, lotId: lots[0]._id, type: "dispatch", qty: 2, customer: "Cafe Two" });
    await receive(t, as, supplierId, [item({ batchCode: "LOT-9", accepted: false, rejectionReason: "Torn" })]);
    const res = await t.query(api.deliveries.trace, { ...as, search: "LOT-9" });
    const accepted = res.find((r) => r.accepted)!;
    expect(accepted.lot).toEqual({
      _id: lots[0]._id, status: "available", qtyOnHand: 4, dispatched: [{ customer: "Cafe Two", qty: 2, at: expect.any(Number) }], usedIn: [],
    });
    expect(res.find((r) => !r.accepted)!.lot).toBeNull();
  });
});

describe("stock:onHand / lot", () => {
  test("lists available and held lots FIFO, with location and expiry flags", async () => {
    const { t, as, supplierId } = await ready();
    const now = Date.now();
    const dry = await t.mutation(api.locations.create, { ...as, name: "Dry store", kind: "dry" });
    const { lots } = await receive(t, as, supplierId, [
      item({ productName: "Later", useBy: now + 10 * DAY }),
      item({ productName: "Past", useBy: now - DAY, locationId: dry }),
      item({ productName: "Undated", useBy: undefined }),
      item({ productName: "Soon BB", useBy: undefined, bestBefore: now + DAY }),
      item({ productName: "Gone" }),
    ]);
    await t.mutation(api.stock.hold, { ...as, lotId: lots[0]._id, reason: "Check" });
    await t.mutation(api.stock.move, { ...as, lotId: lots[4]._id, type: "use", qty: 6 });
    const all = await t.query(api.stock.onHand, as);
    expect(all.map((l) => l.productName)).toEqual(["Past", "Soon BB", "Later", "Undated"]);
    expect(all[0]).toMatchObject({ locationName: "Dry store", expired: true, expiringSoon: true });
    expect(all[1]).toMatchObject({ expired: false, expiringSoon: true, expiresAt: now + DAY });
    expect(all[2]).toMatchObject({ status: "hold", expiringSoon: false });
    expect(all[3]).toMatchObject({ expiringSoon: false });
    expect(all[3]).not.toHaveProperty("locationName");
    expect((await t.query(api.stock.onHand, { ...as, locationId: dry })).map((l) => l.productName)).toEqual(["Past"]);
  });

  test("lot returns history newest first, or null outside the business", async () => {
    const { t, userId, as, supplierId } = await ready();
    const chiller = await t.mutation(api.locations.create, { ...as, name: "C", kind: "chiller" });
    const { lots } = await receive(t, as, supplierId);
    const id = lots[0]._id;
    expect((await t.query(api.stock.lot, { ...as, id }))).toMatchObject({ lot: { _id: id }, movements: [{ type: "receive" }] });
    await t.mutation(api.stock.transfer, { ...as, lotId: id, locationId: chiller });
    const res = (await t.query(api.stock.lot, { ...as, id }))!;
    expect(res.locationName).toBe("C");
    expect(res.movements.map((m) => m.type)).toEqual(["transfer", "receive"]);
    const other = await addBusiness(t, userId);
    const outsider = await signIn(t, "admin", {}, other);
    expect(await t.query(api.stock.lot, { sessionToken: outsider.token, businessId: other, id })).toBeNull();
  });
});

describe("stock:move", () => {
  test("use, sell, dispatch and waste take stock out; using it all depletes the lot", async () => {
    const { t, as, supplierId } = await ready("staff");
    const { lots } = await receive(t, as, supplierId);
    const lotId = lots[0]._id;
    await t.mutation(api.stock.move, { ...as, lotId, type: "use", qty: 1 });
    await t.mutation(api.stock.move, { ...as, lotId, type: "sell", qty: 1.5 });
    await t.mutation(api.stock.move, { ...as, lotId, type: "dispatch", qty: 1, customer: " Cafe Two " });
    await t.mutation(api.stock.move, { ...as, lotId, type: "waste", qty: 2.5, reason: "Dropped" });
    expect(await lotOf(t, lotId)).toMatchObject({ qtyOnHand: 0, status: "depleted" });
    expect((await movementsOf(t, lotId)).map((m) => [m.type, m.qty, m.qtyAfter, m.customer ?? m.reason ?? null])).toEqual([
      ["receive", 6, 6, null],
      ["use", -1, 5, null],
      ["sell", -1.5, 3.5, null],
      ["dispatch", -1, 2.5, "Cafe Two"],
      ["waste", -2.5, 0, "Dropped"],
    ]);
    expect((await auditLog(t)).slice(-2).map((l) => l.summary)).toEqual([
      "Dispatch 1 ea Milk 2L to Cafe Two. 2.5 left",
      "Waste 2.5 ea Milk 2L (Dropped). 0 left",
    ]);
  });

  test("adjust is signed, needs a reason, and can bring a depleted lot back", async () => {
    const { t, as, supplierId } = await ready();
    const { lots } = await receive(t, as, supplierId);
    const lotId = lots[0]._id;
    await t.mutation(api.stock.move, { ...as, lotId, type: "adjust", qty: -6, reason: "Miscounted" });
    expect((await lotOf(t, lotId))?.status).toBe("depleted");
    await t.mutation(api.stock.move, { ...as, lotId, type: "adjust", qty: 2, reason: "Found more" });
    expect(await lotOf(t, lotId)).toMatchObject({ qtyOnHand: 2, status: "available" });
    expect((await auditLog(t)).at(-1)?.summary).toBe("Adjust 2 ea Milk 2L (Found more). 2 left");
  });

  test("validation", async () => {
    const { t, as, supplierId } = await ready();
    const { lots } = await receive(t, as, supplierId);
    const lotId = lots[0]._id;
    const move = (args: Record<string, unknown>) => t.mutation(api.stock.move, { ...as, lotId, type: "use", qty: 1, ...args });
    await expect(move({ type: "adjust", qty: 0, reason: "x" })).rejects.toThrow("Enter how much to add or remove");
    await expect(move({ type: "adjust", qty: 1, reason: " " })).rejects.toThrow("Give a reason for the adjustment");
    await expect(move({ qty: 0 })).rejects.toThrow("Quantity must be more than 0");
    await expect(move({ qty: -1 })).rejects.toThrow("Quantity must be more than 0");
    await expect(move({ type: "waste" })).rejects.toThrow("Say why it was wasted");
    await expect(move({ type: "dispatch", customer: "  " })).rejects.toThrow("Who was it dispatched to?");
    await expect(move({ qty: 7 })).rejects.toThrow("Only 6 ea of Milk 2L on hand");
    await t.run((ctx) => ctx.db.delete(lotId));
    await expect(move({})).rejects.toThrow("Stock not found");
  });

  test("held or expired stock can only be wasted", async () => {
    const { t, as, supplierId } = await ready();
    const { lots } = await receive(t, as, supplierId, [item(), item({ productName: "Old", useBy: Date.now() - DAY })]);
    await t.mutation(api.stock.hold, { ...as, lotId: lots[0]._id, reason: "Smells off" });
    for (const type of ["use", "sell", "dispatch"] as const) {
      await expect(
        t.mutation(api.stock.move, { ...as, lotId: lots[0]._id, type, qty: 1, customer: "C" }),
      ).rejects.toThrow("Milk 2L is on hold: Smells off");
      await expect(
        t.mutation(api.stock.move, { ...as, lotId: lots[1]._id, type, qty: 1, customer: "C" }),
      ).rejects.toThrow("Old is past its use-by date. Waste it instead");
    }
    await t.mutation(api.stock.move, { ...as, lotId: lots[0]._id, type: "waste", qty: 6, reason: "Off" });
    await t.mutation(api.stock.move, { ...as, lotId: lots[1]._id, type: "waste", qty: 6, reason: "Expired" });
    expect((await lotOf(t, lots[0]._id))?.status).toBe("depleted");
  });
});

describe("stock:transfer / hold / release", () => {
  test("transfer moves the lot; the location must be in the business", async () => {
    const { t, userId, as, supplierId } = await ready("staff");
    const { lots } = await receive(t, as, supplierId);
    const mgr = await signIn(t, "manager");
    const freezer = await t.mutation(api.locations.create, { sessionToken: mgr.token, businessId: as.businessId, name: "Freezer", kind: "freezer" });
    await t.mutation(api.stock.transfer, { ...as, lotId: lots[0]._id, locationId: freezer });
    expect((await lotOf(t, lots[0]._id))?.locationId).toBe(freezer);
    expect((await movementsOf(t, lots[0]._id)).at(-1)).toMatchObject({ type: "transfer", qty: 0, toLocationId: freezer });
    expect((await auditLog(t)).at(-1)?.summary).toBe("Moved Milk 2L to Freezer");
    const elsewhere = await addBusiness(t, userId);
    const theirs = await t.run((ctx) => ctx.db.insert("locations", { businessId: elsewhere, name: "x", kind: "dry", active: true, createdAt: 0 }));
    await expect(t.mutation(api.stock.transfer, { ...as, lotId: lots[0]._id, locationId: theirs })).rejects.toThrow("Location not found");
  });

  test("anyone can hold; only managers release, with a reason", async () => {
    const { t, as, supplierId } = await ready("staff");
    const { lots } = await receive(t, as, supplierId);
    const lotId = lots[0]._id;
    await expect(t.mutation(api.stock.hold, { ...as, lotId, reason: " " })).rejects.toThrow("Say why it is on hold");
    await expect(t.mutation(api.stock.release, { ...as, lotId, reason: "ok" })).rejects.toThrow("requires");
    await t.mutation(api.stock.hold, { ...as, lotId, reason: "Swollen pack" });
    expect(await lotOf(t, lotId)).toMatchObject({ status: "hold", holdReason: "Swollen pack" });
    await expect(t.mutation(api.stock.hold, { ...as, lotId, reason: "again" })).rejects.toThrow("Milk 2L is not available to hold");

    const mgr = await signIn(t, "manager");
    const asMgr = { sessionToken: mgr.token, businessId: as.businessId };
    await expect(t.mutation(api.stock.release, { ...asMgr, lotId, reason: " " })).rejects.toThrow("Say why it is safe to release");
    await t.mutation(api.stock.release, { ...asMgr, lotId, reason: "Supplier confirmed OK" });
    const lot = (await lotOf(t, lotId))!;
    expect(lot.status).toBe("available");
    expect(lot).not.toHaveProperty("holdReason");
    await expect(t.mutation(api.stock.release, { ...asMgr, lotId, reason: "x" })).rejects.toThrow("Milk 2L is not on hold");
    expect((await auditLog(t)).at(-1)?.summary).toBe("Released Milk 2L from hold: Supplier confirmed OK");
  });
});

describe("stock:addLot", () => {
  test("managers add opening stock with a reason; product and location must be the business's", async () => {
    const { t, userId, as } = await ready();
    const productId = await t.mutation(api.products.create, { ...as, name: "Flour", storageType: "ambient", allergens: ["gluten"] });
    const base = { ...as, productName: "Flour", storageType: "ambient" as const, unit: "kg", qty: 20, reason: "Opening stock" };
    const id = await t.mutation(api.stock.addLot, { ...base, productId });
    expect(await lotOf(t, id)).toMatchObject({ productName: "Flour", qtyReceived: 20, qtyOnHand: 20, status: "available" });
    expect((await movementsOf(t, id))[0]).toMatchObject({ type: "receive", qty: 20, reason: "Opening stock" });
    expect((await auditLog(t)).at(-1)?.summary).toBe("Added 20 kg Flour to stock (Opening stock)");

    await expect(t.mutation(api.stock.addLot, { ...base, productName: " " })).rejects.toThrow("Product name is required");
    await expect(t.mutation(api.stock.addLot, { ...base, qty: 0 })).rejects.toThrow("Quantity must be more than 0");
    await expect(t.mutation(api.stock.addLot, { ...base, reason: "" })).rejects.toThrow("Say where this stock came from");
    const other = await addBusiness(t, userId);
    const [p2, l2] = await t.run(async (ctx) => [
      await ctx.db.insert("products", { businessId: other, name: "X", storageType: "ambient", allergens: [], active: true, createdAt: 0 }),
      await ctx.db.insert("locations", { businessId: other, name: "X", kind: "dry", active: true, createdAt: 0 }),
    ] as const);
    await expect(t.mutation(api.stock.addLot, { ...base, productId: p2 })).rejects.toThrow("Product not found");
    await expect(t.mutation(api.stock.addLot, { ...base, locationId: l2 })).rejects.toThrow("Location not found");
    const staff = await signIn(t, "staff");
    await expect(t.mutation(api.stock.addLot, { ...base, sessionToken: staff.token })).rejects.toThrow("requires");
  });
});

describe("stock:lowStock / expiring", () => {
  test("lowStock compares available stock with par levels", async () => {
    const { t, as, supplierId } = await ready();
    await receive(t, as, supplierId, [item(), item({ productName: "Eggs" })]);
    const [milk, eggs] = await t.query(api.products.list, as).then((ps) => ["Milk 2L", "Eggs"].map((n) => ps.find((p) => p.name === n)!._id));
    const flour = await t.mutation(api.products.create, { ...as, name: "Flour", storageType: "ambient", allergens: [], parLevel: 5 });
    const retired = await t.mutation(api.products.create, { ...as, name: "Retired", storageType: "ambient", allergens: [], parLevel: 5 });
    await t.mutation(api.products.update, { ...as, id: retired, active: false });
    await t.mutation(api.products.update, { ...as, id: milk, parLevel: 10, reorderQty: 12 });
    await t.mutation(api.products.update, { ...as, id: eggs, parLevel: 6 });
    // Held stock doesn't count towards par.
    const eggLot = (await t.run((ctx) => ctx.db.query("stockLots").collect())).find((l) => l.productName === "Eggs")!;
    await t.mutation(api.stock.hold, { ...as, lotId: eggLot._id, reason: "Cracked" });
    await t.mutation(api.stock.addLot, { ...as, productName: "Loose", storageType: "ambient", unit: "ea", qty: 1, reason: "Found" });
    expect(await t.query(api.stock.lowStock, as)).toEqual([
      { productId: eggs, name: "Eggs", parLevel: 6, onHand: 0 },
      { productId: flour, name: "Flour", parLevel: 5, onHand: 0 },
      { productId: milk, name: "Milk 2L", parLevel: 10, reorderQty: 12, onHand: 6 },
    ]);
  });

  test("expiring lists on-hand lots within the warning window", async () => {
    const { t, as, supplierId } = await ready();
    const now = Date.now();
    await receive(t, as, supplierId, [
      item({ productName: "Soon", useBy: now + DAY }),
      item({ productName: "Later", useBy: now + 10 * DAY }),
      item({ productName: "Undated", useBy: undefined }),
    ]);
    expect((await t.query(api.stock.expiring, as)).map((l) => [l.productName, l.expiresAt])).toEqual([["Soon", now + DAY]]);
  });
});

describe("stock:recall", () => {
  test("holds every available lot listed and raises one high corrective action", async () => {
    const { t, as, supplierId } = await ready();
    const { lots } = await receive(t, as, supplierId, [
      item({ batchCode: "L1" }),
      item({ productName: "Loose", batchCode: undefined }),
      item({ productName: "Used" }),
    ]);
    await t.mutation(api.stock.move, { ...as, lotId: lots[2]._id, type: "use", qty: 6 });
    const res = await t.mutation(api.stock.recall, { ...as, lotIds: lots.map((l) => l._id), reason: "Supplier recall R-1" });
    expect(res.held).toBe(2);
    for (const l of lots.slice(0, 2)) {
      expect(await lotOf(t, l._id)).toMatchObject({ status: "hold", holdReason: "Recall: Supplier recall R-1" });
    }
    const ca = (await cas(t)).find((c) => c._id === res.correctiveActionId)!;
    expect(ca).toMatchObject({ title: "Recall: Supplier recall R-1", source: "stock", severity: "high", status: "open" });
    expect(ca.description).toContain("Milk 2L batch L1 (6 ea); Loose (6 ea)");
    expect((await auditLog(t)).at(-1)?.summary).toBe("Recall: 2 lot(s) put on hold (Supplier recall R-1)");
  });

  test("needs a reason, stock that can be held, and a manager", async () => {
    const { t, as, supplierId } = await ready();
    const { lots } = await receive(t, as, supplierId);
    const lotIds = [lots[0]._id];
    await expect(t.mutation(api.stock.recall, { ...as, lotIds, reason: " " })).rejects.toThrow("Say why the stock is being recalled");
    await t.mutation(api.stock.hold, { ...as, lotId: lots[0]._id, reason: "x" });
    await expect(t.mutation(api.stock.recall, { ...as, lotIds, reason: "R" })).rejects.toThrow("None of that stock is available to hold");
    const staff = await signIn(t, "staff");
    await expect(t.mutation(api.stock.recall, { ...as, sessionToken: staff.token, lotIds, reason: "R" })).rejects.toThrow("requires");
  });
});

describe("locations", () => {
  test("managers create, rename and retire locations; lists are sorted and hide inactive", async () => {
    const { t, as } = await ready();
    const b = await t.mutation(api.locations.create, { ...as, name: " Walk-in ", kind: "chiller" });
    const a = await t.mutation(api.locations.create, { ...as, name: "Ambient", kind: "dry" });
    await t.mutation(api.locations.update, { ...as, id: a, active: false });
    expect((await t.query(api.locations.list, as)).map((l) => l.name)).toEqual(["Walk-in"]);
    expect((await t.query(api.locations.list, { ...as, includeInactive: true })).map((l) => l.name)).toEqual(["Ambient", "Walk-in"]);
    await t.mutation(api.locations.update, { ...as, id: b, name: "Chiller A", kind: "chiller" });
    await t.mutation(api.locations.update, { ...as, id: b, kind: "chiller" });
    expect((await auditLog(t)).map((l) => l.summary)).toEqual([
      "Added location Walk-in (chiller)",
      "Added location Ambient (dry)",
      "Updated location Ambient (active)",
      "Updated location Walk-in (name)",
      "Updated location Chiller A (no changes)",
    ]);
  });

  test("validation and permissions", async () => {
    const { t, as } = await ready();
    await expect(t.mutation(api.locations.create, { ...as, name: " ", kind: "dry" })).rejects.toThrow("Location name is required");
    const id = await t.mutation(api.locations.create, { ...as, name: "X", kind: "dry" });
    await expect(t.mutation(api.locations.update, { ...as, id, name: "" })).rejects.toThrow("Location name is required");
    const staff = await signIn(t, "staff");
    await expect(t.mutation(api.locations.create, { ...as, sessionToken: staff.token, name: "Y", kind: "dry" })).rejects.toThrow("requires");
  });
});

describe("stocktakes", () => {
  test("snapshot, count, then complete: lots corrected and large variances raised", async () => {
    const { t, as, supplierId } = await ready();
    const { lots } = await receive(t, as, supplierId, [
      item({ quantity: 10 }),
      item({ productName: "Cream", quantity: 10 }),
      item({ productName: "Eggs", quantity: 12 }),
    ]);
    const id = await t.mutation(api.stocktakes.start, as);
    const st = (await t.query(api.stocktakes.get, { ...as, id }))!;
    expect(st).toMatchObject({ title: "Stocktake", status: "in_progress", startedByName: "Manager 0" });
    expect(st.lines.map((l) => [l.productName, l.expected, l.counted])).toEqual([
      ["Milk 2L", 10, null], ["Cream", 10, null], ["Eggs", 12, null],
    ]);
    await expect(t.mutation(api.stocktakes.complete, { ...as, id })).rejects.toThrow("Count every line first (3 remaining)");

    await t.mutation(api.stocktakes.count, { ...as, id, lotId: lots[0]._id, counted: 10 }); // spot on
    await t.mutation(api.stocktakes.count, { ...as, id, lotId: lots[1]._id, counted: 9.5 }); // small
    await t.mutation(api.stocktakes.count, { ...as, id, lotId: lots[2]._id, counted: 6 }); // large
    // Someone uses milk while the count is going on: the correction is against what is on hand now.
    await t.mutation(api.stock.move, { ...as, lotId: lots[0]._id, type: "use", qty: 1 });
    expect((await t.query(api.stocktakes.list, as))[0]).toMatchObject({ counted: 3, total: 3, variances: 2 });

    await t.mutation(api.stocktakes.complete, { ...as, id });
    expect((await lotOf(t, lots[0]._id))?.qtyOnHand).toBe(10);
    expect((await lotOf(t, lots[1]._id))?.qtyOnHand).toBe(9.5);
    expect((await lotOf(t, lots[2]._id))?.qtyOnHand).toBe(6);
    expect((await movementsOf(t, lots[2]._id)).at(-1)).toMatchObject({ type: "stocktake", qty: -6, reason: "Stocktake" });
    const ca = (await cas(t)).find((c) => c.source === "stock")!;
    expect(ca).toMatchObject({ title: "Stocktake variance: 1 line(s)", description: "Eggs: expected 12, counted 6 ea", sourceId: id, severity: "low" });
    expect((await auditLog(t)).at(-1)?.summary).toBe("Completed Stocktake: 3 lot(s) adjusted, 1 large variance(s)");
    expect((await t.query(api.stocktakes.get, { ...as, id }))?.status).toBe("completed");

    await expect(t.mutation(api.stocktakes.count, { ...as, id, lotId: lots[0]._id, counted: 1 })).rejects.toThrow(
      "Completed stocktakes are locked",
    );
    await t.mutation(api.stocktakes.complete, { ...as, id }); // no-op
  });

  test("a location stocktake only counts that location; no variances means no corrective action", async () => {
    const { t, as, supplierId } = await ready();
    const freezer = await t.mutation(api.locations.create, { ...as, name: "Freezer", kind: "freezer" });
    const { lots } = await receive(t, as, supplierId, [item({ locationId: freezer }), item({ productName: "Elsewhere" })]);
    const id = await t.mutation(api.stocktakes.start, { ...as, locationId: freezer });
    const st = (await t.query(api.stocktakes.get, { ...as, id }))!;
    expect(st.title).toBe("Stocktake: Freezer");
    expect(st.lines.map((l) => l.productName)).toEqual(["Milk 2L"]);
    await expect(t.mutation(api.stocktakes.count, { ...as, id, lotId: lots[1]._id, counted: 1 })).rejects.toThrow(
      "That stock is not in this stocktake",
    );
    await expect(t.mutation(api.stocktakes.count, { ...as, id, lotId: lots[0]._id, counted: -1 })).rejects.toThrow(
      "Counts can't be negative",
    );
    await t.mutation(api.stocktakes.count, { ...as, id, lotId: lots[0]._id, counted: 6 });
    await t.mutation(api.stocktakes.complete, { ...as, id });
    expect(await cas(t)).toHaveLength(0);
    expect((await auditLog(t)).at(-1)?.summary).toBe("Completed Stocktake: Freezer: 0 lot(s) adjusted, 0 large variance(s)");
  });

  test("needs stock to count, a manager to start, and stays within the business", async () => {
    const { t, userId, as, supplierId } = await ready();
    await expect(t.mutation(api.stocktakes.start, as)).rejects.toThrow("There is no stock on hand to count");
    await receive(t, as, supplierId);
    const staff = await signIn(t, "staff");
    await expect(t.mutation(api.stocktakes.start, { ...as, sessionToken: staff.token })).rejects.toThrow("requires");
    const id = await t.mutation(api.stocktakes.start, as);
    const other = await addBusiness(t, userId);
    const outsider = await signIn(t, "admin", {}, other);
    expect(await t.query(api.stocktakes.get, { sessionToken: outsider.token, businessId: other, id })).toBeNull();
    const theirs = await t.run((ctx) => ctx.db.insert("locations", { businessId: other, name: "x", kind: "dry", active: true, createdAt: 0 }));
    await expect(t.mutation(api.stocktakes.start, { ...as, locationId: theirs })).rejects.toThrow("Location not found");
  });

  test("isLargeVariance: off by at least 1 and at least 10%", () => {
    expect(isLargeVariance(10, 9)).toBe(true);
    expect(isLargeVariance(10, 9.5)).toBe(false);
    expect(isLargeVariance(100, 95)).toBe(false);
    expect(isLargeVariance(0, 1)).toBe(true);
    expect(isLargeVariance(0, 0.5)).toBe(false);
  });
});

describe("lib/stock", () => {
  test("expiryOf prefers use-by; fifo sorts by expiry then receipt", () => {
    expect(expiryOf({ useBy: 1, bestBefore: 2 })).toBe(1);
    expect(expiryOf({ bestBefore: 2 })).toBe(2);
    expect(expiryOf({})).toBeUndefined();
    const lot = (o: object) => ({ receivedAt: 0, ...o }) as never;
    const sorted = [lot({ id: "c", receivedAt: 5 }), lot({ id: "d", receivedAt: 1 }), lot({ id: "b", bestBefore: 9 }), lot({ id: "a", useBy: 3 })]
      .sort(fifo)
      .map((l: { id: string }) => l.id);
    expect(sorted).toEqual(["a", "b", "d", "c"]);
  });
});
