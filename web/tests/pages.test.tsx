// The public pages: landing page, programmes, contact, legal, layout, robots and sitemap.
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import RootLayout, { metadata } from "@/app/layout";
import Home, { metadata as homeMetadata } from "@/app/page";
import AdminLayout, { metadata as adminMetadata } from "@/app/admin/layout";
import Programmes from "@/app/programmes/page";
import Programme, { generateMetadata, generateStaticParams } from "@/app/programmes/[slug]/page";
import Contact from "@/app/contact/page";
import Features from "@/app/features/page";
import Faq from "@/app/faq/page";
import Terms from "@/app/legal/terms/page";
import Privacy from "@/app/legal/privacy/page";
import Cookies from "@/app/legal/cookies/page";
import Legal, { metadata as legalMetadata } from "@/app/legal/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { site } from "@/lib/site";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const ldTypes = (container: HTMLElement) =>
  [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.innerHTML)["@type"]);

describe("landing page", () => {
  test("an overview that links out to its own pages, not to parts of itself", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Food safety records that fill themselves in.");
    expect(screen.getByRole("link", { name: "Get JamPacked" })).toHaveAttribute("href", "/store/");
    expect(screen.getByRole("link", { name: "Find your programme" })).toHaveAttribute("href", "/programmes/");
    expect(screen.getByRole("link", { name: "See all features →" })).toHaveAttribute("href", "/features/");
    expect(screen.getByRole("link", { name: "See pricing" })).toHaveAttribute("href", "/store/");
    expect(screen.getByRole("link", { name: "Read the FAQ" })).toHaveAttribute("href", "/faq/");
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact/");
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByRole("heading").textContent)).toEqual([
      "Receive", "Store", "Make", "Trace", "Audit",
    ]);
    expect(screen.getByRole("heading", { name: "Type it once. Scan it forever." })).toBeInTheDocument();
    expect(screen.getByText(/NP1 is free for one person with no staff\. NP2 is \$50 a month or \$500 a year/)).toBeInTheDocument();
    expect(screen.getByText(/30-day money-back guarantee/)).toBeInTheDocument();
    for (const [name, slug] of [["National Programme 1", "np1"], ["National Programme 2", "np2"], ["National Programme 3", "np3"], ["Custom programme", "custom"]]) {
      expect(screen.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", `/programmes/${slug}/`);
    }
    expect(screen.getByText(/not endorsed by MPI or FSANZ/)).toBeInTheDocument();
    expect([...container.querySelectorAll("a")].filter((a) => a.getAttribute("href")!.includes("#"))).toEqual([]);
    expect(ldTypes(container)).toEqual(["SoftwareApplication"]);
    expect(homeMetadata.title).toEqual({ absolute: "JamPacked: food safety records that fill themselves in" });
    expect(homeMetadata.alternates).toEqual({ canonical: "/" });
  });
});

test("features page: how it works and every feature group", () => {
  const { container } = render(<Features />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Features");
  for (const g of ["How it works", "Deliveries and stock", "Food safety records", "Your team and your records"]) {
    expect(screen.getByRole("heading", { level: 2, name: g })).toBeInTheDocument();
  }
  expect(screen.getByRole("heading", { name: "Holds, recalls and stocktakes" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Get JamPacked" })).toHaveAttribute("href", "/store/");
  expect(ldTypes(container)).toEqual(["BreadcrumbList"]);
});

describe("FAQ page", () => {
  test("general and licence questions, all marked up for search", () => {
    const { container } = render(<Faq />);
    expect(container.querySelectorAll("details")).toHaveLength(13);
    expect(screen.getByText(/No\. JamPacked helps you keep the records/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "NP1 is free for one person with no staff. NP2 is $50 a month or $500 a year, NP3 $100 a month or $1000 a year " +
          "and a custom programme $120 a month or $1200 a year, per business, incl. GST. Every paid plan has a 30-day money-back guarantee.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/once an NP1 business adds staff, it's charged at the NP2 price/)).toBeInTheDocument();
    expect(screen.getByText(/email us within 30 days of paying/)).toBeInTheDocument();
    expect(screen.getByText("Do I have to type everything in?")).toBeInTheDocument();
    expect(screen.getByText("Can I buy in the app?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "/contact/");
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.innerHTML));
    expect(ld.map((d) => d["@type"])).toEqual(["FAQPage", "BreadcrumbList"]);
    expect(ld[0].mainEntity).toHaveLength(13);
  });
});

describe("programme pages", () => {
  const props = (slug: string) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });

  test("the overview links to every programme", () => {
    const { container } = render(<Programmes />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Programmes");
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/programmes/np1/", "/programmes/np2/", "/programmes/np3/", "/programmes/custom/", "/store/",
    ]);
    expect(screen.getByText(/Each is priced on its own/)).toBeInTheDocument();
    expect(ldTypes(container)).toEqual(["BreadcrumbList"]);
  });

  test("one static page per programme", () => {
    expect(generateStaticParams()).toEqual([{ slug: "np1" }, { slug: "np2" }, { slug: "np3" }, { slug: "custom" }]);
  });

  test("a National Programme page: who it's for, what's recorded, and links to the others", async () => {
    render(await Programme(props("np2")));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("National Programme 2");
    expect(screen.getByRole("heading", { name: "Use NP2 if you" })).toBeInTheDocument();
    expect(screen.getByText("Early Childhood Centre (ECE) / Kōhanga Reo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get JamPacked" })).toHaveAttribute("href", "/store/");
    expect(screen.getByRole("heading", { name: "What NP2 costs" })).toBeInTheDocument();
    expect(screen.getByText(/^\$50 a month or \$500 a year per business, incl\. GST, with a 30-day money-back guarantee\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "National Programme 1" })).toHaveAttribute("href", "/programmes/np1/");
    expect(screen.queryByRole("link", { name: "National Programme 2" })).not.toBeInTheDocument();
    const meta = await generateMetadata(props("np2"));
    expect(meta.title).toBe("National Programme 2 (NP2) food safety records");
    expect(meta.description).toMatch(/keeps the records NP2 needs\.$/);
    expect(meta.alternates).toEqual({ canonical: "/programmes/np2/" });
  });

  test("the NP1 page: free on your own, the NP2 price with staff", async () => {
    render(await Programme(props("np1")));
    expect(
      screen.getByText(/^Free for one person running the business with no staff\. Once you add staff it's charged at the NP2 price, \$50 a month or \$500 a year\./),
    ).toBeInTheDocument();
  });

  test("the custom programme page", async () => {
    render(await Programme(props("custom")));
    expect(screen.getByRole("heading", { name: "Build your own if you" })).toBeInTheDocument();
    expect(screen.getByText(/^\$120 a month or \$1200 a year per business/)).toBeInTheDocument();
    const meta = await generateMetadata(props("custom"));
    expect(meta.title).toBe("Custom food safety programme");
    expect(meta.description).toMatch(/keeps the records your programme needs\.$/);
  });

  test("an unknown programme is a 404", async () => {
    await expect(Programme(props("np9"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await generateMetadata(props("np9"))).toEqual({});
  });
});

test("contact page: email by topic, and who runs JamPacked", () => {
  render(<Contact />);
  expect(screen.getByRole("link", { name: /Buying a licence/ })).toHaveAttribute("href", `mailto:${site.email}?subject=JamPacked%20licence`);
  expect(screen.getByText(/Save Point Limited \(NZBN 9429053325013\)/)).toBeInTheDocument();
});

describe("legal pages", () => {
  test("the Legal page links to every document with its current date", () => {
    const { container } = render(<Legal />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Legal");
    expect(screen.getByText(/Save Point Limited \(NZBN 9429053325013\)/)).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/legal/terms/", "/legal/privacy/", "/legal/cookies/", `mailto:${site.email}`,
    ]);
    expect(screen.getByRole("link", { name: /Terms of Service.*Last updated 31 October 2026/ })).toBeInTheDocument();
    expect(ldTypes(container)).toEqual(["BreadcrumbList"]);
    expect(legalMetadata.alternates).toEqual({ canonical: "/legal/" });
  });

  test.each([
    [Terms, "Terms of Service", "Liability"],
    [Privacy, "Privacy Policy", "Your rights"],
    [Cookies, "Cookies & data policy", "This website"],
  ])("%#: dated, numbered, naming the provider and linking back to Legal", (Page, title, section) => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(screen.getByText("Save Point Limited, trading as JamPacked · Last updated 31 October 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: new RegExp(`^\\d+\\. ${section}$`) })).toBeInTheDocument();
    const breadcrumb = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
    expect(breadcrumb.getByRole("link", { name: "Legal" })).toHaveAttribute("href", "/legal/");
    expect(screen.getByRole("link", { name: "All legal documents" })).toHaveAttribute("href", "/legal/");
  });

  test("the terms: plans by programme, NP1 with staff, money back, production and allergens", () => {
    render(<Terms />);
    expect(screen.getByRole("heading", { name: "2. Licences and plans" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Store" })).toHaveAttribute("href", "/store/");
    expect(screen.getByText(/Once anyone else is invited to an NP1 business, it needs the NP2 plan/)).toBeInTheDocument();
    expect(screen.getByText(/its plan changes to match from the next billing period/)).toBeInTheDocument();
    expect(screen.getByText(/at least 30 days beforehand/)).toBeInTheDocument();
    expect(screen.getByText(/Money-back guarantee: if you ask within 30 days of the first payment/)).toBeInTheDocument();
    expect(screen.getByText(/once per business, to the first payment only/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Production, allergens and product details/ })).toBeInTheDocument();
    expect(screen.getByText(/These are aids, not checks/)).toBeInTheDocument();
    expect(screen.getByText(/production \(recipes and the batches you make\)/)).toBeInTheDocument();
    expect(screen.getByText(/the customers you dispatch stock to/)).toBeInTheDocument();
  });

  test("the privacy policy covers customers and suppliers you enter, and barcode lookups", () => {
    render(<Privacy />);
    expect(screen.getByText(/the names of customers stock is dispatched to/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Information about other people/ })).toBeInTheDocument();
    expect(screen.getByText(/the barcode number, and nothing else, is sent to Open Food Facts/)).toBeInTheDocument();
    expect(screen.getByText(/The free NP1 plan involves no payment/)).toBeInTheDocument();
  });

  test("the cookie policy says the site sets no cookies, and what the app keeps", () => {
    render(<Cookies />);
    expect(screen.getByText(/The website sets no cookies/)).toBeInTheDocument();
    expect(screen.getByText(/remembers which business you last worked in/)).toBeInTheDocument();
  });
});

describe("layout", () => {
  test("header, footer with the company details and legal links, and metadata", () => {
    const html = renderToStaticMarkup(<RootLayout params={Promise.resolve({})}><p>child</p></RootLayout>);
    expect(html).toContain('lang="en-NZ"');
    expect(html).toContain("font-figtree");
    expect(html).toContain("<p>child</p>");
    expect(html).toContain(`© ${new Date().getFullYear()} Save Point Limited, trading as JamPacked · NZBN 9429053325013`);
    expect(html).toContain(`href="mailto:${site.email}"`);
    for (const href of ["/features/", "/programmes/", "/store/", "/faq/", "/contact/", "/legal/", "/legal/terms/", "/legal/privacy/", "/legal/cookies/", site.appUrl]) {
      expect(html).toContain(`href="${href}"`);
    }
    // Legal is in the header (desktop and the phone menu), not only the footer.
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(header.match(/href="\/legal\/"/g)).toHaveLength(2);
    expect(html).toContain('"@type":"Organization"');
    expect(metadata.metadataBase?.toString()).toBe(`${site.url}/`);
    expect(metadata.description).toBe(site.description);
    expect(metadata.alternates).toBeUndefined(); // canonical URLs are per page
  });

  test("the admin pages are kept out of search engines", async () => {
    expect(adminMetadata.robots).toEqual({ index: false, follow: false });
    render(await AdminLayout({ children: <p>inside</p>, params: Promise.resolve({}) }));
    expect(screen.getByText("inside")).toBeInTheDocument();
  });
});

test("robots.txt blocks /admin and /welcome and points at the sitemap", () => {
  expect(robots()).toEqual({
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/welcome/"] },
    sitemap: "https://jampacked.co.nz/sitemap.xml",
  });
});

test("the sitemap lists every public page", () => {
  const entries = sitemap();
  expect(entries.map((e) => e.url.replace(site.url, ""))).toEqual([
    "/", "/store/", "/features/", "/programmes/", "/programmes/np1/", "/programmes/np2/", "/programmes/np3/",
    "/programmes/custom/", "/faq/", "/contact/", "/legal/", "/legal/terms/", "/legal/privacy/", "/legal/cookies/",
  ]);
  expect(entries[0]).toEqual({ url: "https://jampacked.co.nz/", changeFrequency: "monthly", priority: 1 });
  expect(entries.at(-1)).toMatchObject({ changeFrequency: "yearly", priority: 0.3 });
});
