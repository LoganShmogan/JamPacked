import Link from "next/link";
import { Faqs } from "@/components/Faqs";
import { JsonLd } from "@/components/JsonLd";
import { licenceFaqs } from "@/lib/content";
import { breadcrumbs, pageMetadata, softwareApplication } from "@/lib/seo";
import { site } from "@/lib/site";
import { PlanPicker } from "./PlanPicker";

export const metadata = pageMetadata(
  "/store/",
  "Pricing and licences",
  "JamPacked is priced by your programme: NP1 free for sole operators, NP2 from $50 a month, NP3 from $100, custom from $120. 30-day money-back guarantee.",
);

const included = [
  "Goods inwards, stock, production and recipes",
  "Enter a product or supply once, then pick it or scan it",
  "Your whole team, each with their own sign-in (NP2 and up)",
  "Android, iPhone and web app",
  "Temperatures, programme records and audits",
  "Records kept for 7 years, with full export",
  "Support by email from a New Zealand team",
];

const steps = [
  ["Pick your plan", "The one for your programme. Pay monthly or yearly for each business, or start free on NP1."],
  ["Get the app", "We send you to Google Play, the App Store or the web app, whichever suits your device."],
  ["Set up your business", "Sign in, pick your programme and invite your team. Records start with your first delivery."],
];

export default function Store() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <JsonLd data={softwareApplication()} />
      <JsonLd data={breadcrumbs([["Home", "/"], ["Store", "/store/"]])} />
      <h1 className="text-3xl font-bold sm:text-4xl">Priced by your programme</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        One licence per business, for the programme it follows. Free on NP1 while it&apos;s just you.
      </p>

      <div className="mt-8"><PlanPicker /></div>

      <h2 className="mt-14 text-xl font-bold">Every plan includes</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {included.map((i) => (
          <li key={i} className="flex gap-3"><span aria-hidden className="font-bold text-jam">✓</span>{i}</li>
        ))}
      </ul>

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
      <div className="mt-4 max-w-3xl"><Faqs items={licenceFaqs} /></div>
      <Link href="/faq/" className="mt-4 inline-block font-semibold text-jam hover:underline">All questions →</Link>

      <p className="mt-10 text-sm text-muted">
        Already have a licence? <a href={site.appUrl} className="font-semibold text-jam hover:underline">Sign in to the app</a>.
        By buying you agree to the <Link href="/legal/terms/" className="underline">Terms</Link> and{" "}
        <Link href="/legal/privacy/" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
