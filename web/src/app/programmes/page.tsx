import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { programmes } from "@/lib/programmes";
import { breadcrumbs, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/programmes/",
  "MPI National Programme 1, 2 and 3 record keeping",
  "Food safety records for MPI National Programmes 1, 2 and 3, or a custom programme built from the parts that apply to your business.",
);

export default function Programmes() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <JsonLd data={breadcrumbs([["Home", "/"], ["Programmes", "/programmes/"]])} />
      <h1 className="text-3xl font-bold sm:text-4xl">Programmes</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        JamPacked comes with modules for MPI&apos;s National Programmes 1, 2 and 3. Choose the one you&apos;re registered
        under, tick the kinds of food business you run, and the app only asks for what applies. If you sit across more
        than one, or follow your own plan, build a custom programme from the parts you need.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {programmes.map((p) => (
          <Link key={p.slug} href={`/programmes/${p.slug}/`} className="group rounded-xl border border-border bg-surface p-6 hover:border-jam">
            <span className="text-xs font-semibold uppercase tracking-wide text-jam-dark">{p.risk}</span>
            <h2 className="mt-1 text-xl font-semibold group-hover:text-jam">{p.name}</h2>
            <p className="mt-2 text-muted">{p.summary}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-jam">What {p.short} covers →</span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">
        Modules are based on MPI&apos;s National Programme guidance (Dec 2025). They&apos;re a starting point, not endorsed
        by MPI or FSANZ: check them against your registration. Each is priced on its own: <Link href="/store/" className="font-semibold text-jam hover:underline">see pricing</Link>.
      </p>
    </div>
  );
}
