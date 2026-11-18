import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Phone } from "@/components/Phone";
import { operationCards, priceSummary, steps } from "@/lib/content";
import { programmes } from "@/lib/programmes";
import { shots } from "@/lib/screenshots";
import { pageMetadata, softwareApplication } from "@/lib/seo";
import { pricing, site } from "@/lib/site";

const title = "JamPacked: food safety records that fill themselves in";

export const metadata: Metadata = {
  ...pageMetadata("/", title, site.description),
  title: { absolute: title },
};

// The designer's jars (public/jars.svg), in its units: a 242×97 lid over a 252-wide body, 15 apart.
// The small jar is the lid alone, the medium has a 162-tall body, the large a 330-tall one.
const JAR = { small: 0, medium: 162, large: 330 };

/** One of the designer's jars, sized by the width in `className`; `body` is its body height in the artwork's units. */
function Jar({ body, className = "" }: { body: number; className?: string }) {
  return (
    <div aria-hidden className={className}>
      <div className="jar-lid mx-auto" style={{ width: "96%", aspectRatio: "242 / 97", borderRadius: "14% / 35%" }} />
      {body > 0 && (
        <div
          className="jar-fill"
          style={{ marginTop: "6%", aspectRatio: `252 / ${body}`, borderRadius: `17.5% / ${Math.min(50, (44 / body) * 100)}%` }}
        />
      )}
    </div>
  );
}

// What drops into the hero jar, bottom of the jar first. The bigger jobs, with a second line, take two
// rows of the jar's 10; keep the rows adding up to 10 so the jar is exactly full.
const records: [what: string, detail: string, more?: string][] = [
  ["Goods in", "Milk 2L, 3.8°C", "Batch MK2611, use by 12 Nov"],
  ["Fridge 2", "3.1°C"],
  ["Batch JP-0412", "Jam, 24 jars", "3 ingredients picked from stock"],
  ["Cooling", "2 checks", "21°C at 2h, 4.6°C at 6h"],
  ["Allergens", "Label checked"],
  ["Harvest", "Block C, 120 kg"],
  ["Dispatch", "Café, 12 jars"],
];

// Programmes as the designer's jar sizes: the more your programme asks for, the bigger the jar.
const programmeJar: Record<string, number> = { np1: JAR.small, np2: JAR.medium, np3: JAR.large };

// The shelf: the jar grows with each step, from the small jar to the large one.
const stepJars = [JAR.small, 80, JAR.medium, 250, JAR.large];

// An overview: each section is a short teaser that links to its own page.
export default function Home() {
  return (
    <>
      <JsonLd data={softwareApplication()} />

      <section className="relative overflow-hidden bg-burgundy text-peach">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-16 sm:py-24 md:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-rose">Food safety app for NZ &amp; AU food businesses</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              Jam-packed with every record your audit needs.
            </h1>
            <p className="mt-5 text-lg text-peach/85">
              Every delivery, temperature, batch and harvest goes in the jar as you work. JamPacked labels it, traces it
              both ways and fills in the records your MPI National Programme asks for. On your phone, at the back door
              or out in the paddock.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/store/" className="btn-rose rounded-full px-6 py-3 text-center font-semibold">
                Get JamPacked
              </Link>
              <Link href="/programmes/" className="rounded-full border border-peach/40 px-6 py-3 text-center font-semibold hover:bg-peach/10">
                Find your programme
              </Link>
            </div>
          </div>

          {/* The signature: a day's records drop into the jar, then the lid goes on. */}
          <div aria-hidden className="mx-auto w-full max-w-[18rem]">
            {/* The designer's large jar: lid and body in its proportions, the body holding the records. */}
            <div className="jar-lid pack-lid mx-auto flex w-[96%] items-center justify-center" style={{ aspectRatio: "242 / 97", borderRadius: "14% / 35%" }}>
              <p className="pack-stamp -rotate-3 rounded-full bg-peach px-4 py-1 text-sm font-bold uppercase tracking-wide text-burgundy shadow-lg">
                Audit ready
              </p>
            </div>
            {/* Ten equal rows, top to bottom; records are listed bottom first, so they're laid out reversed. */}
            <div className="jar-fill mt-[6%] grid aspect-[252/330] grid-rows-[repeat(10,minmax(0,1fr))] gap-2 overflow-hidden rounded-[17.5%/13%] p-4">
              {records.map(([what, detail, more], i) => (
                <div
                  key={what}
                  className={`pack-drop flex items-center justify-between gap-2 rounded-2xl bg-peach px-3 text-sm leading-5 text-burgundy shadow ${more ? "row-span-2" : ""}`}
                  style={{ animationDelay: `${0.2 + i * 0.35}s` }}
                >
                  <span className="min-w-0">
                    <span className="block truncate"><b className="font-semibold">{what}</b> · {detail}</span>
                    {more && <span className="block truncate text-xs leading-4 text-burgundy/75">{more}</span>}
                  </span>
                  <span className="shrink-0 rounded-full bg-burgundy px-2 text-xs font-bold text-peach">OK</span>
                </div>
              )).reverse()}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <p className="text-sm font-semibold uppercase tracking-wide text-jam">How the jar fills up</p>
        <h2 className="mt-1 text-2xl font-bold">From the back door to the audit</h2>
        {/* A pantry shelf on a wide screen, a list of jars on a phone. Each step adds to the jar. */}
        <ol className="mt-8 grid gap-6 lg:grid-cols-5 lg:gap-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 lg:flex-col lg:gap-0">
              <div className="flex h-28 w-16 shrink-0 items-end lg:h-40 lg:w-full lg:justify-center lg:border-b-8 lg:border-jam-dark">
                <Jar body={stepJars[i]} className="w-14 lg:w-20" />
              </div>
              <div className="lg:mt-4">
                <div className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="text-jam">{i + 1}.</span>
                  <h3>{s.title}</h3>
                  {i === steps.length - 1 && <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-jam-dark">Jam packed</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/features/" className="mt-8 inline-block font-semibold text-jam hover:underline">See all features →</Link>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-jam">Whatever goes in your jar</p>
          <h2 className="mt-1 text-2xl font-bold">Made here, grown here</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Tell JamPacked what you do and production fits it, with its own tab, its own words and the checks your
            programme asks for on every batch.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {operationCards.map(([heading, body], i) => (
              <div key={heading} className="overflow-hidden rounded-3xl border border-border bg-bg">
                <div className="jar-lid h-3" />
                <div className="p-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-jam-dark">
                    {["Kitchen", "Production", "Harvest"][i]} tab
                  </span>
                  <h3 className="mt-1 font-semibold">{heading}</h3>
                  <p className="mt-2 text-sm text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">Doing a bit of everything? Choose Mixed / other and you get all of it.</p>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-jam">Every jar gets a label</p>
            <h2 className="mt-1 text-2xl font-bold">Label it once. Scan it forever.</h2>
            <p className="mt-3 text-muted">
              Enter a product, supply, supplier or customer once. Next time it comes up, at goods inwards, in a recipe,
              in production or on a dispatch, search for it or scan the barcode and everything is already there: name,
              unit, storage and allergens.
            </p>
          </div>
          {/* A jar label, the way the app remembers a product. */}
          <div aria-hidden className="mx-auto w-full max-w-sm -rotate-2 rounded-[2rem] border-2 border-dashed border-jam/50 bg-cream p-6 text-ink shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-jam-dark">Product</p>
            <p className="text-xl font-bold">Strawberries, 1 kg punnet</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Unit</dt><dd>Punnet</dd>
              <dt className="text-muted">Storage</dt><dd>Chilled, 0 to 5°C</dd>
              <dt className="text-muted">Allergens</dt><dd>None</dd>
              <dt className="text-muted">Batch</dt><dd>Traced to supplier and customer</dd>
            </dl>
            <div className="barcode mt-5 h-10 rounded" />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-cream">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-jam-dark">Lid off</p>
          <h2 className="mt-1 text-2xl font-bold">See what&apos;s inside</h2>
          <p className="mt-3 max-w-2xl text-muted">The real app, on a phone at the back door.</p>
          <div className="-mx-4 mt-8 flex snap-x gap-6 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {[shots.receive, shots.production, shots.trace, shots.insights].map((s) => (
              <Phone key={s.src} shot={s} className="w-56 shrink-0 snap-center sm:w-auto" />
            ))}
          </div>
          <Link href="/help/" className="mt-6 inline-block font-semibold text-jam hover:underline">How to use it, step by step →</Link>
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-jam">Pick your jar size</p>
          <h2 className="mt-1 text-2xl font-bold">Built around your programme</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Pick the National Programme your business is registered under and JamPacked asks for the checks and records
            it needs. Doing a bit of more than one? Build a custom programme from the parts that apply.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {programmes.map((p) => (
              <Link key={p.slug} href={`/programmes/${p.slug}/`} className="group rounded-3xl border border-border bg-bg p-5 hover:border-jam">
                <div className="flex h-20 items-end gap-1.5">
                  {p.slug === "custom"
                    ? [JAR.large, JAR.medium, JAR.small].map((b) => <Jar key={b} body={b} className="w-9" />)
                    : <Jar body={programmeJar[p.slug] ?? JAR.medium} className="w-11" />}
                </div>
                <span className="mt-4 block text-xs font-semibold uppercase tracking-wide text-jam-dark">{p.risk}</span>
                <h3 className="mt-1 font-semibold group-hover:text-jam">{p.name}</h3>
                <p className="mt-2 text-sm text-muted">{p.summary}</p>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Based on MPI&apos;s National Programme guidance (Dec 2025): a starting point, not endorsed by MPI or FSANZ.
          </p>
        </div>
      </section>

      <section className="bg-burgundy text-peach">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Priced by the jar. NP1 is free.</h2>
            <p className="mt-2 max-w-xl text-peach/80">
              {priceSummary()} Every paid plan has a {pricing.moneyBackDays}-day money-back guarantee.
            </p>
          </div>
          <Link href="/store/" className="btn-rose shrink-0 rounded-full px-6 py-3 text-center font-semibold">
            See pricing
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-bold">Questions?</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Who it&apos;s for, how it fits with your verifier, what it runs on and how licences work.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/faq/" className="rounded-full border border-ink/20 px-5 py-3 text-center font-semibold hover:bg-surface">Read the FAQ</Link>
          <Link href="/contact/" className="rounded-full border border-ink/20 px-5 py-3 text-center font-semibold hover:bg-surface">Contact us</Link>
        </div>
      </section>
    </>
  );
}
