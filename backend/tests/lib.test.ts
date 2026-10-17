import { describe, expect, test } from "vitest";
import { diff, logAudit } from "../convex/lib/audit";
import { hashPassword, randomHex, verifyPassword } from "../convex/lib/password";
import { getUser, requireRole, requireUser } from "../convex/lib/session";
import { DEFAULT_SETTINGS, isTempCompliant, loadSettings, unitCompliant } from "../convex/lib/settings";
import { TEMPLATES } from "../convex/lib/templates";
import { DAY, auditLog, setup, signIn } from "./helpers";

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
  test("loadSettings returns defaults when no row exists, else the stored row", async () => {
    const t = setup();
    expect(await t.run((ctx) => loadSettings(ctx))).toEqual(DEFAULT_SETTINGS);
    await t.run((ctx) => ctx.db.insert("settings", { ...DEFAULT_SETTINGS, businessName: "Cafe", chilledMaxC: 4 }));
    const s = await t.run((ctx) => loadSettings(ctx));
    expect(s).toEqual({ ...DEFAULT_SETTINGS, businessName: "Cafe", chilledMaxC: 4 });
    expect(s).not.toHaveProperty("_id");
  });

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

  test("requireRole allows listed roles and rejects others", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    expect((await t.run((ctx) => requireRole(ctx, token, ["staff"]))).role).toBe("staff");
    await expect(t.run((ctx) => requireRole(ctx, token, ["admin", "manager"]))).rejects.toThrow(
      "This action requires one of: admin, manager",
    );
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
