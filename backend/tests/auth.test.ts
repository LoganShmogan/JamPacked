import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { auditLog, getDoc, setup, signIn } from "./helpers";

const creds = { email: "  Alice@Example.com ", name: " Alice ", password: "password123" };

describe("auth:register", () => {
  test.each([
    [{ email: "not-an-email" }, "Enter a valid email address"],
    [{ password: "short" }, "Password must be at least 8 characters"],
    [{ name: "   " }, "Name is required"],
  ])("rejects invalid input %o", async (patch, message) => {
    const t = setup();
    await expect(t.action(api.auth.register, { ...creds, ...patch })).rejects.toThrow(message);
  });

  test("first account is admin, later accounts are staff; emails are normalised", async () => {
    const t = setup();
    const { token } = await t.action(api.auth.register, creds);
    expect(await t.query(api.auth.me, { sessionToken: token })).toMatchObject({
      email: "alice@example.com",
      name: "Alice",
      role: "admin",
    });
    const second = await t.action(api.auth.register, { ...creds, email: "bob@example.com", name: "Bob" });
    expect((await t.query(api.auth.me, { sessionToken: second.token }))?.role).toBe("staff");

    const log = await auditLog(t);
    expect(log.map((l) => l.summary)).toEqual([
      "Account created for alice@example.com (admin)",
      "Account created for bob@example.com (staff)",
    ]);
  });

  test("rejects a duplicate email", async () => {
    const t = setup();
    await t.action(api.auth.register, creds);
    await expect(t.action(api.auth.register, creds)).rejects.toThrow("already exists");
  });

  test("me does not leak password fields", async () => {
    const t = setup();
    const { token } = await t.action(api.auth.register, creds);
    const me = await t.query(api.auth.me, { sessionToken: token });
    expect(Object.keys(me!).sort()).toEqual(["_id", "email", "name", "role"]);
  });
});

describe("auth:login", () => {
  test("signs in with correct credentials (case/whitespace-insensitive email)", async () => {
    const t = setup();
    await t.action(api.auth.register, creds);
    const { token } = await t.action(api.auth.login, { email: "ALICE@example.com ", password: "password123" });
    expect((await t.query(api.auth.me, { sessionToken: token }))?.name).toBe("Alice");
    expect((await auditLog(t)).at(-1)).toMatchObject({ action: "login", summary: "Alice signed in" });
  });

  test("rejects a wrong password, an unknown email and a deactivated user, logging each attempt", async () => {
    const t = setup();
    const { token } = await t.action(api.auth.register, creds);
    await expect(t.action(api.auth.login, { email: creds.email, password: "wrong-password" })).rejects.toThrow(
      "Incorrect email or password",
    );
    await expect(t.action(api.auth.login, { email: "nobody@x.com", password: "password123" })).rejects.toThrow(
      "Incorrect email or password",
    );
    const me = await t.query(api.auth.me, { sessionToken: token });
    await t.run((ctx) => ctx.db.patch(me!._id, { active: false }));
    await expect(t.action(api.auth.login, { email: creds.email, password: "password123" })).rejects.toThrow(
      "Incorrect email or password",
    );
    const failed = (await auditLog(t)).filter((l) => l.action === "login_failed");
    expect(failed.map((l) => l.summary)).toEqual([
      "Failed sign-in attempt for alice@example.com",
      "Failed sign-in attempt for nobody@x.com",
      "Failed sign-in attempt for alice@example.com",
    ]);
    expect(failed.every((l) => l.userName === "system")).toBe(true);
  });

  test("recordLogin without a token logs the user but creates no session", async () => {
    const t = setup();
    const { userId } = await signIn(t);
    const before = await t.run((ctx) => ctx.db.query("sessions").collect());
    await t.mutation(internal.auth.recordLogin, { email: "a@x.com", userId });
    expect(await t.run((ctx) => ctx.db.query("sessions").collect())).toHaveLength(before.length);
    expect((await auditLog(t)).at(-1)?.action).toBe("login");
  });
});

describe("auth:logout", () => {
  test("deletes the session and logs it; unknown tokens are a no-op", async () => {
    const t = setup();
    const { token } = await signIn(t);
    await t.mutation(api.auth.logout, { sessionToken: "unknown" });
    expect(await auditLog(t)).toHaveLength(0);

    await t.mutation(api.auth.logout, { sessionToken: token });
    expect(await t.query(api.auth.me, { sessionToken: token })).toBeNull();
    expect((await auditLog(t))[0]).toMatchObject({ action: "logout", summary: "Admin 0 signed out" });
  });

  test("still logs out when the user record no longer exists", async () => {
    const t = setup();
    const { userId, token } = await signIn(t);
    await t.run((ctx) => ctx.db.delete(userId));
    await t.mutation(api.auth.logout, { sessionToken: token });
    expect((await auditLog(t))[0].summary).toBe("User signed out");
  });
});

describe("auth:listUsers / updateUser", () => {
  test("listUsers is for admins and managers only", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const manager = await signIn(t, "manager");
    const staff = await signIn(t, "staff");
    const users = await t.query(api.auth.listUsers, { sessionToken: manager.token });
    expect(users).toHaveLength(3);
    expect(users[0]).toEqual({
      _id: admin.userId,
      email: "admin0@example.com",
      name: "Admin 0",
      role: "admin",
      active: true,
      createdAt: expect.any(Number),
    });
    await expect(t.query(api.auth.listUsers, { sessionToken: staff.token })).rejects.toThrow("requires");
  });

  test("admin can change another user's role and active flag", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const staff = await signIn(t, "staff");
    await t.mutation(api.auth.updateUser, { sessionToken: admin.token, userId: staff.userId, role: "manager", active: false });
    expect(await getDoc(t, staff.userId)).toMatchObject({ role: "manager", active: false });
    const summary = (await auditLog(t))[0].summary;
    expect(summary).toMatch(/^Updated Staff 1: /);
    expect(summary).toContain("role=manager");
    expect(summary).toContain("active=false");

    await t.mutation(api.auth.updateUser, { sessionToken: admin.token, userId: staff.userId, active: true });
    expect((await auditLog(t))[1].summary).toBe("Updated Staff 1: active=true");
  });

  test("guards: admin only, user must exist, cannot demote or deactivate yourself", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const manager = await signIn(t, "manager");
    await expect(
      t.mutation(api.auth.updateUser, { sessionToken: manager.token, userId: admin.userId, role: "staff" }),
    ).rejects.toThrow("requires");

    const ghost = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        email: "g@x.com", name: "G", role: "staff", passwordHash: "", passwordSalt: "", active: true, createdAt: 0,
      });
      await ctx.db.delete(id);
      return id as Id<"users">;
    });
    await expect(t.mutation(api.auth.updateUser, { sessionToken: admin.token, userId: ghost })).rejects.toThrow(
      "User not found",
    );
    await expect(
      t.mutation(api.auth.updateUser, { sessionToken: admin.token, userId: admin.userId, role: "staff" }),
    ).rejects.toThrow("can't change your own role");
    await expect(
      t.mutation(api.auth.updateUser, { sessionToken: admin.token, userId: admin.userId, active: false }),
    ).rejects.toThrow("can't change your own role");
    // Re-affirming yourself as active is harmless.
    await t.mutation(api.auth.updateUser, { sessionToken: admin.token, userId: admin.userId, active: true });
  });
});
