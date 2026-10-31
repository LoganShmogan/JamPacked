import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/lib/site";

export type LegalSection = { heading: string; body: ReactNode[] };

/** A versioned legal document: the date at the top is the version people agree to. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link> /{" "}
        <Link href="/legal/" className="hover:text-ink">Legal</Link>
      </nav>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">{site.company}, trading as JamPacked · Last updated {updated}</p>
      <div className="mt-6 text-lg text-muted">{intro}</div>
      {sections.map((s, i) => (
        <section key={s.heading} className="mt-10">
          <h2 className="text-xl font-bold">{i + 1}. {s.heading}</h2>
          <div className="mt-3 space-y-3 leading-relaxed">
            {s.body.map((b, j) => <div key={j}>{b}</div>)}
          </div>
        </section>
      ))}
      <p className="mt-12 text-sm text-muted">
        Questions about this document? Email <a href={`mailto:${site.email}`} className="font-semibold text-jam">{site.email}</a>.
        {" "}<Link href="/legal/" className="font-semibold text-jam hover:underline">All legal documents</Link>
      </p>
    </article>
  );
}
