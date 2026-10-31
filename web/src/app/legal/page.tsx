import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { legalDocs } from "@/lib/legal";
import { breadcrumbs, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata(
  "/legal/",
  "Legal",
  "JamPacked's Terms of Service, Privacy Policy and Cookies & data policy, from Save Point Limited.",
);

/** Every legal document, with the version (date) currently in force. */
export default function Legal() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbs([["Home", "/"], ["Legal", "/legal/"]])} />
      <h1 className="text-3xl font-bold sm:text-4xl">Legal</h1>
      <p className="mt-4 text-lg text-muted">
        JamPacked is provided by {site.company} (NZBN {site.nzbn}). These documents apply to the app and this website.
      </p>
      <ul className="mt-8 space-y-4">
        {Object.values(legalDocs).map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="group block rounded-xl border border-border bg-surface p-5 hover:border-jam">
              <h2 className="text-xl font-bold group-hover:text-jam">{d.title}</h2>
              <p className="mt-1 text-sm text-muted">Last updated {d.updated}</p>
              <p className="mt-3 text-muted">{d.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-muted">
        Questions? Email <a href={`mailto:${site.email}`} className="font-semibold text-jam">{site.email}</a>.
      </p>
    </div>
  );
}
