import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

/** Append an entry to the immutable audit trail. Every write in the app goes through here. */
export async function logAudit(
  ctx: MutationCtx,
  user: Pick<Doc<"users">, "_id" | "name"> | null,
  entry: {
    businessId?: Id<"businesses">; // absent only for account events (register, sign-in, sign-out)
    action: string;
    entityType: string;
    entityId?: string;
    summary: string;
    changes?: unknown;
  },
) {
  await ctx.db.insert("auditLog", {
    at: Date.now(),
    userId: user?._id,
    userName: user?.name ?? "system",
    ...entry,
  });
}

/** Field-level diff of `patch` against `before`, for audit log "changes". */
export function diff(before: Record<string, unknown>, patch: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, to] of Object.entries(patch)) {
    if (to === undefined) continue;
    const from = before[k];
    if (JSON.stringify(from) !== JSON.stringify(to)) out[k] = { from: from ?? null, to };
  }
  return out;
}
