import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbs, faqPage, pageMetadata, softwareApplication } from "@/lib/seo";
import { site } from "@/lib/site";
import { PlanPicker } from "./PlanPicker";

export const metadata = pageMetadata(
  "/store/",
  "Pricing and licences",
  "One JamPacked licence per business: every programme (NP1, NP2, NP3 and custom), all your staff, on Android, iPhone and the web.",
);

const included = [
  "Every programme: NP1, NP2, NP3 and custom",
  "Your whole team, each with their own sign-in",
  "Android, iPhone and web app",
  "Goods inwards, stock, temperatures and audits",
  "Records kept for 7 years, with full export",
  "Support by email from a New Zealand team",
];

const steps = [
  ["Buy a licence", "Pay monthly or yearly for each business. Card payments are handled by Stripe."],
  ["Get the app", "We send you to Google Play, the App Store or the web app, whichever suits your device."],
  ["Set up your business", "Sign in, pick your programme and invite your team. Records start with your first delivery."],
];

const faqs: [string, string][] = [
  ["Do I need a licence for each site?", "You need one licence per business in the app. A business can have several storage locations; separate businesses (for example, two cafés with their own registrations) each need a licence."],
  ["Can I cancel?", "Yes. Your licence runs to the end of the period you've paid for. After that the business becomes read-only: nothing is deleted and you can still view and export your records."],
  ["Can I buy in the app?", "No. Licences are only sold on this website. The app is free to download; it unlocks your business once its licence is active."],
  ["Do prices include GST?", "Yes, prices are in New Zealand dollars and include GST."],
];

export default function Store() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <JsonLd data={softwareApplication()} />
      <JsonLd data={faqPage(faqs)} />
      <JsonLd data={breadcrumbs([["Home", "/"], ["Store", "/store/"]])} />
      <h1 className="text-3xl font-bold sm:text-4xl">One licence per business</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Everything JamPacked does, for your whole team, whichever programme you run.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <PlanPicker />
        <div>
          <h2 className="text-xl font-bold">Included</h2>
          <ul className="mt-4 space-y-3">
            {included.map((i) => (
              <li key={i} className="flex gap-3"><span aria-hidden className="font-bold text-jam">✓</span>{i}</li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="mt-14 text-2xl font-bold">How it works</h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="rounded-xl border border-border bg-surface p-5">
            <span className="text-sm font-bold text-jam">{i + 1}</span>
            <h3 className="mt-1 font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 text-2xl font-bold">Licence questions</h2>
      <div className="mt-4 max-w-3xl divide-y divide-border">
        {faqs.map(([q, a]) => (
          <details key={q} className="py-4">
            <summary className="cursor-pointer font-semibold marker:text-jam">{q}</summary>
            <p className="mt-2 text-muted">{a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        Already have a licence? <a href={site.appUrl} className="font-semibold text-jam hover:underline">Sign in to the app</a>.
        By buying you agree to the <Link href="/legal/terms/" className="underline">Terms</Link> and{" "}
        <Link href="/legal/privacy/" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
