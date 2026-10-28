"use client";

import { useState } from "react";
import { formatPrice, type Plan, pricing, site } from "@/lib/site";

/** Monthly / yearly switch and the Buy button: the plan's Stripe link, or an email until there is one. */
export function PlanPicker() {
  const [key, setKey] = useState<Plan["key"]>("yearly");
  const plan = pricing.plans.find((p) => p.key === key) as Plan;
  const buy = plan.checkoutUrl ?? `mailto:${site.email}?subject=${encodeURIComponent(`JamPacked ${plan.name.toLowerCase()} licence`)}`;
  return (
    <div className="rounded-2xl border-2 border-jam bg-surface p-6 sm:p-8">
      <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-lg bg-cream p-1">
        {pricing.plans.map((p) => (
          <button
            key={p.key}
            role="radio"
            aria-checked={p.key === key}
            onClick={() => setKey(p.key)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${p.key === key ? "bg-surface shadow" : "text-muted"}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <h2 className="mt-6 text-xl font-bold">JamPacked licence</h2>
      {plan.price === null ? (
        <p className="mt-2 text-3xl font-bold">Price on request</p>
      ) : (
        <p className="mt-2">
          <span className="text-4xl font-bold">{formatPrice(plan.price)}</span>
          <span className="text-muted"> {pricing.currency} per business / {plan.per}, incl. GST</span>
        </p>
      )}
      {pricing.trialDays !== null && <p className="mt-2 font-semibold text-jam-dark">{pricing.trialDays}-day free trial</p>}
      <a href={buy} className="mt-6 block rounded-lg bg-jam px-5 py-3 text-center font-semibold text-on-jam hover:bg-jam-dark">
        {plan.checkoutUrl ? `Buy ${plan.name.toLowerCase()} licence` : "Get started by email"}
      </a>
      <p className="mt-3 text-center text-xs text-muted">
        {plan.checkoutUrl ? "Secure payment by Stripe. Cancel any time." : "We'll set up your business and send you a payment link."}
      </p>
    </div>
  );
}
