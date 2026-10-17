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
 * covered by the auth tests). Returns the user id and the session token to pass as
 * `sessionToken`.
 */
export async function signIn(
  t: T,
  role: Doc<"users">["role"] = "admin",
  overrides: Partial<Omit<Doc<"users">, "_id" | "_creationTime">> = {},
) {
  return await t.run(async (ctx) => {
    const n = (await ctx.db.query("users").collect()).length;
    const userId = await ctx.db.insert("users", {
      email: `${role}${n}@example.com`,
      name: `${role[0].toUpperCase()}${role.slice(1)} ${n}`,
      role,
      passwordHash: "x",
      passwordSalt: "00",
      active: true,
      createdAt: Date.now(),
      ...overrides,
    });
    const token = `token-${role}-${n}`;
    await ctx.db.insert("sessions", { userId, token, expiresAt: Date.now() + DAY });
    return { userId, token };
  });
}

export async function addSupplier(t: T, overrides: Partial<Doc<"suppliers">> = {}) {
  return await t.run((ctx) =>
    ctx.db.insert("suppliers", {
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

export const auditLog = (t: T) => t.run((ctx) => ctx.db.query("auditLog").collect());
export const cas = (t: T) => t.run((ctx) => ctx.db.query("correctiveActions").collect());
export const getDoc = <Tbl extends "users" | "deliveries" | "audits" | "suppliers" | "products" | "correctiveActions" | "settings">(
  t: T,
  id: Id<Tbl>,
) => t.run((ctx) => ctx.db.get(id));
