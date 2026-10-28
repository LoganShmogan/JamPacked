import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Analytics } from "@/components/Analytics";
import { site } from "@/lib/site";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "JamPacked: food safety records that fill themselves in", template: "%s · JamPacked" },
  description: site.description,
  openGraph: { title: "JamPacked", description: site.description, images: ["/logo.jpg"], locale: "en_NZ", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NZ" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Image src="/logo.jpg" alt="" width={36} height={36} className="rounded-lg" />
              JamPacked
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/#features" className="hidden sm:inline text-muted hover:text-ink">Features</Link>
              <Link href="/#faq" className="hidden sm:inline text-muted hover:text-ink">FAQ</Link>
              <a href={site.appUrl} className="rounded-lg bg-jam px-4 py-2 font-semibold text-on-jam hover:bg-jam-dark">
                Open the app
              </a>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border bg-surface text-sm text-muted">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 sm:flex-row sm:justify-between">
            <p>
              © {new Date().getFullYear()} {site.company}, trading as JamPacked · NZBN {site.nzbn}
            </p>
            <a href={`mailto:${site.email}`} className="hover:text-ink">{site.email}</a>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
