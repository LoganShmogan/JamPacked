// The public pages: landing page, programmes, contact, legal, layout, robots and sitemap.
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import RootLayout, { metadata } from "@/app/layout";
import Home, { metadata as homeMetadata } from "@/app/page";
import AdminLayout, { metadata as adminMetadata } from "@/app/admin/layout";
import Programmes from "@/app/programmes/page";
import Programme, { generateMetadata, generateStaticParams } from "@/app/programmes/[slug]/page";
import Contact from "@/app/contact/page";
import Terms from "@/app/legal/terms/page";
import Privacy from "@/app/legal/privacy/page";
import Cookies from "@/app/legal/cookies/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { pricing, site } from "@/lib/site";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const ldTypes = (container: HTMLElement) =>
  [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.innerHTML)["@type"]);

describe("landing page", () => {
  afterEach(() => {
    pricing.plans[0].price = null;
  });

  test("says what JamPacked does and sends people to the store and the programmes", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Food safety records that fill themselves in.");
    expect(screen.getAllByRole("link", { name: "Get JamPacked" })[0]).toHaveAttribute("href", "/store/");
    expect(screen.getByRole("link", { name: "Find your programme" })).toHaveAttribute("href", "/programmes/");
    expect(screen.getByRole("link", { name: "See pricing" })).toHaveAttribute("href", "/store/");
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByRole("heading").textContent)).toEqual([
      "Receive", "Store", "Trace", "Audit",
    ]);
    for (const [name, slug] of [["National Programme 1", "np1"], ["National Programme 2", "np2"], ["National Programme 3", "np3"], ["Custom programme", "custom"]]) {
      expect(screen.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", `/programmes/${slug}/`);
    }
    expect(screen.getByText(/not\s+endorsed by MPI or FSANZ/)).toBeInTheDocument();
    expect(ldTypes(container)).toEqual(["SoftwareApplication", "FAQPage"]);
    expect(homeMetadata.title).toEqual({ absolute: "JamPacked: food safety records that fill themselves in" });
    expect(homeMetadata.alternates).toEqual({ canonical: "/" });
  });

  test("the FAQ answers who it's for, MPI's role and price", () => {
    const { container } = render(<Home />);
    expect(container.querySelectorAll("#faq details")).toHaveLength(6);
    expect(screen.getByText(/No\. JamPacked helps you keep the records/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Pricing is being finalised: email ${site.email}`))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "/contact/");
  });

  test("once the monthly price is set, the FAQ quotes it", () => {
    pricing.plans[0].price = 49;
    render(<Home />);
    expect(screen.getByText(/^\$49 a month per business \(incl\. GST\)/)).toBeInTheDocument();
  });
});

describe("programme pages", () => {
  const props = (slug: string) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });

  test("the overview links to every programme", () => {
    const { container } = render(<Programmes />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Programmes");
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/programmes/np1/", "/programmes/np2/", "/programmes/np3/", "/programmes/custom/",
    ]);
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
    expect(screen.getByRole("link", { name: "National Programme 1" })).toHaveAttribute("href", "/programmes/np1/");
    expect(screen.queryByRole("link", { name: "National Programme 2" })).not.toBeInTheDocument();
    const meta = await generateMetadata(props("np2"));
    expect(meta.title).toBe("National Programme 2 (NP2) food safety records");
    expect(meta.description).toMatch(/keeps the records NP2 needs\.$/);
    expect(meta.alternates).toEqual({ canonical: "/programmes/np2/" });
  });

  test("the custom programme page", async () => {
    render(await Programme(props("custom")));
    expect(screen.getByRole("heading", { name: "Build your own if you" })).toBeInTheDocument();
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
  test.each([
    [Terms, "Terms of Service", "Liability"],
    [Privacy, "Privacy Policy", "Your rights"],
    [Cookies, "Cookies & data policy", "This website"],
  ])("%#: dated, numbered and naming the provider", (Page, title, section) => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(screen.getByText(/Save Point Limited, trading as JamPacked · Last updated 28 October 2026/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: new RegExp(`^\\d+\\. ${section}$`) })).toBeInTheDocument();
  });

  test("the cookie policy says the site sets no cookies", () => {
    render(<Cookies />);
    expect(screen.getByText(/The website sets no cookies/)).toBeInTheDocument();
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
    for (const href of ["/programmes/", "/store/", "/#faq", "/contact/", "/legal/terms/", "/legal/privacy/", "/legal/cookies/", site.appUrl]) {
      expect(html).toContain(`href="${href}"`);
    }
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
    "/", "/store/", "/programmes/", "/programmes/np1/", "/programmes/np2/", "/programmes/np3/", "/programmes/custom/",
    "/contact/", "/legal/terms/", "/legal/privacy/", "/legal/cookies/",
  ]);
  expect(entries[0]).toEqual({ url: "https://jampacked.co.nz/", changeFrequency: "monthly", priority: 1 });
  expect(entries.at(-1)).toMatchObject({ changeFrequency: "yearly", priority: 0.3 });
});
