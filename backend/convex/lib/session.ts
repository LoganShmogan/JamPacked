import { ConvexError } from "convex/values";
import { Doc } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

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

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
  roles: Doc<"users">["role"][],
) {
  const user = await requireUser(ctx, sessionToken);
  if (!roles.includes(user.role)) {
    throw new ConvexError(`This action requires one of: ${roles.join(", ")}`);
  }
  return user;
}
