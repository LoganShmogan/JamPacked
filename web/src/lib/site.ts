// Everything the pages say about who we are and where things live, in one place.
export const site = {
  name: "JamPacked",
  url: "https://jampacked.co.nz",
  appUrl: "https://app.jampacked.co.nz",
  // JamPacked mailboxes aren't set up yet; Save Point's inbox until they are.
  email: "contact@savepoint.co.nz",
  company: "Save Point Limited",
  nzbn: "9429053325013",
  description:
    "Goods inwards, stock and food safety records for New Zealand and Australian food businesses. " +
    "Every delivery becomes stock you can trace, and your audits fill themselves in.",
  // Store listings, once the apps are published (docs/issues/app-store-release.md). Until then
  // phones are sent to the web app, which works in any mobile browser.
  playStoreUrl: null as string | null, // https://play.google.com/store/apps/details?id=nz.co.jampacked.app
  appStoreUrl: null as string | null, // https://apps.apple.com/nz/app/jampacked/id...
};

// One licence per business, priced by the programme it follows (docs/issues/billing-stripe.md).
// Prices are in NZD including GST; 0 is free. NP1 is free for one person with no staff: an NP1
// business that adds staff pays the NP2 price. Each paid plan's checkoutUrls are Stripe Payment
// Links whose "after payment" page is set to https://jampacked.co.nz/welcome/ in the Stripe
// dashboard. Without one, Buy opens an email instead.
export type Period = "monthly" | "yearly";
export type Plan = {
  key: "np1" | "np2" | "np3" | "custom";
  name: string;
  summary: string;
  prices: Record<Period, number>;
  checkoutUrls: Record<Period, string | null>;
};

export const pricing = {
  currency: "NZD",
  moneyBackDays: 30,
  periods: [
    { key: "monthly", name: "Monthly", per: "month" },
    { key: "yearly", name: "Yearly", per: "year" },
  ] as { key: Period; name: string; per: string }[],
  plans: [
    {
      key: "np1",
      name: "NP1",
      summary: "National Programme 1, for one person running the business with no staff. Add staff and it's the NP2 price.",
      prices: { monthly: 0, yearly: 0 },
      checkoutUrls: { monthly: null, yearly: null },
    },
    {
      key: "np2",
      name: "NP2",
      summary: "National Programme 2, or NP1 with staff.",
      prices: { monthly: 50, yearly: 500 },
      checkoutUrls: { monthly: null, yearly: null },
    },
    {
      key: "np3",
      name: "NP3",
      summary: "National Programme 3.",
      prices: { monthly: 100, yearly: 1000 },
      checkoutUrls: { monthly: null, yearly: null },
    },
    {
      key: "custom",
      name: "Custom",
      summary: "A programme you build yourself, from parts of the NPs or from scratch.",
      prices: { monthly: 120, yearly: 1200 },
      checkoutUrls: { monthly: null, yearly: null },
    },
  ] as Plan[],
};

/** "$49" for whole dollars, "$49.50" otherwise. */
export const formatPrice = (price: number) =>
  `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
