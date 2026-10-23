import { Doc } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import { DAILY_CHILLED, ProgrammeModule, ScheduleItem, moduleFor } from "./programmes";
import { TEMPLATES, Template } from "./templates";

/** A custom programme as a module: its schedule comes from the frequencies set on its parts. */
export function customModule(p: Doc<"customProgrammes"> | null): ProgrammeModule {
  const templates: Template[] = (p?.templates ?? []).map((t) => ({ ...t, standardRef: `Custom programme: ${p!.name}` }));
  const recordTypes = (p?.recordTypes ?? []).map((r) => ({ ...r, card: p!.name }));
  const schedule: ScheduleItem[] = [
    ...(p?.dailyChilledCheck ? [DAILY_CHILLED] : []),
    ...recordTypes
      .filter((r) => r.frequency)
      .map((r) => ({ key: `record:${r.key}`, label: r.name, frequency: r.frequency!, satisfiedBy: { kind: "record" as const, recordType: r.key } })),
    ...templates
      .filter((t) => t.frequency)
      .map((t) => ({ key: `audit:${t.key}`, label: t.name, frequency: t.frequency!, satisfiedBy: { kind: "audit" as const, templateKey: t.key } })),
  ];
  return {
    key: "custom",
    name: p?.name ?? "Custom programme",
    receivingPrompts: p?.receivingPrompts ?? [],
    recordTypes,
    templates,
    schedule,
  };
}

/** The programme module a business follows, trimmed to its sectors. */
export async function loadModule(ctx: QueryCtx, business: Doc<"businesses">): Promise<ProgrammeModule> {
  if (business.programme === "custom") {
    return customModule(business.customProgrammeId ? await ctx.db.get(business.customProgrammeId) : null);
  }
  return moduleFor(business.programme, business.sectors)!;
}

/** Built-in audit templates plus the programme's own checklists. */
export const allTemplates = (m: ProgrammeModule): Template[] => [...TEMPLATES, ...m.templates];
