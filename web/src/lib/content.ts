// Copy shared by more than one page. Claims here must match what the app does today (see the README's
// "What's in it"). Say the programmes are *based on* MPI guidance: MPI and FSANZ don't endorse the product.
import { formatPrice, pricing, site } from "./site";

export const steps = [
  { title: "Receive", body: "Scan the barcode, check the temperature, batch and use-by. Accept or reject on the spot." },
  { title: "Store", body: "Accepted goods become stock by location, first-expiring first, with holds and low-stock alerts." },
  { title: "Make", body: "Pick a recipe and say how many. Ingredients come out of stock and the batch goes in, with a batch code." },
  { title: "Trace", body: "Search a batch code to see who supplied it, how much is left and where it went. One tap holds it all." },
  { title: "Audit", body: "Audits fill themselves in from your deliveries, temperatures and records, with the evidence attached." },
];

export const featureGroups: { heading: string; features: [string, string][] }[] = [
  {
    heading: "Deliveries and stock",
    features: [
      ["Goods inwards", "Supplier, invoice, vehicle check, probe temperature, packaging, allergens and put-away, item by item."],
      ["Enter it once", "Every product, supply, supplier and customer is typed once. After that you search for it or scan its barcode and it's all filled in."],
      ["Barcode auto-fill", "New products fill in from Open Food Facts, including allergens."],
      ["Production and recipes", "Save a recipe once, then make batches from it, or a one-off from whatever stock you pick. Allergens carry through to what you make."],
      ["Stock by location", "Accepted goods become lots you can see by location, oldest use-by first, with par levels and low-stock alerts."],
      ["Holds, recalls and stocktakes", "Put a batch on hold, recall it, or count a location. Every movement is recorded."],
      ["Trace through production", "Search a supplier batch to see what you made from it and who it went to, or a batch you made to see what went in."],
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
      ["Insights", "What your business did this week, month or quarter, and how long everyday tasks take, with your own times alongside. No staff league tables."],
      ["Help built in", "Step-by-step guides in the app and on this website, and a real person by email when you need one."],
    ],
  },
];

const plan = (key: string) => pricing.plans.find((p) => p.key === key)!;
const both = (key: string) =>
  `${formatPrice(plan(key).prices.monthly)} a month or ${formatPrice(plan(key).prices.yearly)} a year`;

/** One programme's price, in a sentence (the programme slugs are the plan keys). */
export const planPrice = (key: string) =>
  key === "np1"
    ? `Free for one person running the business with no staff. Once you add staff it's charged at the NP2 price, ${both("np2")}.`
    : `${both(key)} per business, incl. GST, with a ${pricing.moneyBackDays}-day money-back guarantee.`;

/** What it costs, in a sentence; follows lib/site.ts. */
export const priceSummary = () =>
  `NP1 is free for one person with no staff. NP2 is ${both("np2")}, NP3 ${both("np3")} and a custom programme ${both("custom")}, per business, incl. GST.`;

/** General questions. */
export const generalFaqs = (): [string, string][] => [
  ["Who is JamPacked for?", "Food businesses in New Zealand and Australia that receive, store, make and track food: bakeries, early childhood centres, manufacturers, retailers, transporters and more."],
  ["Which programmes does it support?", "Modules based on MPI's National Programme 1, 2 and 3 guidance, or a custom programme you build yourself from parts of them or from scratch. Australian businesses can switch to FSANZ defaults."],
  ["Does it replace my food control plan or verifier?", "No. JamPacked helps you keep the records, but your registered plan or programme, and your verifier or EHO, still decide what's required. Check the modules against your registration."],
  ["What does it run on?", "Android, iPhone and any web browser, with one account across all of them. Staff can be invited by email."],
  ["Do I have to type everything in?", "Only once. A product, supply, supplier or customer you've entered before is there to pick or scan next time: at goods inwards, in recipes, in production and when you dispatch."],
  ["How do I get help?", `Tap the ? on the app's home screen, or More › Help & support, for step-by-step guides; they're also on our Help page. Still stuck? Email ${site.email} and a person in New Zealand will reply.`],
  ["Can I run more than one business?", "Yes. One account can work across several businesses, with a different role in each. Each business has its own licence."],
  ["What does it cost?", `${priceSummary()} Every paid plan has a ${pricing.moneyBackDays}-day money-back guarantee.`],
];

export const licenceFaqs: [string, string][] = [
  ["Which plan do I need?", "The one for the programme your business follows. NP1 is free while it's just you; once an NP1 business adds staff, it's charged at the NP2 price."],
  ["Is there a money-back guarantee?", `Yes. If JamPacked isn't right for you, email us within ${pricing.moneyBackDays} days of paying and we'll refund you in full.`],
  ["Do I need a licence for each site?", "You need one licence per business in the app. A business can have several storage locations; separate businesses (for example, two cafés with their own registrations) each need a licence."],
  ["Can I cancel?", "Yes. Your licence runs to the end of the period you've paid for. After that the business becomes read-only: nothing is deleted and you can still view and export your records."],
  ["Can I buy in the app?", "No. Licences are only sold on this website. The app is free to download; it unlocks your business once its licence is active."],
  ["Do prices include GST?", "Yes, prices are in New Zealand dollars and include GST."],
];
