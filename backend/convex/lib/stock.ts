import { ConvexError, Infer } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { movementType } from "../schema";

export type MovementType = Infer<typeof movementType>;
type Lot = Doc<"stockLots">;

/** The date a lot must be gone by: use-by first, then best-before. */
export const expiryOf = (lot: Pick<Lot, "useBy" | "bestBefore">) => lot.useBy ?? lot.bestBefore;

/** First expiring, first out; undated stock last, oldest received first. */
export const fifo = (a: Lot, b: Lot) =>
  (expiryOf(a) ?? Infinity) - (expiryOf(b) ?? Infinity) || a.receivedAt - b.receivedAt;

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The only way stock changes. Applies `qty` (signed) to the lot, keeps its status in step
 * and appends the movement, so a lot's history always adds up to what is on hand.
 */
export async function recordMovement(
  ctx: MutationCtx,
  user: Doc<"users">,
  lot: Lot,
  m: { type: MovementType; qty: number; reason?: string; customer?: string; toLocationId?: Id<"locations"> },
  patch: Partial<Pick<Lot, "status" | "holdReason" | "locationId">> = {},
) {
  const qtyAfter = round(lot.qtyOnHand + m.qty);
  if (qtyAfter < 0) throw new ConvexError(`Only ${lot.qtyOnHand} ${lot.unit} of ${lot.productName} on hand`);
  const status = patch.status ?? (qtyAfter === 0 ? "depleted" : lot.status === "depleted" ? "available" : lot.status);
  await ctx.db.patch(lot._id, { ...patch, qtyOnHand: qtyAfter, status });
  await ctx.db.insert("stockMovements", {
    ...m,
    businessId: lot.businessId,
    lotId: lot._id,
    productName: lot.productName,
    qtyAfter,
    at: Date.now(),
    byId: user._id,
    byName: user.name,
  });
  return { ...lot, ...patch, qtyOnHand: qtyAfter, status };
}

/** Creates a lot with its opening "receive" movement. */
export async function createLot(
  ctx: MutationCtx,
  user: Doc<"users">,
  lot: Omit<Lot, "_id" | "_creationTime" | "qtyOnHand" | "status" | "holdReason">,
  reason?: string,
) {
  const id = await ctx.db.insert("stockLots", { ...lot, qtyOnHand: 0, status: "available" });
  await recordMovement(ctx, user, (await ctx.db.get(id))!, { type: "receive", qty: lot.qtyReceived, reason });
  return id;
}

/** Lots still on hand (available or held) for a business. */
export async function lotsOnHand(ctx: QueryCtx, businessId: Id<"businesses">) {
  const [available, hold] = await Promise.all(
    (["available", "hold"] as const).map((status) =>
      ctx.db
        .query("stockLots")
        .withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", status))
        .collect(),
    ),
  );
  return [...available, ...hold].sort(fifo);
}

/** Active products with a par level whose available stock has fallen below it. */
export async function belowPar(ctx: QueryCtx, businessId: Id<"businesses">) {
  const products = (
    await ctx.db.query("products").withIndex("by_business_name", (q) => q.eq("businessId", businessId)).collect()
  ).filter((p) => p.active && p.parLevel !== undefined);
  const onHand = new Map<string, number>();
  for (const l of await lotsOnHand(ctx, businessId)) {
    if (l.status === "available" && l.productId) onHand.set(l.productId, (onHand.get(l.productId) ?? 0) + l.qtyOnHand);
  }
  return products
    .map((p) => ({ productId: p._id, name: p.name, parLevel: p.parLevel!, reorderQty: p.reorderQty, onHand: onHand.get(p._id) ?? 0 }))
    .filter((p) => p.onHand < p.parLevel);
}
