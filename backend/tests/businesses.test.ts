// Multi-business: the picker, adding businesses, members & invites, and isolation between businesses.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { PROGRAMMES } from "../convex/lib/programmes";
import { REGIONS } from "../convex/lib/regions";
import { addBusiness, addSupplier, auditLog, getDoc, item, setup, signIn } from "./helpers";

describe("businesses:programmes", () => {
  test("lists NP1-3 with who they're for and their sectors, without signing in", async () => {
    const t = setup();
    const list = await t.query(api.businesses.programmes, {});
    expect(list.map((p) => p.key)).toEqual(["NP1", "NP2", "NP3"]);
    expect(list).toEqual(PROGRAMMES);
    for (const p of list) {
      expect(p.whoFor.length).toBeGreaterThan(0);
      expect(new Set(p.sectors.map((s) => s.key)).size).toBe(p.sectors.length);
    }
  });
});

describe("businesses:regions", () => {
  test("lists NZ regions and AU states without signing in", async () => {
    const t = setup();
    const r = await t.query(api.businesses.regions, {});
    expect(r).toEqual(REGIONS);
    expect(r.NZ).toContain("Manawatū-Whanganui");
    expect(r.AU).toHaveLength(8);
  });

  test("a new business can have a region of its country (NZ unless given)", async () => {
    const t = setup();
    const { token } = await signIn(t, "admin");
    const nz = await t.mutation(api.businesses.create, { sessionToken: token, name: "Kiwi", programme: "NP2", region: "Canterbury" });
    const au = await t.mutation(api.businesses.create, {
      sessionToken: token, name: "Aussie", programme: "custom", jurisdiction: "AU", region: "Victoria",
    });
    expect(await getDoc(t, nz)).toMatchObject({ jurisdiction: "NZ", region: "Canterbury" });
    expect(await getDoc(t, au)).toMatchObject({ jurisdiction: "AU", region: "Victoria" });
    await expect(
      t.mutation(api.businesses.create, { sessionToken: token, name: "X", programme: "NP2", region: "Victoria" }),
    ).rejects.toThrow("Victoria isn't a region of New Zealand");
  });
});

describe("businesses:mine / create / setArchived", () => {
  test("the picker lists active memberships with role, programme and open corrective actions", async () => {
    const t = setup();
    const { userId, token, businessId } = await signIn(t, "manager");
    const second = await t.mutation(api.businesses.create, {
      sessionToken: token, name: " Bakery ", programme: "NP2", sectors: ["bread"],
    });
    const gone = await addBusiness(t, userId, { name: "Left Ltd" });
    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", { userId, businessId: gone, role: "staff", active: false, createdAt: 0 });
      await ctx.db.insert("correctiveActions", {
        businessId, title: "x", source: "manual", severity: "low", status: "open", raisedAt: 0, raisedById: userId, raisedByName: "M",
      });
    });
    await t.mutation(api.businesses.setArchived, { sessionToken: token, businessId: second, archived: true });

    const mine = await t.query(api.businesses.mine, { sessionToken: token });
    expect(mine).toEqual([
      {
        _id: businessId, name: "Kai Cafe", programme: "NP2", sectors: [], archived: false, isOwner: true,
        role: "manager", openCorrectiveActions: 1,
      },
      {
        _id: second, name: "Bakery", programme: "NP2", sectors: ["bread"], archived: true, isOwner: true,
        role: "admin", openCorrectiveActions: 0,
      },
    ]);
    expect((await auditLog(t)).map((l) => l.summary)).toEqual(["Business Bakery created (NP2)", "Archived Bakery"]);
  });

  test("businesses sort by name, archived last; restoring is logged", async () => {
    const t = setup();
    const { token } = await signIn(t, "admin");
    const b = await t.mutation(api.businesses.create, { sessionToken: token, name: "Apple", programme: "NP1" });
    expect((await t.query(api.businesses.mine, { sessionToken: token })).map((x) => x.name)).toEqual(["Apple", "Kai Cafe"]);
    await t.mutation(api.businesses.setArchived, { sessionToken: token, businessId: b, archived: true });
    await t.mutation(api.businesses.setArchived, { sessionToken: token, businessId: b, archived: false });
    expect((await auditLog(t)).at(-1)?.summary).toBe("Restored Apple");
    expect((await getDoc(t, b))?.archived).toBe(false);
  });

  test("only admins archive; creating needs a sign-in", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "manager");
    await expect(t.mutation(api.businesses.setArchived, { sessionToken: token, businessId, archived: true })).rejects.toThrow("requires");
    await expect(t.mutation(api.businesses.create, { sessionToken: "x", name: "A", programme: "NP1" })).rejects.toThrow("Not signed in");
  });
});

describe("businesses:members / invite / updateMember", () => {
  test("members lists people and pending invites, for admins and managers only", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const staff = await signIn(t, "staff");
    await t.mutation(api.businesses.invite, { sessionToken: admin.token, businessId: admin.businessId, email: " New@X.com ", role: "staff" });
    const res = await t.query(api.businesses.members, { sessionToken: admin.token, businessId: admin.businessId });
    expect(res.members).toEqual([
      { _id: admin.userId, name: "Admin 0", email: "admin0@example.com", role: "admin", active: true, createdAt: expect.any(Number) },
      { _id: staff.userId, name: "Staff 1", email: "staff1@example.com", role: "staff", active: true, createdAt: expect.any(Number) },
    ]);
    expect(res.invites).toMatchObject([{ email: "new@x.com", role: "staff", invitedByName: "Admin 0" }]);
    await expect(t.query(api.businesses.members, { sessionToken: staff.token, businessId: staff.businessId })).rejects.toThrow("requires");
  });

  test("inviting an existing user adds them straight away; re-inviting a removed member reactivates them", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const other = await t.mutation(api.businesses.create, { sessionToken: admin.token, name: "Other", programme: "NP3" });
    const elsewhere = await signIn(t, "staff", {}, other);
    const res = await t.mutation(api.businesses.invite, {
      sessionToken: admin.token, businessId: admin.businessId, email: "staff1@example.com", role: "manager",
    });
    expect(res).toEqual({ added: true });
    const mine = await t.query(api.businesses.mine, { sessionToken: elsewhere.token });
    expect(mine.map((b) => [b.name, b.role])).toEqual([["Kai Cafe", "manager"], ["Other", "staff"]]);
    await expect(
      t.mutation(api.businesses.invite, { sessionToken: admin.token, businessId: admin.businessId, email: "staff1@example.com", role: "staff" }),
    ).rejects.toThrow("Staff 1 is already a member");

    await t.mutation(api.businesses.updateMember, {
      sessionToken: admin.token, businessId: admin.businessId, userId: elsewhere.userId, active: false,
    });
    await t.mutation(api.businesses.invite, { sessionToken: admin.token, businessId: admin.businessId, email: "staff1@example.com", role: "staff" });
    const again = await t.query(api.businesses.members, { sessionToken: admin.token, businessId: admin.businessId });
    expect(again.members.find((m) => m._id === elsewhere.userId)).toMatchObject({ role: "staff", active: true });
    expect((await auditLog(t)).filter((l) => l.action === "invite").map((l) => l.summary)).toEqual([
      "Added Staff 1 as manager",
      "Added Staff 1 as staff",
    ]);
  });

  test("invite validates the email, rejects duplicates and is admin-only", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const mgr = await signIn(t, "manager");
    const args = { sessionToken: admin.token, businessId: admin.businessId, role: "staff" as const };
    await expect(t.mutation(api.businesses.invite, { ...args, email: "nope" })).rejects.toThrow("Enter a valid email address");
    expect(await t.mutation(api.businesses.invite, { ...args, email: "a@x.com" })).toEqual({ added: false });
    await expect(t.mutation(api.businesses.invite, { ...args, email: "a@x.com" })).rejects.toThrow("a@x.com has already been invited");
    // The same email can be invited to another business.
    const other = await addBusiness(t, admin.userId);
    await t.run((ctx) => ctx.db.insert("memberships", { userId: admin.userId, businessId: other, role: "admin", active: true, createdAt: 0 }));
    await t.mutation(api.businesses.invite, { ...args, businessId: other, email: "a@x.com" });
    await expect(
      t.mutation(api.businesses.invite, { sessionToken: mgr.token, businessId: mgr.businessId, email: "b@x.com", role: "staff" }),
    ).rejects.toThrow("requires");
    expect((await auditLog(t)).at(-1)?.summary).toBe("Invited a@x.com as staff");
  });

  test("admin can change another member's role and active flag", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const staff = await signIn(t, "staff");
    const args = { sessionToken: admin.token, businessId: admin.businessId, userId: staff.userId };
    await t.mutation(api.businesses.updateMember, { ...args, role: "manager", active: false });
    const m = await t.run((ctx) => ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", staff.userId)).unique());
    expect(m).toMatchObject({ role: "manager", active: false });
    const summary = (await auditLog(t))[0].summary;
    expect(summary).toMatch(/^Updated Staff 1: /);
    expect(summary).toContain("role=manager");
    expect(summary).toContain("active=false");
    await t.mutation(api.businesses.updateMember, { ...args, active: true });
    expect((await auditLog(t))[1].summary).toBe("Updated Staff 1: active=true");
  });

  test("guards: admin only, member must exist, cannot demote or deactivate yourself", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const manager = await signIn(t, "manager");
    const outsider = await signIn(t, "staff", {}, await addBusiness(t, admin.userId));
    const args = { sessionToken: admin.token, businessId: admin.businessId };
    await expect(
      t.mutation(api.businesses.updateMember, { sessionToken: manager.token, businessId: manager.businessId, userId: admin.userId, role: "staff" }),
    ).rejects.toThrow("requires");
    await expect(t.mutation(api.businesses.updateMember, { ...args, userId: outsider.userId })).rejects.toThrow("User not found");
    await expect(t.mutation(api.businesses.updateMember, { ...args, userId: admin.userId, role: "staff" })).rejects.toThrow(
      "can't change your own role",
    );
    await expect(t.mutation(api.businesses.updateMember, { ...args, userId: admin.userId, active: false })).rejects.toThrow(
      "can't change your own role",
    );
    // Re-affirming yourself as active is harmless.
    await t.mutation(api.businesses.updateMember, { ...args, userId: admin.userId, active: true });
  });
});

describe("isolation between businesses", () => {
  test("records of one business are invisible and untouchable from another", async () => {
    const t = setup();
    const a = await signIn(t, "admin");
    const bId = await t.mutation(api.businesses.create, { sessionToken: a.token, name: "B", programme: "NP3" });
    const supplierId = await addSupplier(t);
    const deliveryId = await t.mutation(api.deliveries.create, {
      sessionToken: a.token, businessId: a.businessId, supplierId, vehicleClean: true, items: [item()],
    });
    const asB = { sessionToken: a.token, businessId: bId };
    expect(await t.query(api.deliveries.list, asB)).toEqual([]);
    expect(await t.query(api.deliveries.get, { ...asB, id: deliveryId })).toBeNull();
    expect(await t.query(api.suppliers.list, asB)).toEqual([]);
    expect(await t.query(api.suppliers.get, { ...asB, id: supplierId })).toBeNull();
    expect(await t.query(api.products.list, asB)).toEqual([]);
    expect(await t.query(api.deliveries.trace, { ...asB, search: "Milk" })).toEqual([]);
    expect(await t.query(api.auditLog.list, { ...asB, entityType: "delivery", entityId: deliveryId })).toEqual([]);
    await expect(t.mutation(api.deliveries.voidDelivery, { ...asB, id: deliveryId, reason: "x" })).rejects.toThrow("Delivery not found");
    await expect(
      t.mutation(api.deliveries.create, { ...asB, supplierId, vehicleClean: true, items: [item()] }),
    ).rejects.toThrow("Supplier not found");
    await expect(t.query(api.deliveries.suggestionsForSupplier, { ...asB, supplierId })).rejects.toThrow("Supplier not found");
    await expect(t.mutation(api.suppliers.update, { ...asB, id: supplierId, name: "x" })).rejects.toThrow("Supplier not found");
    const productId = (await t.query(api.products.list, { sessionToken: a.token, businessId: a.businessId }))[0]._id as Id<"products">;
    await expect(t.mutation(api.products.update, { ...asB, id: productId, name: "x" })).rejects.toThrow("Product not found");
    const auditId = await t.mutation(api.audits.start, { sessionToken: a.token, businessId: a.businessId, templateKey: "hygiene" });
    expect(await t.query(api.audits.get, { ...asB, id: auditId })).toBeNull();
    const outsider = await signIn(t, "staff", {}, bId);
    await expect(
      t.query(api.deliveries.list, { sessionToken: outsider.token, businessId: a.businessId }),
    ).rejects.toThrow("You don't have access to this business");
  });
});
