// One-off migration from the single-business install to the first business of the multi-business model.
import { describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import { DEFAULT_SETTINGS } from "../convex/lib/settings";
import { setup } from "./helpers";

const user = (email: string, role: "admin" | "manager" | "staff" | undefined, createdAt: number, active = true) => ({
  email, name: email.split("@")[0], role, passwordHash: "", passwordSalt: "", active, createdAt,
});

describe("migrations:toMultiBusiness", () => {
  test("turns settings into a business, roles into memberships and stamps every record", async () => {
    const t = setup();
    const ids = await t.run(async (ctx) => {
      const late = await ctx.db.insert("users", user("late@x.com", "admin", 5));
      const owner = await ctx.db.insert("users", user("owner@x.com", "admin", 1));
      const staff = await ctx.db.insert("users", user("staff@x.com", "staff", 2, false));
      const legacy = await ctx.db.insert("users", user("legacy@x.com", undefined, 3));
      await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, businessName: "Old Cafe", chilledMaxC: 4, address: "1 St", registrationNumber: "R1" });
      const supplierId = await ctx.db.insert("suppliers", { name: "S", approved: true, active: true, createdAt: 0 });
      await ctx.db.insert("correctiveActions", {
        title: "x", source: "manual", severity: "low", status: "open", raisedAt: 0, raisedById: owner, raisedByName: "o",
      });
      await ctx.db.insert("auditLog", { at: 0, userName: "o", action: "x", entityType: "y", summary: "old" });
      return { owner, late, staff, legacy, supplierId };
    });
    const res = await t.mutation(internal.migrations.toMultiBusiness, { programme: "NP2", sectors: ["ece"] });
    expect(res).toMatchObject({
      migrated: true,
      counts: { suppliers: 1, products: 0, deliveries: 0, deliveryItems: 0, temperatureLogs: 0, audits: 0, correctiveActions: 1, auditLog: 1 },
    });
    const all = await t.run(async (ctx) => ({
      businesses: await ctx.db.query("businesses").collect(),
      memberships: await ctx.db.query("memberships").collect(),
      suppliers: await ctx.db.query("suppliers").collect(),
      log: await ctx.db.query("auditLog").collect(),
    }));
    expect(all.businesses).toMatchObject([
      { name: "Old Cafe", chilledMaxC: 4, address: "1 St", registrationNumber: "R1", programme: "NP2", sectors: ["ece"], ownerId: ids.owner },
    ]);
    const bid = all.businesses[0]._id;
    expect(all.memberships.map((m) => [m.userId, m.role, m.active, m.businessId])).toEqual([
      [ids.late, "admin", true, bid],
      [ids.owner, "admin", true, bid],
      [ids.staff, "staff", false, bid],
      [ids.legacy, "staff", true, bid],
    ]);
    expect(all.suppliers[0].businessId).toBe(bid);
    expect(all.log.every((l) => l.businessId === bid)).toBe(true);
    expect(all.log.at(-1)?.summary).toBe("Migrated to multi-business: 4 member(s), NP2");

    // Re-running is a no-op.
    expect(await t.mutation(internal.migrations.toMultiBusiness, { programme: "NP1" })).toEqual({ migrated: false });
  });

  test("uses default settings when none were saved; needs an admin; checks sectors", async () => {
    const t = setup();
    await expect(t.mutation(internal.migrations.toMultiBusiness, { programme: "NP1", sectors: ["ece"] })).rejects.toThrow(
      "Not a NP1 sector: ece",
    );
    await expect(t.mutation(internal.migrations.toMultiBusiness, { programme: "NP1" })).rejects.toThrow("No admin user");
    await t.run((ctx) => ctx.db.insert("users", user("a@x.com", "admin", 0)));
    await t.mutation(internal.migrations.toMultiBusiness, { programme: "NP1" });
    const [b] = await t.run((ctx) => ctx.db.query("businesses").collect());
    expect(b).toMatchObject({ ...DEFAULT_SETTINGS, name: "My Food Business", programme: "NP1", sectors: [] });
  });
});
