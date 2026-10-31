// The store (licence plans and Buy), the after-payment welcome page, and picking the app for a device.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Store, { metadata as storeMetadata } from "@/app/store/page";
import Welcome, { metadata as welcomeMetadata } from "@/app/welcome/page";
import { REDIRECT_SECONDS } from "@/app/welcome/GetTheApp";
import { appLink, detectPlatform } from "@/lib/device";
import { formatPrice, pricing, site } from "@/lib/site";

const UA = {
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
};

const reset = () => {
  for (const p of pricing.plans) p.checkoutUrls = { monthly: null, yearly: null };
  site.playStoreUrl = null;
  site.appStoreUrl = null;
};
afterEach(reset);

describe("store", () => {
  const card = (name: string) => within(screen.getByRole("region", { name: `${name} plan` }));

  test("a plan per programme, yearly first; free NP1 opens the app, paid plans email until Stripe is set up", async () => {
    const { container } = render(<Store />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Priced by your programme");
    expect(screen.getByRole("radio", { name: "Yearly" })).toHaveAttribute("aria-checked", "true");
    expect(card("NP1").getByText("Free")).toBeInTheDocument();
    expect(card("NP1").getByText(/Add staff and it's the NP2 price/)).toBeInTheDocument();
    expect(card("NP1").getByRole("link", { name: "Start free" })).toHaveAttribute("href", site.appUrl);
    expect(card("NP1").queryByText(/Save/)).not.toBeInTheDocument();
    for (const [name, price, saving] of [["NP2", "$500", "$100"], ["NP3", "$1000", "$200"], ["Custom", "$1200", "$240"]]) {
      expect(card(name).getByText(price)).toBeInTheDocument();
      expect(card(name).getByText("/ year")).toBeInTheDocument();
      expect(card(name).getByText(`Save ${saving} a year`)).toBeInTheDocument();
    }
    expect(card("NP2").getByRole("link", { name: "Get started by email" })).toHaveAttribute(
      "href", `mailto:${site.email}?subject=JamPacked%20NP2%20yearly%20licence`,
    );
    expect(screen.getByText("30-day money-back guarantee")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(screen.getByRole("radio", { name: "Monthly" })).toHaveAttribute("aria-checked", "true");
    expect(card("NP3").getByText("$100")).toBeInTheDocument();
    expect(card("NP3").getByText("/ month")).toBeInTheDocument();
    expect(screen.queryByText(/Save \$/)).not.toBeInTheDocument();
    expect(card("NP3").getByRole("link", { name: "Get started by email" })).toHaveAttribute(
      "href", `mailto:${site.email}?subject=JamPacked%20NP3%20monthly%20licence`,
    );

    expect(screen.getByText("Enter a product or supply once, then pick it or scan it")).toBeInTheDocument();
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.innerHTML));
    expect(ld.map((d) => d["@type"])).toEqual(["SoftwareApplication", "BreadcrumbList"]); // FAQPage lives on /faq/
    expect(screen.getByText("Which plan do I need?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All questions →" })).toHaveAttribute("href", "/faq/");
    expect(storeMetadata.alternates).toEqual({ canonical: "/store/" });
  });

  test("with Stripe links, Buy goes to Stripe for the chosen period", async () => {
    pricing.plans[1].checkoutUrls = { monthly: "https://buy.stripe.com/np2-monthly", yearly: "https://buy.stripe.com/np2-yearly" };
    render(<Store />);
    expect(card("NP2").getByRole("link", { name: "Buy NP2" })).toHaveAttribute("href", "https://buy.stripe.com/np2-yearly");
    await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(card("NP2").getByRole("link", { name: "Buy NP2" })).toHaveAttribute("href", "https://buy.stripe.com/np2-monthly");
  });

  test("search engines get every paid plan and period, and NP1 once as free", () => {
    const { container } = render(<Store />);
    const app = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML);
    expect(app.offers.map((o: { name: string; price: string }) => [o.name, o.price])).toEqual([
      ["NP1 licence", "0.00"],
      ["NP2 monthly licence", "50.00"],
      ["NP2 yearly licence", "500.00"],
      ["NP3 monthly licence", "100.00"],
      ["NP3 yearly licence", "1000.00"],
      ["Custom monthly licence", "120.00"],
      ["Custom yearly licence", "1200.00"],
    ]);
    expect(app.offers[1]).toMatchObject({ priceCurrency: "NZD", description: "$50 per business per month, incl. GST" });
    expect(app.offers[0].description).toMatch(/no staff/);
  });

  test("formatPrice drops cents only for whole dollars", () => {
    expect(formatPrice(49)).toBe("$49");
    expect(formatPrice(49.5)).toBe("$49.50");
  });

  test("a plan with no yearly saving doesn't claim one", () => {
    const np2 = pricing.plans[1];
    const before = np2.prices;
    np2.prices = { monthly: 50, yearly: 600 };
    render(<Store />);
    expect(card("NP2").queryByText(/Save/)).not.toBeInTheDocument();
    np2.prices = before;
  });
});

describe("device detection", () => {
  test.each([
    [UA.android, 0, "android"],
    [UA.iphone, 5, "ios"],
    [UA.mac, 5, "ios"], // iPad in desktop mode
    [UA.mac, 0, "other"],
    [UA.windows, 0, "other"],
  ] as const)("%s (%i touch points) → %s", (ua, touch, platform) => {
    expect(detectPlatform(ua, touch)).toBe(platform);
  });

  test("defaults to no touch screen", () => {
    expect(detectPlatform(UA.mac)).toBe("other");
  });

  test("phones get the web app until the store listings exist, then their store", () => {
    expect(appLink("android")).toEqual({ url: site.appUrl, label: "Open the JamPacked web app" });
    expect(appLink("ios")).toEqual({ url: site.appUrl, label: "Open the JamPacked web app" });
    site.playStoreUrl = "https://play.google.com/store/apps/details?id=nz.co.jampacked.app";
    site.appStoreUrl = "https://apps.apple.com/nz/app/jampacked/id1";
    expect(appLink("android")).toEqual({ url: site.playStoreUrl, label: "Get it on Google Play" });
    expect(appLink("ios")).toEqual({ url: site.appStoreUrl, label: "Download on the App Store" });
    expect(appLink("other")).toEqual({ url: site.appUrl, label: "Open the JamPacked web app" });
  });
});

describe("welcome page", () => {
  const assign = vi.fn();
  const useDevice = (ua: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    assign.mockClear();
    vi.spyOn(window, "location", "get").mockReturnValue({ assign } as unknown as Location);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("is kept out of search results", () => {
    expect(welcomeMetadata.robots).toEqual({ index: false, follow: false });
  });

  test("an Android phone is sent to Google Play after a few seconds", () => {
    site.playStoreUrl = "https://play.google.com/store/apps/details?id=nz.co.jampacked.app";
    site.appStoreUrl = "https://apps.apple.com/nz/app/jampacked/id1";
    useDevice(UA.android);
    render(<Welcome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome to JamPacked");
    expect(screen.getByRole("link", { name: "Get it on Google Play" })).toHaveAttribute("href", site.playStoreUrl);
    expect(screen.getByRole("link", { name: "App Store" })).toHaveAttribute("href", site.appStoreUrl);
    act(() => vi.advanceTimersByTime(REDIRECT_SECONDS * 1000 - 1));
    expect(assign).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(assign).toHaveBeenCalledWith(site.playStoreUrl);
  });

  test("a computer goes to the web app, and Stay here stops the redirect", async () => {
    useDevice(UA.windows);
    render(<Welcome />);
    expect(screen.getByRole("link", { name: "Open the JamPacked web app" })).toHaveAttribute("href", site.appUrl);
    expect(screen.queryByRole("link", { name: "Google Play" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Web app (app.jampacked.co.nz)" })).toHaveAttribute("href", site.appUrl);
    await userEvent.click(screen.getByRole("button", { name: "Stay here" }));
    expect(screen.getByText("Take your time.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(REDIRECT_SECONDS * 1000 * 2));
    expect(assign).not.toHaveBeenCalled();
  });

  test("before the browser runs it (pre-rendered), there's no button yet", async () => {
    const { renderToString } = await import("react-dom/server");
    expect(renderToString(<Welcome />)).not.toContain("Taking you there");
  });
});
