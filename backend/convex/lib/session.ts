import { ConvexError, v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

export type Role = Doc<"memberships">["role"];

/** Args every business-scoped function takes. The app adds both to every call. */
export const scoped = { sessionToken: v.string(), businessId: v.id("businesses") };

export async function getUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
): Promise<Doc<"users"> | null> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .unique();
  if (!session || session.expiresAt < Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser(ctx: QueryCtx | MutationCtx, sessionToken: string) {
  const user = await getUser(ctx, sessionToken);
  if (!user) throw new ConvexError("Not signed in or session expired");
  return user;
}

/** The owner dashboard: only JamPacked's own staff (users with `platformAdmin`), never customers. */
export async function requirePlatformAdmin(ctx: QueryCtx | MutationCtx, sessionToken: string) {
  const user = await requireUser(ctx, sessionToken);
  if (!user.platformAdmin) throw new ConvexError("Only JamPacked staff can see this");
  return user;
}

export async function membership(ctx: QueryCtx | MutationCtx, userId: Id<"users">, businessId: Id<"businesses">) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_user_business", (q) => q.eq("userId", userId).eq("businessId", businessId))
    .unique();
}

/**
 * Every business-scoped function starts here: the signed-in user must be an active member of
 * `businessId` (and hold one of `roles`, when given). Returns the user, business and their role in it.
 */
export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
  businessId: Id<"businesses">,
  roles?: Role[],
) {
  const user = await requireUser(ctx, sessionToken);
  const business = await ctx.db.get(businessId);
  const m = await membership(ctx, user._id, businessId);
  if (!business || !m || !m.active) throw new ConvexError("You don't have access to this business");
  if (roles && !roles.includes(m.role)) {
    throw new ConvexError(`This action requires one of: ${roles.join(", ")}`);
  }
  return { user, business, role: m.role };
}

/** A record fetched by id must belong to the business being worked in; otherwise it doesn't exist. */
export function inBusiness<D extends { businessId?: Id<"businesses"> }>(
  doc: D | null,
  businessId: Id<"businesses">,
  what: string,
): D {
  if (!doc || doc.businessId !== businessId) throw new ConvexError(`${what} not found`);
  return doc;
}
