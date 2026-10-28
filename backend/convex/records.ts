import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { loadModule } from "./lib/module";
import { failures } from "./lib/programmes";
import { inBusiness, requireMember, scoped } from "./lib/session";
import { answerValue } from "./schema";

export const list = query({
  args: { ...scoped, recordType: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { sessionToken, businessId, recordType, limit }) => {
    await requireMember(ctx, sessionToken, businessId);
    const take = Math.min(limit ?? 100, 500);
    if (recordType) {
      return await ctx.db
        .query("records")
        .withIndex("by_business_type", (q) => q.eq("businessId", businessId).eq("recordType", recordType))
        .order("desc")
        .take(take);
    }
    return await ctx.db.query("records").withIndex("by_business_at", (q) => q.eq("businessId", businessId)).order("desc").take(take);
  },
});

/**
 * Records a programme record. Fields are checked against the record type; any answer outside
 * its limits is listed on the record and raises a corrective action.
 */
export const create = mutation({
  args: { ...scoped, recordType: v.string(), values: v.record(v.string(), answerValue) },
  handler: async (ctx, { sessionToken, businessId, recordType, values }) => {
    const { user, business } = await requireMember(ctx, sessionToken, businessId);
    const m = await loadModule(ctx, business);
    const type = m.recordTypes.find((r) => r.key === recordType);
    if (!type) throw new ConvexError("Your programme doesn't have that kind of record");
    const clean: Record<string, string | number | boolean | null> = {};
    for (const f of type.fields) {
      let val = values[f.key] ?? null;
      if (typeof val === "string") val = val.trim() || null;
      if (val !== null) {
        const ok =
          f.type === "yesno" ? typeof val === "boolean" : f.type === "text" ? typeof val === "string" : typeof val === "number";
        if (!ok) throw new ConvexError(`${f.label}: wrong kind of answer`);
      }
      if (f.required && val === null) throw new ConvexError(`${f.label} is required`);
      clean[f.key] = val;
    }
    const issues = failures(type, clean);
    const at = Date.now();
    const id = await ctx.db.insert("records", {
      businessId,
      programme: m.key,
      recordType,
      recordName: type.name,
      values: clean,
      issues,
      at,
      byId: user._id,
      byName: user.name,
      voided: false,
    });
    for (const issue of issues) {
      const caId = await ctx.db.insert("correctiveActions", {
        businessId,
        title: `${type.name}: ${issue}`,
        description: type.fields
          .filter((f) => clean[f.key] !== null)
          .map((f) => `${f.label}: ${clean[f.key]}${f.unit ?? ""}`)
          .join("; "),
        source: "record",
        sourceId: id,
        severity: "medium",
        status: "open",
        raisedAt: at,
        raisedById: user._id,
        raisedByName: user.name,
      });
      await logAudit(ctx, user, { businessId, action: "create", entityType: "correctiveAction", entityId: caId, summary: `Auto-raised from ${type.name}: ${issue}` });
    }
    await logAudit(ctx, user, {
      businessId,
      action: "create",
      entityType: "record",
      entityId: id,
      summary: `${type.name} recorded${issues.length ? ` (${issues.join("; ")})` : ""}`,
      changes: clean,
    });
    return id;
  },
});

/** Records are never deleted: a manager voids one with a reason. */
export const voidRecord = mutation({
  args: { ...scoped, id: v.id("records"), reason: v.string() },
  handler: async (ctx, { sessionToken, businessId, id, reason }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    if (!reason.trim()) throw new ConvexError("A reason is required to void a record");
    const r = inBusiness(await ctx.db.get(id), businessId, "Record");
    if (r.voided) return;
    await ctx.db.patch(id, { voided: true, voidReason: reason });
    await logAudit(ctx, user, { businessId, action: "void", entityType: "record", entityId: id, summary: `Voided ${r.recordName}: ${reason}` });
  },
});
