// Temperature checks, corrective actions, the audit trail and the dashboard summary.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { DAY, addSupplier, auditLog, cas, getDoc, item, setup, signIn } from "./helpers";

describe("temperature", () => {
  test("records a compliant reading", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    const r = await t.mutation(api.temperature.record, { sessionToken: token, businessId, unitName: "Walk-in", unitType: "chiller", temperatureC: 3 });
    expect(r.compliant).toBe(true);
    expect(await cas(t)).toHaveLength(0);
    expect((await auditLog(t))[0].summary).toBe("Walk-in: 3°C OK");
  });

  test("out-of-range readings need a corrective action and raise a high-severity CA", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    await expect(
      t.mutation(api.temperature.record, { sessionToken: token, businessId, unitName: "Bain", unitType: "hot_hold", temperatureC: 40, correctiveAction: " " }),
    ).rejects.toThrow("Out of range");
    const r = await t.mutation(api.temperature.record, {
      sessionToken: token, businessId, unitName: "Bain", unitType: "hot_hold", temperatureC: 40, correctiveAction: "Reheated to 75°C",
    });
    expect(r.compliant).toBe(false);
    const [ca] = await cas(t);
    expect(ca).toMatchObject({
      title: "Bain out of range (40°C)", description: "Reheated to 75°C", source: "temperature", sourceId: r.id, severity: "high",
    });
    expect((await auditLog(t)).map((l) => l.summary)).toEqual([
      "Auto-raised corrective action for Bain",
      "Bain: 40°C OUT OF RANGE",
    ]);
  });

  test("list is newest first; units lists each unit once with its latest type", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    const rec = (unitName: string, unitType: "chiller" | "freezer") =>
      t.mutation(api.temperature.record, { sessionToken: token, businessId, unitName, unitType, temperatureC: -20 });
    await rec("A", "chiller");
    await rec("B", "freezer");
    await rec("A", "freezer");
    expect((await t.query(api.temperature.list, { sessionToken: token, businessId })).map((l) => l.unitName)).toEqual(["A", "B", "A"]);
    expect(await t.query(api.temperature.units, { sessionToken: token, businessId })).toEqual([
      { unitName: "A", unitType: "freezer" },
      { unitName: "B", unitType: "freezer" },
    ]);
  });
});

describe("correctiveActions", () => {
  test("create requires a title and logs it as manual", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    await expect(t.mutation(api.correctiveActions.create, { sessionToken: token, businessId, title: " ", severity: "low" })).rejects.toThrow(
      "Title is required",
    );
    const id = await t.mutation(api.correctiveActions.create, { sessionToken: token, businessId, title: "Pest sighting", severity: "high" });
    expect(await getDoc(t, id)).toMatchObject({ source: "manual", status: "open", raisedByName: "Staff 0" });
    expect((await auditLog(t))[0].summary).toBe("Raised corrective action: Pest sighting");
  });

  test("list filters by status or returns everything newest first", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    const a = await t.mutation(api.correctiveActions.create, { sessionToken: token, businessId, title: "A", severity: "low" });
    await t.mutation(api.correctiveActions.create, { sessionToken: token, businessId, title: "B", severity: "low" });
    await t.mutation(api.correctiveActions.close, { sessionToken: token, businessId, id: a, resolution: "Fixed" });
    const titles = async (status?: "open" | "closed") =>
      (await t.query(api.correctiveActions.list, { sessionToken: token, businessId, status })).map((c) => c.title);
    expect(await titles("open")).toEqual(["B"]);
    expect(await titles("closed")).toEqual(["A"]);
    expect(await titles()).toEqual(["B", "A"]);
  });

  test("close requires a resolution, an existing open CA, and records who closed it", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    const id = await t.mutation(api.correctiveActions.create, { sessionToken: token, businessId, title: "A", severity: "low" });
    await expect(t.mutation(api.correctiveActions.close, { sessionToken: token, businessId, id, resolution: "" })).rejects.toThrow(
      "Describe how it was resolved",
    );
    await t.mutation(api.correctiveActions.close, { sessionToken: token, businessId, id, resolution: "Fixed" });
    expect(await getDoc(t, id)).toMatchObject({ status: "closed", resolution: "Fixed", closedByName: "Staff 0" });
    await expect(t.mutation(api.correctiveActions.close, { sessionToken: token, businessId, id, resolution: "Again" })).rejects.toThrow(
      "Already closed",
    );
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.correctiveActions.close, { sessionToken: token, businessId, id, resolution: "x" })).rejects.toThrow("Corrective action not found");
  });
});

describe("auditLog:list", () => {
  async function seeded() {
    const t = setup();
    const admin = await signIn(t, "admin");
    const staff = await signIn(t, "staff");
    await t.mutation(api.correctiveActions.create, { sessionToken: staff.token, businessId: staff.businessId, title: "By staff", severity: "low" });
    const sup = await t.mutation(api.suppliers.create, { sessionToken: admin.token, businessId: admin.businessId, name: "Acme", approved: true });
    await t.mutation(api.suppliers.update, { sessionToken: admin.token, businessId: admin.businessId, id: sup, phone: "1" });
    return { t, admin, staff, sup };
  }

  test("any user can read the history of a single entity", async () => {
    const { t, staff, sup } = await seeded();
    const rows = await t.query(api.auditLog.list, { sessionToken: staff.token, businessId: staff.businessId, entityType: "supplier", entityId: sup });
    expect(rows.map((r) => r.action)).toEqual(["update", "create"]);
  });

  test("the full trail is manager-only and can be filtered by user or type, and limited", async () => {
    const { t, admin, staff } = await seeded();
    await expect(t.query(api.auditLog.list, { sessionToken: staff.token, businessId: staff.businessId })).rejects.toThrow("requires");
    expect(await t.query(api.auditLog.list, { sessionToken: admin.token, businessId: admin.businessId })).toHaveLength(3);
    expect(await t.query(api.auditLog.list, { sessionToken: admin.token, businessId: admin.businessId, limit: 1 })).toHaveLength(1);
    const byStaff = await t.query(api.auditLog.list, { sessionToken: admin.token, businessId: admin.businessId, userId: staff.userId });
    expect(byStaff.map((r) => r.summary)).toEqual(["Raised corrective action: By staff"]);
    const suppliers = await t.query(api.auditLog.list, { sessionToken: admin.token, businessId: admin.businessId, entityType: "supplier" });
    expect(suppliers).toHaveLength(2);
  });
});

describe("dashboard:summary", () => {
  test("empty business", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "staff");
    expect(await t.query(api.dashboard.summary, { sessionToken: token, businessId })).toEqual({
      businessName: "Kai Cafe",
      jurisdiction: "NZ",
      programme: "NP2",
      deliveriesToday: 0,
      rejectionsToday: 0,
      tempChecksToday: 0,
      tempIssuesToday: 0,
      openCorrectiveActions: 0,
      highSeverityOpen: 0,
      expiringSoon: 0,
      expired: 0,
      stockLines: 0,
      onHold: 0,
      lowStock: 0,
      inProgressAudits: 0,
    });
  });

  test("counts today's activity, open CAs, expiring stock and in-progress audits", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "manager");
    const supplierId = await addSupplier(t);
    const now = Date.now();
    const deliver = (items: ReturnType<typeof item>[], receivedAt = now) =>
      t.mutation(api.deliveries.create, { sessionToken: token, businessId, supplierId, vehicleClean: true, receivedAt, items });
    await deliver([item({ useBy: now - DAY })]); // expired => high CA
    await deliver([item({ accepted: false, rejectionReason: "x" })]); // rejected => medium CA
    await deliver([item({ useBy: undefined, bestBefore: now + DAY })]);
    await deliver([item({ useBy: undefined })]); // undated, never "expiring"
    await deliver([item()], now - 2 * DAY); // before dayStart
    const voided = await deliver([item()]);
    await t.mutation(api.deliveries.voidDelivery, { sessionToken: token, businessId, id: voided, reason: "dup" });
    await t.mutation(api.temperature.record, { sessionToken: token, businessId, unitName: "F", unitType: "freezer", temperatureC: -20 });
    await t.mutation(api.temperature.record, { sessionToken: token, businessId, unitName: "F", unitType: "freezer", temperatureC: 0, correctiveAction: "Moved" });
    await t.mutation(api.audits.start, { sessionToken: token, businessId, templateKey: "hygiene" });
    const done = await t.mutation(api.audits.start, { sessionToken: token, businessId, templateKey: "hygiene" });
    await t.run((ctx) => ctx.db.patch(done, { status: "completed" }));

    const s = await t.query(api.dashboard.summary, { sessionToken: token, businessId, dayStart: now - DAY / 2 });
    expect(s).toMatchObject({
      deliveriesToday: 4,
      rejectionsToday: 1,
      tempChecksToday: 2,
      tempIssuesToday: 1,
      openCorrectiveActions: 3,
      highSeverityOpen: 2,
      expiringSoon: 2, // past use-by + best-before tomorrow; default use-by (5 days) is outside the 3-day window
      expired: 1,
      stockLines: 4, // the rejected and voided lines never became stock
      onHold: 0,
      lowStock: 0,
      inProgressAudits: 1,
    });
  });
});
