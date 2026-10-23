// MPI National Programmes under the Food Act 2014, from MPI's NP1/NP2/NP3 guidance (Dec 2025, v2).
// A business picks one at sign-up (or a custom programme it builds itself) and the app prompts
// for the checks and records that programme requires.

export type BuiltInProgramme = "NP1" | "NP2" | "NP3";

export type Sector = { key: string; label: string };

export type ProgrammeInfo = {
  key: BuiltInProgramme;
  name: string;
  risk: string;
  /** "You should use National Programme N if you..." from the front of each guide. */
  whoFor: string[];
  /** Business types the guide marks with icons; rules tagged with a sector only apply to it. */
  sectors: Sector[];
  source: string;
};

export const PROGRAMMES: ProgrammeInfo[] = [
  {
    key: "NP1",
    name: "National Programme 1",
    risk: "Lowest risk",
    whoFor: [
      "Extract or pack honey",
      "Grow or pack fruit, vegetables or other horticultural products",
      "Make sugar, molasses, syrups or related products",
      "Sell tea, coffee, hot chocolate and packaged shelf-stable food only",
      "Sell packaged ice creams, ice blocks or similar items only",
      "Store or transport food only",
    ],
    sectors: [
      { key: "honey", label: "Honey" },
      { key: "horticulture", label: "Horticulture" },
      { key: "sugar", label: "Sugar" },
      { key: "packaged_ice_cream", label: "Packaged ice-creams" },
      { key: "hot_drinks", label: "Hot drinks" },
      { key: "transport", label: "Transport and distribution" },
    ],
    source: "MPI National Programme 1 Guidance, Dec 2025 v2",
  },
  {
    key: "NP2",
    name: "National Programme 2",
    risk: "Low to medium risk",
    whoFor: [
      "Manufacture bread, cereals, biscuits, crackers, snacks, spreads, jams, pickles or chutneys",
      "Manufacture confectionery, chocolate, icing, ice or iced confectionery",
      "Manufacture frozen, dried or dehydrated fruit and vegetables",
      "Sell chilled or frozen foods",
      "Process nuts and seeds",
      "Serve food at an early childhood education centre (ECE) / Kōhanga Reo",
    ],
    sectors: [
      { key: "bread", label: "Bread" },
      { key: "cereals", label: "Cereals, biscuits and crackers" },
      { key: "snacks", label: "Crisps and snacks" },
      { key: "spreads", label: "Peanut butter, jam, pickles and chutney" },
      { key: "confectionery", label: "Confectionery" },
      { key: "iced_confectionery", label: "Ice and iced confectionery" },
      { key: "frozen_dried_produce", label: "Frozen, dried or dehydrated fruit and vegetables" },
      { key: "retail_chilled_frozen", label: "Retailer of chilled and frozen food" },
      { key: "nuts_seeds", label: "Nuts and seeds" },
      { key: "ece", label: "Early Childhood Centre (ECE) / Kōhanga Reo" },
    ],
    source: "MPI National Programme 2 Guidance, Dec 2025 v2",
  },
  {
    key: "NP3",
    name: "National Programme 3",
    risk: "Medium risk",
    whoFor: [
      "Brew, distil, or make vinegar, malt extract or alcoholic beverages",
      "Manufacture non-alcoholic beverages",
      "Manufacture oils or fats (other than butter)",
      "Manufacture food additives or dietary supplements",
      "Process grain, herbs or spices (including loose tea)",
      "Handle food for retail (including scooping ice cream and reheating prepared food)",
      "Manufacture dry mix products (cake mixes, powdered desserts, drinks, soups)",
    ],
    sectors: [
      { key: "brewery", label: "Brewery, vinegar and malt" },
      { key: "non_alcoholic_beverages", label: "Manufacturer of non-alcoholic beverages" },
      { key: "oils_fats", label: "Manufacturer of oils or fats" },
      { key: "food_additives", label: "Manufacturer of food additives" },
      { key: "grain", label: "Processor of grain" },
      { key: "retail_handling", label: "Retailer that handles food" },
      { key: "herbs_spices", label: "Processor of herbs or spices" },
      { key: "dry_mix", label: "Manufacturer of dry mix products" },
      { key: "grape_wine", label: "Grape wine" },
      { key: "alcoholic_beverages", label: "Alcoholic beverages" },
    ],
    source: "MPI National Programme 3 Guidance, Dec 2025 v2",
  },
];

export const programmeInfo = (key: string) => PROGRAMMES.find((p) => p.key === key);
