// Usage analytics: task timings from the app, a business's Insights numbers, and timings on the owner dashboard.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { MAX_MS, MIN_MS, median } from "../convex/analytics";
import { DAY, addBusiness, addSupplier, auditLog, item, setup, signIn } from "./helpers";

const timings = (t: ReturnType<typeof setup>) => t.run((ctx) => ctx.db.query("taskTimings").collect());

describe("median", () => {
  test("odd, even and empty", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("analytics:recordTask", () => {
  test("stores a timing for the member's business, without an audit-log entry", async () => {
    const t = setup();
    const { token, businessId, userId } = await signIn(t, "staff");
    expect(await t.mutation(api.analytics.recordTask, { sessionToken: token, businessId, task: "goodsIn", durationMs: 90_400.6 })).toBe(true);
    expect(await timings(t)).toMatchObject([{ businessId, userId, task: "goodsIn", durationMs: 90_401 }]);
    expect(await auditLog(t)).toEqual([]);
  });

  test("drops double taps and forms left open", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t);
    for (const durationMs of [MIN_MS - 1, MAX_MS + 1, Number.NaN]) {
      expect(await t.mutation(api.analytics.recordTask, { sessionToken: token, businessId, task: "record", durationMs })).toBe(false);
    }
    expect(await t.mutation(api.analytics.recordTask, { sessionToken: token, businessId, task: "record", durationMs: MIN_MS })).toBe(true);
    expect(await t.mutation(api.analytics.recordTask, { sessionToken: token, businessId, task: "record", durationMs: MAX_MS })).toBe(true);
    expect(await timings(t)).toHaveLength(2);
  });

  test("needs to be a member of the business", async () => {
    const t = setup();
    const { token, userId } = await signIn(t);
    const other = await addBusiness(t, userId);
    await expect(
      t.mutation(api.analytics.recordTask, { sessionToken: token, businessId: other, task: "goodsIn", durationMs: 5_000 }),
    ).rejects.toThrow("You don't have access");
  });
});

describe("analytics:insights", () => {
  test("business totals for the period, and task times for the business and for me", async () => {
    const t = setup();
    const me = await signIn(t, "staff");
    const them = await signIn(t, "manager");
    const as = { sessionToken: me.token, businessId: me.businessId };
    const supplierId = await addSupplier(t);

    // A delivery with one rejected line, and a voided one that doesn't count.
    await t.mutation(api.deliveries.create, {
      ...as, supplierId, vehicleClean: true,
      items: [item({ batchCode: "F1" }), item({ productName: "Bad", accepted: false, rejectionReason: "Warm" })],
    });
    const voided = await t.mutation(api.deliveries.create, { ...as, supplierId, vehicleClean: true, items: [item()] });
    await t.mutation(api.deliveries.voidDelivery, { sessionToken: them.token, businessId: me.businessId, id: voided, reason: "Typo" });
    const lot = (await t.run((ctx) => ctx.db.query("stockLots").collect())).find((l) => l.batchCode === "F1")!;
    await t.mutation(api.stock.move, { ...as, lotId: lot._id, type: "waste", qty: 1, reason: "Dropped" });
    await t.mutation(api.stock.move, { ...as, lotId: lot._id, type: "dispatch", qty: 1, customer: "Cafe" });
    await t.mutation(api.production.create, { ...as, productName: "Custard", qty: 1, unit: "L", inputs: [{ lotId: lot._id, qty: 1 }] });
    await t.mutation(api.temperature.record, { ...as, unitName: "Chiller", unitType: "chiller", temperatureC: 3 });
    await t.mutation(api.temperature.record, { ...as, unitName: "Chiller", unitType: "chiller", temperatureC: 9, correctiveAction: "Moved stock" });

    // Corrective actions: one closed after 2 hours, plus the open ones raised automatically above.
    const ca = (await t.run((ctx) => ctx.db.query("correctiveActions").collect()))[0];
    await t.run(async (ctx) => {
      await ctx.db.patch(ca._id, { status: "closed", closedAt: ca.raisedAt + 2 * 3_600_000, closedByName: "X", resolution: "Done" });
      // A record, and a voided record, made directly.
      for (const voidedRecord of [false, true]) {
        await ctx.db.insert("records", {
          businessId: me.businessId, programme: "NP2", recordType: "pest", recordName: "Pest check", values: {}, issues: [],
          at: Date.now(), byId: me.userId, byName: "Staff", voided: voidedRecord,
        });
      }
      // Old activity outside the period doesn't count.
      await ctx.db.insert("taskTimings", { businessId: me.businessId, userId: me.userId, task: "goodsIn", durationMs: 999_999, at: Date.now() - 40 * DAY });
    });

    for (const [who, durationMs] of [[me, 60_000], [me, 120_000], [them, 300_000]] as const) {
      await t.mutation(api.analytics.recordTask, { sessionToken: who.token, businessId: me.businessId, task: "goodsIn", durationMs });
    }

    const i = await t.query(api.analytics.insights, as);
    expect(i).toMatchObject({
      days: 30,
      deliveries: 1,
      itemsReceived: 2,
      itemsRejected: 1,
      batchesMade: 1,
      temperatureChecks: 2,
      temperatureInRange: 1,
      records: 1,
      wasteMovements: 1,
      dispatches: 1,
      correctiveActions: { closed: 1, medianHoursToClose: 2 },
    });
    expect(i.correctiveActions.raised).toBeGreaterThan(1);
    expect(i.tasks).toEqual([
      { task: "goodsIn", count: 3, medianMs: 120_000, myCount: 2, myMedianMs: 90_000 },
      { task: "production", count: 0, medianMs: null, myCount: 0, myMedianMs: null },
      { task: "temperature", count: 0, medianMs: null, myCount: 0, myMedianMs: null },
      { task: "record", count: 0, medianMs: null, myCount: 0, myMedianMs: null },
    ]);
    // The other person sees the same business numbers but their own times.
    const theirs = await t.query(api.analytics.insights, { sessionToken: them.token, businessId: me.businessId });
    expect(theirs.tasks[0]).toMatchObject({ count: 3, myCount: 1, myMedianMs: 300_000 });
  });

  test("the period is 7 to 365 days; an empty business has nothing", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t);
    expect((await t.query(api.analytics.insights, { sessionToken: token, businessId, days: 1 })).days).toBe(7);
    expect((await t.query(api.analytics.insights, { sessionToken: token, businessId, days: 9999 })).days).toBe(365);
    const i = await t.query(api.analytics.insights, { sessionToken: token, businessId, days: 90.4 });
    expect(i).toMatchObject({ days: 90, deliveries: 0, correctiveActions: { raised: 0, closed: 0, medianHoursToClose: null } });
  });
});

describe("platform:overview task times", () => {
  test("medians across businesses for the last 30 days", async () => {
    const t = setup();
    const admin = await signIn(t, "admin", { platformAdmin: true });
    const other = await signIn(t, "admin", {}, await addBusiness(t, admin.userId));
    await t.mutation(api.analytics.recordTask, { sessionToken: admin.token, businessId: admin.businessId, task: "temperature", durationMs: 10_000 });
    await t.mutation(api.analytics.recordTask, { sessionToken: other.token, businessId: other.businessId, task: "temperature", durationMs: 30_000 });
    await t.run((ctx) =>
      ctx.db.insert("taskTimings", { businessId: admin.businessId, userId: admin.userId, task: "temperature", durationMs: 1, at: Date.now() - 31 * DAY }),
    );
    const o = await t.query(api.platform.overview, { sessionToken: admin.token });
    expect(o.taskTimes).toContainEqual({ task: "temperature", count: 2, medianMs: 20_000, businesses: 2 });
    expect(o.taskTimes).toContainEqual({ task: "goodsIn", count: 0, medianMs: null, businesses: 0 });
  });
});
