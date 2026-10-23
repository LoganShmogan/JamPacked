/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { Doc, Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

export const modules = import.meta.glob("../convex/**/*.*s");

export const DAY = 86_400_000;

/** A fresh in-memory Convex backend for one test. */
export const setup = () => convexTest(schema, modules);
export type T = ReturnType<typeof setup>;

/**
 * Inserts a user plus a live session directly (skipping PBKDF2, which is slow and
 * covered by the auth tests), and makes them a member of the test's business with `role`.
 * Every user signed in on the same `t` shares one business (created on first use), unless
 * `businessId` is given. Returns the user id, the session token to pass as `sessionToken`
 * and the business id to pass as `businessId`.
 */
export async function signIn(
  t: T,
  role: Doc<"memberships">["role"] = "admin",
  overrides: Partial<Omit<Doc<"users">, "_id" | "_creationTime">> = {},
  businessId?: Id<"businesses">,
) {
  return await t.run(async (ctx) => {
    const n = (await ctx.db.query("users").collect()).length;
    const userId = await ctx.db.insert("users", {
      email: `${role}${n}@example.com`,
      name: `${role[0].toUpperCase()}${role.slice(1)} ${n}`,
      passwordHash: "x",
      passwordSalt: "00",
      active: true,
      createdAt: Date.now(),
      ...overrides,
    });
    const bid =
      businessId ??
      (await ctx.db.query("businesses").first())?._id ??
      (await ctx.db.insert("businesses", { ...BUSINESS, ownerId: userId, createdAt: Date.now() }));
    await ctx.db.insert("memberships", { userId, businessId: bid, role, active: true, createdAt: Date.now() });
    const token = `token-${role}-${n}`;
    await ctx.db.insert("sessions", { userId, token, expiresAt: Date.now() + DAY });
    return { userId, token, businessId: bid };
  });
}

/** A second, separate business (for isolation tests). */
export async function addBusiness(t: T, ownerId: Id<"users">, overrides: Partial<Doc<"businesses">> = {}) {
  return await t.run((ctx) =>
    ctx.db.insert("businesses", { ...BUSINESS, name: "Other Co", ownerId, createdAt: Date.now(), ...overrides }),
  );
}

export const BUSINESS = {
  name: "Kai Cafe",
  jurisdiction: "NZ" as const,
  chilledMaxC: 5,
  frozenMaxC: -15,
  hotMinC: 60,
  expiryWarningDays: 3,
  programme: "NP2" as const,
  sectors: [],
  archived: false,
};

export async function addSupplier(t: T, overrides: Partial<Doc<"suppliers">> = {}) {
  return await t.run(async (ctx) =>
    ctx.db.insert("suppliers", {
      businessId: (await ctx.db.query("businesses").first())?._id,
      name: "Fresh Foods Ltd",
      approved: true,
      active: true,
      createdAt: Date.now(),
      ...overrides,
    }),
  );
}

/** A valid delivery line item; override what the test cares about. */
export const item = (overrides: Record<string, unknown> = {}) => ({
  productName: "Milk 2L",
  quantity: 6,
  unit: "ea",
  storageType: "chilled" as const,
  temperatureC: 3,
  batchCode: "B1",
  useBy: Date.now() + 5 * DAY,
  packagingOk: true,
  labelOk: true,
  allergens: ["milk"],
  accepted: true,
  ...overrides,
});

/** The business shared by everyone signed in on `t`. */
export const firstBusiness = (t: T) => t.run(async (ctx) => (await ctx.db.query("businesses").first())!._id);

export const auditLog = (t: T) => t.run((ctx) => ctx.db.query("auditLog").collect());
export const cas = (t: T) => t.run((ctx) => ctx.db.query("correctiveActions").collect());
export const getDoc = <Tbl extends "users" | "deliveries" | "audits" | "suppliers" | "products" | "correctiveActions" | "settings" | "businesses" | "memberships">(
  t: T,
  id: Id<Tbl>,
) => t.run((ctx) => ctx.db.get(id));
