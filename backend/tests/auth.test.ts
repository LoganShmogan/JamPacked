import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { auditLog, setup, signIn } from "./helpers";

const business = (o: Record<string, unknown> = {}) => ({ name: "Kai Cafe", programme: "NP2" as const, sectors: ["ece"], ...o });
const creds = { email: "  Alice@Example.com ", name: " Alice ", password: "password123", business: business() };

describe("auth:register", () => {
  test.each([
    [{ email: "not-an-email" }, "Enter a valid email address"],
    [{ password: "short" }, "Password must be at least 8 characters"],
    [{ name: "   " }, "Name is required"],
  ])("rejects invalid input %o", async (patch, message) => {
    const t = setup();
    await expect(t.action(api.auth.register, { ...creds, ...patch })).rejects.toThrow(message);
  });

  test("creates the account and its main business, with the creator as admin; emails are normalised", async () => {
    const t = setup();
    const { token } = await t.action(api.auth.register, creds);
    const me = await t.query(api.auth.me, { sessionToken: token });
    expect(me).toMatchObject({ email: "alice@example.com", name: "Alice" });
    const [b] = await t.run((ctx) => ctx.db.query("businesses").collect());
    expect(b).toMatchObject({
      name: "Kai Cafe", programme: "NP2", sectors: ["ece"], jurisdiction: "NZ", chilledMaxC: 5, ownerId: me!._id, archived: false,
    });
    const [m] = await t.run((ctx) => ctx.db.query("memberships").collect());
    expect(m).toMatchObject({ userId: me!._id, businessId: b._id, role: "admin", active: true });
    expect((await auditLog(t)).map((l) => l.summary)).toEqual([
      "Account created for alice@example.com",
      "Business Kai Cafe created (NP2)",
    ]);
  });

  test("needs a business unless the person was invited", async () => {
    const t = setup();
    await expect(t.action(api.auth.register, { ...creds, business: undefined })).rejects.toThrow(
      "Set up your business to create an account",
    );
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  });

  test("an invited person joins the inviting business with the invited role", async () => {
    const t = setup();
    const { businessId } = await signIn(t, "admin");
    await t.run((ctx) =>
      ctx.db.insert("invites", { businessId, email: "alice@example.com", role: "manager", invitedByName: "Admin 0", createdAt: 0 }),
    );
    const { token } = await t.action(api.auth.register, { ...creds, business: undefined });
    const me = (await t.query(api.auth.me, { sessionToken: token }))!;
    const mine = await t.run((ctx) => ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", me._id)).collect());
    expect(mine).toMatchObject([{ businessId, role: "manager", active: true }]);
    expect((await t.run((ctx) => ctx.db.query("invites").first()))?.acceptedAt).toEqual(expect.any(Number));
    expect((await auditLog(t)).at(-1)?.summary).toBe("Alice joined as manager (invited by Admin 0)");
  });

  test("an invite that was already accepted is not claimed again", async () => {
    const t = setup();
    const { businessId } = await signIn(t, "admin");
    await t.run((ctx) =>
      ctx.db.insert("invites", { businessId, email: "bob@x.com", role: "staff", invitedByName: "A", createdAt: 0, acceptedAt: 1 }),
    );
    await t.mutation(internal.auth.createUserAndSession, {
      email: "bob@x.com", name: "Bob", passwordHash: "", passwordSalt: "", token: "t2", business: business(),
    });
    const bob = (await t.query(api.auth.me, { sessionToken: "t2" }))!;
    const mine = await t.run((ctx) => ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", bob._id)).collect());
    expect(mine).toHaveLength(1);
    expect(mine[0].businessId).not.toBe(businessId);
  });

  test("rejects a duplicate email and sectors from another programme", async () => {
    const t = setup();
    await t.action(api.auth.register, creds);
    await expect(t.action(api.auth.register, creds)).rejects.toThrow("already exists");
    await expect(
      t.action(api.auth.register, { ...creds, email: "b@x.com", business: business({ sectors: ["honey"] }) }),
    ).rejects.toThrow("Not a NP2 sector: honey");
    await expect(
      t.action(api.auth.register, { ...creds, email: "c@x.com", business: business({ name: "  " }) }),
    ).rejects.toThrow("Business name is required");
  });

  test("me does not leak password fields", async () => {
    const t = setup();
    const { token } = await t.action(api.auth.register, creds);
    const me = await t.query(api.auth.me, { sessionToken: token });
    expect(Object.keys(me!).sort()).toEqual(["_id", "email", "name"]);
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
    const { token, businessId } = await signIn(t);
    await t.mutation(api.auth.logout, { sessionToken: "unknown" });
    expect(await auditLog(t)).toHaveLength(0);

    await t.mutation(api.auth.logout, { sessionToken: token });
    expect(await t.query(api.auth.me, { sessionToken: token })).toBeNull();
    expect((await auditLog(t))[0]).toMatchObject({ action: "logout", summary: "Admin 0 signed out" });
  });

  test("still logs out when the user record no longer exists", async () => {
    const t = setup();
    const { userId, token, businessId } = await signIn(t);
    await t.run((ctx) => ctx.db.delete(userId));
    await t.mutation(api.auth.logout, { sessionToken: token });
    expect((await auditLog(t))[0].summary).toBe("User signed out");
  });
});
