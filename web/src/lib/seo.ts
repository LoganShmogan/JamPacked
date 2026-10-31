// Structured data (schema.org JSON-LD) so search engines can show the business, the app, its price
// and the FAQ as rich results. Rendered with <JsonLd> on each page.
import type { Metadata } from "next";
import { formatPrice, pricing, site } from "./site";

/** A page's title, description, canonical URL and social preview, all pointing at the same path. */
export function pageMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: site.name, images: ["/logo.jpg"], locale: "en_NZ", type: "website" },
    twitter: { card: "summary", title, description, images: ["/logo.jpg"] },
  };
}

export const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.company,
  alternateName: site.name,
  url: site.url,
  logo: `${site.url}/logo.jpg`,
  email: site.email,
  areaServed: ["NZ", "AU"],
  identifier: { "@type": "PropertyValue", propertyID: "NZBN", value: site.nzbn },
};

/** The app, with an offer per priced plan (none until prices are set). */
export function softwareApplication() {
  const offers = pricing.plans.flatMap((p) =>
    pricing.periods
      .filter((period) => p.prices.yearly > 0 || period.key === "yearly") // a free plan is one offer
      .map((period) => {
        const price = p.prices[period.key];
        return {
          "@type": "Offer",
          name: price ? `${p.name} ${period.name.toLowerCase()} licence` : `${p.name} licence`,
          price: price.toFixed(2),
          priceCurrency: pricing.currency,
          url: `${site.url}/store/`,
          description: price ? `${formatPrice(price)} per business per ${period.per}, incl. GST` : p.summary,
        };
      }),
  );
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    url: site.url,
    description: site.description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Android, iOS, Web",
    publisher: { "@type": "Organization", name: site.company },
    offers,
  };
}

export const faqPage = (faqs: [string, string][]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

export const breadcrumbs = (items: [string, string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${site.url}${path}` })),
});
