"use client";

import { useState } from "react";
import { formatPrice, type Period, pricing, site } from "@/lib/site";

/** Monthly / yearly switch and a card per plan: free plans go to the app, paid ones to Stripe or an email. */
export function PlanPicker() {
  const [period, setPeriod] = useState<Period>("yearly");
  const per = pricing.periods.find((p) => p.key === period)!.per;
  return (
    <div>
      <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-lg bg-cream p-1">
        {pricing.periods.map((p) => (
          <button
            key={p.key}
            role="radio"
            aria-checked={p.key === period}
            onClick={() => setPeriod(p.key)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${p.key === period ? "bg-surface shadow" : "text-muted"}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pricing.plans.map((plan) => {
          const price = plan.prices[period];
          const saving = plan.prices.monthly * 12 - plan.prices.yearly;
          const checkout = plan.checkoutUrls[period];
          const href = !price
            ? site.appUrl
            : (checkout ?? `mailto:${site.email}?subject=${encodeURIComponent(`JamPacked ${plan.name} ${period} licence`)}`);
          return (
            <section key={plan.key} aria-label={`${plan.name} plan`} className="flex flex-col rounded-2xl border-2 border-border bg-surface p-5 first:border-jam">
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <p className="mt-3">
                {price ? (
                  <>
                    <span className="text-3xl font-bold">{formatPrice(price)}</span>
                    <span className="text-muted"> / {per}</span>
                  </>
                ) : (
                  <span className="text-3xl font-bold">Free</span>
                )}
              </p>
              {price > 0 && period === "yearly" && saving > 0 && (
                <p className="mt-1 text-sm font-semibold text-jam-dark">Save {formatPrice(saving)} a year</p>
              )}
              <p className="mt-3 flex-1 text-sm text-muted">{plan.summary}</p>
              <a href={href} className="mt-5 block rounded-lg bg-jam px-4 py-2.5 text-center font-semibold text-on-jam hover:bg-jam-dark">
                {!price ? "Start free" : checkout ? `Buy ${plan.name}` : "Get started by email"}
              </a>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted">
        {pricing.currency} per business, incl. GST. Every paid plan has a{" "}
        <strong className="text-ink">{pricing.moneyBackDays}-day money-back guarantee</strong>. Card payments are handled by Stripe.
      </p>
    </div>
  );
}
