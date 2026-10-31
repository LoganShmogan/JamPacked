import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Phone } from "@/components/Phone";
import { guides, supportEmail } from "@/lib/guides";
import { shots, type ShotName } from "@/lib/screenshots";
import { breadcrumbs, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/help/",
  "Help: how to use JamPacked",
  "Step-by-step guides for JamPacked: receiving deliveries, stock, making batches, recipes, temperature checks, audits, trace and recall.",
);

/** The app's how-to guides, with screenshots, and how to reach a person. */
export default function Help() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <JsonLd data={breadcrumbs([["Home", "/"], ["Help", "/help/"]])} />
      <h1 className="text-3xl font-bold sm:text-4xl">How to use JamPacked</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Step-by-step guides for everyday tasks. The same guides are in the app: tap the ? on the home screen, or go to
        More › Help &amp; support.
      </p>

      <nav aria-label="Guides" className="mt-8 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Guides</h2>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.id}>
              <a href={`#${g.id}`} className="text-jam hover:underline">{g.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      {guides.map((g) => (
        <section key={g.id} id={g.id} className="mt-14 grid scroll-mt-24 gap-8 md:grid-cols-[1fr_15rem]">
          <div>
            <h2 className="text-2xl font-bold">{g.title}</h2>
            <p className="mt-2 text-muted">{g.summary}</p>
            <p className="mt-3 text-sm font-semibold text-jam-dark">Where: {g.where}</p>
            <ol className="mt-4 list-decimal space-y-2 pl-6">
              {g.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            {g.tip && <p className="mt-4 rounded-lg bg-cream p-4 text-sm">Tip: {g.tip}</p>}
          </div>
          {g.screenshot && <Phone shot={shots[g.screenshot as ShotName]} className="mx-auto w-56 md:w-full" />}
        </section>
      ))}

      <section className="mt-16 rounded-xl bg-cream p-6">
        <h2 className="text-xl font-bold">Still stuck?</h2>
        <p className="mt-2 text-muted">
          Email <a href={`mailto:${supportEmail}`} className="font-semibold text-jam hover:underline">{supportEmail}</a> with
          your business name and what you were trying to do. A person in New Zealand will reply. Or see the{" "}
          <Link href="/faq/" className="font-semibold text-jam hover:underline">FAQ</Link>.
        </p>
      </section>
    </div>
  );
}
