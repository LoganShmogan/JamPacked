import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Analytics } from "@/components/Analytics";
import { JsonLd } from "@/components/JsonLd";
import { legalDocs } from "@/lib/legal";
import { organization } from "@/lib/seo";
import { site } from "@/lib/site";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "JamPacked: food safety records that fill themselves in", template: "%s · JamPacked" },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "food safety app", "food safety records", "MPI National Programme", "NP1", "NP2", "NP3",
    "food control plan", "goods inwards", "temperature log", "stock traceability", "New Zealand", "Australia",
  ],
  // Each page sets its own canonical URL (pageMetadata in lib/seo.ts); one here would leak to every page.
  openGraph: {
    title: "JamPacked", description: site.description, siteName: site.name,
    images: ["/logo.jpg"], locale: "en_NZ", type: "website",
  },
  twitter: { card: "summary", title: "JamPacked", description: site.description, images: ["/logo.jpg"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffaf4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1716" },
  ],
};

const nav = [
  ["Features", "/features/"],
  ["Programmes", "/programmes/"],
  ["Store", "/store/"],
  ["Help", "/help/"],
  ["FAQ", "/faq/"],
  ["Contact", "/contact/"],
  ["Legal", "/legal/"],
];

const legal = [
  ["Terms", legalDocs.terms.href],
  ["Privacy", legalDocs.privacy.href],
  ["Cookies & data", legalDocs.cookies.href],
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NZ" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
          <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Image src="/logo.jpg" alt="" width={36} height={36} className="rounded-lg" />
              JamPacked
            </Link>
            <div className="hidden items-center gap-5 text-sm lg:flex">
              {nav.map(([label, href]) => (
                <Link key={href} href={href} className="text-muted hover:text-ink">{label}</Link>
              ))}
              <Link href="/store/" className="rounded-lg bg-jam px-4 py-2 font-semibold text-on-jam hover:bg-jam-dark">
                Get JamPacked
              </Link>
            </div>
            {/* Phones: a plain disclosure menu, so it works before (and without) any JavaScript. */}
            <details className="relative lg:hidden">
              <summary aria-label="Menu" className="list-none rounded-lg border border-border px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Menu
              </summary>
              <div className="absolute right-0 mt-2 flex w-48 flex-col rounded-xl border border-border bg-surface p-2 shadow-lg">
                {nav.map(([label, href]) => (
                  <Link key={href} href={href} className="rounded-lg px-3 py-3 hover:bg-cream">{label}</Link>
                ))}
                <Link href="/store/" className="mt-1 rounded-lg bg-jam px-3 py-3 text-center font-semibold text-on-jam">
                  Get JamPacked
                </Link>
              </div>
            </details>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border bg-surface text-sm text-muted">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:justify-between">
            <div className="space-y-1">
              <p>© {new Date().getFullYear()} {site.company}, trading as JamPacked · NZBN {site.nzbn}</p>
              <a href={`mailto:${site.email}`} className="hover:text-ink">{site.email}</a>
            </div>
            <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
              {legal.map(([label, href]) => (
                <Link key={href} href={href} className="hover:text-ink">{label}</Link>
              ))}
              <a href={site.appUrl} className="hover:text-ink">Sign in</a>
            </nav>
          </div>
        </footer>
        <JsonLd data={organization} />
        <Analytics />
      </body>
    </html>
  );
}
