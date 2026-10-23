// Seven-year retention: nothing is ever deleted, and an admin can take a full copy of a business's records.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { EXPORT_TABLES } from "../convex/exportData";
import { RETENTION_YEARS } from "../convex/lib/retention";
import { addBusiness, addSupplier, item, setup, signIn } from "./helpers";

// The backend's own source, to check what it can and can't do.
const sources = import.meta.glob("../convex/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("retention", () => {
  test("records are kept 7 years", () => {
    expect(RETENTION_YEARS).toBe(7);
  });

  test("nothing in the backend deletes records: only sign-out removes a session", () => {
    const deletes = Object.entries(sources)
      .filter(([path]) => !path.includes("/_generated/"))
      .flatMap(([path, src]) => (src.match(/\bdb\.(delete|replace)\(/g) ?? []).map(() => path.replace("../convex/", "")));
    expect(deletes).toEqual(["auth.ts"]);
    expect(sources["../convex/auth.ts"]).toContain("await ctx.db.delete(session._id)");
  });

  test("every table that holds a business's records is exported", () => {
    const withBusiness = Object.entries(schema.tables)
      .filter(([, t]) => "businessId" in (t.validator as { fields: object }).fields)
      .map(([name]) => name);
    expect([...EXPORT_TABLES].sort()).toEqual(withBusiness.sort());
  });
});

describe("exportData", () => {
  test("an admin can page through every table of their business, and only theirs", async () => {
    const t = setup();
    const { userId, token, businessId } = await signIn(t, "admin");
    const supplierId = await addSupplier(t);
    const as = { sessionToken: token, businessId };
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.deliveries.create, { ...as, supplierId, vehicleClean: true, items: [item()] });
    }
    // Another business's delivery must not leak in.
    const other = await signIn(t, "admin", {}, await addBusiness(t, userId));
    const theirSupplier = await t.mutation(api.suppliers.create, {
      sessionToken: other.token, businessId: other.businessId, name: "Theirs", approved: true,
    });
    await t.mutation(api.deliveries.create, {
      sessionToken: other.token, businessId: other.businessId, supplierId: theirSupplier, vehicleClean: true, items: [item()],
    });

    const m = await t.query(api.exportData.manifest, as);
    expect(m).toMatchObject({ business: { _id: businessId, name: "Kai Cafe" }, tables: EXPORT_TABLES, retentionYears: 7 });

    const rows: Record<string, unknown[]> = {};
    for (const table of m.tables) {
      rows[table] = [];
      let cursor: string | null = null;
      for (;;) {
        const res: { page: unknown[]; isDone: boolean; continueCursor: string } = await t.query(api.exportData.page, { ...as, table, paginationOpts: { cursor, numItems: 2 } });
        rows[table].push(...res.page);
        if (res.isDone) break;
        cursor = res.continueCursor;
      }
    }
    expect(rows.deliveries).toHaveLength(3);
    expect(rows.deliveryItems).toHaveLength(3);
    expect(rows.stockLots).toHaveLength(3);
    expect(rows.suppliers).toHaveLength(1);
    expect(rows.memberships).toHaveLength(1);
    for (const r of Object.values(rows).flat()) expect((r as { businessId: string }).businessId).toBe(businessId);
  });

  test("admins only", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "manager");
    await expect(t.query(api.exportData.manifest, { sessionToken: token, businessId })).rejects.toThrow("requires");
    await expect(
      t.query(api.exportData.page, { sessionToken: token, businessId, table: "deliveries", paginationOpts: { cursor: null, numItems: 10 } }),
    ).rejects.toThrow("requires");
  });
});
