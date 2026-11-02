// The test accounts (convex/seed.ts): every account builds cleanly through the app's own mutations.
import { afterEach, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { SEED_PASSWORD } from "../convex/seed";
import { setup } from "./helpers";

declare const process: { env: Record<string, string | undefined> };

afterEach(() => {
  delete process.env.SEED_ALLOWED;
});

test("refuses to run unless the deployment allows it", async () => {
  delete process.env.SEED_ALLOWED;
  const t = setup();
  await expect(t.action(internal.seed.run, { confirm: "wipe everything" })).rejects.toThrow("Seeding is turned off");
  await expect(t.mutation(internal.seed.wipeTable, { table: "users" })).rejects.toThrow("Seeding is turned off");
});

test("seeds every account, with history, and they can sign in", { timeout: 600_000 }, async () => {
  process.env.SEED_ALLOWED = "true";
  const t = setup();
  const { accounts } = await t.action(internal.seed.run, { confirm: "wipe everything" });
  expect(accounts).toContain("full@jampacked.test");
  const { token } = await t.action(api.auth.login, { email: "full@jampacked.test", password: SEED_PASSWORD });
  const mine = await t.query(api.businesses.mine, { sessionToken: token });
  expect(mine.map((b) => [b.name, b.operation, b.archived])).toEqual([
    ["Fiona's Farm Shop", "farm", false],
    ["Harbour Kitchen & Farm", "mixed", false],
    ["Old Town Café", "kitchen", true],
  ]);
  const as = { sessionToken: token, businessId: mine[1]._id };
  const runs = await t.query(api.production.list, { ...as, limit: 500 });
  expect(runs.some((r) => r.kind === "harvest")).toBe(true);
  expect(runs.some((r) => r.voided)).toBe(true);
  expect(Math.min(...runs.map((r) => r.madeAt))).toBeLessThan(Date.now() - 30 * 86_400_000);
  expect((await t.query(api.production.planned, as)).length).toBeGreaterThan(0);
  const insights = await t.query(api.analytics.insights, as);
});
