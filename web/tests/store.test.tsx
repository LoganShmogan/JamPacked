// The store (licence plans and Buy), the after-payment welcome page, and picking the app for a device.
import { act, render, screen } from "@testing-library/react";
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
  for (const p of pricing.plans) Object.assign(p, { price: null, checkoutUrl: null });
  pricing.trialDays = null;
  site.playStoreUrl = null;
  site.appStoreUrl = null;
};
afterEach(reset);

describe("store", () => {
  test("before prices and Stripe links are set: price on request, Buy opens an email", async () => {
    const { container } = render(<Store />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("One licence per business");
    expect(screen.getByRole("radio", { name: "Yearly" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Price on request")).toBeInTheDocument();
    expect(screen.queryByText(/free trial/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started by email" })).toHaveAttribute(
      "href", `mailto:${site.email}?subject=JamPacked%20yearly%20licence`,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(screen.getByRole("radio", { name: "Monthly" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("link", { name: "Get started by email" })).toHaveAttribute(
      "href", `mailto:${site.email}?subject=JamPacked%20monthly%20licence`,
    );
    expect(screen.getByText("Every programme: NP1, NP2, NP3 and custom")).toBeInTheDocument();
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.innerHTML));
    expect(ld.map((d) => d["@type"])).toEqual(["SoftwareApplication", "BreadcrumbList"]); // FAQPage lives on /faq/
    expect(screen.getByText("Can I cancel?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All questions →" })).toHaveAttribute("href", "/faq/");
    expect(ld[0].offers).toBeUndefined();
    expect(storeMetadata.alternates).toEqual({ canonical: "/store/" });
  });

  test("with prices, a trial and Stripe links: shows them and Buy goes to Stripe", async () => {
    Object.assign(pricing.plans[0], { price: 49, checkoutUrl: "https://buy.stripe.com/monthly" });
    Object.assign(pricing.plans[1], { price: 490.5, checkoutUrl: "https://buy.stripe.com/yearly" });
    pricing.trialDays = 14;
    const { container } = render(<Store />);
    expect(screen.getByText("$490.50")).toBeInTheDocument();
    expect(screen.getByText(/NZD per business \/ year, incl\. GST/)).toBeInTheDocument();
    expect(screen.getByText("14-day free trial")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buy yearly licence" })).toHaveAttribute("href", "https://buy.stripe.com/yearly");
    expect(screen.getByText(/Secure payment by Stripe/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(screen.getByText("$49")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buy monthly licence" })).toHaveAttribute("href", "https://buy.stripe.com/monthly");
    const app = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML);
    expect(app.offers).toEqual([
      expect.objectContaining({ name: "Monthly licence", price: "49.00", priceCurrency: "NZD", description: "$49 per business per month, incl. GST" }),
      expect.objectContaining({ name: "Yearly licence", price: "490.50" }),
    ]);
  });

  test("formatPrice drops cents only for whole dollars", () => {
    expect(formatPrice(49)).toBe("$49");
    expect(formatPrice(49.5)).toBe("$49.50");
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
