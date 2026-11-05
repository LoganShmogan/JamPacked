import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { internalMutation, MutationCtx, query } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { licence, PLAN_BY_AMOUNT } from "./lib/licence";
import { requireMember, scoped } from "./lib/session";

/** The business's licence: what it needs, what it has, and whether it's read-only (for a billing page). */
export const status = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    const { business } = await requireMember(ctx, sessionToken, businessId);
    return await licence(ctx, business);
  },
});

type Sub = Doc<"subscriptions">;
type Fields = Partial<Omit<Sub, "_id" | "_creationTime" | "stripeSubscriptionId" | "updatedAt">>;

/**
 * One Stripe webhook event (verified in http.ts); `created` is the event's time in seconds. Stripe can
 * deliver events late and out of order (it retries for up to 3 days), so each one upserts and an older
 * subscription event never undoes a newer one.
 */
export const applyEvent = internalMutation({
  args: { type: v.string(), object: v.any(), created: v.number() },
  handler: async (ctx, { type, object: o, created }) => {
    if (type === "checkout.session.completed") {
      if (o.mode !== "subscription" || !o.subscription) return;
      const row = await find(ctx, o.subscription);
      // The website adds ?client_reference_id=<businessId> to the Payment Link when it knows the business.
      const id = o.client_reference_id && ctx.db.normalizeId("businesses", o.client_reference_id);
      await save(ctx, o.subscription, row, {
        businessId: id && (await ctx.db.get(id)) ? id : undefined,
        stripeCustomerId: o.customer ?? undefined,
        email: o.customer_details?.email ?? undefined,
        businessHint: o.custom_fields?.find((f: { text?: { value?: string } }) => f.text?.value)?.text.value,
        plan: PLAN_BY_AMOUNT[o.amount_total],
        // Paid: active, unless a subscription event has already said where it stands.
        status: o.payment_status === "paid" && (!row || row.status === "incomplete") ? "active" : undefined,
      });
    } else if (type.startsWith("customer.subscription.")) {
      const row = await find(ctx, o.id);
      const at = created * 1000;
      if (row?.eventAt && at < row.eventAt) return;
      const item = o.items?.data?.[0];
      const end = o.current_period_end ?? item?.current_period_end;
      await save(ctx, o.id, row, {
        stripeCustomerId: o.customer ?? undefined,
        plan: PLAN_BY_AMOUNT[item?.price?.unit_amount],
        // A subscription is only ever incomplete first, so a late "incomplete" (same second) is stale.
        status: o.status === "incomplete" && row ? undefined : o.status,
        currentPeriodEnd: end ? end * 1000 : undefined,
        cancelAtPeriodEnd: o.cancel_at_period_end,
        eventAt: at,
      });
    }
  },
});

const find = (ctx: MutationCtx, stripeSubscriptionId: string) =>
  ctx.db.query("subscriptions").withIndex("by_stripe_id", (q) => q.eq("stripeSubscriptionId", stripeSubscriptionId)).unique();

async function save(ctx: MutationCtx, stripeSubscriptionId: string, row: Sub | null, patch: Fields) {
  const fields = Object.fromEntries(Object.entries(patch).filter(([, x]) => x !== undefined)) as Fields;
  if (!row && !fields.businessId && !fields.plan) {
    // Not a JamPacked price: another product on the same Stripe account, or PLAN_BY_AMOUNT is out of date.
    console.warn(`Ignored Stripe subscription ${stripeSubscriptionId}: no business and not a JamPacked price`);
    return;
  }
  const status = fields.status ?? row?.status ?? "incomplete";
  if (row) await ctx.db.patch(row._id, { ...fields, updatedAt: Date.now() });
  else await ctx.db.insert("subscriptions", { ...fields, status, stripeSubscriptionId, updatedAt: Date.now() });
  const businessId = fields.businessId ?? row?.businessId;
  if (businessId) {
    await logAudit(ctx, null, {
      businessId,
      action: row ? "update" : "create",
      entityType: "subscription",
      entityId: stripeSubscriptionId,
      summary: `Licence ${status}${fields.plan ? ` (${fields.plan.toUpperCase()})` : ""}`,
      changes: fields,
    });
  }
}

/**
 * Match a payment to a business by hand, when Stripe didn't get a client_reference_id (see who paid in
 * the `subscriptions` table: email and businessHint). JamPacked staff only, from the CLI:
 *   npx convex run billing:link '{"stripeSubscriptionId":"sub_...","businessId":"..."}'
 */
export const link = internalMutation({
  args: { stripeSubscriptionId: v.string(), businessId: v.id("businesses") },
  handler: async (ctx, { stripeSubscriptionId, businessId }) => {
    if (!(await ctx.db.get(businessId))) throw new Error("No such business");
    await save(ctx, stripeSubscriptionId, await find(ctx, stripeSubscriptionId), { businessId });
  },
});
