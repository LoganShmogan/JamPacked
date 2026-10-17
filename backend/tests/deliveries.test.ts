import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { DAY, addSupplier, auditLog, cas, getDoc, item, setup, signIn } from "./helpers";

async function ready(role: "admin" | "manager" | "staff" = "staff") {
  const t = setup();
  const user = await signIn(t, role);
  const supplierId = await addSupplier(t);
  return { t, ...user, supplierId };
}

describe("deliveries:create", () => {
  test("requires items and an existing supplier", async () => {
    const { t, token, supplierId } = await ready();
    await expect(
      t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [] }),
    ).rejects.toThrow("Add at least one item");
    await t.run((ctx) => ctx.db.delete(supplierId));
    await expect(
      t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [item()] }),
    ).rejects.toThrow("Supplier not found");
  });

  test("rejected items need a reason", async () => {
    const { t, token, supplierId } = await ready();
    await expect(
      t.mutation(api.deliveries.create, {
        sessionToken: token, supplierId, vehicleClean: true, items: [item({ accepted: false, rejectionReason: "  " })],
      }),
    ).rejects.toThrow("Give a reason for rejecting Milk 2L");
  });

  test("a clean delivery is accepted, catalogues the product and raises nothing", async () => {
    const { t, token, supplierId } = await ready();
    const id = await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true, invoiceNumber: "INV1", receivedAt: 1000, items: [item()],
    });
    const d = await getDoc(t, id);
    expect(d).toMatchObject({ status: "accepted", supplierName: "Fresh Foods Ltd", supplierApproved: true, receivedAt: 1000, voided: false });
    const items = await t.run((ctx) => ctx.db.query("deliveryItems").collect());
    expect(items[0]).toMatchObject({ temperatureCompliant: true, receivedAt: 1000, deliveryId: id });
    const products = await t.run((ctx) => ctx.db.query("products").collect());
    expect(products).toHaveLength(1);
    expect(items[0].productId).toBe(products[0]._id);
    expect(await cas(t)).toHaveLength(0);
    expect((await auditLog(t))[0].summary).toBe("Goods received from Fresh Foods Ltd: 1 item(s), accepted");
  });

  test("reuses catalogue products by barcode, by name, or by explicit productId", async () => {
    const { t, token, supplierId } = await ready();
    const send = (items: ReturnType<typeof item>[]) =>
      t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items });
    await send([item({ barcode: "123" }), item({ productName: "Eggs", allergens: ["egg"] })]);
    await send([item({ barcode: "123", productName: "Renamed milk" }), item({ productName: "Eggs" })]);
    const products = await t.run((ctx) => ctx.db.query("products").collect());
    expect(products.map((p) => p.name)).toEqual(["Milk 2L", "Eggs"]);
    await send([item({ productId: products[1]._id, productName: "Something else" })]);
    expect(await t.run((ctx) => ctx.db.query("products").collect())).toHaveLength(2);
  });

  test("problems raise corrective actions and set status; partial vs rejected", async () => {
    const { t, token } = await ready();
    const unapproved = await addSupplier(t, { name: "Shady Co", approved: false });
    const now = Date.now();
    const id = await t.mutation(api.deliveries.create, {
      sessionToken: token,
      supplierId: unapproved,
      vehicleClean: false,
      receivedAt: now,
      items: [
        item({ productName: "Warm milk", temperatureC: 9 }),
        item({ productName: "No-temp fish", temperatureC: undefined }),
        item({ productName: "Old yoghurt", useBy: now - DAY }),
        item({ productName: "Squashed", accepted: false, rejectionReason: "Damaged" }),
        item({ productName: "Flour", storageType: "ambient", temperatureC: undefined }),
      ],
    });
    expect((await getDoc(t, id))?.status).toBe("partial");
    const raised = await cas(t);
    expect(raised.map((c) => [c.title, c.severity])).toEqual([
      ["Out-of-range temperature accepted: Warm milk", "high"],
      ["Out-of-range temperature accepted: No-temp fish", "high"],
      ["Expired product accepted: Old yoghurt", "high"],
      ["Rejected at delivery: Squashed", "medium"],
      ["Delivery from unapproved supplier: Shady Co", "medium"],
      ["Delivery vehicle not clean: Shady Co", "low"],
    ]);
    expect(raised[1].description).toContain("at no reading°C");
    expect(raised.every((c) => c.source === "goods_inward" && c.sourceId === id)).toBe(true);
    const items = await t.run((ctx) => ctx.db.query("deliveryItems").collect());
    expect(items.map((i) => i.temperatureCompliant)).toEqual([false, false, true, true, null]);
    expect((await auditLog(t)).at(-1)?.summary).toBe(
      "Goods received from Shady Co: 5 item(s), partial. Warm milk accepted at 9°C (chilled); " +
        "No-temp fish accepted at unrecorded°C (chilled); Squashed rejected: Damaged",
    );

    const all = await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId: unapproved, vehicleClean: true,
      items: [item({ accepted: false, rejectionReason: "Warm" })],
    });
    expect((await getDoc(t, all))?.status).toBe("rejected");
  });

  test("defaults receivedAt to now", async () => {
    const { t, token, supplierId } = await ready();
    const before = Date.now();
    const id = await t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [item()] });
    expect((await getDoc(t, id))!.receivedAt).toBeGreaterThanOrEqual(before);
  });
});

describe("deliveries:voidDelivery / updateNotes", () => {
  test("voids a delivery and its items with a reason (manager only, idempotent)", async () => {
    const { t, token, supplierId } = await ready("manager");
    const staff = await signIn(t, "staff");
    const id = await t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [item(), item()] });
    await expect(t.mutation(api.deliveries.voidDelivery, { sessionToken: staff.token, id, reason: "x" })).rejects.toThrow("requires");
    await expect(t.mutation(api.deliveries.voidDelivery, { sessionToken: token, id, reason: " " })).rejects.toThrow(
      "A reason is required",
    );
    await t.mutation(api.deliveries.voidDelivery, { sessionToken: token, id, reason: "Duplicate" });
    await t.mutation(api.deliveries.voidDelivery, { sessionToken: token, id, reason: "Again" });
    expect(await getDoc(t, id)).toMatchObject({ voided: true, voidReason: "Duplicate" });
    const items = await t.run((ctx) => ctx.db.query("deliveryItems").collect());
    expect(items.every((i) => i.voided)).toBe(true);
    const voids = (await auditLog(t)).filter((l) => l.action === "void");
    expect(voids.map((l) => l.summary)).toEqual(["Voided delivery from Fresh Foods Ltd: Duplicate"]);

    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.deliveries.voidDelivery, { sessionToken: token, id, reason: "x" })).rejects.toThrow(
      "Delivery not found",
    );
  });

  test("updateNotes records from/to in the trail", async () => {
    const { t, token, supplierId } = await ready();
    const id = await t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [item()] });
    await t.mutation(api.deliveries.updateNotes, { sessionToken: token, id, notes: "first" });
    await t.mutation(api.deliveries.updateNotes, { sessionToken: token, id, notes: "second" });
    const log = (await auditLog(t)).filter((l) => l.action === "update");
    expect(log.map((l) => l.changes)).toEqual([
      { notes: { from: null, to: "first" } },
      { notes: { from: "first", to: "second" } },
    ]);
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.deliveries.updateNotes, { sessionToken: token, id, notes: "x" })).rejects.toThrow(
      "Delivery not found",
    );
  });
});

describe("deliveries queries", () => {
  test("list newest first with item counts and accepted temperature issues", async () => {
    const { t, token, supplierId } = await ready();
    await t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, receivedAt: 1, items: [item()] });
    await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true, receivedAt: 2,
      items: [item({ temperatureC: 10 }), item({ temperatureC: 10, accepted: false, rejectionReason: "warm" })],
    });
    const list = await t.query(api.deliveries.list, { sessionToken: token });
    expect(list.map((d) => [d.receivedAt, d.itemCount, d.tempIssues])).toEqual([
      [2, 2, 1],
      [1, 1, 0],
    ]);
    expect(await t.query(api.deliveries.list, { sessionToken: token, limit: 1 })).toHaveLength(1);
  });

  test("get returns delivery, items and history, or null", async () => {
    const { t, token, supplierId } = await ready();
    const id = await t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [item()] });
    const res = await t.query(api.deliveries.get, { sessionToken: token, id });
    expect(res?.items).toHaveLength(1);
    expect(res?.history.map((h) => h.action)).toEqual(["create"]);
    await t.run((ctx) => ctx.db.delete(id));
    expect(await t.query(api.deliveries.get, { sessionToken: token, id })).toBeNull();
  });

  test("suggestionsForSupplier returns each product once, most recent first", async () => {
    const { t, token, supplierId } = await ready();
    await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true, receivedAt: 1, items: [item({ quantity: 1 }), item({ productName: "Eggs" })],
    });
    await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true, receivedAt: 2, items: [item({ quantity: 12, barcode: "94" })],
    });
    const s = await t.query(api.deliveries.suggestionsForSupplier, { sessionToken: token, supplierId });
    expect(s.map((x) => [x.productName, x.quantity])).toEqual([
      ["Milk 2L", 12],
      ["Eggs", 6],
    ]);
    expect(Object.keys(s[0]).sort()).toEqual(
      ["allergens", "barcode", "productId", "productName", "quantity", "storageType", "unit"].sort(),
    );
  });

  test("expiring returns accepted, non-voided stock within the warning window, soonest first", async () => {
    const { t, token, supplierId } = await ready();
    const now = Date.now();
    await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true,
      items: [
        item({ productName: "Soon", useBy: now + 2 * DAY }),
        item({ productName: "Past", useBy: now - DAY }),
        item({ productName: "BB soon", useBy: undefined, bestBefore: now + DAY }),
        item({ productName: "Later", useBy: now + 10 * DAY }),
        item({ productName: "Undated", useBy: undefined }),
        item({ productName: "Rejected", useBy: now, accepted: false, rejectionReason: "x" }),
      ],
    });
    const voided = await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true, items: [item({ productName: "Voided", useBy: now })],
    });
    await t.run(async (ctx) => {
      const its = await ctx.db.query("deliveryItems").withIndex("by_delivery", (q) => q.eq("deliveryId", voided)).collect();
      for (const i of its) await ctx.db.patch(i._id, { voided: true });
    });
    const res = await t.query(api.deliveries.expiring, { sessionToken: token });
    expect(res.map((r) => r.productName)).toEqual(["Past", "BB soon", "Soon"]);
    expect(res[1].expiresAt).toBe(now + DAY);
  });

  test("trace matches batch code exactly, plus name/batch substring and exact barcode", async () => {
    const { t, token, supplierId } = await ready();
    await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true, receivedAt: 1,
      items: [item({ batchCode: "LOT-42" }), item({ productName: "Cheese", batchCode: undefined, barcode: "9400" })],
    });
    await t.mutation(api.deliveries.create, {
      sessionToken: token, supplierId, vehicleClean: true, receivedAt: 2, items: [item({ productName: "Butter", batchCode: "lot-43" })],
    });
    const trace = (search: string) => t.query(api.deliveries.trace, { sessionToken: token, search });
    expect(await trace("   ")).toEqual([]);
    expect((await trace("LOT-42")).map((r) => r.productName)).toEqual(["Milk 2L"]);
    expect((await trace("lot-4")).map((r) => r.productName)).toEqual(["Butter", "Milk 2L"]);
    expect((await trace("cheese")).map((r) => r.productName)).toEqual(["Cheese"]);
    expect((await trace("9400"))[0]).toMatchObject({ productName: "Cheese", supplierName: "Fresh Foods Ltd", receivedByName: "Staff 0" });
    expect(await trace("nothing")).toEqual([]);
  });

  test("trace tolerates an item whose delivery row is missing", async () => {
    const { t, token, supplierId } = await ready();
    const id = await t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [item()] });
    await t.run((ctx) => ctx.db.delete(id as Id<"deliveries">));
    expect(await t.query(api.deliveries.trace, { sessionToken: token, search: "milk" })).toMatchObject([
      { supplierName: "", receivedByName: "" },
    ]);
  });
});
