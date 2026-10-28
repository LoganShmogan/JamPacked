import type { Metadata } from "next";
import { site } from "@/lib/site";
import { GetTheApp } from "./GetTheApp";

// Stripe's "after payment" page. Not for search engines: it only makes sense straight after buying.
export const metadata: Metadata = { title: { absolute: "Welcome to JamPacked" }, robots: { index: false, follow: false } };

export default function Welcome() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-jam-dark">Payment received</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Welcome to JamPacked</h1>
      <p className="mt-4 text-lg text-muted">
        Thanks for your order. Your receipt is on its way by email. Get the app, then sign up with the same email you
        paid with and we&apos;ll link your licence to your business.
      </p>
      <GetTheApp />
      <p className="mt-8 text-sm text-muted">
        Questions or trouble signing in? Email <a href={`mailto:${site.email}`} className="font-semibold text-jam">{site.email}</a>.
      </p>
    </div>
  );
}
