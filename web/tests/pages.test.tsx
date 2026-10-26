// The public pages: landing page, layout, robots and sitemap.
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import RootLayout, { metadata } from "@/app/layout";
import Home from "@/app/page";
import AdminLayout, { metadata as adminMetadata } from "@/app/admin/layout";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { site } from "@/lib/site";

describe("landing page", () => {
  test("says what JamPacked does and links to the app and contact email", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Food safety records that fill themselves in.");
    expect(screen.getByRole("link", { name: "Open the app" })).toHaveAttribute("href", site.appUrl);
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", `mailto:${site.email}?subject=JamPacked`);
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByRole("heading").textContent)).toEqual([
      "Receive", "Store", "Trace", "Audit",
    ]);
    for (const np of ["National Programme 1", "National Programme 2", "National Programme 3"]) {
      expect(screen.getByRole("heading", { name: np })).toBeInTheDocument();
    }
    expect(screen.getByText(/not\s+endorsed by MPI or FSANZ/)).toBeInTheDocument();
  });

  test("the FAQ answers who it's for, MPI's role and price", () => {
    const { container } = render(<Home />);
    const faqs = container.querySelectorAll("#faq details");
    expect(faqs).toHaveLength(6);
    expect(screen.getByText(/doesn't|No\. JamPacked helps you keep the records/)).toBeInTheDocument();
    expect(screen.getByText(`Pricing is being finalised. Email ${site.email} to get started.`)).toBeInTheDocument();
  });
});

describe("layout", () => {
  test("header, footer with the company details, and metadata", () => {
    const html = renderToStaticMarkup(<RootLayout params={Promise.resolve({})}><p>child</p></RootLayout>);
    expect(html).toContain('lang="en-NZ"');
    expect(html).toContain("font-figtree");
    expect(html).toContain("<p>child</p>");
    expect(html).toContain(`© ${new Date().getFullYear()} Save Point Limited, trading as JamPacked · NZBN 9429053325013`);
    expect(html).toContain(`href="mailto:${site.email}"`);
    expect(metadata.metadataBase?.toString()).toBe(`${site.url}/`);
    expect(metadata.description).toBe(site.description);
  });

  test("the admin pages are kept out of search engines", async () => {
    expect(adminMetadata.robots).toEqual({ index: false, follow: false });
    render(await AdminLayout({ children: <p>inside</p>, params: Promise.resolve({}) }));
    expect(screen.getByText("inside")).toBeInTheDocument();
  });
});

test("robots.txt blocks /admin and points at the sitemap", () => {
  expect(robots()).toEqual({
    rules: { userAgent: "*", allow: "/", disallow: "/admin/" },
    sitemap: "https://jampacked.co.nz/sitemap.xml",
  });
});

test("the sitemap lists the home page", () => {
  expect(sitemap()).toEqual([{ url: "https://jampacked.co.nz/", changeFrequency: "monthly", priority: 1 }]);
});
