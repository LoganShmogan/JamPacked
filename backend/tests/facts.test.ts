// The audit auto-fill engine (convex/lib/facts.ts), driven with raw rows so each rule is isolated.
import { describe, expect, test } from "vitest";
import { Doc, Id } from "../convex/_generated/dataModel";
import { computeFacts } from "../convex/lib/facts";
import { TEMPLATES } from "../convex/lib/templates";
import { DAY, T, addSupplier, setup, signIn } from "./helpers";

type ItemRow = Partial<Omit<Doc<"deliveryItems">, "_id" | "_creationTime">>;

async function world() {
  const t = setup();
  const { userId } = await signIn(t, "staff");
  const supplierId = await addSupplier(t);
  const now = Date.now();
  return { t, userId, supplierId, now };
}

async function delivery(
  t: T,
  base: { userId: Id<"users">; supplierId: Id<"suppliers"> },
  opts: { receivedAt: number; supplierName?: string; supplierApproved?: boolean; vehicleClean?: boolean; voided?: boolean },
  items: ItemRow[] = [],
) {
  return await t.run(async (ctx) => {
    const deliveryId = await ctx.db.insert("deliveries", {
      supplierId: base.supplierId,
      supplierName: opts.supplierName ?? "Fresh Foods",
      supplierApproved: opts.supplierApproved ?? true,
      vehicleClean: opts.vehicleClean ?? true,
      receivedAt: opts.receivedAt,
      status: "accepted",
      receivedById: base.userId,
      receivedByName: "S",
      voided: opts.voided ?? false,
    });
    for (const i of items) {
      await ctx.db.insert("deliveryItems", {
        deliveryId,
        receivedAt: opts.receivedAt,
        supplierId: base.supplierId,
        productName: "Milk",
        batchCode: "B1",
        quantity: 1,
        unit: "ea",
        useBy: opts.receivedAt + 5 * DAY,
        storageType: "chilled",
        temperatureC: 3,
        temperatureCompliant: true,
        packagingOk: true,
        labelOk: true,
        allergens: [],
        accepted: true,
        voided: opts.voided ?? false,
        ...i,
      });
    }
  });
}

const facts = (t: T, start: number, end: number, tz?: number) => t.run((ctx) => computeFacts(ctx, start, end, tz));

describe("computeFacts", () => {
  test("produces a fact for every auto-fill key used by the templates", async () => {
    const { t, now } = await world();
    const f = await facts(t, now - DAY, now);
    const keys = TEMPLATES.flatMap((tpl) => tpl.questions.map((q) => q.autoFill)).filter(Boolean);
    for (const k of keys) expect(f).toHaveProperty(k!);
  });

  test("an empty period: counts are zero and record-based checks are unanswered", async () => {
    const { t, now } = await world();
    const f = await facts(t, now - 2 * DAY, now);
    expect(f["gi.count"]).toEqual({ value: 0, evidence: "0 deliveries, 0 line items (0 rejected)" });
    for (const k of ["gi.allApprovedSuppliers", "gi.vehiclesClean"]) {
      expect(f[k]).toEqual({ value: null, evidence: "No deliveries recorded in this period" });
    }
    for (const k of ["gi.tempChecked", "gi.tempCompliant"]) {
      expect(f[k].evidence).toBe("No temperature-controlled deliveries recorded in this period");
    }
    for (const k of ["gi.packagingLabels", "gi.noExpiredAccepted", "gi.traceable"]) {
      expect(f[k].evidence).toBe("No accepted goods recorded in this period");
    }
    expect(f["temp.compliant"].value).toBeNull();
    expect(f["gi.rejectionsHandled"]).toEqual({ value: true, evidence: "No rejections" });
    expect(f["gi.rejectionRate"].value).toBe(0);
    expect(f["gi.allergens"].value).toBe("None recorded");
    expect(f["stock.noExpired"]).toEqual({ value: true, evidence: "No received stock is past its use-by" });
    expect(f["temp.count"].value).toBe(0);
    expect(f["temp.daily"].value).toBe(false);
    expect(f["ca.allClosed"]).toEqual({ value: true, evidence: "No open corrective actions" });
  });

  test("a clean period passes every check", async () => {
    const { t, userId, supplierId, now } = await world();
    await delivery(t, { userId, supplierId }, { receivedAt: now - 1000 }, [
      { allergens: ["milk"] },
      { productName: "Flour", storageType: "ambient", temperatureC: undefined, temperatureCompliant: null, allergens: ["gluten", "milk"], useBy: undefined, bestBefore: now + 90 * DAY },
    ]);
    await delivery(t, { userId, supplierId }, { receivedAt: now - 500, voided: true }, [{ productName: "Voided" }]);
    await t.run((ctx) =>
      ctx.db.insert("temperatureLogs", {
        checkedAt: now - 100, unitName: "C1", unitType: "chiller", temperatureC: 3, compliant: true, checkedById: userId, checkedByName: "S",
      }),
    );
    const f = await facts(t, now - 2000, now);
    expect(f["gi.count"].evidence).toBe("1 deliveries, 2 line items (0 rejected)");
    expect(f["gi.allApprovedSuppliers"]).toEqual({ value: true, evidence: "1 supplier(s), all approved" });
    expect(f["gi.tempChecked"]).toEqual({ value: true, evidence: "1 temperature readings recorded" });
    expect(f["gi.tempCompliant"]).toEqual({ value: true, evidence: "All within limits (chilled ≤5°C, frozen ≤-15°C, hot ≥60°C)" });
    expect(f["gi.packagingLabels"]).toEqual({ value: true, evidence: "2 items checked OK" });
    expect(f["gi.noExpiredAccepted"]).toEqual({ value: true, evidence: "No expired goods accepted" });
    expect(f["gi.traceable"]).toEqual({ value: true, evidence: "2 items fully traceable" });
    expect(f["gi.vehiclesClean"]).toEqual({ value: true, evidence: "All vehicles clean" });
    expect(f["gi.allergens"]).toEqual({ value: "gluten, milk", evidence: "From 2 accepted items" });
    expect(f["temp.compliant"]).toEqual({ value: true, evidence: "1 checks all within limits" });
    expect(f["temp.daily"]).toEqual({ value: true, evidence: "Checks recorded every day" });
  });

  test("a problem period fails each check with evidence naming the culprits", async () => {
    const { t, userId, supplierId, now } = await world();
    const at = now - 1000;
    await delivery(t, { userId, supplierId }, { receivedAt: at, supplierName: "Shady", supplierApproved: false, vehicleClean: false }, [
      { productName: "NoTemp", temperatureC: undefined, temperatureCompliant: false },
      { productName: "Warm", temperatureC: 9, temperatureCompliant: false },
      { productName: "Torn", packagingOk: false },
      { productName: "Unlabelled", labelOk: false },
      { productName: "Expired", useBy: at - DAY },
      { productName: "NoBatch", batchCode: undefined },
      { productName: "NoDate", useBy: undefined },
      { productName: "Rejected", accepted: false, rejectionReason: "Smelly" },
      { productName: "RejectedNoReason", accepted: false },
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("temperatureLogs", {
        checkedAt: at, unitName: "F1", unitType: "freezer", temperatureC: -2, compliant: false, correctiveAction: "Moved stock",
        checkedById: userId, checkedByName: "S",
      });
      await ctx.db.insert("temperatureLogs", {
        checkedAt: at, unitName: "F2", unitType: "freezer", temperatureC: 0, compliant: false, checkedById: userId, checkedByName: "S",
      });
      await ctx.db.insert("correctiveActions", {
        title: "Open one", source: "manual", severity: "low", status: "open", raisedAt: at, raisedById: userId, raisedByName: "S",
      });
    });
    const f = await facts(t, now - 2000, now);
    expect(f["gi.allApprovedSuppliers"]).toEqual({ value: false, evidence: "Unapproved: Shady" });
    expect(f["gi.tempChecked"]).toEqual({ value: false, evidence: "Missing: NoTemp" });
    expect(f["gi.tempCompliant"]).toEqual({ value: false, evidence: "Out of range: NoTemp ?°C; Warm 9°C" });
    expect(f["gi.packagingLabels"]).toEqual({ value: false, evidence: "Issues: Torn; Unlabelled" });
    expect(f["gi.noExpiredAccepted"]).toEqual({ value: false, evidence: "Expired on receipt: Expired" });
    expect(f["gi.traceable"]).toEqual({ value: false, evidence: "Missing batch/date: NoBatch; NoDate" });
    expect(f["gi.vehiclesClean"].value).toBe(false);
    expect(f["gi.vehiclesClean"].evidence).toMatch(/^Not clean: Shady \d{4}-\d{2}-\d{2}$/);
    expect(f["gi.rejectionsHandled"]).toEqual({
      value: false,
      evidence: "2 rejected: Rejected (Smelly); RejectedNoReason (no reason)",
    });
    expect(f["gi.rejectionRate"]).toEqual({ value: 22.2, evidence: "2 of 9 line items rejected" });
    expect(f["stock.noExpired"].value).toBe(false);
    expect(f["stock.noExpired"].evidence).toMatch(/^Past use-by: Expired \(\d{4}-\d{2}-\d{2}\)$/);
    expect(f["temp.compliant"]).toEqual({ value: false, evidence: "Out of range: F1 -2°C → Moved stock; F2 0°C → " });
    expect(f["temp.count"]).toEqual({ value: 2, evidence: "2 checks, 2 out of range" });
    expect(f["ca.allClosed"]).toEqual({ value: false, evidence: "1 open: Open one" });
  });

  test("long lists are truncated after five names", async () => {
    const { t, userId, supplierId, now } = await world();
    await delivery(
      t,
      { userId, supplierId },
      { receivedAt: now - 1000 },
      ["A", "B", "C", "D", "E", "F", "G"].map((productName) => ({ productName, packagingOk: false })),
    );
    const f = await facts(t, now - 2000, now);
    expect(f["gi.packagingLabels"].evidence).toBe("Issues: A; B; C; D; E (+2 more)");
  });

  test("temp.daily lists missing local days, using the time zone offset", async () => {
    const { t, userId } = await world();
    const start = Date.UTC(2020, 0, 1);
    await t.run((ctx) =>
      ctx.db.insert("temperatureLogs", {
        checkedAt: start + 11 * 3_600_000, // 11:00 UTC on 1 Jan = 00:00 on 2 Jan at UTC+13
        unitName: "C", unitType: "chiller", temperatureC: 2, compliant: true, checkedById: userId, checkedByName: "S",
      }),
    );
    expect((await facts(t, start, start + 2 * DAY))["temp.daily"]).toEqual({
      value: false,
      evidence: "No checks on: 2020-01-02; 2020-01-03",
    });
    expect((await facts(t, start, start + 2 * DAY, 13 * 60))["temp.daily"]).toEqual({
      value: false,
      evidence: "No checks on: 2020-01-01; 2020-01-03",
    });
  });
});
