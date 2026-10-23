// Programme modules (NP1/NP2/NP3): what each asks for, the "Due" schedule, records and receiving prompts.
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { computeFacts } from "../convex/lib/facts";
import { BUILT_IN_MODULES, PROGRAMMES, applies, failures, moduleFor } from "../convex/lib/programmes";
import { DAY, T, addBusiness, addSupplier, auditLog, cas, getDoc, item, setup, signIn } from "./helpers";

async function ready(role: "admin" | "manager" | "staff" = "staff", programme = "NP2", sectors: string[] = []) {
  const t = setup();
  const user = await signIn(t, role);
  await t.run((ctx) => ctx.db.patch(user.businessId, { programme: programme as "NP2", sectors }));
  return { t, ...user, as: { sessionToken: user.token, businessId: user.businessId } };
}

const record = (t: T, as: { sessionToken: string; businessId: Id<"businesses"> }, recordType: string, values: Record<string, unknown>) =>
  t.mutation(api.records.create, { ...as, recordType, values: values as Record<string, string> });

describe("lib/programmes", () => {
  test("every built-in module is internally consistent", () => {
    for (const p of PROGRAMMES) {
      const m = BUILT_IN_MODULES[p.key];
      const recordKeys = m.recordTypes.map((r) => r.key);
      expect(new Set(recordKeys).size).toBe(recordKeys.length);
      expect(new Set(m.receivingPrompts.map((x) => x.key)).size).toBe(m.receivingPrompts.length);
      for (const r of m.recordTypes) expect(new Set(r.fields.map((f) => f.key)).size).toBe(r.fields.length);
      for (const tpl of m.templates) expect(new Set(tpl.questions.map((q) => q.id)).size).toBe(tpl.questions.length);
      const sectorKeys = p.sectors.map((s) => s.key);
      const tagged = [...m.recordTypes, ...m.receivingPrompts, ...m.schedule, ...m.templates.flatMap((x) => x.questions)];
      for (const i of tagged) for (const s of [...(i.sectors ?? []), ...(i.excludeSectors ?? [])]) expect(sectorKeys).toContain(s);
      for (const s of m.schedule) {
        if (s.satisfiedBy.kind === "record") expect(recordKeys).toContain(s.satisfiedBy.recordType);
        if (s.satisfiedBy.kind === "audit") expect(m.templates.map((x) => x.key)).toContain(s.satisfiedBy.templateKey);
      }
    }
  });

  test("moduleFor drops what doesn't apply to the business's sectors", () => {
    const np1 = moduleFor("NP1", [])!;
    expect(np1.recordTypes.map((r) => r.key)).not.toContain("tutin");
    expect(np1.recordTypes.map((r) => r.key)).not.toContain("transport");
    expect(np1.receivingPrompts.map((r) => r.key)).not.toContain("tutinDeclaration");
    expect(np1.templates[0].questions.map((q) => q.id)).not.toContain("np1b");
    const honey = moduleFor("NP1", ["honey", "transport"])!;
    expect(honey.recordTypes.map((r) => r.key)).toEqual(expect.arrayContaining(["tutin", "transport"]));
    expect(honey.receivingPrompts.map((r) => r.key)).toContain("tutinDeclaration");
    expect(honey.templates[0].questions.map((q) => q.id)).toEqual(expect.arrayContaining(["np1a", "np1b"]));

    // NP2: ECE and retailers of packaged chilled/frozen food don't need sickness or transport records.
    expect(moduleFor("NP2", [])!.recordTypes.map((r) => r.key)).toEqual(expect.arrayContaining(["sickness", "transport", "cooking", "ph_test"]));
    const ece = moduleFor("NP2", ["ece"])!.recordTypes.map((r) => r.key);
    expect(ece).not.toContain("sickness");
    expect(ece).not.toContain("transport");
    expect(ece).toContain("cooking");
    const retail = moduleFor("NP2", ["retail_chilled_frozen"])!.templates[0].questions.map((q) => q.id);
    expect(retail).not.toContain("pc1");

    // NP3 asks for sickness records from everyone; reheating question for retailers only.
    expect(moduleFor("NP3", [])!.recordTypes.map((r) => r.key)).toContain("sickness");
    expect(moduleFor("NP3", [])!.templates[0].questions.map((q) => q.id)).not.toContain("np3a");
    expect(moduleFor("NP3", ["retail_handling"])!.templates[0].questions.map((q) => q.id)).toContain("np3a");
    expect(moduleFor("custom", [])).toBeUndefined();
  });

  test("applies: sectors are an allow-list, excludeSectors a deny-list", () => {
    expect(applies({}, [])).toBe(true);
    expect(applies({ sectors: ["a"] }, ["b"])).toBe(false);
    expect(applies({ sectors: ["a"] }, ["a", "b"])).toBe(true);
    expect(applies({ excludeSectors: ["a"] }, ["a"])).toBe(false);
    expect(applies({ excludeSectors: ["a"] }, ["b"])).toBe(true);
  });

  test("failures checks equals, above and below; blanks never fail", () => {
    const type = {
      fields: [
        { key: "ok", label: "OK", type: "yesno" as const, failIf: { equals: false, message: "not ok" } },
        { key: "t", label: "T", type: "number" as const, failIf: { above: 1, below: -1, message: "out" } },
        { key: "plain", label: "P", type: "text" as const },
      ],
    };
    expect(failures(type, { ok: true, t: 0 })).toEqual([]);
    expect(failures(type, { ok: false, t: 2 })).toEqual(["not ok", "out"]);
    expect(failures(type, { t: -2 })).toEqual(["out"]);
    expect(failures(type, { ok: null, t: "" })).toEqual([]);
  });
});

describe("programmes:current", () => {
  test("returns the business's module trimmed to its sectors, with template summaries", async () => {
    const { t, as } = await ready("staff", "NP1", ["honey"]);
    const m = await t.query(api.programmes.current, as);
    expect(m).toMatchObject({ key: "NP1", name: "National Programme 1", sectors: ["honey"], sectorLabels: ["Honey"] });
    expect(m.recordTypes.map((r) => r.key)).toContain("tutin");
    expect(m.templates[0]).toMatchObject({ key: "np1_self_check", frequency: "monthly", questionCount: 17 });
    expect(m.templates[0]).not.toHaveProperty("questions");
  });

  test("a custom programme with nothing defined yet is empty", async () => {
    const { t, as } = await ready("staff", "custom");
    expect(await t.query(api.programmes.current, as)).toMatchObject({
      key: "custom", receivingPrompts: [], recordTypes: [], templates: [], schedule: [], sectorLabels: [],
    });
    // A sector the programme doesn't know (e.g. left over from a change) shows as its key.
    await t.run((ctx) => ctx.db.patch(as.businessId, { programme: "NP3", sectors: ["gone"] }));
    expect((await t.query(api.programmes.current, as)).sectorLabels).toEqual(["gone"]);
  });
});

describe("programmes:due", () => {
  test("each schedule item is due until done in its period", async () => {
    const { t, as, userId } = await ready("manager");
    const before = await t.query(api.programmes.due, as);
    expect(before.map((d) => [d.key, d.frequency, d.done])).toEqual([
      ["chilled_check", "daily", false],
      ["pest_check", "weekly", false],
      ["calibration", "monthly", false],
      ["self_check", "monthly", false],
      ["mock_recall", "yearly", false],
    ]);

    const now = Date.now();
    await t.run(async (ctx) => {
      const base = { businessId: as.businessId, programme: "NP2", values: {}, issues: [], byId: userId, byName: "M", voided: false };
      await ctx.db.insert("records", { ...base, recordType: "pest_check", recordName: "Pest check", at: now - 2 * DAY });
      await ctx.db.insert("records", { ...base, recordType: "calibration", recordName: "x", at: now - 40 * DAY }); // too old
      await ctx.db.insert("records", { ...base, recordType: "mock_recall", recordName: "x", at: now - DAY, voided: true }); // voided
      const audit = { businessId: as.businessId, templateName: "x", standardRef: "x", title: "x", periodStart: 0, periodEnd: 0, startedById: userId, startedByName: "M", answers: [] };
      await ctx.db.insert("audits", { ...audit, templateKey: "np2_self_check", status: "in_progress", startedAt: now - 3 * DAY });
      await ctx.db.insert("audits", { ...audit, templateKey: "np2_self_check", status: "completed", startedAt: now - 5 * DAY, completedAt: now - 4 * DAY });
      const log = { businessId: as.businessId, unitName: "x", temperatureC: 3, compliant: true, checkedById: userId, checkedByName: "M" };
      await ctx.db.insert("temperatureLogs", { ...log, unitType: "hot_hold", checkedAt: now - 1000 }); // not a chilled check
      await ctx.db.insert("temperatureLogs", { ...log, unitType: "freezer", checkedAt: now - 2000 });
    });
    const after = await t.query(api.programmes.due, as);
    expect(after.map((d) => [d.key, d.done])).toEqual([
      ["chilled_check", true],
      ["pest_check", true],
      ["calibration", false],
      ["self_check", true],
      ["mock_recall", false],
    ]);
    expect(after[0].lastAt).toBe(now - 2000);
    expect(after[2].lastAt).toBe(now - 40 * DAY);
    expect(after[4].lastAt).toBeUndefined();
    // "Today" is the caller's local day: a check from before dayStart doesn't count.
    const tomorrow = await t.query(api.programmes.due, { ...as, dayStart: now + 1000 });
    expect(tomorrow[0].done).toBe(false);
  });
});

describe("records", () => {
  test("create validates against the record type and trims text", async () => {
    const { t, as } = await ready();
    await expect(record(t, as, "nope", {})).rejects.toThrow("Your programme doesn't have that kind of record");
    await expect(record(t, as, "pest_check", { area: "  ", found: false })).rejects.toThrow("Areas checked is required");
    await expect(record(t, as, "pest_check", { area: "Kitchen", found: "no" })).rejects.toThrow("Signs of pests found?: wrong kind of answer");
    await expect(record(t, as, "calibration", { thermometer: "T1", iceReading: "0" })).rejects.toThrow("Reading in ice slurry: wrong kind of answer");
    await expect(record(t, as, "pest_check", { area: 3, found: false })).rejects.toThrow("Areas checked: wrong kind of answer");
    await expect(record(t, as, "sickness", { staff: "Kim", symptoms: "Vomiting", action: "Sent home", returned: "tomorrow" })).rejects.toThrow(
      "wrong kind of answer",
    );
    const id = await record(t, as, "pest_check", { area: " Kitchen ", found: false, type: "", extra: "ignored" });
    expect(await getDoc(t, id as never)).toMatchObject({
      recordType: "pest_check", recordName: "Pest check", programme: "NP2", issues: [], voided: false, byName: "Staff 0",
      values: { area: "Kitchen", found: false, type: null, action: null },
    });
    expect(await cas(t)).toHaveLength(0);
    expect((await auditLog(t)).at(-1)?.summary).toBe("Pest check recorded");
  });

  test("answers outside limits are listed and each raises a corrective action", async () => {
    const { t, as } = await ready();
    const id = await record(t, as, "transport", {
      load: "Run 1", chilledTempC: 8, frozen: true, hotTempC: 55, vehicleClean: true,
    });
    const r = await getDoc(t, id as never);
    expect(r).toMatchObject({ issues: ["Chilled food above 5°C in transport", "Hot food below 60°C in transport"] });
    const raised = await cas(t);
    expect(raised.map((c) => [c.title, c.source, c.sourceId, c.severity])).toEqual([
      ["Transport temperature: Chilled food above 5°C in transport", "record", id, "medium"],
      ["Transport temperature: Hot food below 60°C in transport", "record", id, "medium"],
    ]);
    expect(raised[0].description).toBe(
      "Load / delivery run: Run 1; Chilled food temperature: 8°C; Frozen food still frozen?: true; Hot food temperature: 55°C; Vehicle clean?: true",
    );
    expect((await auditLog(t)).at(-1)?.summary).toBe(
      "Transport temperature recorded (Chilled food above 5°C in transport; Hot food below 60°C in transport)",
    );
  });

  test("a record type must apply to the business's sectors", async () => {
    const { t, as } = await ready("staff", "NP2", ["ece"]);
    await expect(record(t, as, "sickness", { staff: "Kim", symptoms: "x", action: "y" })).rejects.toThrow(
      "Your programme doesn't have that kind of record",
    );
    await record(t, as, "cooking", { food: "Chicken", coreTempC: 76, timeMet: true });
  });

  test("list by type or all, newest first", async () => {
    const { t, as } = await ready();
    await record(t, as, "pest_check", { area: "A", found: false });
    await record(t, as, "training", { staff: "Kim", topic: "Receiving", competent: true });
    await record(t, as, "pest_check", { area: "B", found: true, type: "Mouse droppings" });
    expect((await t.query(api.records.list, as)).map((r) => r.recordType)).toEqual(["pest_check", "training", "pest_check"]);
    expect((await t.query(api.records.list, { ...as, recordType: "pest_check", limit: 1 })).map((r) => r.values.area)).toEqual(["B"]);
  });

  test("void: managers only, with a reason, once, within the business", async () => {
    const { t, as, userId } = await ready("manager");
    const id = (await record(t, as, "pest_check", { area: "A", found: false })) as Id<"records">;
    await expect(t.mutation(api.records.voidRecord, { ...as, id, reason: " " })).rejects.toThrow("A reason is required");
    const staff = await signIn(t, "staff");
    await expect(t.mutation(api.records.voidRecord, { ...as, sessionToken: staff.token, id, reason: "x" })).rejects.toThrow("requires");
    await t.mutation(api.records.voidRecord, { ...as, id, reason: "Entered twice" });
    await t.mutation(api.records.voidRecord, { ...as, id, reason: "again" });
    expect(await getDoc(t, id as never)).toMatchObject({ voided: true, voidReason: "Entered twice" });
    expect((await auditLog(t)).filter((l) => l.action === "void").map((l) => l.summary)).toEqual(["Voided Pest check: Entered twice"]);
    const other = await addBusiness(t, userId);
    const outsider = await signIn(t, "admin", {}, other);
    await expect(
      t.mutation(api.records.voidRecord, { sessionToken: outsider.token, businessId: other, id, reason: "x" }),
    ).rejects.toThrow("Record not found");
  });
});

describe("receiving prompts on goods inwards", () => {
  test("answers are stored with their text; 'No' raises a corrective action; unknown keys are rejected", async () => {
    const { t, as } = await ready();
    const supplierId = await addSupplier(t);
    const base = { ...as, supplierId, vehicleClean: true, items: [item()] };
    await expect(
      t.mutation(api.deliveries.create, { ...base, programmeAnswers: [{ key: "tutinDeclaration", value: true }] }),
    ).rejects.toThrow("Unknown receiving check: tutinDeclaration");
    const id = await t.mutation(api.deliveries.create, {
      ...base,
      programmeAnswers: [
        { key: "attended", value: true },
        { key: "putAwayOrder", value: false },
        { key: "allergenInfo" }, // the app drops nulls: absent means not applicable
      ],
    });
    expect((await getDoc(t, id))?.programmeAnswers).toEqual([
      { key: "attended", value: true, text: "Someone was there to receive the delivery (it wasn't left unattended)" },
      { key: "putAwayOrder", value: false, text: "Chilled food was put away first, then frozen, then ambient" },
      { key: "allergenInfo", value: null, text: "Ingredient and allergen information for these goods is on file and up to date" },
    ]);
    expect((await cas(t)).map((c) => c.title)).toEqual([
      "Receiving check failed: Chilled food was put away first, then frozen, then ambient",
    ]);
    const plain = await t.mutation(api.deliveries.create, base);
    expect(await getDoc(t, plain)).not.toHaveProperty("programmeAnswers");
  });
});

describe("programme checklists in audits", () => {
  test("the self-check auto-fills from programme records", async () => {
    const { t, as } = await ready("manager");
    await record(t, as, "mock_recall", { scenario: "Milk B1", minutes: 12, allFound: true });
    await record(t, as, "pest_check", { area: "All", found: false });
    await record(t, as, "calibration", { thermometer: "T1", iceReading: 0.5 });
    await record(t, as, "training", { staff: "Kim", topic: "Allergens", competent: true });
    const id = await t.mutation(api.audits.start, { ...as, templateKey: "np2_self_check" });
    const audit = (await t.query(api.audits.get, { ...as, id }))!;
    const answer = (qid: string) => audit.answers.find((a) => a.questionId === qid)!;
    expect(audit.templateName).toBe("NP2 self-check");
    expect(answer("sc6")).toMatchObject({ value: true, autoFilled: true });
    expect(answer("sc12")).toMatchObject({ value: true, evidence: "1 pest check(s), nothing found" });
    expect(answer("sc13").value).toBe(true);
    expect(answer("sc14").value).toBe(true);
    expect(answer("sc91")).toMatchObject({ value: true, evidence: "No records flagged a problem" });
  });

  test("refreshing an audit whose template left with a programme change keeps its answers", async () => {
    const { t, as } = await ready("admin");
    const id = await t.mutation(api.audits.start, { ...as, templateKey: "np2_self_check" });
    const before = (await t.query(api.audits.get, { ...as, id }))!.answers;
    await t.mutation(api.settings.update, { ...as, programme: "NP3" });
    await t.mutation(api.audits.refreshAutoFill, { ...as, id });
    expect((await t.query(api.audits.get, { ...as, id }))!.answers).toEqual(before);
  });
});

describe("computeFacts: programme records", () => {
  test("problems and gaps show up with evidence", async () => {
    const { t, as, userId } = await ready("manager");
    const now = Date.now();
    await t.run(async (ctx) => {
      const base = { businessId: as.businessId, programme: "NP2", byId: userId, byName: "M", voided: false, values: {}, issues: [] };
      await ctx.db.insert("records", { ...base, recordType: "pest_check", recordName: "Pest check", at: now - DAY, values: { found: true } });
      await ctx.db.insert("records", { ...base, recordType: "mock_recall", recordName: "x", at: now - 400 * DAY }); // over a year ago
      await ctx.db.insert("records", { ...base, recordType: "training", recordName: "x", at: now - DAY, voided: true });
      const flagged = await ctx.db.insert("records", { ...base, recordType: "cooking", recordName: "x", at: now - DAY, issues: ["cold"] });
      await ctx.db.insert("records", { ...base, recordType: "cooling", recordName: "x", at: now - DAY, issues: ["slow"] });
      await ctx.db.insert("correctiveActions", {
        businessId: as.businessId, title: "x", source: "record", sourceId: flagged, severity: "medium", status: "open",
        raisedAt: now, raisedById: userId, raisedByName: "M",
      });
    });
    const f = await t.run(async (ctx) => computeFacts(ctx, (await ctx.db.get(as.businessId))!, now - 7 * DAY, now));
    expect(f["records.mockRecall"]).toEqual({ value: false, evidence: "No mock recall recorded in the last 12 months" });
    expect(f["records.noPests"].value).toBe(false);
    expect(f["records.noPests"].evidence).toMatch(/^Pests found on \d{4}-\d{2}-\d{2}$/);
    expect(f["records.calibrated"]).toEqual({ value: false, evidence: "No thermometer check in the last 3 months" });
    expect(f["records.training"]).toEqual({ value: false, evidence: "No training recorded in the last 12 months" });
    expect(f["records.issuesHandled"]).toEqual({ value: false, evidence: "2 record(s) flagged a problem, 1 still open" });
    const empty = await t.run(async (ctx) => computeFacts(ctx, (await ctx.db.get(as.businessId))!, now - 7 * DAY, now - 3 * DAY));
    expect(empty["records.noPests"]).toEqual({ value: null, evidence: "No pest checks recorded in this period" });
  });
});
