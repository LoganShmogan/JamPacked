// Settings, suppliers and products: the reference data goods inwards relies on.
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { BUSINESS, addBusiness, addSupplier, auditLog, getDoc, setup, signIn } from "./helpers";

describe("settings", () => {
  test("get returns the current business's settings to any member", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    expect(await t.query(api.settings.get, { sessionToken: token, businessId })).toMatchObject({
      ...BUSINESS,
      _id: businessId,
      businessName: "Kai Cafe",
    });
    await expect(t.query(api.settings.get, { sessionToken: "x", businessId })).rejects.toThrow("Not signed in");
  });

  test("update patches the business with a field diff in the trail", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    await t.mutation(api.settings.update, { sessionToken: token, businessId, businessName: "Cafe", chilledMaxC: 4 });
    expect(await t.query(api.settings.get, { sessionToken: token, businessId })).toMatchObject({
      businessName: "Cafe",
      chilledMaxC: 4,
      hotMinC: 60,
    });
    await t.mutation(api.settings.update, { sessionToken: token, businessId, jurisdiction: "AU", businessName: "  " });
    await t.mutation(api.settings.update, { sessionToken: token, businessId, jurisdiction: "AU" });

    const log = await auditLog(t);
    expect(log.map((l) => l.summary)).toEqual([
      "Business settings updated (chilledMaxC, name)",
      "Business settings updated (jurisdiction)",
      "Business settings updated (no changes)",
    ]);
    expect(log[0].changes).toEqual({
      name: { from: "Kai Cafe", to: "Cafe" },
      chilledMaxC: { from: 5, to: 4 },
    });
    expect(log.every((l) => l.businessId === businessId)).toBe(true);
  });

  test("changing programme clears sectors from the old one; sectors must fit the programme", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    await t.mutation(api.settings.update, { sessionToken: token, businessId, sectors: ["ece"] });
    await t.mutation(api.settings.update, { sessionToken: token, businessId, programme: "NP2" });
    expect((await getDoc(t, businessId))?.sectors).toEqual(["ece"]);
    await t.mutation(api.settings.update, { sessionToken: token, businessId, programme: "NP1" });
    expect(await getDoc(t, businessId)).toMatchObject({ programme: "NP1", sectors: [] });
    await t.mutation(api.settings.update, { sessionToken: token, businessId, programme: "NP3", sectors: ["grain"] });
    expect(await getDoc(t, businessId)).toMatchObject({ programme: "NP3", sectors: ["grain"] });
    await expect(t.mutation(api.settings.update, { sessionToken: token, businessId, sectors: ["ece"] })).rejects.toThrow(
      "Not a NP3 sector: ece",
    );
  });

  test("only admins can update", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "manager");
    await expect(t.mutation(api.settings.update, { sessionToken: token, businessId, hotMinC: 1 })).rejects.toThrow("requires");
  });
});

describe("suppliers", () => {
  test("create validates, records approval in the summary and returns the id", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "manager");
    await expect(t.mutation(api.suppliers.create, { sessionToken: token, businessId, name: " ", approved: true })).rejects.toThrow(
      "Supplier name is required",
    );
    const a = await t.mutation(api.suppliers.create, { sessionToken: token, businessId, name: "Acme", approved: true });
    await t.mutation(api.suppliers.create, { sessionToken: token, businessId, name: "Dodgy", approved: false, phone: "021" });
    expect(await getDoc(t, a)).toMatchObject({ name: "Acme", active: true });
    expect((await auditLog(t)).map((l) => l.summary)).toEqual([
      "Added supplier Acme (approved)",
      "Added supplier Dodgy (not approved)",
    ]);
  });

  test("staff cannot create or update suppliers", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    const id = await addSupplier(t);
    await expect(t.mutation(api.suppliers.create, { sessionToken: token, businessId, name: "X", approved: true })).rejects.toThrow(
      "requires",
    );
    await expect(t.mutation(api.suppliers.update, { sessionToken: token, businessId, id, name: "Y" })).rejects.toThrow("requires");
  });

  test("list sorts by name and hides inactive unless asked", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    await addSupplier(t, { name: "Zed" });
    await addSupplier(t, { name: "Alpha" });
    await addSupplier(t, { name: "Old", active: false });
    expect((await t.query(api.suppliers.list, { sessionToken: token, businessId })).map((s) => s.name)).toEqual(["Alpha", "Zed"]);
    expect(
      (await t.query(api.suppliers.list, { sessionToken: token, businessId, includeInactive: true })).map((s) => s.name),
    ).toEqual(["Alpha", "Old", "Zed"]);
  });

  test("get returns the supplier with recent non-voided deliveries, or null", async () => {
    const t = setup();
    const { token, userId, businessId } = await signIn(t, "staff");
    const id = await addSupplier(t);
    await t.run(async (ctx) => {
      for (const voided of [false, true]) {
        await ctx.db.insert("deliveries", {
          receivedAt: Date.now(), supplierId: id, supplierName: "Fresh Foods Ltd", supplierApproved: true,
          vehicleClean: true, status: "accepted", receivedById: userId, receivedByName: "S", voided,
        });
      }
    });
    const res = await t.query(api.suppliers.get, { sessionToken: token, businessId, id });
    expect(res?.supplier.name).toBe("Fresh Foods Ltd");
    expect(res?.recentDeliveries).toHaveLength(1);

    await t.run((ctx) => ctx.db.delete(id));
    expect(await t.query(api.suppliers.get, { sessionToken: token, businessId, id })).toBeNull();
  });

  test("update patches and logs a diff; missing supplier errors", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const id = await addSupplier(t);
    await t.mutation(api.suppliers.update, { sessionToken: token, businessId, id, approved: false, name: "Fresh Foods Ltd" });
    await t.mutation(api.suppliers.update, { sessionToken: token, businessId, id });
    expect((await getDoc(t, id))?.approved).toBe(false);
    expect((await auditLog(t)).map((l) => l.summary)).toEqual([
      "Updated supplier Fresh Foods Ltd (approved)",
      "Updated supplier Fresh Foods Ltd (no changes)",
    ]);
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.suppliers.update, { sessionToken: token, businessId, id })).rejects.toThrow("Supplier not found");
  });
});

describe("products", () => {
  const product = { name: "Cheddar", storageType: "chilled" as const, allergens: ["milk"], barcode: "9400000000001" };

  test("any user can create; name is required", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    await expect(t.mutation(api.products.create, { sessionToken: token, businessId, ...product, name: "" })).rejects.toThrow(
      "Product name is required",
    );
    const id = await t.mutation(api.products.create, { sessionToken: token, businessId, ...product });
    expect(await getDoc(t, id)).toMatchObject({ ...product, active: true });
    expect((await auditLog(t))[0].summary).toBe("Added product Cheddar");
  });

  test("list returns active products by name; byBarcode finds one or null", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    await t.mutation(api.products.create, { sessionToken: token, businessId, ...product });
    await t.mutation(api.products.create, { sessionToken: token, businessId, name: "Apples", storageType: "ambient", allergens: [] });
    const gone = await t.mutation(api.products.create, { sessionToken: token, businessId, name: "Bread", storageType: "ambient", allergens: [] });
    await t.run((ctx) => ctx.db.patch(gone, { active: false }));
    expect((await t.query(api.products.list, { sessionToken: token, businessId })).map((p) => p.name)).toEqual(["Apples", "Cheddar"]);
    expect((await t.query(api.products.byBarcode, { sessionToken: token, businessId, barcode: product.barcode }))?.name).toBe("Cheddar");
    expect(await t.query(api.products.byBarcode, { sessionToken: token, businessId, barcode: "000" })).toBeNull();
  });

  test("update is manager-only, logs a diff, and errors for a missing product", async () => {
    const t = setup();
    const staff = await signIn(t, "staff");
    const mgr = await signIn(t, "manager");
    const id = await t.mutation(api.products.create, { sessionToken: staff.token, businessId: staff.businessId, ...product });
    await expect(t.mutation(api.products.update, { sessionToken: staff.token, businessId: staff.businessId, id, name: "X" })).rejects.toThrow("requires");
    await t.mutation(api.products.update, { sessionToken: mgr.token, businessId: mgr.businessId, id, allergens: ["milk", "soy"] });
    await t.mutation(api.products.update, { sessionToken: mgr.token, businessId: mgr.businessId, id });
    expect((await getDoc(t, id))?.allergens).toEqual(["milk", "soy"]);
    expect((await auditLog(t)).slice(1).map((l) => l.summary)).toEqual([
      "Updated product Cheddar (allergens)",
      "Updated product Cheddar (no changes)",
    ]);
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.products.update, { sessionToken: mgr.token, businessId: mgr.businessId, id: id as Id<"products"> })).rejects.toThrow(
      "Product not found",
    );
  });
});

describe("products:lookupBarcode (Open Food Facts)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: unknown, ok = true) =>
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));

  test("requires a session and membership of the business", async () => {
    const t = setup();
    const { userId, businessId } = await signIn(t, "staff");
    await expect(t.action(api.products.lookupBarcode, { sessionToken: "x", businessId, barcode: "12345678" })).rejects.toThrow(
      "Not signed in",
    );
    const outsider = await signIn(t, "staff", {}, await addBusiness(t, userId));
    await expect(
      t.action(api.products.lookupBarcode, { sessionToken: outsider.token, businessId, barcode: "12345678" }),
    ).rejects.toThrow("You don't have access");
  });

  test("returns null without calling the API for non-numeric or wrong-length barcodes", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, businessId, barcode: "abc" })).toBeNull();
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, businessId, barcode: "123" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([
    ["HTTP error", {}, false],
    ["status 0 (not found)", { status: 0 }, true],
    ["missing product", { status: 1 }, true],
  ])("returns null on %s", async (_, body, ok) => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    respond(body, ok);
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, businessId, barcode: "9400000000001" })).toBeNull();
  });

  test("maps a full product: brand, allergens, NOVA, frozen storage", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
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
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, businessId, barcode: "9400000000001" })).toEqual({
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
    const { token, businessId } = await signIn(t, "staff");
    respond({ status: 1, product: { categories_tags: cats, nova_group: "4" } });
    expect(await t.action(api.products.lookupBarcode, { sessionToken: token, businessId, barcode: "12345678" })).toEqual({
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
