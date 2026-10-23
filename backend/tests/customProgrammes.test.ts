// Custom programmes: build your own receiving checks, records and checklists, and use them across businesses.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { validateParts } from "../convex/customProgrammes";
import { customModule } from "../convex/lib/module";
import { BUILT_IN_MODULES } from "../convex/lib/programmes";
import { addBusiness, addSupplier, auditLog, cas, getDoc, item, setup, signIn } from "./helpers";

const field = (o: Record<string, unknown> = {}) => ({ key: "temp", label: "Temperature", type: "number" as const, ...o });
const recordType = (o: Record<string, unknown> = {}) => ({
  key: "oil", name: "Fryer oil", description: "Check the oil", fields: [field()], ...o,
});
const checklist = (o: Record<string, unknown> = {}) => ({
  key: "weekly_walk", name: "Weekly walk", description: "Walk round", defaultPeriodDays: 7,
  questions: [{ id: "q1", section: "Kitchen", text: "Clean?", type: "yesno" as const }], ...o,
});
const parts = (o: Record<string, unknown> = {}) => ({
  receivingPrompts: [{ key: "p1", text: "Seal intact" }], recordTypes: [recordType()], templates: [checklist()], ...o,
});

describe("validateParts", () => {
  test.each([
    [{ receivingPrompts: [{ key: " ", text: "x" }] }, "Every receiving check needs a key"],
    [{ receivingPrompts: [{ key: "a", text: "x" }, { key: "a", text: "y" }] }, 'Two receiving checks share the key "a"'],
    [{ receivingPrompts: [{ key: "a", text: " " }] }, "Receiving checks need some text"],
    [{ recordTypes: [recordType({ name: " " })] }, "Records need a name"],
    [{ recordTypes: [recordType({ fields: [] })] }, "Fryer oil needs at least one field"],
    [{ recordTypes: [recordType({ fields: [field(), field()] })] }, 'Two Fryer oil fields share the key "temp"'],
    [{ recordTypes: [recordType({ fields: [field({ label: "" })] })] }, "Fryer oil: every field needs a label"],
    [{ recordTypes: [recordType({ fields: [field({ failIf: { above: 180, message: " " } })] })] }, "Fryer oil: Temperature needs a problem message"],
    [{ templates: [checklist({ key: "hygiene" })] }, '"hygiene" is a built-in audit; choose another key'],
    [{ templates: [checklist({ name: "" })] }, "Checklists need a name"],
    [{ templates: [checklist({ questions: [] })] }, "Weekly walk needs at least one question"],
    [{ templates: [checklist({ defaultPeriodDays: 0 })] }, "Weekly walk: the period must be at least 1 day"],
    [{ templates: [checklist({ questions: [{ id: "q", section: "s", text: "", type: "yesno" }] })] }, "Weekly walk: every question needs text"],
    [{ templates: [checklist({ questions: [{ id: "q", section: "s", text: "a", type: "yesno" }, { id: "q", section: "s", text: "b", type: "yesno" }] })] }, 'Two Weekly walk questions share the key "q"'],
  ])("rejects %o", (patch, message) => {
    expect(() => validateParts(parts(patch) as never)).toThrow(message);
  });

  test("accepts a complete programme", () => {
    expect(() => validateParts(parts() as never)).not.toThrow();
  });
});

describe("customModule", () => {
  test("builds a schedule from frequencies and the daily chilled check", () => {
    const m = customModule({
      name: "My plan", dailyChilledCheck: true, receivingPrompts: [],
      recordTypes: [recordType({ frequency: "daily" }), recordType({ key: "x", name: "X" })],
      templates: [checklist({ frequency: "weekly" }), checklist({ key: "y", name: "Y" })],
    } as never);
    expect(m.name).toBe("My plan");
    expect(m.recordTypes[0].card).toBe("My plan");
    expect(m.templates[0].standardRef).toBe("Custom programme: My plan");
    expect(m.schedule.map((s) => [s.key, s.frequency])).toEqual([
      ["chilled_check", "daily"],
      ["record:oil", "daily"],
      ["audit:weekly_walk", "weekly"],
    ]);
    expect(customModule(null)).toEqual({
      key: "custom", name: "Custom programme", receivingPrompts: [], recordTypes: [], templates: [], schedule: [],
    });
    expect(customModule({ name: "Bare", dailyChilledCheck: false, receivingPrompts: [], recordTypes: [], templates: [] } as never).schedule).toEqual([]);
  });
});

describe("customProgrammes", () => {
  test("create blank, put it on a business, edit it, and the business follows it", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const as = { sessionToken: token, businessId };
    const id = await t.mutation(api.customProgrammes.create, { sessionToken: token, name: " Our plan ", businessId });
    expect(await getDoc(t, businessId)).toMatchObject({ programme: "custom", customProgrammeId: id, sectors: [] });
    expect(await t.query(api.programmes.current, as)).toMatchObject({
      key: "custom", name: "Our plan", customProgrammeId: id, ownsProgramme: true, recordTypes: [], schedule: [{ key: "chilled_check" }],
    });

    await t.mutation(api.customProgrammes.update, { sessionToken: token, id, ...parts(), description: "Ours" });
    const m = await t.query(api.programmes.current, as);
    expect(m.recordTypes.map((r) => r.key)).toEqual(["oil"]);
    expect(m.receivingPrompts).toEqual([{ key: "p1", text: "Seal intact" }]);
    expect(m.templates).toMatchObject([{ key: "weekly_walk", questionCount: 1 }]);

    // Its parts work everywhere a programme's do.
    await t.mutation(api.records.create, { ...as, recordType: "oil", values: { temp: 175 } });
    expect((await t.query(api.records.list, as))[0]).toMatchObject({ programme: "custom", recordName: "Fryer oil" });
    const auditId = await t.mutation(api.audits.start, { ...as, templateKey: "weekly_walk" });
    expect((await t.query(api.audits.get, { ...as, id: auditId }))?.standardRef).toBe("Custom programme: Our plan");
    const supplierId = await addSupplier(t);
    await t.mutation(api.deliveries.create, {
      ...as, supplierId, vehicleClean: true, items: [item()], programmeAnswers: [{ key: "p1", value: false }],
    });
    expect((await cas(t)).map((c) => c.title)).toEqual(["Receiving check failed: Seal intact"]);

    const log = (await auditLog(t)).filter((l) => l.entityType === "customProgramme" || l.entityType === "settings").map((l) => l.summary);
    expect(log.slice(0, 2)).toEqual(["Now following custom programme Our plan", "Created custom programme Our plan"]);
    // Convex doesn't keep argument order, so check the edited parts without relying on it.
    expect(log[2]).toMatch(/^Edited custom programme Our plan \(/);
    for (const k of ["description", "receivingPrompts", "recordTypes", "templates"]) expect(log[2]).toContain(k);
  });

  test("copy from a built-in programme, then reuse it on another business", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const id = await t.mutation(api.customProgrammes.create, { sessionToken: token, name: "Based on NP3", copyFrom: "NP3" });
    const p = (await t.query(api.customProgrammes.get, { sessionToken: token, id }))!;
    const np3 = BUILT_IN_MODULES.NP3;
    expect(p.recordTypes.map((r) => r.key)).toEqual(np3.recordTypes.map((r) => r.key));
    expect(p.recordTypes[0]).not.toHaveProperty("card");
    expect(p.templates.map((x) => x.key)).toEqual(["custom_np3_self_check"]);
    expect(p.templates[0].questions.find((q) => q.id === "sc3")?.autoFill).toBe("gi.allApprovedSuppliers");
    expect(p.templates[0].questions.some((q) => "sectors" in q)).toBe(false);
    expect(p.dailyChilledCheck).toBe(true);
    // Not on a business until you say so.
    expect((await getDoc(t, businessId))?.programme).toBe("NP2");

    const second = await t.mutation(api.businesses.create, { sessionToken: token, name: "Second", programme: "NP1" });
    await t.mutation(api.customProgrammes.useForBusiness, { sessionToken: token, businessId: second, id });
    await t.mutation(api.customProgrammes.useForBusiness, { sessionToken: token, businessId, id });
    expect(await t.query(api.customProgrammes.mine, { sessionToken: token })).toEqual([
      { _id: id, name: "Based on NP3", records: np3.recordTypes.length, checklists: 1, receivingChecks: 3, usedBy: ["Kai Cafe", "Second"] },
    ]);
  });

  test("only the owner can see or change a programme; admins only assign; names are required", async () => {
    const t = setup();
    const owner = await signIn(t, "admin");
    const id = await t.mutation(api.customProgrammes.create, { sessionToken: owner.token, name: "Mine" });
    const other = await signIn(t, "admin", {}, await addBusiness(t, owner.userId));
    expect(await t.query(api.customProgrammes.get, { sessionToken: other.token, id })).toBeNull();
    await expect(t.mutation(api.customProgrammes.update, { sessionToken: other.token, id, name: "Hijack" })).rejects.toThrow(
      "Programme not found",
    );
    await expect(
      t.mutation(api.customProgrammes.useForBusiness, { sessionToken: other.token, businessId: other.businessId, id }),
    ).rejects.toThrow("Programme not found");
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.customProgrammes.update, { sessionToken: owner.token, id })).rejects.toThrow("Programme not found");

    await expect(t.mutation(api.customProgrammes.create, { sessionToken: owner.token, name: " " })).rejects.toThrow(
      "Give your programme a name",
    );
    const id2 = await t.mutation(api.customProgrammes.create, { sessionToken: owner.token, name: "Two" });
    await expect(t.mutation(api.customProgrammes.update, { sessionToken: owner.token, id: id2, name: "" })).rejects.toThrow(
      "Give your programme a name",
    );
    await t.mutation(api.customProgrammes.update, { sessionToken: owner.token, id: id2 });
    expect((await auditLog(t)).at(-1)?.summary).toBe("Edited custom programme Two (no changes)");

    const staff = await signIn(t, "staff");
    await expect(
      t.mutation(api.customProgrammes.create, { sessionToken: staff.token, name: "x", businessId: staff.businessId }),
    ).rejects.toThrow("requires");
  });

  test("a programme someone else owns shows on their business but can't be edited by you", async () => {
    const t = setup();
    const owner = await signIn(t, "admin");
    const id = await t.mutation(api.customProgrammes.create, { sessionToken: owner.token, name: "Shared", businessId: owner.businessId });
    const mgr = await signIn(t, "manager");
    expect(await t.query(api.programmes.current, { sessionToken: mgr.token, businessId: mgr.businessId })).toMatchObject({
      name: "Shared", customProgrammeId: id as Id<"customProgrammes">, ownsProgramme: false,
    });
  });

  test("a business on a built-in programme has no custom programme", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const m = await t.query(api.programmes.current, { sessionToken: token, businessId });
    expect(m.ownsProgramme).toBe(false);
    expect(m).not.toHaveProperty("customProgrammeId");
  });
});
