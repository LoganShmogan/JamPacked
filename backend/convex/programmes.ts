import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadModule } from "./lib/module";
import { programmeInfo } from "./lib/programmes";
import { Frequency } from "./lib/templates";
import { requireMember, scoped } from "./lib/session";

const DAY = 86_400_000;

/** What the business's programme asks for: receiving prompts, record types, checklists and schedule. */
export const current = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    const { user, business } = await requireMember(ctx, sessionToken, businessId);
    const m = await loadModule(ctx, business);
    const custom = business.programme === "custom" && business.customProgrammeId ? await ctx.db.get(business.customProgrammeId) : null;
    return {
      ...m,
      sectors: business.sectors,
      sectorLabels: business.sectors.map((k) => programmeInfo(business.programme)?.sectors.find((s) => s.key === k)?.label ?? k),
      customProgrammeId: custom?._id,
      ownsProgramme: custom?.ownerId === user._id, // only the owner can edit a custom programme
      templates: m.templates.map(({ questions, ...t }) => ({ ...t, questionCount: questions.length })),
    };
  },
});

/** The programme's schedule, each item marked done (with when) or due for its current period. */
export const due = query({
  // dayStart: start of today in the user's local time zone, so "daily" means their day
  args: { ...scoped, dayStart: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, businessId, dayStart }) => {
    const { business } = await requireMember(ctx, sessionToken, businessId);
    const m = await loadModule(ctx, business);
    const now = Date.now();
    const since = (f: Frequency) =>
      f === "daily" ? (dayStart ?? now - DAY) : now - { weekly: 7, monthly: 30, yearly: 365 }[f] * DAY;
    const out = [];
    for (const item of m.schedule) {
      const from = since(item.frequency);
      const s = item.satisfiedBy;
      let lastAt: number | undefined;
      if (s.kind === "record") {
        const rows = await ctx.db
          .query("records")
          .withIndex("by_business_type", (q) => q.eq("businessId", businessId).eq("recordType", s.recordType))
          .order("desc")
          .take(20);
        lastAt = rows.find((r) => !r.voided)?.at;
      } else if (s.kind === "audit") {
        const audits = await ctx.db
          .query("audits")
          .withIndex("by_business_startedAt", (q) => q.eq("businessId", businessId))
          .order("desc")
          .take(200);
        lastAt = audits.find((a) => a.templateKey === s.templateKey && a.status === "completed")?.completedAt;
      } else {
        const logs = await ctx.db
          .query("temperatureLogs")
          .withIndex("by_business_checkedAt", (q) => q.eq("businessId", businessId))
          .order("desc")
          .take(50);
        lastAt = logs.find((l) => l.unitType === "chiller" || l.unitType === "freezer")?.checkedAt;
      }
      out.push({ ...item, lastAt, done: lastAt !== undefined && lastAt >= from });
    }
    return out;
  },
});
