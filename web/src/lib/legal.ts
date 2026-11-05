// The legal documents, in one place so the /legal/ index, each page's "Last updated" and the footer agree.
// Change a document's date whenever its wording changes: the date is the version people agree to.
export const legalDocs = {
  terms: {
    title: "Terms of Service",
    href: "/legal/terms/",
    updated: "6 November 2026",
    summary: "The terms for buying and using a JamPacked licence: plans by programme, the free NP1 plan, the money-back guarantee, production and allergen records, and your data.",
  },
  privacy: {
    title: "Privacy Policy",
    href: "/legal/privacy/",
    updated: "6 November 2026",
    summary: "What personal information JamPacked holds (including customers and suppliers you enter, and how long tasks take), why, who it's shared with, how long it's kept and your rights.",
  },
  cookies: {
    title: "Cookies & data policy",
    href: "/legal/cookies/",
    updated: "31 October 2026",
    summary: "The website sets no cookies. What the app keeps on your device, and the payment page.",
  },
};

/**
 * The outside providers that handle personal information for JamPacked, listed in the Privacy Policy.
 * `soon` ones are planned but not switched on yet. Keep in step with docs/providers.md (which also lists
 * the ones that never see personal information), and change the Privacy Policy's date when this changes.
 */
export const providers: { name: string; does: string; where: string; soon?: boolean }[] = [
  { name: "Stripe", does: "Takes payment for licences. Card details go to Stripe, never to us.", where: "United States" },
  { name: "Cloudflare", does: "Runs our domain names and carries traffic to the website and app securely.", where: "Worldwide network" },
  { name: "Google Workspace", does: "Our email.", where: "United States and worldwide" },
  { name: "Open Food Facts", does: "Looks up barcodes you scan that aren't in your catalogue. Only the barcode number is sent.", where: "France" },
  { name: "PostHog", does: "Counts website page views, without cookies, if we turn it on.", where: "United States" },
  { name: "Convex", does: "Will host the database that holds your account and records (today it runs on our own server).", where: "United States", soon: true },
  { name: "Clerk", does: "Will handle signing in to the app and website.", where: "United States", soon: true },
  { name: "Apple and Google", does: "Will deliver the phone apps through the App Store and Google Play, under their own privacy policies.", where: "United States", soon: true },
  { name: "Anthropic", does: "Will power the support chat on our Help page; a person takes over when needed.", where: "United States", soon: true },
];
