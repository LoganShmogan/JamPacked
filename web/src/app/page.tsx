import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { programmes } from "@/lib/programmes";
import { faqPage, pageMetadata, softwareApplication } from "@/lib/seo";
import { formatPrice, type Plan, pricing, site } from "@/lib/site";

const title = "JamPacked: food safety records that fill themselves in";

export const metadata: Metadata = {
  ...pageMetadata("/", title, site.description),
  title: { absolute: title },
};

// Claims here must match what the app does today (see the README's "What's in it"). Say the programmes
// are *based on* MPI guidance: MPI and FSANZ don't endorse the product.
const steps = [
  { title: "Receive", body: "Scan the barcode, check the temperature, batch and use-by. Accept or reject on the spot." },
  { title: "Store", body: "Accepted goods become stock by location, first-expiring first, with holds and low-stock alerts." },
  { title: "Trace", body: "Search a batch code to see who supplied it, how much is left and where it went. One tap holds it all." },
  { title: "Audit", body: "Audits fill themselves in from your deliveries, temperatures and records, with the evidence attached." },
];

const features = [
  ["Goods inwards", "Supplier, invoice, vehicle check, probe temperature, packaging, allergens and put-away, item by item."],
  ["Temperature checks", "Chillers, freezers, hot holding, cooking and cooling. Out-of-range readings need a corrective action."],
  ["Corrective actions", "Raised automatically for rejected goods, failed checks, expired stock and audit findings, then closed out."],
  ["Your programme", "NP1, NP2, NP3 or your own, narrowed to what your business does, with a Due list of the records you need to keep."],
  ["Barcode auto-fill", "Products fill in from your catalogue or Open Food Facts, including allergens."],
  ["Kept for 7 years", "Every change is logged with who, when and what. Nothing is deleted, and admins can export everything."],
];

// Built per render so the price answer follows lib/site.ts.
const faqList = (monthly = (pricing.plans.find((p) => p.key === "monthly") as Plan).price): [string, string][] => [
  ["Who is JamPacked for?", "Food businesses in New Zealand and Australia that receive, store and track food: bakeries, early childhood centres, manufacturers, retailers, transporters and more."],
  ["Which programmes does it support?", "Modules based on MPI's National Programme 1, 2 and 3 guidance, or a custom programme you build yourself from parts of them or from scratch. Australian businesses can switch to FSANZ defaults."],
  ["Does it replace my food control plan or verifier?", "No. JamPacked helps you keep the records, but your registered plan or programme, and your verifier or EHO, still decide what's required. Check the modules against your registration."],
  ["What does it run on?", "Android, iPhone and any web browser, with one account across all of them. Staff can be invited by email."],
  ["Can I run more than one business?", "Yes. One account can work across several businesses, with a different role in each. Each business has its own licence."],
  [
    "What does it cost?",
    monthly === null
      ? `One licence per business covers every programme and all your staff. Pricing is being finalised: email ${site.email} to get started.`
      : `${formatPrice(monthly)} a month per business (incl. GST), or pay yearly. One licence covers every programme and all your staff.`,
  ],
];

export default function Home() {
  const faqs = faqList();
  return (
    <>
      <JsonLd data={softwareApplication()} />
      <JsonLd data={faqPage(faqs)} />

      <section className="bg-cream">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-12 sm:py-20 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-jam-dark">Food safety app for NZ &amp; AU food businesses</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Food safety records that fill themselves in.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Record every delivery once. JamPacked turns it into stock you can rotate and trace, keeps the records
              your MPI National Programme needs, and answers your audits for you. On your phone, at the back door.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/store/" className="rounded-lg bg-jam px-5 py-3 text-center font-semibold text-on-jam hover:bg-jam-dark">
                Get JamPacked
              </Link>
              <Link href="/programmes/" className="rounded-lg border border-ink/20 px-5 py-3 text-center font-semibold hover:bg-surface">
                Find your programme
              </Link>
            </div>
          </div>
          <Image src="/logo.jpg" alt="The JamPacked jar" width={360} height={360} priority className="mx-auto w-48 rounded-3xl sm:w-72" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-bold">From the back door to the audit</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-border bg-surface p-5">
              <span className="text-sm font-bold text-jam">{i + 1}</span>
              <h3 className="mt-1 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-bold">What&apos;s in it</h2>
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, body]) => (
              <div key={title}>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="programmes" className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-bold">Built around your programme</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Pick the National Programme your business is registered under and JamPacked asks for the checks and records
          it needs, narrowed to what you actually do. Doing a bit of more than one? Build a custom programme from the
          parts that apply.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {programmes.map((p) => (
            <Link key={p.slug} href={`/programmes/${p.slug}/`} className="group rounded-xl border border-border bg-surface p-5 hover:border-jam">
              <span className="text-xs font-semibold uppercase tracking-wide text-jam-dark">{p.risk}</span>
              <h3 className="mt-1 font-semibold group-hover:text-jam">{p.name}</h3>
              <p className="mt-2 text-sm text-muted">{p.summary}</p>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Modules are based on MPI&apos;s National Programme guidance (Dec 2025). They&apos;re a starting point, not
          endorsed by MPI or FSANZ. Every programme is included in every licence.
        </p>
      </section>

      <section className="border-y border-border bg-cream">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">One licence per business. Every programme included.</h2>
            <p className="mt-2 max-w-xl text-muted">
              Buy online, then get the app on Google Play, the App Store or in your browser. Your whole team signs in
              with their own account.
            </p>
          </div>
          <Link href="/store/" className="shrink-0 rounded-lg bg-jam px-5 py-3 text-center font-semibold text-on-jam hover:bg-jam-dark">
            See pricing
          </Link>
        </div>
      </section>

      <section id="faq" className="bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-bold">Questions</h2>
          <div className="mt-6 divide-y divide-border">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="cursor-pointer font-semibold marker:text-jam">{q}</summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-muted">
            Something else? <Link href="/contact/" className="font-semibold text-jam hover:underline">Get in touch</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
