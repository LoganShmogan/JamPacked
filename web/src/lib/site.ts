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

// One licence per business, whichever programme it runs (docs/issues/billing-stripe.md). Prices are
// in NZD including GST; leave a price null until it's decided and the store says "price on request".
// Each plan's checkoutUrl is a Stripe Payment Link whose "after payment" page is set to
// https://jampacked.co.nz/welcome/ in the Stripe dashboard. Without one, Buy opens an email instead.
export type Plan = { key: "monthly" | "yearly"; name: string; price: number | null; per: string; checkoutUrl: string | null };

export const pricing = {
  currency: "NZD",
  trialDays: null as number | null,
  plans: [
    { key: "monthly", name: "Monthly", price: null, per: "month", checkoutUrl: null },
    { key: "yearly", name: "Yearly", price: null, per: "year", checkoutUrl: null },
  ] as Plan[],
};

/** "$49" for whole dollars, "$49.50" otherwise. */
export const formatPrice = (price: number) =>
  `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
