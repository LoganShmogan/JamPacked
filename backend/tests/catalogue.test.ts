// Settings, suppliers and products: the reference data goods inwards relies on.
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { DEFAULT_SETTINGS } from "../convex/lib/settings";
import { addSupplier, auditLog, getDoc, setup, signIn } from "./helpers";

describe("settings", () => {
  test("get returns defaults for any signed-in user", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    expect(await t.query(api.settings.get, { sessionToken: token })).toEqual(DEFAULT_SETTINGS);
    await expect(t.query(api.settings.get, { sessionToken: "x" })).rejects.toThrow("Not signed in");
  });

  test("first update inserts the row, later updates patch it, with a field diff in the trail", async () => {
    const t = setup();
    const { token } = await signIn(t, "admin");
    await t.mutation(api.settings.update, { sessionToken: token, businessName: "Cafe", chilledMaxC: 4 });
    expect(await t.query(api.settings.get, { sessionToken: token })).toMatchObject({
      businessName: "Cafe",
      chilledMaxC: 4,
      hotMinC: 60,
    });
    await t.mutation(api.settings.update, { sessionToken: token, jurisdiction: "AU" });
    await t.mutation(api.settings.update, { sessionToken: token, jurisdiction: "AU" });
    expect(await t.run((ctx) => ctx.db.query("settings").collect())).toHaveLength(1);

    const log = await auditLog(t);
    expect(log.map((l) => l.summary)).toEqual([
      "Business settings updated (businessName, chilledMaxC)",
      "Business settings updated (jurisdiction)",
      "Business settings updated (no changes)",
    ]);
    expect(log[0].changes).toEqual({
      businessName: { from: "My Food Business", to: "Cafe" },
      chilledMaxC: { from: 5, to: 4 },
    });
  });

  test("only admins can update", async () => {
    const t = setup();
    const { token } = await signIn(t, "manager");
    await expect(t.mutation(api.settings.update, { sessionToken: token, hotMinC: 1 })).rejects.toThrow("requires");
  });
});

describe("suppliers", () => {
  test("create validates, records approval in the summary and returns the id", async () => {
    const t = setup();
    const { token } = await signIn(t, "manager");
    await expect(t.mutation(api.suppliers.create, { sessionToken: token, name: " ", approved: true })).rejects.toThrow(
      "Supplier name is required",
    );
    const a = await t.mutation(api.suppliers.create, { sessionToken: token, name: "Acme", approved: true });
    await t.mutation(api.suppliers.create, { sessionToken: token, name: "Dodgy", approved: false, phone: "021" });
    expect(await getDoc(t, a)).toMatchObject({ name: "Acme", active: true });
    expect((await auditLog(t)).map((l) => l.summary)).toEqual([
      "Added supplier Acme (approved)",
      "Added supplier Dodgy (not approved)",
    ]);
  });

  test("staff cannot create or update suppliers", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await addSupplier(t);
    await expect(t.mutation(api.suppliers.create, { sessionToken: token, name: "X", approved: true })).rejects.toThrow(
      "requires",
    );
    await expect(t.mutation(api.suppliers.update, { sessionToken: token, id, name: "Y" })).rejects.toThrow("requires");
  });

  test("list sorts by name and hides inactive unless asked", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    await addSupplier(t, { name: "Zed" });
    await addSupplier(t, { name: "Alpha" });
    await addSupplier(t, { name: "Old", active: false });
    expect((await t.query(api.suppliers.list, { sessionToken: token })).map((s) => s.name)).toEqual(["Alpha", "Zed"]);
    expect(
      (await t.query(api.suppliers.list, { sessionToken: token, includeInactive: true })).map((s) => s.name),
    ).toEqual(["Alpha", "Old", "Zed"]);
  });

  test("get returns the supplier with recent non-voided deliveries, or null", async () => {
    const t = setup();
    const { token, userId } = await signIn(t, "staff");
    const id = await addSupplier(t);
    await t.run(async (ctx) => {
      for (const voided of [false, true]) {
        await ctx.db.insert("deliveries", {
          receivedAt: Date.now(), supplierId: id, supplierName: "Fresh Foods Ltd", supplierApproved: true,
          vehicleClean: true, status: "accepted", receivedById: userId, receivedByName: "S", voided,
        });
      }
    });
    const res = await t.query(api.suppliers.get, { sessionToken: token, id });
    expect(res?.supplier.name).toBe("Fresh Foods Ltd");
    expect(res?.recentDeliveries).toHaveLength(1);

    await t.run((ctx) => ctx.db.delete(id));
    expect(await t.query(api.suppliers.get, { sessionToken: token, id })).toBeNull();
  });

  test("update patches and logs a diff; missing supplier errors", async () => {
    const t = setup();
    const { token } = await signIn(t, "admin");
    const id = await addSupplier(t);
    await t.mutation(api.suppliers.update, { sessionToken: token, id, approved: false, name: "Fresh Foods Ltd" });
    await t.mutation(api.suppliers.update, { sessionToken: token, id });
    expect((await getDoc(t, id))?.approved).toBe(false);
    expect((await auditLog(t)).map((l) => l.summary)).toEqual([
      "Updated supplier Fresh Foods Ltd (approved)",
      "Updated supplier Fresh Foods Ltd (no changes)",
    ]);
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.suppliers.update, { sessionToken: token, id })).rejects.toThrow("Supplier not found");
  });
});

describe("products", () => {
  const product = { name: "Cheddar", storageType: "chilled" as const, allergens: ["milk"], barcode: "9400000000001" };

  test("any user can create; name is required", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    await expect(t.mutation(api.products.create, { sessionToken: token, ...product, name: "" })).rejects.toThrow(
      "Product name is required",
    );
    const id = await t.mutation(api.products.create, { sessionToken: token, ...product });
    expect(await getDoc(t, id)).toMatchObject({ ...product, active: true });
    expect((await auditLog(t))[0].summary).toBe("Added product Cheddar");
  });

  test("list returns active products by name; byBarcode finds one or null", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    await t.mutation(api.products.create, { sessionToken: token, ...product });
    await t.mutation(api.products.create, { sessionToken: token, name: "Apples", storageType: "ambient", allergens: [] });
    const gone = await t.mutation(api.products.create, { sessionToken: token, name: "Bread", storageType: "ambient", allergens: [] });
    await t.run((ctx) => ctx.db.patch(gone, { active: false }));
    expect((await t.query(api.products.list, { sessionToken: token })).map((p) => p.name)).toEqual(["Apples", "Cheddar"]);
    expect((await t.query(api.products.byBarcode, { sessionToken: token, barcode: product.barcode }))?.name).toBe("Cheddar");
    expect(await t.query(api.products.byBarcode, { sessionToken: token, barcode: "000" })).toBeNull();
  });

  test("update is manager-only, logs a diff, and errors for a missing product", async () => {
    const t = setup();
    const staff = await signIn(t, "staff");
    const mgr = await signIn(t, "manager");
    const id = await t.mutation(api.products.create, { sessionToken: staff.token, ...product });
    await expect(t.mutation(api.products.update, { sessionToken: staff.token, id, name: "X" })).rejects.toThrow("requires");
    await t.mutation(api.products.update, { sessionToken: mgr.token, id, allergens: ["milk", "soy"] });
    await t.mutation(api.products.update, { sessionToken: mgr.token, id });
    expect((await getDoc(t, id))?.allergens).toEqual(["milk", "soy"]);
    expect((await auditLog(t)).slice(1).map((l) => l.summary)).toEqual([
      "Updated product Cheddar (allergens)",
      "Updated product Cheddar (no changes)",
    ]);
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.products.update, { sessionToken: mgr.token, id: id as Id<"products"> })).rejects.toThrow(
      "Product not found",
    );
  });
});

describe("products:lookupBarcode (Open Food Facts)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: unknown, ok = true) =>
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));

  test("requires a session", async () => {
    const t = setup();
    await expect(t.action(api.products.lookupBarcode, { sessionToken: "x", barcode: "12345678" })).rejects.toThrow(
      "Not signed in",
    );
  });

  test("returns null without calling the API for non-numeric or wrong-length barcodes", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, barcode: "abc" })).toBeNull();
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, barcode: "123" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([
    ["HTTP error", {}, false],
    ["status 0 (not found)", { status: 0 }, true],
    ["missing product", { status: 1 }, true],
  ])("returns null on %s", async (_, body, ok) => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    respond(body, ok);
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, barcode: "9400000000001" })).toBeNull();
  });

  test("maps a full product: brand, allergens, NOVA, frozen storage", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    respond({
      status: 1,
      product: {
        product_name: "Peas",
        brands: "Wattie's, Heinz",
        allergens_tags: ["en:milk", "en:nuts", "fr:celery", "en:milk"],
        ingredients_text: "peas",
        nova_group: 1,
        image_front_small_url: "http://img",
        categories_tags: ["en:frozen-vegetables"],
      },
    });
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, barcode: "9400000000001" })).toEqual({
      name: "Peas",
      brand: "Wattie's",
      allergens: ["milk", "tree nuts", "celery"],
      ingredients: "peas",
      novaGroup: 1,
      imageUrl: "http://img",
      storageType: "frozen",
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/product/9400000000001.json");
  });

  test.each([
    [["en:cheeses"], "chilled"],
    [["en:dairies"], "chilled"],
    [["en:snacks"], "ambient"],
    [undefined, "ambient"],
  ])("guesses storage from categories %o -> %s, tolerating missing fields", async (cats, storage) => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    respond({ status: 1, product: { categories_tags: cats, nova_group: "4" } });
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, barcode: "12345678" })).toEqual({
      name: "",
      brand: undefined,
      allergens: [],
      ingredients: undefined,
      novaGroup: undefined,
      imageUrl: undefined,
      storageType: storage,
    });
  });
});
