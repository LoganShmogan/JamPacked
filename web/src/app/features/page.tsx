import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { featureGroups, steps } from "@/lib/content";
import { breadcrumbs, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/features/",
  "Features: goods inwards, stock, temperatures and audits",
  "Goods inwards with barcode scanning, stock by location, temperature logs, corrective actions, programme records and self-filling audits, on Android, iPhone and the web.",
);

export default function Features() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <JsonLd data={breadcrumbs([["Home", "/"], ["Features", "/features/"]])} />
      <h1 className="text-3xl font-bold sm:text-4xl">Features</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Everything a food business needs to receive, store and trace food, and to show its records when the verifier
        calls. Every feature is in every licence.
      </p>

      <h2 className="mt-12 text-2xl font-bold">How it works</h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-xl border border-border bg-surface p-5">
            <span className="text-sm font-bold text-jam">{i + 1}</span>
            <h3 className="mt-1 font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      {featureGroups.map((g) => (
        <section key={g.heading} className="mt-14">
          <h2 className="text-2xl font-bold">{g.heading}</h2>
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {g.features.map(([title, body]) => (
              <div key={title}>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-14 flex flex-col gap-4 rounded-xl bg-cream p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">See what your programme asks for</h2>
          <p className="mt-1 text-muted">NP1, NP2, NP3 or your own custom programme.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/programmes/" className="rounded-lg border border-ink/20 px-5 py-3 text-center font-semibold hover:bg-surface">Programmes</Link>
          <Link href="/store/" className="rounded-lg bg-jam px-5 py-3 text-center font-semibold text-on-jam hover:bg-jam-dark">Get JamPacked</Link>
        </div>
      </div>
    </div>
  );
}
