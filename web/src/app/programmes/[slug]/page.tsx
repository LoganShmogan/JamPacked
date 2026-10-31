import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { planPrice } from "@/lib/content";
import { programmeBySlug, programmes } from "@/lib/programmes";
import { breadcrumbs, pageMetadata } from "@/lib/seo";

// One page per programme, built at export time.
export const dynamicParams = false;
export const generateStaticParams = () => programmes.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: PageProps<"/programmes/[slug]">) {
  const p = programmeBySlug((await params).slug);
  if (!p) return {};
  const title = p.slug === "custom" ? "Custom food safety programme" : `${p.name} (${p.short}) food safety records`;
  return pageMetadata(`/programmes/${p.slug}/`, title, `${p.summary} JamPacked keeps the records ${p.short === "Custom" ? "your programme" : p.short} needs.`);
}

export default async function Programme({ params }: PageProps<"/programmes/[slug]">) {
  const p = programmeBySlug((await params).slug);
  if (!p) notFound();
  const others = programmes.filter((o) => o.slug !== p.slug);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbs([["Home", "/"], ["Programmes", "/programmes/"], [p.name, `/programmes/${p.slug}/`]])} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/programmes/" className="hover:text-ink">Programmes</Link> / {p.short}
      </nav>
      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-jam-dark">{p.risk}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{p.name}</h1>
      <p className="mt-4 text-lg text-muted">{p.summary}</p>

      <h2 className="mt-10 text-xl font-bold">{p.slug === "custom" ? "Build your own if you" : `Use ${p.short} if you`}</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        {p.whoFor.map((w) => <li key={w}>{w}</li>)}
      </ul>

      <h2 className="mt-10 text-xl font-bold">What JamPacked keeps for you</h2>
      <ul className="mt-3 space-y-2">
        {p.records.map((r) => (
          <li key={r} className="rounded-lg border border-border bg-surface px-4 py-3">{r}</li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-bold">Business types</h2>
      <p className="mt-2 text-muted">Tick the ones that apply and the app leaves out the checks that don&apos;t.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {p.businessTypes.map((b) => (
          <li key={b} className="rounded-full bg-cream px-3 py-1 text-sm">{b}</li>
        ))}
      </ul>

      <div className="mt-12 rounded-xl bg-cream p-6">
        <h2 className="text-xl font-bold">What {p.short} costs</h2>
        <p className="mt-2 text-muted">{planPrice(p.slug)} Every feature is included, and you can switch programme at any time.</p>
        <Link href="/store/" className="mt-4 inline-block rounded-lg bg-jam px-5 py-3 font-semibold text-on-jam hover:bg-jam-dark">
          Get JamPacked
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted">
        Based on MPI&apos;s National Programme guidance (Dec 2025). A starting point, not endorsed by MPI or FSANZ: your
        registered programme, verifier or EHO decide what&apos;s required.
      </p>
      <p className="mt-6 text-sm">
        Also see:{" "}
        {others.map((o, i) => (
          <span key={o.slug}>
            {i > 0 && " · "}
            <Link href={`/programmes/${o.slug}/`} className="font-semibold text-jam hover:underline">{o.name}</Link>
          </span>
        ))}
      </p>
    </article>
  );
}
