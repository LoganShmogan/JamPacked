import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata(
  "/contact/",
  "Contact",
  "Get in touch with JamPacked about licences, setting up your business, or support. Run by Save Point Limited, New Zealand.",
);

const topics = [
  ["Buying a licence", "Questions about pricing, several businesses, or paying by invoice.", "JamPacked licence"],
  ["Help with the app", "Signing in, setting up your programme, or something not working.", "JamPacked support"],
  ["Privacy and your data", "Access to or correction of your personal information, or exporting records.", "JamPacked privacy request"],
];

export default function Contact() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">Contact</h1>
      <p className="mt-4 text-lg text-muted">
        Email us at <a href={`mailto:${site.email}`} className="font-semibold text-jam">{site.email}</a>. We reply
        within one business day (Monday to Friday, New Zealand time).
      </p>
      <div className="mt-8 space-y-4">
        {topics.map(([title, body, subject]) => (
          <a key={title} href={`mailto:${site.email}?subject=${encodeURIComponent(subject)}`} className="block rounded-xl border border-border bg-surface p-5 hover:border-jam">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </a>
        ))}
      </div>
      <h2 className="mt-12 text-xl font-bold">Who we are</h2>
      <p className="mt-2 text-muted">
        JamPacked is made and sold by {site.company} (NZBN {site.nzbn}), a New Zealand company. See our{" "}
        <Link href="/legal/terms/" className="underline">Terms</Link>,{" "}
        <Link href="/legal/privacy/" className="underline">Privacy Policy</Link> and{" "}
        <Link href="/legal/cookies/" className="underline">Cookies &amp; data policy</Link>.
      </p>
    </div>
  );
}
