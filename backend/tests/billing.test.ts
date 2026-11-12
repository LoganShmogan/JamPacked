// Licences: a business is read-only without the licence its programme needs, once billing is enforced.
// Stripe's webhook keeps the subscriptions in step.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { verifyStripe } from "../convex/http";
import { addBusiness, setup, signIn, T } from "./helpers";

declare const process: { env: Record<string, string | undefined> };

const SECRET = "whsec_test";

async function sign(body: string, t = Math.floor(Date.now() / 1000), secret = SECRET) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return `t=${t},v1=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const NOW = Math.floor(Date.now() / 1000);

async function webhook(t: T, type: string, object: object, signature?: string, created = NOW) {
  const body = JSON.stringify({ type, created, data: { object } });
  return await t.fetch("/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature ?? (await sign(body)) },
  });
}

const paid = (businessId: string | null, amount = 50000, sub = "sub_1") => ({
  mode: "subscription",
  subscription: sub,
  customer: "cus_1",
  client_reference_id: businessId,
  customer_details: { email: "owner@example.com" },
  custom_fields: [{ key: "business", text: { value: "Kai Cafe" } }],
  amount_subtotal: amount,
  amount_total: amount - 2500, // a promotion code: the plan comes from the price, not from what was paid
  payment_status: "paid",
});

const subscription = (status: string, amount = 50000, sub = "sub_1") => ({
  id: sub,
  customer: "cus_1",
  status,
  cancel_at_period_end: status === "active" ? false : true,
  items: { data: [{ price: { unit_amount: amount }, current_period_end: 1_900_000_000 }] },
});

/** One event straight into the mutation, `created` seconds after NOW. */
const apply = (t: T, type: string, object: object, created = 0) =>
  t.mutation(internal.billing.applyEvent, { type, object, created: NOW + created });

/** Any write: adding a supplier. */
const write = (t: T, as: { sessionToken: string; businessId: Id<"businesses"> }) =>
  t.mutation(api.suppliers.create, { ...as, name: "Fresh Co", approved: true });

const subs = (t: T) => t.run((ctx) => ctx.db.query("subscriptions").collect());

beforeEach(() => {
  process.env.BILLING_ENFORCED = "true";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.BILLING_ENFORCED;
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("licence", () => {
  test("off unless BILLING_ENFORCED: nothing is read-only", async () => {
    delete process.env.BILLING_ENFORCED;
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    await write(t, { sessionToken: token, businessId });
    expect(await t.query(api.billing.status, { sessionToken: token, businessId })).toMatchObject({ needs: "np2", enforced: false, readOnly: false });
  });

  test("an NP2 business with no licence is read-only: writes refused, reads and export still work", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const as = { sessionToken: token, businessId };
    await expect(write(t, as)).rejects.toThrow("This business needs the NP2 licence, so its records are read-only for now");
    await t.query(api.suppliers.list, as);
    await t.query(api.exportData.manifest, as);
    expect(await t.query(api.billing.status, as)).toEqual({
      needs: "np2", plan: null, status: null, currentPeriodEnd: null, enforced: true, readOnly: true,
    });
  });

  test("NP1 is free for one person; adding staff needs NP2, and removing them frees it again", async () => {
    const t = setup();
    const admin = await signIn(t, "admin");
    const as = { sessionToken: admin.token, businessId: admin.businessId };
    await t.run((ctx) => ctx.db.patch(admin.businessId, { programme: "NP1", sectors: [] }));
    await write(t, as);
    const staff = await signIn(t, "staff");
    await expect(write(t, as)).rejects.toThrow("An NP1 business with staff needs the NP2 licence");
    // The admin can still bring the business back within the free plan.
    await t.mutation(api.businesses.updateMember, { ...as, userId: staff.userId, active: false });
    await write(t, as);
  });

  test("NP3 and custom programmes need their own plan; a dearer plan covers a cheaper one", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const as = { sessionToken: token, businessId };
    await apply(t, "checkout.session.completed", paid(businessId, 5000));
    await write(t, as);
    expect(await t.query(api.billing.status, as)).toMatchObject({ plan: "np2", status: "active", currentPeriodEnd: null, readOnly: false });
    await t.mutation(api.settings.update, { ...as, programme: "NP3", sectors: [] });
    await expect(write(t, as)).rejects.toThrow("needs the NP3 licence");
    await t.run(async (ctx) => ctx.db.patch(businessId, { programme: "custom" }));
    await expect(write(t, as)).rejects.toThrow("needs the Custom licence");
    await apply(t, "customer.subscription.updated", subscription("active", 120000));
    await write(t, as);
    await t.run(async (ctx) => ctx.db.patch(businessId, { programme: "NP3" }));
    await write(t, as);
  });

  test("past_due keeps working (grace period); canceled is read-only; archiving still works", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const as = { sessionToken: token, businessId };
    await apply(t, "checkout.session.completed", paid(businessId));
    await apply(t, "customer.subscription.updated", subscription("past_due"));
    await write(t, as);
    await apply(t, "customer.subscription.deleted", subscription("canceled"));
    await expect(write(t, as)).rejects.toThrow("read-only");
    expect(await t.query(api.billing.status, as)).toMatchObject({ plan: null, status: "canceled", currentPeriodEnd: 1_900_000_000_000 });
    await t.mutation(api.businesses.setArchived, { ...as, archived: true });
  });
});

describe("Stripe webhook", () => {
  test("a paid checkout for a business unlocks it, and is in its audit trail", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const res = await webhook(t, "checkout.session.completed", paid(businessId));
    expect(res.status).toBe(200);
    await write(t, { sessionToken: token, businessId });
    expect(await subs(t)).toMatchObject([
      { businessId, stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1", email: "owner@example.com", businessHint: "Kai Cafe", plan: "np2", status: "active" },
    ]);
    const log = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(log.find((e) => e.entityType === "subscription")).toMatchObject({ businessId, userName: "system", summary: "Licence active (NP2)" });
  });

  test("events in any order: the subscription can arrive before the checkout", async () => {
    const t = setup();
    const { businessId } = await signIn(t, "admin");
    await webhook(t, "customer.subscription.created", subscription("active"));
    expect(await subs(t)).toMatchObject([{ status: "active", plan: "np2", cancelAtPeriodEnd: false }]);
    await webhook(t, "checkout.session.completed", paid(businessId));
    expect(await subs(t)).toHaveLength(1);
    expect((await subs(t))[0].businessId).toBe(businessId);
  });

  test("a payment without a known business waits to be matched by hand", async () => {
    const t = setup();
    const { userId, token, businessId } = await signIn(t, "admin");
    await webhook(t, "checkout.session.completed", { ...paid(null), customer: null, customer_details: null, custom_fields: [], payment_status: "unpaid" });
    await webhook(t, "checkout.session.completed", paid("not-an-id", 50000, "sub_2"));
    const other = await addBusiness(t, userId);
    await t.run((ctx) => ctx.db.delete(other));
    await webhook(t, "checkout.session.completed", paid(other, 50000, "sub_3"));
    expect((await subs(t)).map((s) => [s.businessId, s.status])).toEqual([[undefined, "incomplete"], [undefined, "active"], [undefined, "active"]]);

    await t.mutation(internal.billing.link, { stripeSubscriptionId: "sub_2", businessId });
    await write(t, { sessionToken: token, businessId });
    await expect(t.mutation(internal.billing.link, { stripeSubscriptionId: "sub_2", businessId: other })).rejects.toThrow("No such business");
    // Linked before Stripe has told us anything about it: waits as incomplete.
    await t.mutation(internal.billing.link, { stripeSubscriptionId: "sub_new", businessId });
    expect((await subs(t)).at(-1)).toMatchObject({ stripeSubscriptionId: "sub_new", businessId, status: "incomplete" });
    // ...and doesn't hide the live licence the business already has.
    await write(t, { sessionToken: token, businessId });
    expect(await t.query(api.billing.status, { sessionToken: token, businessId })).toMatchObject({ plan: "np2", status: "active" });
  });

  test("other events, one-off payments and other products' subscriptions are ignored", async () => {
    const t = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await webhook(t, "invoice.paid", {});
    await webhook(t, "checkout.session.completed", { mode: "payment" });
    await webhook(t, "checkout.session.completed", { mode: "subscription" });
    // Not one of JamPacked's prices and no business: another product on the same Stripe account.
    await webhook(t, "customer.subscription.updated", { id: "sub_9", status: "active", items: { data: [{ price: { unit_amount: 999 } }] } });
    expect(await subs(t)).toEqual([]);
    expect(warn).toHaveBeenCalledWith("Ignored Stripe subscription sub_9: no business and not a JamPacked price");
    warn.mockRestore();
  });

  test("Stripe's late and out-of-order deliveries never undo a newer state", async () => {
    const t = setup();
    const { token, businessId } = await signIn(t, "admin");
    const as = { sessionToken: token, businessId };
    await apply(t, "customer.subscription.updated", subscription("past_due"), 100);
    await apply(t, "customer.subscription.updated", subscription("active"), 200);
    await apply(t, "checkout.session.completed", paid(businessId));
    // A retry of the older past_due arrives last: ignored.
    await apply(t, "customer.subscription.updated", subscription("past_due"), 100);
    // The "created" event (incomplete) from the same second as the "active" one arrives late: stale.
    await apply(t, "customer.subscription.created", subscription("incomplete"), 200);
    expect(await subs(t)).toMatchObject([{ status: "active", businessId, eventAt: (NOW + 200) * 1000 }]);
    await write(t, as);
    // Canceled, then a late checkout: still canceled.
    await apply(t, "customer.subscription.deleted", subscription("canceled"), 300);
    await apply(t, "checkout.session.completed", paid(businessId));
    expect((await subs(t))[0].status).toBe("canceled");
    await expect(write(t, as)).rejects.toThrow("They can still be viewed and exported");
  });

  test("refuses a bad signature, and answers 503 until the secret is set", async () => {
    const t = setup();
    expect((await webhook(t, "invoice.paid", {}, await sign("something else"))).status).toBe(400);
    expect((await webhook(t, "invoice.paid", {}, "garbage")).status).toBe(400);
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await webhook(t, "invoice.paid", {})).status).toBe(503);
  });

  test("verifyStripe: right secret, within 5 minutes, any of several v1 signatures", async () => {
    const now = Date.now();
    const good = await sign("{}", Math.floor(now / 1000));
    expect(await verifyStripe("{}", good, SECRET, now)).toBe(true);
    expect(await verifyStripe("{}", `${good},v1=00`.replace("v1=", "v1=ab,v1="), SECRET, now)).toBe(true);
    expect(await verifyStripe("{}", good, "whsec_other", now)).toBe(false);
    expect(await verifyStripe("{}", good, SECRET, now + 301_000)).toBe(false);
    expect(await verifyStripe("{}", null, SECRET, now)).toBe(false);
    expect(await verifyStripe("{}", `t=${Math.floor(now / 1000)}`, SECRET, now)).toBe(false);
  });
});
