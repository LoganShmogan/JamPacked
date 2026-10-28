// The programmes the app ships with, worded for the website. "Who it's for" and the business types
// come from backend/convex/lib/programmes.ts (MPI's NP1/NP2/NP3 guidance, Dec 2025 v2); keep them in step.
export type ProgrammePage = {
  slug: string;
  short: string;
  name: string;
  risk: string;
  summary: string;
  whoFor: string[];
  businessTypes: string[];
  records: string[];
};

export const programmes: ProgrammePage[] = [
  {
    slug: "np1",
    short: "NP1",
    name: "National Programme 1",
    risk: "Lowest risk",
    summary: "For honey, horticulture, sugar, hot drinks, packaged ice cream, and businesses that only store or transport food.",
    whoFor: [
      "Extract or pack honey",
      "Grow or pack fruit, vegetables or other horticultural products",
      "Make sugar, molasses, syrups or related products",
      "Sell tea, coffee, hot chocolate and packaged shelf-stable food only",
      "Sell packaged ice creams, ice blocks or similar items only",
      "Store or transport food only",
    ],
    businessTypes: ["Honey", "Horticulture", "Sugar", "Packaged ice-creams", "Hot drinks", "Transport and distribution"],
    records: [
      "Goods inwards with supplier, batch, use-by and probe temperature",
      "Transport temperatures and tutin tests for honey, where they apply",
      "Pest checks, thermometer checks, maintenance and staff training",
      "Monthly NP1 self-check and a yearly mock recall, on your Due list",
    ],
  },
  {
    slug: "np2",
    short: "NP2",
    name: "National Programme 2",
    risk: "Low to medium risk",
    summary: "For bread, biscuits and snacks, jams and spreads, confectionery, chilled and frozen retail, nuts and seeds, and ECE centres.",
    whoFor: [
      "Manufacture bread, cereals, biscuits, crackers, snacks, spreads, jams, pickles or chutneys",
      "Manufacture confectionery, chocolate, icing, ice or iced confectionery",
      "Manufacture frozen, dried or dehydrated fruit and vegetables",
      "Sell chilled or frozen foods",
      "Process nuts and seeds",
      "Serve food at an early childhood education centre (ECE) / Kōhanga Reo",
    ],
    businessTypes: [
      "Bread", "Cereals, biscuits and crackers", "Crisps and snacks", "Peanut butter, jam, pickles and chutney",
      "Confectionery", "Ice and iced confectionery", "Frozen, dried or dehydrated fruit and vegetables",
      "Retailer of chilled and frozen food", "Nuts and seeds", "Early Childhood Centre (ECE) / Kōhanga Reo",
    ],
    records: [
      "Goods inwards and stock by location, first-expiring first",
      "Daily chiller and freezer checks; cooking, cooling and reheating temperatures",
      "Water activity and pH tests, pest checks, thermometer checks and staff training",
      "Monthly NP2 self-check and a yearly mock recall, on your Due list",
    ],
  },
  {
    slug: "np3",
    short: "NP3",
    name: "National Programme 3",
    risk: "Medium risk",
    summary: "For brewing and beverages, oils and fats, food additives, grain, herbs and spices, dry mixes, and retailers that handle food.",
    whoFor: [
      "Brew, distil, or make vinegar, malt extract or alcoholic beverages",
      "Manufacture non-alcoholic beverages",
      "Manufacture oils or fats (other than butter)",
      "Manufacture food additives or dietary supplements",
      "Process grain, herbs or spices (including loose tea)",
      "Handle food for retail (including scooping ice cream and reheating prepared food)",
      "Manufacture dry mix products (cake mixes, powdered desserts, drinks, soups)",
    ],
    businessTypes: [
      "Brewery, vinegar and malt", "Non-alcoholic beverages", "Oils or fats", "Food additives", "Grain",
      "Retailer that handles food", "Herbs or spices", "Dry mix products", "Grape wine", "Alcoholic beverages",
    ],
    records: [
      "Goods inwards, batch tracing and one-tap holds and recalls",
      "Cooking, cooling and reheating temperatures, with corrective actions when they fail",
      "Staff sickness, transport temperatures, water activity and pH tests",
      "Monthly NP3 self-check and a yearly mock recall, on your Due list",
    ],
  },
  {
    slug: "custom",
    short: "Custom",
    name: "Custom programme",
    risk: "Your own mix",
    summary: "Build your own from parts of NP1, NP2 and NP3, or from scratch: your own records, receiving checks and checklists.",
    whoFor: [
      "Run a food control plan or a programme that doesn't match one guide",
      "Do a bit of more than one programme and want a single set of records",
      "Need extra checks your verifier, EHO or head office asks for",
      "Run several sites and want them all on the same checklist",
    ],
    businessTypes: ["Any food business in New Zealand or Australia"],
    records: [
      "Start from the NP1, NP2 or NP3 modules and keep only what applies",
      "Your own record types, with fields, units and pass/fail limits",
      "Your own receiving checks asked on every delivery",
      "Your own audit checklists, reusable across all your businesses",
    ],
  },
];

export const programmeBySlug = (slug: string) => programmes.find((p) => p.slug === slug);
