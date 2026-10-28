import Link from "next/link";
import { Faqs } from "@/components/Faqs";
import { JsonLd } from "@/components/JsonLd";
import { generalFaqs, licenceFaqs } from "@/lib/content";
import { breadcrumbs, faqPage, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/faq/",
  "Frequently asked questions",
  "Who JamPacked is for, which MPI National Programmes it supports, how it fits with your verifier, what it runs on, and how licences work.",
);

export default function Faq() {
  const general = generalFaqs();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={faqPage([...general, ...licenceFaqs])} />
      <JsonLd data={breadcrumbs([["Home", "/"], ["FAQ", "/faq/"]])} />
      <h1 className="text-3xl font-bold sm:text-4xl">Frequently asked questions</h1>
      <h2 className="mt-10 text-xl font-bold">About JamPacked</h2>
      <div className="mt-2"><Faqs items={general} /></div>
      <h2 className="mt-10 text-xl font-bold">Licences</h2>
      <div className="mt-2"><Faqs items={licenceFaqs} /></div>
      <p className="mt-10 text-muted">
        Something else? <Link href="/contact/" className="font-semibold text-jam hover:underline">Get in touch</Link>.
      </p>
    </div>
  );
}
