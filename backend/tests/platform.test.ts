// The owner dashboard: platform admins only, counts and activity without any business's records.
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { WEEKS } from "../convex/platform";
import { addBusiness, auditLog, DAY, getDoc, setup, signIn } from "./helpers";

describe("platform:overview", () => {
  test("customers and signed-out callers can't see it", async () => {
    const t = setup();
    const { token } = await signIn(t, "admin");
    await expect(t.query(api.platform.overview, { sessionToken: token })).rejects.toThrow("Only JamPacked staff");
    await expect(t.query(api.platform.overview, { sessionToken: "nope" })).rejects.toThrow("Not signed in");
  });

  test("counts users, businesses, activity and sign-ups per week", async () => {
    const t = setup();
    const me = await signIn(t, "admin", { platformAdmin: true });
    const staff = await signIn(t, "staff", { active: false });
    const now = Date.now();
    // Kai Cafe (from signIn) is active today; Old Co was last used 20 days ago; Quiet Co never; Shut Co archived.
    await t.mutation(api.suppliers.create, { sessionToken: me.token, businessId: me.businessId, name: "Fresh", approved: true });
    const old = await addBusiness(t, me.userId, { name: "Old Co", programme: "NP3", createdAt: now - 20 * DAY });
    await addBusiness(t, me.userId, { name: "Quiet Co", jurisdiction: "AU", region: "Victoria", createdAt: now - 2 * DAY });
    await t.run((ctx) => ctx.db.patch(me.businessId, { region: "Otago" }));
    await addBusiness(t, me.userId, { name: "Shut Co", archived: true, createdAt: now - 400 * DAY });
    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        businessId: old, at: now - 20 * DAY, userName: "x", action: "create", entityType: "supplier", summary: "x",
      });
      await ctx.db.patch(staff.userId, { createdAt: now - 8 * DAY });
    });

    const o = await t.query(api.platform.overview, { sessionToken: me.token });
    expect(o.users).toEqual({ total: 2, active: 1 });
    expect(o.businesses).toEqual({
      total: 4,
      archived: 1,
      active7d: 1,
      active30d: 2,
      byProgramme: { NP2: 2, NP3: 1 },
      byCountry: [
        { country: "NZ", count: 2, regions: [{ region: "Otago", count: 1 }, { region: "Not set", count: 1 }] },
        { country: "AU", count: 1, regions: [{ region: "Victoria", count: 1 }] },
      ],
    });
    expect(o.businessList.map((b) => [b.name, b.members, b.lastActivityAt !== null])).toEqual([
      ["Kai Cafe", 2, true],
      ["Quiet Co", 0, false],
      ["Old Co", 0, true],
      ["Shut Co", 0, false],
    ]);
    expect(Object.keys(o.businessList[0]).sort()).toEqual(
      ["_id", "archived", "createdAt", "jurisdiction", "lastActivityAt", "members", "name", "programme", "region"],
    );

    const counts = (w: { count: number }[]) => w.map((x) => x.count);
    expect(o.signupsByWeek.users).toHaveLength(WEEKS);
    expect(counts(o.signupsByWeek.users)).toEqual([...Array(WEEKS - 2).fill(0), 1, 1]);
    // Shut Co (400 days) is outside the window; Old Co is 2 weeks back; Kai Cafe and Quiet Co this week.
    expect(counts(o.signupsByWeek.businesses)).toEqual([...Array(WEEKS - 3).fill(0), 1, 0, 2]);
    expect(o.signupsByWeek.users[WEEKS - 1].weekStart).toBe(o.generatedAt - 7 * DAY);
  });
});

describe("platform:setPlatformAdmin", () => {
  test("grants and revokes by email, and logs it", async () => {
    const t = setup();
    const { userId, token } = await signIn(t, "admin", { email: "logan@example.com" });
    expect(await t.mutation(internal.platform.setPlatformAdmin, { email: " Logan@Example.com ", platformAdmin: true })).toEqual({ updated: true });
    expect((await getDoc(t, userId))!.platformAdmin).toBe(true);
    await t.query(api.platform.overview, { sessionToken: token });

    await t.mutation(internal.platform.setPlatformAdmin, { email: "logan@example.com", platformAdmin: false });
    expect((await getDoc(t, userId))!.platformAdmin).toBe(false);
    await expect(t.query(api.platform.overview, { sessionToken: token })).rejects.toThrow("Only JamPacked staff");

    const log = await auditLog(t);
    expect(log.map((e) => e.action)).toEqual(expect.arrayContaining(["platform_admin_granted", "platform_admin_revoked"]));
  });

  test("an unknown email changes nothing", async () => {
    const t = setup();
    expect(await t.mutation(internal.platform.setPlatformAdmin, { email: "who@example.com", platformAdmin: true })).toEqual({ updated: false });
  });
});

describe("platform:createPlatformAdmin", () => {
  test("creates a staff account with no business that can sign in and see the dashboard", async () => {
    const t = setup();
    await signIn(t, "admin"); // a customer, so the dashboard has something to count
    const res = await t.action(internal.platform.createPlatformAdmin, {
      email: " Tim@Example.com ", name: " Tim ", password: "longenough1",
    });
    expect(res).toEqual({ created: true });
    const { token } = await t.action(api.auth.login, { email: "tim@example.com", password: "longenough1" });
    const o = await t.query(api.platform.overview, { sessionToken: token });
    expect(o.users.total).toBe(2);
    expect(await t.query(api.businesses.mine, { sessionToken: token })).toEqual([]);
    expect((await auditLog(t)).map((e) => e.action)).toContain("platform_admin_created");
  });

  test("leaves an existing account alone and rejects short passwords", async () => {
    const t = setup();
    const { userId } = await signIn(t, "admin", { email: "logan@example.com" });
    expect(await t.action(internal.platform.createPlatformAdmin, { email: "logan@example.com", name: "L", password: "longenough1" })).toEqual({ created: false });
    expect((await getDoc(t, userId))!.platformAdmin).toBeUndefined();
    await expect(t.action(internal.platform.createPlatformAdmin, { email: "x@example.com", name: "X", password: "short" })).rejects.toThrow("at least 8");
  });
});

describe("platform:setBusinessRegion", () => {
  test("sets a region of the business's country, logged in its trail", async () => {
    const t = setup();
    const { businessId } = await signIn(t, "admin");
    await t.mutation(internal.platform.setBusinessRegion, { businessId, region: "Manawatū-Whanganui" });
    await t.mutation(internal.platform.setBusinessRegion, { businessId, region: "Wellington" });
    expect((await getDoc(t, businessId))!.region).toBe("Wellington");
    const log = (await auditLog(t)).filter((e) => e.businessId === businessId);
    expect(log.map((e) => e.changes)).toEqual([
      { region: { from: null, to: "Manawatū-Whanganui" } },
      { region: { from: "Manawatū-Whanganui", to: "Wellington" } },
    ]);
    await expect(t.mutation(internal.platform.setBusinessRegion, { businessId, region: "Victoria" })).rejects.toThrow(
      "isn't a region of New Zealand",
    );
  });

  test("an unknown business is an error", async () => {
    const t = setup();
    const { userId } = await signIn(t, "admin");
    const gone = await addBusiness(t, userId);
    await t.run((ctx) => ctx.db.delete(gone));
    await expect(t.mutation(internal.platform.setBusinessRegion, { businessId: gone, region: "Otago" })).rejects.toThrow(
      "Business not found",
    );
  });
});
