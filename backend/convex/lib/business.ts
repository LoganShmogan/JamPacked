import { ConvexError, Infer, v } from "convex/values";
import { Doc } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { programmeKey } from "../schema";
import { logAudit } from "./audit";
import { programmeInfo } from "./programmes";
import { DEFAULT_SETTINGS } from "./settings";

/** What sign-up and "Add business" ask for. */
export const newBusinessFields = {
  name: v.string(),
  programme: programmeKey,
  sectors: v.optional(v.array(v.string())),
  jurisdiction: v.optional(v.union(v.literal("NZ"), v.literal("AU"))),
  registrationNumber: v.optional(v.string()),
  address: v.optional(v.string()),
};
const newBusiness = v.object(newBusinessFields);
export type NewBusiness = Infer<typeof newBusiness>;

/** Sectors must belong to the chosen built-in programme; custom programmes have none. */
export function checkSectors(programme: string, sectors: string[]) {
  const allowed = programmeInfo(programme)?.sectors.map((s) => s.key) ?? [];
  const bad = sectors.filter((s) => !allowed.includes(s));
  if (bad.length) throw new ConvexError(`Not a ${programme} sector: ${bad.join(", ")}`);
}

/** Creates a business with the creator as its admin. */
export async function createBusiness(ctx: MutationCtx, owner: Doc<"users">, input: NewBusiness) {
  const name = input.name.trim();
  if (!name) throw new ConvexError("Business name is required");
  const sectors = input.sectors ?? [];
  checkSectors(input.programme, sectors);
  const businessId = await ctx.db.insert("businesses", {
    ...DEFAULT_SETTINGS,
    ...input,
    name,
    sectors,
    ownerId: owner._id,
    archived: false,
    createdAt: Date.now(),
  });
  await ctx.db.insert("memberships", {
    userId: owner._id,
    businessId,
    role: "admin",
    active: true,
    createdAt: Date.now(),
  });
  await logAudit(ctx, owner, {
    businessId,
    action: "create",
    entityType: "business",
    entityId: businessId,
    summary: `Business ${name} created (${input.programme})`,
    changes: input,
  });
  return businessId;
}
