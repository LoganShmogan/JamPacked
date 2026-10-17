import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";
import { TEMPLATES } from "../convex/lib/templates";
import { DAY, T, addSupplier, auditLog, cas, getDoc, item, setup, signIn } from "./helpers";

const answerOf = (a: Doc<"audits"> | null, qid: string) => a!.answers.find((x) => x.questionId === qid)!;

async function startAudit(t: T, token: string, templateKey: string, extra: Record<string, number> = {}) {
  const id = await t.mutation(api.audits.start, { sessionToken: token, templateKey, ...extra });
  return id as Id<"audits">;
}

describe("audits:templates / list / get", () => {
  test("templates summarise question and auto-fill counts without the questions", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const list = await t.query(api.audits.templates, { sessionToken: token });
    expect(list.map((x) => x.key)).toEqual(TEMPLATES.map((x) => x.key));
    const gr = list.find((x) => x.key === "goods_receipt")!;
    expect(gr).toMatchObject({ questionCount: 11, autoFillCount: 10 });
    expect(gr).not.toHaveProperty("questions");
  });

  test("list reports answered/total, get returns the audit", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await startAudit(t, token, "hygiene");
    const [row] = await t.query(api.audits.list, { sessionToken: token });
    expect(row).toMatchObject({ _id: id, answered: 0, total: 9 });
    expect(row).not.toHaveProperty("answers");
    expect((await t.query(api.audits.get, { sessionToken: token, id }))?.templateKey).toBe("hygiene");
  });
});

describe("audits:start", () => {
  test("rejects unknown templates", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    await expect(startAudit(t, token, "nope")).rejects.toThrow("Unknown audit template");
  });

  test("pre-fills auto-fill questions from records and leaves the rest blank", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const supplierId = await addSupplier(t);
    await t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [item()] });
    const id = await startAudit(t, token, "goods_receipt");
    const a = await getDoc(t, id);
    expect(a).toMatchObject({ status: "in_progress", tzOffsetMinutes: 0, startedByName: "Staff 0" });
    expect(a!.periodEnd - a!.periodStart).toBe(7 * DAY);
    expect(a!.title).toMatch(/^Goods Receipt & Supplier Verification: .+ to .+$/);
    expect(answerOf(a, "gr1")).toMatchObject({ value: 1, autoFilled: true, answeredByName: "Auto-filled" });
    expect(answerOf(a, "gr2")).toMatchObject({ value: true, autoFilled: true });
    expect(answerOf(a, "gr11")).toMatchObject({ value: null, autoFilled: false });
    expect(answerOf(a, "gr11")).not.toHaveProperty("evidence");
    expect((await auditLog(t)).at(-1)?.summary).toBe("Started Goods Receipt & Supplier Verification (10/11 auto-filled)");
  });

  test("facts with no data stay unanswered but keep their evidence; single-day titles have no range", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await startAudit(t, token, "daily_check", { periodStart: 0, periodEnd: DAY - 1, tzOffsetMinutes: 720 });
    const a = await getDoc(t, id);
    expect(a!.title).toBe("Daily Food Safety Check: 1/01/1970");
    expect(a!.tzOffsetMinutes).toBe(720);
    expect(answerOf(a, "dc1")).toMatchObject({
      value: null, autoFilled: false, evidence: "No temperature checks recorded in this period",
    });
    expect(answerOf(a, "dc1")).not.toHaveProperty("answeredByName");
  });
});

describe("audits:answer", () => {
  test("records the answer, clears auto-fill and logs the override", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await startAudit(t, token, "goods_receipt");
    await t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "gr1", value: 5, notes: "counted" });
    await t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "gr1", value: 6 });
    const a = answerOf(await getDoc(t, id), "gr1");
    expect(a).toMatchObject({ value: 6, notes: "counted", autoFilled: false, answeredByName: "Staff 0" });
    const log = (await auditLog(t)).filter((l) => l.action === "answer");
    expect(log.map((l) => l.summary)).toEqual([
      `"Number of deliveries received this period": 0 → 5 (overrode auto-fill)`,
      `"Number of deliveries received this period": 5 → 6`,
    ]);
  });

  test("errors for a missing audit, a completed audit or an unknown question", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await startAudit(t, token, "hygiene");
    await expect(t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "zz", value: true })).rejects.toThrow(
      "Question not found",
    );
    await t.run((ctx) => ctx.db.patch(id, { status: "completed" }));
    await expect(t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "hy1", value: true })).rejects.toThrow(
      "locked",
    );
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "hy1", value: true })).rejects.toThrow(
      "Audit not found",
    );
  });
});

describe("audits:refreshAutoFill", () => {
  test("updates untouched auto-fill answers but keeps manual ones", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const supplierId = await addSupplier(t);
    const id = await startAudit(t, token, "goods_receipt");
    await t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "gr2", value: false });
    await t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "gr11", value: true });
    await t.mutation(api.deliveries.create, { sessionToken: token, supplierId, vehicleClean: true, items: [item()] });

    await t.mutation(api.audits.refreshAutoFill, { sessionToken: token, id });
    const a = await getDoc(t, id);
    expect(answerOf(a, "gr1")).toMatchObject({ value: 1, autoFilled: true, answeredByName: "Auto-filled" });
    expect(answerOf(a, "gr2")).toMatchObject({ value: false, autoFilled: false }); // manual answer kept
    expect(answerOf(a, "gr11").value).toBe(true); // not an auto-fill question
    expect((await auditLog(t)).at(-1)?.summary).toMatch(/^Refreshed auto-filled answers \(\d+ changed\)$/);

    await t.mutation(api.audits.refreshAutoFill, { sessionToken: token, id });
    expect((await auditLog(t)).at(-1)?.summary).toBe("Refreshed auto-filled answers (0 changed)");
  });

  test("works for audits saved without a time zone offset", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await startAudit(t, token, "daily_check");
    await t.run((ctx) => ctx.db.patch(id, { tzOffsetMinutes: undefined }));
    await t.mutation(api.audits.refreshAutoFill, { sessionToken: token, id });
    expect(answerOf(await getDoc(t, id), "dc2").value).toBe(0);
  });

  test("errors for missing or completed audits", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await startAudit(t, token, "hygiene");
    await t.run((ctx) => ctx.db.patch(id, { status: "completed" }));
    await expect(t.mutation(api.audits.refreshAutoFill, { sessionToken: token, id })).rejects.toThrow("locked");
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.audits.refreshAutoFill, { sessionToken: token, id })).rejects.toThrow("Audit not found");
  });
});

describe("audits:complete", () => {
  test("requires every yes/no answer", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await startAudit(t, token, "hygiene");
    await expect(t.mutation(api.audits.complete, { sessionToken: token, id })).rejects.toThrow("(8 remaining)");
  });

  test("scores, locks and raises a CA per 'No' with evidence and notes", async () => {
    const t = setup();
    const { token } = await signIn(t, "manager");
    const id = await startAudit(t, token, "hygiene");
    for (const q of ["hy1", "hy2", "hy3", "hy4", "hy5", "hy6"]) {
      await t.mutation(api.audits.answer, { sessionToken: token, id, questionId: q, value: true });
    }
    await t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "hy7", value: false, notes: "Lid broken" });
    await t.mutation(api.audits.answer, { sessionToken: token, id, questionId: "hy8", value: false });
    await t.mutation(api.audits.complete, { sessionToken: token, id });

    expect(await getDoc(t, id)).toMatchObject({ status: "completed", score: 75, completedByName: "Manager 0" });
    expect((await cas(t)).map((c) => [c.title, c.description, c.source])).toEqual([
      ["Audit finding: Bins clean, lidded and emptied regularly", "Lid broken", "audit"],
      ["Audit finding: Chemicals stored away from food and labelled", undefined, "audit"],
    ]);
    expect((await auditLog(t)).at(-1)?.summary).toBe("Completed Cleaning, Pest & Personal Hygiene, score 75% (2 finding(s))");

    // Completing again is a no-op.
    await t.mutation(api.audits.complete, { sessionToken: token, id });
    expect(await cas(t)).toHaveLength(2);
  });

  test("an audit with no yes/no questions scores 100", async () => {
    const t = setup();
    const { token, userId } = await signIn(t, "staff");
    const id = await t.run((ctx) =>
      ctx.db.insert("audits", {
        templateKey: "custom", templateName: "Notes only", standardRef: "-", title: "Notes", periodStart: 0, periodEnd: 1,
        status: "in_progress", startedAt: 0, startedById: userId, startedByName: "S",
        answers: [{ questionId: "n1", section: "S", text: "Notes", type: "text", value: null, autoFilled: false }],
      }),
    );
    await t.mutation(api.audits.complete, { sessionToken: token, id });
    expect((await getDoc(t, id))?.score).toBe(100);
  });

  test("errors for a missing audit", async () => {
    const t = setup();
    const { token } = await signIn(t, "staff");
    const id = await startAudit(t, token, "hygiene");
    await t.run((ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.audits.complete, { sessionToken: token, id })).rejects.toThrow("Audit not found");
  });
});
