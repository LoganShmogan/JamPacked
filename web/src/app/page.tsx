import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { steps } from "@/lib/content";
import { programmes } from "@/lib/programmes";
import { pageMetadata, softwareApplication } from "@/lib/seo";
import { site } from "@/lib/site";

const title = "JamPacked: food safety records that fill themselves in";

export const metadata: Metadata = {
  ...pageMetadata("/", title, site.description),
  title: { absolute: title },
};

// An overview: each section is a short teaser that links to its own page.
export default function Home() {
  return (
    <>
      <JsonLd data={softwareApplication()} />

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
        <Link href="/features/" className="mt-6 inline-block font-semibold text-jam hover:underline">See all features →</Link>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-bold">Built around your programme</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Pick the National Programme your business is registered under and JamPacked asks for the checks and records
            it needs. Doing a bit of more than one? Build a custom programme from the parts that apply.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {programmes.map((p) => (
              <Link key={p.slug} href={`/programmes/${p.slug}/`} className="group rounded-xl border border-border bg-bg p-5 hover:border-jam">
                <span className="text-xs font-semibold uppercase tracking-wide text-jam-dark">{p.risk}</span>
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

      <section className="bg-cream">
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

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-bold">Questions?</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Who it&apos;s for, how it fits with your verifier, what it runs on and how licences work.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/faq/" className="rounded-lg border border-ink/20 px-5 py-3 text-center font-semibold hover:bg-surface">Read the FAQ</Link>
          <Link href="/contact/" className="rounded-lg border border-ink/20 px-5 py-3 text-center font-semibold hover:bg-surface">Contact us</Link>
        </div>
      </section>
    </>
  );
}
