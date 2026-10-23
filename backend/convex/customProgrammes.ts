import { ConvexError, Infer, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { BUILT_IN_MODULES } from "./lib/programmes";
import { requireMember, requireUser } from "./lib/session";
import { TEMPLATES } from "./lib/templates";
import { customChecklist, customPrompt, customRecordType } from "./schema";

type Parts = {
  receivingPrompts: Infer<typeof customPrompt>[];
  recordTypes: Infer<typeof customRecordType>[];
  templates: Infer<typeof customChecklist>[];
};

function unique(keys: string[], what: string) {
  if (keys.some((k) => !k.trim())) throw new ConvexError(`Every ${what} needs a key`);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) throw new ConvexError(`Two ${what}s share the key "${dup}"`);
}

/** Everything must be named, keyed uniquely and complete enough to fill in. */
export function validateParts(p: Parts) {
  unique(p.receivingPrompts.map((x) => x.key), "receiving check");
  for (const x of p.receivingPrompts) if (!x.text.trim()) throw new ConvexError("Receiving checks need some text");
  unique(p.recordTypes.map((x) => x.key), "record");
  for (const r of p.recordTypes) {
    if (!r.name.trim()) throw new ConvexError("Records need a name");
    if (r.fields.length === 0) throw new ConvexError(`${r.name} needs at least one field`);
    unique(r.fields.map((f) => f.key), `${r.name} field`);
    for (const f of r.fields) {
      if (!f.label.trim()) throw new ConvexError(`${r.name}: every field needs a label`);
      if (f.failIf && !f.failIf.message.trim()) throw new ConvexError(`${r.name}: ${f.label} needs a problem message`);
    }
  }
  unique(p.templates.map((x) => x.key), "checklist");
  for (const t of p.templates) {
    if (TEMPLATES.some((b) => b.key === t.key)) throw new ConvexError(`"${t.key}" is a built-in audit; choose another key`);
    if (!t.name.trim()) throw new ConvexError("Checklists need a name");
    if (t.questions.length === 0) throw new ConvexError(`${t.name} needs at least one question`);
    if (!(t.defaultPeriodDays >= 1)) throw new ConvexError(`${t.name}: the period must be at least 1 day`);
    unique(t.questions.map((q) => q.id), `${t.name} question`);
    for (const q of t.questions) if (!q.text.trim()) throw new ConvexError(`${t.name}: every question needs text`);
  }
}

/** A copy of a built-in module, without its sector tags, as a starting point to edit. */
function copyOf(key: "NP1" | "NP2" | "NP3"): Parts {
  const m = BUILT_IN_MODULES[key];
  return {
    receivingPrompts: m.receivingPrompts.map(({ key, text, guidance }) => ({ key, text, guidance })),
    recordTypes: m.recordTypes.map(({ key, name, description, fields, frequency }) => ({ key, name, description, fields, frequency })),
    templates: m.templates.map(({ key, name, description, defaultPeriodDays, frequency, questions }) => ({
      key: `custom_${key}`,
      name,
      description,
      defaultPeriodDays,
      frequency,
      questions: questions.map(({ id, section, text, type, guidance, autoFill }) => ({ id, section, text, type, guidance, autoFill })),
    })),
  };
}

async function owned(ctx: MutationCtx, user: Doc<"users">, id: Id<"customProgrammes">) {
  const p = await ctx.db.get(id);
  if (!p || p.ownerId !== user._id) throw new ConvexError("Programme not found");
  return p;
}

/** Puts a business on a custom programme. The caller must be its admin and own the programme. */
async function assign(ctx: MutationCtx, user: Doc<"users">, businessId: Id<"businesses">, p: Doc<"customProgrammes">) {
  await ctx.db.patch(businessId, { programme: "custom", customProgrammeId: p._id, sectors: [] });
  await logAudit(ctx, user, {
    businessId,
    action: "update",
    entityType: "settings",
    entityId: businessId,
    summary: `Now following custom programme ${p.name}`,
  });
}

/** The programmes you've built, and which of your businesses use each. */
export const mine = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireUser(ctx, sessionToken);
    const list = await ctx.db.query("customProgrammes").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
    const businesses = await ctx.db.query("businesses").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
    return list.map((p) => ({
      _id: p._id,
      name: p.name,
      description: p.description,
      records: p.recordTypes.length,
      checklists: p.templates.length,
      receivingChecks: p.receivingPrompts.length,
      usedBy: businesses.filter((b) => b.programme === "custom" && b.customProgrammeId === p._id).map((b) => b.name),
    }));
  },
});

export const get = query({
  args: { sessionToken: v.string(), id: v.id("customProgrammes") },
  handler: async (ctx, { sessionToken, id }) => {
    const user = await requireUser(ctx, sessionToken);
    const p = await ctx.db.get(id);
    return p?.ownerId === user._id ? p : null;
  },
});

/** A new programme, blank or copied from NP1/2/3; optionally put straight onto a business. */
export const create = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    copyFrom: v.optional(v.union(v.literal("NP1"), v.literal("NP2"), v.literal("NP3"))),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, { sessionToken, name, copyFrom, businessId }) => {
    const user = await requireUser(ctx, sessionToken);
    if (businessId) await requireMember(ctx, sessionToken, businessId, ["admin"]);
    if (!name.trim()) throw new ConvexError("Give your programme a name");
    const parts = copyFrom ? copyOf(copyFrom) : { receivingPrompts: [], recordTypes: [], templates: [] };
    const id = await ctx.db.insert("customProgrammes", {
      ownerId: user._id,
      name: name.trim(),
      dailyChilledCheck: true,
      ...parts,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const p = (await ctx.db.get(id))!;
    if (businessId) await assign(ctx, user, businessId, p);
    await logAudit(ctx, user, {
      businessId,
      action: "create",
      entityType: "customProgramme",
      entityId: id,
      summary: `Created custom programme ${p.name}${copyFrom ? ` (from ${copyFrom})` : ""}`,
    });
    return id;
  },
});

/** Edits apply to every business using the programme; records already kept are unchanged. */
export const update = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("customProgrammes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    dailyChilledCheck: v.optional(v.boolean()),
    receivingPrompts: v.optional(v.array(customPrompt)),
    recordTypes: v.optional(v.array(customRecordType)),
    templates: v.optional(v.array(customChecklist)),
  },
  handler: async (ctx, { sessionToken, id, ...patch }) => {
    const user = await requireUser(ctx, sessionToken);
    const before = await owned(ctx, user, id);
    if (patch.name !== undefined && !patch.name.trim()) throw new ConvexError("Give your programme a name");
    validateParts({ ...before, ...patch });
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    await logAudit(ctx, user, {
      action: "update",
      entityType: "customProgramme",
      entityId: id,
      summary: `Edited custom programme ${patch.name ?? before.name} (${Object.keys(patch).join(", ") || "no changes"})`,
    });
  },
});

/** Use one of your existing programmes for a business you administer. */
export const useForBusiness = mutation({
  args: { sessionToken: v.string(), businessId: v.id("businesses"), id: v.id("customProgrammes") },
  handler: async (ctx, { sessionToken, businessId, id }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin"]);
    await assign(ctx, user, businessId, await owned(ctx, user, id));
  },
});
