import { describe, expect, test } from "vitest";
import { diff, logAudit } from "../convex/lib/audit";
import { checkSectors } from "../convex/lib/business";
import { hashPassword, randomHex, verifyPassword } from "../convex/lib/password";
import { getUser, inBusiness, requireMember, requireUser } from "../convex/lib/session";
import { DEFAULT_SETTINGS, isTempCompliant, unitCompliant } from "../convex/lib/settings";
import { TEMPLATES } from "../convex/lib/templates";
import { DAY, addBusiness, auditLog, setup, signIn } from "./helpers";

describe("lib/password", () => {
  test("randomHex returns 2 hex chars per byte and differs between calls", () => {
    const a = randomHex(16);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(randomHex(16)).not.toBe(a);
  });

  test("hashPassword generates a salt and is deterministic for a given salt", async () => {
    const { hash, salt } = await hashPassword("correct horse");
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await hashPassword("correct horse", salt)).hash).toBe(hash);
  });

  test("verifyPassword accepts the right password and rejects wrong ones", async () => {
    const { hash, salt } = await hashPassword("s3cret-pass");
    expect(await verifyPassword("s3cret-pass", salt, hash)).toBe(true);
    expect(await verifyPassword("wrong-pass", salt, hash)).toBe(false);
    // Length mismatch is rejected too (constant-time compare covers unequal lengths).
    expect(await verifyPassword("s3cret-pass", salt, hash.slice(0, 10))).toBe(false);
  });
});

describe("lib/audit", () => {
  test("diff reports only changed, defined fields and maps missing 'from' to null", () => {
    expect(
      diff(
        { a: 1, b: "x", c: [1, 2] },
        { a: 1, b: "y", c: [1, 2], d: true, e: undefined },
      ),
    ).toEqual({ b: { from: "x", to: "y" }, d: { from: null, to: true } });
  });

  test("logAudit stores the user or falls back to 'system'", async () => {
    const t = setup();
    const { userId } = await signIn(t);
    await t.run(async (ctx) => {
      await logAudit(ctx, { _id: userId, name: "Alice" }, { action: "x", entityType: "y", summary: "with user" });
      await logAudit(ctx, null, { action: "x", entityType: "y", summary: "no user", changes: { a: 1 } });
    });
    const rows = await auditLog(t);
    expect(rows.map((r) => [r.userName, r.userId, r.summary])).toEqual([
      ["Alice", userId, "with user"],
      ["system", undefined, "no user"],
    ]);
    expect(rows[1].changes).toEqual({ a: 1 });
  });
});

describe("lib/settings", () => {
  test.each([
    ["ambient", 30, null],
    ["chilled", undefined, false],
    ["chilled", 5, true],
    ["chilled", 5.1, false],
    ["frozen", -15, true],
    ["frozen", -10, false],
    ["hot", 60, true],
    ["hot", 59, false],
  ] as const)("isTempCompliant(%s, %s) = %s", (storage, temp, expected) => {
    expect(isTempCompliant(DEFAULT_SETTINGS, storage, temp)).toBe(expected);
  });

  test.each([
    ["chiller", 5, true],
    ["chiller", 6, false],
    ["freezer", -18, true],
    ["freezer", -5, false],
    ["hot_hold", 65, true],
    ["hot_hold", 50, false],
    ["cooking", 75, true],
    ["cooking", 70, false],
    ["cooling", 21, true],
    ["cooling", 22, false],
  ] as const)("unitCompliant(%s, %s) = %s", (unit, temp, expected) => {
    expect(unitCompliant(DEFAULT_SETTINGS, unit, temp)).toBe(expected);
  });
});

describe("lib/session", () => {
  test("getUser resolves a valid session", async () => {
    const t = setup();
    const { userId, token } = await signIn(t);
    expect((await t.run((ctx) => getUser(ctx, token)))?._id).toBe(userId);
  });

  test("getUser returns null for unknown, expired, orphaned or deactivated sessions", async () => {
    const t = setup();
    const { userId, token } = await signIn(t);
    expect(await t.run((ctx) => getUser(ctx, "nope"))).toBeNull();

    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", { userId, token: "expired", expiresAt: Date.now() - 1 });
      const ghost = await ctx.db.insert("users", {
        email: "g@x.com", name: "Ghost", role: "staff", passwordHash: "", passwordSalt: "", active: true, createdAt: 0,
      });
      await ctx.db.insert("sessions", { userId: ghost, token: "orphan", expiresAt: Date.now() + DAY });
      await ctx.db.delete(ghost);
    });
    expect(await t.run((ctx) => getUser(ctx, "expired"))).toBeNull();
    expect(await t.run((ctx) => getUser(ctx, "orphan"))).toBeNull();

    await t.run((ctx) => ctx.db.patch(userId, { active: false }));
    expect(await t.run((ctx) => getUser(ctx, token))).toBeNull();
  });

  test("requireUser throws when signed out", async () => {
    const t = setup();
    await expect(t.run((ctx) => requireUser(ctx, "nope"))).rejects.toThrow("Not signed in");
  });

  test("requireMember allows active members holding a listed role", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    const r = await t.run((ctx) => requireMember(ctx, token, businessId, ["staff"]));
    expect(r.role).toBe("staff");
    expect(r.business._id).toBe(businessId);
    expect((await t.run((ctx) => requireMember(ctx, token, businessId))).user.name).toBe("Staff 0");
    await expect(t.run((ctx) => requireMember(ctx, token, businessId, ["admin", "manager"]))).rejects.toThrow(
      "This action requires one of: admin, manager",
    );
  });

  test("requireMember rejects other businesses, removed members and missing businesses", async () => {
    const t = setup();
    const { userId, token, businessId } = await signIn(t, "admin");
    const other = await addBusiness(t, userId);
    await expect(t.run((ctx) => requireMember(ctx, token, other))).rejects.toThrow("You don't have access to this business");
    await t.run(async (ctx) => {
      const m = (await ctx.db.query("memberships").first())!;
      await ctx.db.patch(m._id, { active: false });
    });
    await expect(t.run((ctx) => requireMember(ctx, token, businessId))).rejects.toThrow("You don't have access");
    await t.run((ctx) => ctx.db.delete(other));
    await expect(t.run((ctx) => requireMember(ctx, token, other))).rejects.toThrow("You don't have access");
  });

  test("inBusiness only returns records belonging to the business", async () => {
    const t = setup();
    const { userId, businessId } = await signIn(t);
    const other = await addBusiness(t, userId);
    const doc = { businessId, name: "x" };
    expect(inBusiness(doc, businessId, "Thing")).toBe(doc);
    expect(() => inBusiness(doc, other, "Thing")).toThrow("Thing not found");
    expect(() => inBusiness(null, businessId, "Thing")).toThrow("Thing not found");
  });
});

describe("lib/business", () => {
  test("checkSectors accepts the programme's own sectors only; custom programmes have none", () => {
    expect(() => checkSectors("NP1", ["honey", "transport"])).not.toThrow();
    expect(() => checkSectors("NP1", ["ece"])).toThrow("Not a NP1 sector: ece");
    expect(() => checkSectors("custom", [])).not.toThrow();
    expect(() => checkSectors("custom", ["honey"])).toThrow("Not a custom sector: honey");
  });
});

describe("lib/templates", () => {
  test("every template has unique question ids and a positive period", () => {
    for (const tpl of TEMPLATES) {
      const ids = tpl.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(tpl.defaultPeriodDays).toBeGreaterThan(0);
    }
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
  });
});
