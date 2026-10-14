import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { computeFacts } from "./lib/facts";
import { requireUser } from "./lib/session";
import { TEMPLATES } from "./lib/templates";
import { answerValue } from "./schema";

export const templates = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireUser(ctx, sessionToken);
    return TEMPLATES.map(({ questions, ...t }) => ({
      ...t,
      questionCount: questions.length,
      autoFillCount: questions.filter((q) => q.autoFill).length,
    }));
  },
});

export const list = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireUser(ctx, sessionToken);
    const audits = await ctx.db.query("audits").withIndex("by_startedAt").order("desc").take(100);
    return audits.map(({ answers, ...a }) => ({
      ...a,
      answered: answers.filter((x) => x.value !== null).length,
      total: answers.length,
    }));
  },
});

export const get = query({
  args: { sessionToken: v.string(), id: v.id("audits") },
  handler: async (ctx, { sessionToken, id }) => {
    await requireUser(ctx, sessionToken);
    return await ctx.db.get(id);
  },
});

/** Start an audit: copies the template and pre-fills every auto-fill question from records. */
export const start = mutation({
  args: {
    sessionToken: v.string(),
    templateKey: v.string(),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, templateKey, tzOffsetMinutes, ...p }) => {
    const user = await requireUser(ctx, sessionToken);
    const template = TEMPLATES.find((t) => t.key === templateKey);
    if (!template) throw new ConvexError("Unknown audit template");
    const periodEnd = p.periodEnd ?? Date.now();
    const periodStart = p.periodStart ?? periodEnd - template.defaultPeriodDays * 86_400_000;
    const tz = tzOffsetMinutes ?? 0;
    const facts = await computeFacts(ctx, periodStart, periodEnd, tz);
    const now = Date.now();
    const answers = template.questions.map((q) => {
      const fact = q.autoFill ? facts[q.autoFill] : undefined;
      return {
        questionId: q.id,
        section: q.section,
        text: q.text,
        type: q.type,
        guidance: q.guidance,
        value: fact?.value ?? null,
        autoFilled: fact !== undefined && fact.value !== null,
        evidence: fact?.evidence,
        answeredByName: fact && fact.value !== null ? "Auto-filled" : undefined,
        answeredAt: fact && fact.value !== null ? now : undefined,
      };
    });
    const day = (ms: number) => new Date(ms + tz * 60_000).toLocaleDateString("en-NZ", { timeZone: "UTC" });
    const id = await ctx.db.insert("audits", {
      templateKey,
      templateName: template.name,
      standardRef: template.standardRef,
      title: `${template.name}: ${day(periodStart)}${template.defaultPeriodDays > 1 ? ` to ${day(periodEnd)}` : ""}`,
      periodStart,
      periodEnd,
      tzOffsetMinutes: tz,
      status: "in_progress",
      startedAt: now,
      startedById: user._id,
      startedByName: user.name,
      answers,
    });
    await logAudit(ctx, user, {
      action: "create",
      entityType: "audit",
      entityId: id,
      summary: `Started ${template.name} (${answers.filter((a) => a.autoFilled).length}/${answers.length} auto-filled)`,
    });
    return id;
  },
});

export const answer = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("audits"),
    questionId: v.string(),
    value: answerValue,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, id, questionId, value, notes }) => {
    const user = await requireUser(ctx, sessionToken);
    const audit = await ctx.db.get(id);
    if (!audit) throw new ConvexError("Audit not found");
    if (audit.status === "completed") throw new ConvexError("Completed audits are locked");
    const prev = audit.answers.find((a) => a.questionId === questionId);
    if (!prev) throw new ConvexError("Question not found");
    const answers = audit.answers.map((a) =>
      a.questionId === questionId
        ? { ...a, value, notes: notes ?? a.notes, autoFilled: false, answeredByName: user.name, answeredAt: Date.now() }
        : a,
    );
    await ctx.db.patch(id, { answers });
    await logAudit(ctx, user, {
      action: "answer",
      entityType: "audit",
      entityId: id,
      summary: `"${prev.text}": ${JSON.stringify(prev.value)} → ${JSON.stringify(value)}${prev.autoFilled ? " (overrode auto-fill)" : ""}`,
      changes: { questionId, from: prev.value, to: value, notes },
    });
  },
});

/** Re-run auto-fill for answers nobody has manually changed (e.g. after more deliveries came in). */
export const refreshAutoFill = mutation({
  args: { sessionToken: v.string(), id: v.id("audits") },
  handler: async (ctx, { sessionToken, id }) => {
    const user = await requireUser(ctx, sessionToken);
    const audit = await ctx.db.get(id);
    if (!audit) throw new ConvexError("Audit not found");
    if (audit.status === "completed") throw new ConvexError("Completed audits are locked");
    const template = TEMPLATES.find((t) => t.key === audit.templateKey)!;
    const facts = await computeFacts(ctx, audit.periodStart, Date.now(), audit.tzOffsetMinutes);
    let changed = 0;
    const answers = audit.answers.map((a) => {
      const key = template.questions.find((q) => q.id === a.questionId)?.autoFill;
      const isManual = !a.autoFilled && a.answeredByName && a.answeredByName !== "Auto-filled";
      if (!key || isManual) return a;
      const f = facts[key];
      if (JSON.stringify(f.value) !== JSON.stringify(a.value)) changed++;
      return { ...a, value: f.value, evidence: f.evidence, autoFilled: f.value !== null, answeredByName: "Auto-filled", answeredAt: Date.now() };
    });
    await ctx.db.patch(id, { answers, periodEnd: Date.now() });
    await logAudit(ctx, user, {
      action: "refresh",
      entityType: "audit",
      entityId: id,
      summary: `Refreshed auto-filled answers (${changed} changed)`,
    });
  },
});

export const complete = mutation({
  args: { sessionToken: v.string(), id: v.id("audits") },
  handler: async (ctx, { sessionToken, id }) => {
    const user = await requireUser(ctx, sessionToken);
    const audit = await ctx.db.get(id);
    if (!audit) throw new ConvexError("Audit not found");
    if (audit.status === "completed") return;
    const unanswered = audit.answers.filter((a) => a.value === null && a.type === "yesno");
    if (unanswered.length) {
      throw new ConvexError(`Answer all yes/no questions first (${unanswered.length} remaining)`);
    }
    const yesNo = audit.answers.filter((a) => a.type === "yesno");
    const fails = yesNo.filter((a) => a.value === false);
    const score = yesNo.length ? Math.round(((yesNo.length - fails.length) / yesNo.length) * 100) : 100;
    for (const f of fails) {
      const caId = await ctx.db.insert("correctiveActions", {
        title: `Audit finding: ${f.text}`,
        description: [f.evidence, f.notes].filter(Boolean).join(". ") || undefined,
        source: "audit",
        sourceId: id,
        severity: "medium",
        status: "open",
        raisedAt: Date.now(),
        raisedById: user._id,
        raisedByName: user.name,
      });
      await logAudit(ctx, user, {
        action: "create",
        entityType: "correctiveAction",
        entityId: caId,
        summary: `Auto-raised from ${audit.templateName}: ${f.text}`,
      });
    }
    await ctx.db.patch(id, {
      status: "completed",
      score,
      completedAt: Date.now(),
      completedById: user._id,
      completedByName: user.name,
    });
    await logAudit(ctx, user, {
      action: "complete",
      entityType: "audit",
      entityId: id,
      summary: `Completed ${audit.templateName}, score ${score}% (${fails.length} finding(s))`,
    });
  },
});
