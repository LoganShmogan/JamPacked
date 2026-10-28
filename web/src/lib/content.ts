// Copy shared by more than one page. Claims here must match what the app does today (see the README's
// "What's in it"). Say the programmes are *based on* MPI guidance: MPI and FSANZ don't endorse the product.
import { formatPrice, type Plan, pricing, site } from "./site";

export const steps = [
  { title: "Receive", body: "Scan the barcode, check the temperature, batch and use-by. Accept or reject on the spot." },
  { title: "Store", body: "Accepted goods become stock by location, first-expiring first, with holds and low-stock alerts." },
  { title: "Trace", body: "Search a batch code to see who supplied it, how much is left and where it went. One tap holds it all." },
  { title: "Audit", body: "Audits fill themselves in from your deliveries, temperatures and records, with the evidence attached." },
];

export const featureGroups: { heading: string; features: [string, string][] }[] = [
  {
    heading: "Deliveries and stock",
    features: [
      ["Goods inwards", "Supplier, invoice, vehicle check, probe temperature, packaging, allergens and put-away, item by item."],
      ["Barcode auto-fill", "Products fill in from your catalogue or Open Food Facts, including allergens."],
      ["Stock by location", "Accepted goods become lots you can see by location, oldest use-by first, with par levels and low-stock alerts."],
      ["Holds, recalls and stocktakes", "Put a batch on hold, recall it, or count a location. Every movement is recorded."],
    ],
  },
  {
    heading: "Food safety records",
    features: [
      ["Temperature checks", "Chillers, freezers, hot holding, cooking and cooling. Out-of-range readings need a corrective action."],
      ["Your programme", "NP1, NP2, NP3 or your own, narrowed to what your business does, with a Due list of the records you need to keep."],
      ["Corrective actions", "Raised automatically for rejected goods, failed checks, expired stock and audit findings, then closed out."],
      ["Audits that fill themselves in", "Self-checks answered from your deliveries, temperatures and records, with the evidence attached."],
    ],
  },
  {
    heading: "Your team and your records",
    features: [
      ["Phone, tablet and browser", "Android, iPhone and any web browser, with one account across all of them."],
      ["Staff and roles", "Invite staff by email. One account can work across several businesses, with a different role in each."],
      ["Kept for 7 years", "Every change is logged with who, when and what. Nothing is deleted."],
      ["Export everything", "Admins can export all of a business's records at any time."],
    ],
  },
];

/** General questions; the price answer follows lib/site.ts. */
export const generalFaqs = (monthly = (pricing.plans.find((p) => p.key === "monthly") as Plan).price): [string, string][] => [
  ["Who is JamPacked for?", "Food businesses in New Zealand and Australia that receive, store and track food: bakeries, early childhood centres, manufacturers, retailers, transporters and more."],
  ["Which programmes does it support?", "Modules based on MPI's National Programme 1, 2 and 3 guidance, or a custom programme you build yourself from parts of them or from scratch. Australian businesses can switch to FSANZ defaults."],
  ["Does it replace my food control plan or verifier?", "No. JamPacked helps you keep the records, but your registered plan or programme, and your verifier or EHO, still decide what's required. Check the modules against your registration."],
  ["What does it run on?", "Android, iPhone and any web browser, with one account across all of them. Staff can be invited by email."],
  ["Can I run more than one business?", "Yes. One account can work across several businesses, with a different role in each. Each business has its own licence."],
  [
    "What does it cost?",
    monthly === null
      ? `One licence per business covers every programme and all your staff. Pricing is being finalised: email ${site.email} to get started.`
      : `${formatPrice(monthly)} a month per business (incl. GST), or pay yearly. One licence covers every programme and all your staff.`,
  ],
];

export const licenceFaqs: [string, string][] = [
  ["Do I need a licence for each site?", "You need one licence per business in the app. A business can have several storage locations; separate businesses (for example, two cafés with their own registrations) each need a licence."],
  ["Can I cancel?", "Yes. Your licence runs to the end of the period you've paid for. After that the business becomes read-only: nothing is deleted and you can still view and export your records."],
  ["Can I buy in the app?", "No. Licences are only sold on this website. The app is free to download; it unlocks your business once its licence is active."],
  ["Do prices include GST?", "Yes, prices are in New Zealand dollars and include GST."],
];
