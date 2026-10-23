import type { Frequency, Question, SectorScoped, Template } from "./templates";

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

// ---------------------------------------------------------------------------------------------
// Modules: what each programme makes the app prompt for. Built from each guide's "Do" rules and
// "Will you keep records for this?" / "Show" sections. Items tagged with `sectors` only apply to
// businesses that do that kind of thing; `excludeSectors` are exempt.
// ---------------------------------------------------------------------------------------------

export type FieldType = "yesno" | "number" | "text" | "date";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unit?: string;
  /** Answers that mean something has gone wrong; each raises a corrective action. */
  failIf?: { equals?: boolean; above?: number; below?: number; message: string };
};

export type RecordType = SectorScoped & {
  key: string;
  name: string;
  description: string;
  card: string; // the guide card it comes from
  fields: Field[];
  frequency?: Frequency; // when set, the record shows on the "Due" list
};

export type ReceivingPrompt = SectorScoped & { key: string; text: string; guidance?: string };

export type ScheduleItem = SectorScoped & {
  key: string;
  label: string;
  frequency: Frequency;
  satisfiedBy: { kind: "record"; recordType: string } | { kind: "audit"; templateKey: string } | { kind: "temperature" };
};

export type ProgrammeModule = {
  key: string;
  name: string;
  receivingPrompts: ReceivingPrompt[];
  recordTypes: RecordType[];
  templates: Template[];
  schedule: ScheduleItem[];
};

const yes = (key: string, label: string, message: string): Field => ({
  key, label, type: "yesno", required: true, failIf: { equals: false, message },
});

// Records every National Programme asks for.
const COMMON_RECORDS: RecordType[] = [
  {
    key: "pest_check",
    name: "Pest check",
    description: "Look for droppings, gnawing, insects and damage. Record what you find and what you did.",
    card: "Controlling pests",
    frequency: "weekly",
    fields: [
      { key: "area", label: "Areas checked", type: "text", required: true },
      { key: "found", label: "Signs of pests found?", type: "yesno", required: true, failIf: { equals: true, message: "Pests found" } },
      { key: "type", label: "Type and amount of pests", type: "text" },
      { key: "action", label: "What was done", type: "text" },
    ],
  },
  {
    key: "calibration",
    name: "Thermometer check",
    description: "Ice slurry should read 0°C (within 1°C). Replace or adjust thermometers that don't.",
    card: "Maintaining equipment and facilities",
    frequency: "monthly",
    fields: [
      { key: "thermometer", label: "Thermometer", type: "text", required: true },
      { key: "iceReading", label: "Reading in ice slurry", type: "number", unit: "°C", required: true, failIf: { above: 1, below: -1, message: "Thermometer is out by more than 1°C" } },
      { key: "action", label: "Action taken", type: "text" },
    ],
  },
  {
    key: "maintenance",
    name: "Maintenance",
    description: "Repairs, servicing and anything that broke down, especially chillers, freezers and measuring equipment.",
    card: "Maintaining equipment and facilities",
    fields: [
      { key: "item", label: "Equipment or area", type: "text", required: true },
      { key: "work", label: "Work done", type: "text", required: true },
      { key: "by", label: "Done by", type: "text" },
      { key: "foodAffected", label: "Could food have been affected?", type: "yesno", failIf: { equals: true, message: "Food may have been affected by an equipment problem" } },
    ],
  },
  {
    key: "training",
    name: "Staff training",
    description: "Who was trained, in what, and how you know they understood.",
    card: "Ensuring staff are trained and competent",
    fields: [
      { key: "staff", label: "Staff member", type: "text", required: true },
      { key: "topic", label: "Topic", type: "text", required: true },
      { key: "trainer", label: "Trained by", type: "text" },
      { key: "competent", label: "Shown they can do it correctly?", type: "yesno", required: true, failIf: { equals: false, message: "Staff member not yet competent: follow up training" } },
    ],
  },
  {
    key: "mock_recall",
    name: "Simulated (mock) recall",
    description: "Test your tracing at least once every 12 months: pick a product or batch and find where it came from and where it went.",
    card: "Recalling your food",
    frequency: "yearly",
    fields: [
      { key: "scenario", label: "Scenario (product / batch)", type: "text", required: true },
      { key: "minutes", label: "Time to trace", type: "number", unit: "min", required: true },
      yes("allFound", "All affected stock and customers found?", "Mock recall could not trace everything"),
      { key: "improvements", label: "What will you improve?", type: "text" },
    ],
  },
  {
    key: "water_test",
    name: "Self-supply water test",
    description: "Only if your water does not come from a council supply. Keep the lab results.",
    card: "Ensuring your water is suitable",
    fields: [
      { key: "lab", label: "Laboratory", type: "text", required: true },
      { key: "result", label: "Result", type: "text", required: true },
      yes("pass", "Water meets the drinking-water standard?", "Self-supply water failed its test"),
    ],
  },
  {
    key: "complaint",
    name: "Customer complaint",
    description: "Investigate every food safety complaint and record what you found and did.",
    card: "Taking action when something goes wrong",
    fields: [
      { key: "customer", label: "Customer / contact", type: "text" },
      { key: "complaint", label: "Complaint", type: "text", required: true },
      { key: "investigation", label: "What you found", type: "text", required: true },
      { key: "foodUnsafe", label: "Was food unsafe or unsuitable?", type: "yesno", required: true, failIf: { equals: true, message: "Complaint found unsafe or unsuitable food" } },
    ],
  },
];

const SICKNESS: RecordType = {
  key: "sickness",
  name: "Staff sickness",
  description: "Staff who report vomiting, diarrhoea or other illness, and how you stopped them contaminating food.",
  card: "Managing personal hygiene and health",
  fields: [
    { key: "staff", label: "Staff member", type: "text", required: true },
    { key: "symptoms", label: "Symptoms", type: "text", required: true },
    { key: "returned", label: "Date back at work (48 h symptom-free)", type: "date" },
    { key: "action", label: "What you did", type: "text", required: true },
  ],
};

const TRANSPORT: RecordType = {
  key: "transport",
  name: "Transport temperature",
  description: "Chilled at or below 5°C, frozen kept frozen, hot above 60°C (unless eaten within 4 hours of loading).",
  card: "Transporting food",
  fields: [
    { key: "load", label: "Load / delivery run", type: "text", required: true },
    { key: "chilledTempC", label: "Chilled food temperature", type: "number", unit: "°C", failIf: { above: 5, message: "Chilled food above 5°C in transport" } },
    { key: "frozen", label: "Frozen food still frozen?", type: "yesno", failIf: { equals: false, message: "Frozen food not frozen in transport" } },
    { key: "hotTempC", label: "Hot food temperature", type: "number", unit: "°C", failIf: { below: 60, message: "Hot food below 60°C in transport" } },
    { key: "humidityOk", label: "Humidity / atmosphere within limits (if needed)?", type: "yesno", failIf: { equals: false, message: "Humidity out of limits in transport" } },
    yes("vehicleClean", "Vehicle clean?", "Vehicle not clean"),
  ],
};

const COOKING: RecordType = {
  key: "cooking",
  name: "Cooking / pasteurising",
  description: "Check the centre reached one of: 75°C for 15 s, 72°C for 1 min, 71°C for 2 min, 69°C for 5 min.",
  card: "Thoroughly cooking or pasteurising food",
  fields: [
    { key: "food", label: "Food / batch", type: "text", required: true },
    { key: "coreTempC", label: "Centre temperature", type: "number", unit: "°C", required: true, failIf: { below: 69, message: "Food not cooked to a safe temperature" } },
    yes("timeMet", "Held long enough at that temperature?", "Cooking time/temperature not met"),
  ],
};

const COOLING: RecordType = {
  key: "cooling",
  name: "Cooling cooked food",
  description: "From 60°C: down to 21°C within 2 hours, then to 5°C within another 4 hours. Otherwise throw it out.",
  card: "Thoroughly cooking or pasteurising food",
  fields: [
    { key: "food", label: "Food / batch", type: "text", required: true },
    { key: "temp2h", label: "Temperature after 2 hours", type: "number", unit: "°C", required: true, failIf: { above: 21, message: "Food not cooled to 21°C within 2 hours" } },
    { key: "temp6h", label: "Temperature after 6 hours", type: "number", unit: "°C", failIf: { above: 5, message: "Food not cooled to 5°C within 6 hours" } },
  ],
};

const REHEATING: RecordType = {
  key: "reheating",
  name: "Reheating",
  description: "Reheat until steaming hot, at least 75°C in the middle, then keep above 60°C.",
  card: "Defrosting and reheating food safely",
  fields: [
    { key: "food", label: "Food", type: "text", required: true },
    { key: "tempC", label: "Temperature reached", type: "number", unit: "°C", required: true, failIf: { below: 75, message: "Food not reheated to 75°C" } },
  ],
};

const WATER_ACTIVITY: RecordType = {
  key: "water_activity",
  name: "Water activity test",
  description: "Dried or concentrated food must be below 0.85 water activity throughout, every batch.",
  card: "Using water activity to control bugs",
  fields: [
    { key: "batch", label: "Product / batch", type: "text", required: true },
    { key: "method", label: "Drying / concentrating method", type: "text" },
    { key: "aw", label: "Water activity", type: "number", required: true, failIf: { above: 0.85, message: "Water activity above 0.85" } },
  ],
};

const PH: RecordType = {
  key: "ph_test",
  name: "pH test",
  description: "Shelf-stable pickled, fermented or acidified food: pH below 3.6, or 3.6 to 4.6 and then pasteurised or cooked.",
  card: "Pickling, fermenting, or acidifying food to keep them safe",
  fields: [
    { key: "batch", label: "Product / batch", type: "text", required: true },
    { key: "method", label: "Fermenting / acidifying method", type: "text" },
    { key: "ph", label: "pH", type: "number", required: true, failIf: { above: 4.6, message: "pH above 4.6: not shelf stable" } },
    { key: "heatTreated", label: "If pH 3.6-4.6: pasteurised or cooked?", type: "yesno", failIf: { equals: false, message: "pH 3.6-4.6 food not heat treated" } },
  ],
};

const TUTIN: RecordType = {
  key: "tutin",
  name: "Tutin in honey",
  description: "Show honey you pack meets the Tutin in Honey Standard: test results, low-risk harvest records or supplier declarations.",
  card: "Sourcing, receiving and tracing food",
  sectors: ["honey"],
  fields: [
    { key: "batch", label: "Honey batch", type: "text", required: true },
    { key: "evidence", label: "Evidence (test, declaration, harvest timing)", type: "text", required: true },
    yes("meets", "Meets the tutin standard?", "Honey batch may not meet the tutin standard"),
  ],
};

// Extra checks on every delivery at goods inwards. "No" raises a corrective action.
const COMMON_PROMPTS: ReceivingPrompt[] = [
  {
    key: "attended",
    text: "Someone was there to receive the delivery (it wasn't left unattended)",
    guidance: "If chilled or frozen food is delivered out of hours, you can't know it arrived at the right temperature.",
  },
  {
    key: "putAwayOrder",
    text: "Chilled food was put away first, then frozen, then ambient",
  },
  {
    key: "allergenInfo",
    text: "Ingredient and allergen information for these goods is on file and up to date",
  },
];

const HONEY_PROMPT: ReceivingPrompt = {
  key: "tutinDeclaration",
  text: "Tutin certificate of analysis or supplier declaration received for each honey batch",
  sectors: ["honey"],
};

export const DAILY_CHILLED: ScheduleItem = {
  key: "chilled_check",
  label: "Check chilled food is at 5°C or lower",
  frequency: "daily",
  satisfiedBy: { kind: "temperature" },
};

/** The self-check every programme asks you to do regularly, as an auditable checklist. */
function selfCheck(np: BuiltInProgramme, extra: Question[]): Template {
  return {
    key: `${np.toLowerCase()}_self_check`,
    name: `${np} self-check`,
    description: "Checking the programme is working well: the things your verifier will ask to see.",
    standardRef: `MPI ${np} guidance (Dec 2025): 'Checking the programme is working well' and each card's Show section`,
    defaultPeriodDays: 30,
    frequency: "monthly",
    questions: [
      { id: "sc1", section: "Responsibility", text: "Everyone knows who is responsible for food safety (and who covers when they are away)", type: "yesno" },
      { id: "sc2", section: "Responsibility", text: "Changes since the last check (new food, processes, staff, suppliers) have been reviewed", type: "text" },
      { id: "sc3", section: "Sourcing & tracing", text: "All goods came from trusted (approved/registered) suppliers", type: "yesno", autoFill: "gi.allApprovedSuppliers" },
      { id: "sc4", section: "Sourcing & tracing", text: "Receiving records include type, quantity and date of everything received", type: "yesno", autoFill: "gi.traceable" },
      { id: "sc5", section: "Sourcing & tracing", text: "Chilled food temperatures were recorded on receipt", type: "yesno", autoFill: "gi.tempChecked" },
      { id: "sc6", section: "Sourcing & tracing", text: "Tracing has been tested (mock or real recall) in the last 12 months", type: "yesno", autoFill: "records.mockRecall" },
      { id: "sc7", section: "Storage", text: "Chilled food was checked at 5°C or lower every day", type: "yesno", autoFill: "temp.daily" },
      { id: "sc8", section: "Storage", text: "No food past its use-by date is in stock", type: "yesno", autoFill: "stock.noExpired" },
      { id: "sc9", section: "Storage", text: "Nothing is left on hold without a decision", type: "yesno", autoFill: "stock.noneOnHold" },
      { id: "sc10", section: "Hygiene", text: "Hand washing facilities are stocked and used at the right times", type: "yesno" },
      { id: "sc11", section: "Hygiene", text: "Food contact surfaces are cleaned (and sanitised) every day they are used", type: "yesno" },
      { id: "sc12", section: "Pests & maintenance", text: "Pest checks were done and no pests were found", type: "yesno", autoFill: "records.noPests" },
      { id: "sc13", section: "Pests & maintenance", text: "Thermometers were checked in the last 3 months", type: "yesno", autoFill: "records.calibrated" },
      { id: "sc14", section: "People", text: "Staff training records are up to date", type: "yesno", autoFill: "records.training" },
      ...extra,
      { id: "sc90", section: "When things go wrong", text: "Every problem has been fixed and recorded, with steps to stop it happening again", type: "yesno", autoFill: "ca.allClosed" },
      { id: "sc91", section: "When things go wrong", text: "Every record that flagged a problem has a closed corrective action", type: "yesno", autoFill: "records.issuesHandled" },
    ],
  };
}

const PROCESS_QUESTIONS: Question[] = [
  { id: "pc1", section: "Process controls", text: "Cooked food reached a safe time/temperature (e.g. 75°C for 15 seconds) and records show it", type: "yesno" },
  { id: "pc2", section: "Process controls", text: "Cooked food was cooled from 60°C to 21°C in 2 h and to 5°C within 6 h", type: "yesno" },
  { id: "pc3", section: "Process controls", text: "Dried / acidified products were tested (water activity < 0.85, pH as required)", type: "yesno" },
];

const SICKNESS_QUESTION: Question = {
  id: "pc4",
  section: "People",
  text: "Staff sickness has been reported and recorded, and sick staff kept away from food",
  type: "yesno",
};

const MODULES: Record<BuiltInProgramme, ProgrammeModule> = {
  NP1: {
    key: "NP1",
    name: "National Programme 1",
    receivingPrompts: [...COMMON_PROMPTS, HONEY_PROMPT],
    recordTypes: [...COMMON_RECORDS, { ...TRANSPORT, sectors: ["transport"] }, TUTIN],
    templates: [
      selfCheck("NP1", [
        { id: "np1a", section: "Transport", text: "Chilled and frozen deliveries had temperature (and humidity) recorded in transport", type: "yesno", sectors: ["transport"] },
        { id: "np1b", section: "Honey", text: "Every honey batch packed has evidence it meets the tutin standard", type: "yesno", sectors: ["honey"] },
      ]),
    ],
    schedule: [
      DAILY_CHILLED,
      { key: "pest_check", label: "Pest check", frequency: "weekly", satisfiedBy: { kind: "record", recordType: "pest_check" } },
      { key: "calibration", label: "Thermometer check", frequency: "monthly", satisfiedBy: { kind: "record", recordType: "calibration" } },
      { key: "self_check", label: "NP1 self-check", frequency: "monthly", satisfiedBy: { kind: "audit", templateKey: "np1_self_check" } },
      { key: "mock_recall", label: "Mock recall", frequency: "yearly", satisfiedBy: { kind: "record", recordType: "mock_recall" } },
    ],
  },
  NP2: {
    key: "NP2",
    name: "National Programme 2",
    receivingPrompts: COMMON_PROMPTS,
    recordTypes: [
      ...COMMON_RECORDS,
      { ...SICKNESS, excludeSectors: ["ece", "retail_chilled_frozen"] },
      { ...TRANSPORT, excludeSectors: ["ece", "retail_chilled_frozen"] },
      { ...COOKING, description: `${COOKING.description} ECE / Kōhanga Reo: record this every time you cook poultry or minced meat.` },
      COOLING,
      REHEATING,
      WATER_ACTIVITY,
      PH,
    ],
    templates: [
      selfCheck("NP2", [
        { ...SICKNESS_QUESTION, excludeSectors: ["ece", "retail_chilled_frozen"] },
        ...PROCESS_QUESTIONS.map((q) => ({ ...q, excludeSectors: ["retail_chilled_frozen"] })),
        { id: "np2a", section: "Transport", text: "Temperature and humidity were recorded during transport", type: "yesno", excludeSectors: ["ece", "retail_chilled_frozen"] },
      ]),
    ],
    schedule: [
      DAILY_CHILLED,
      { key: "pest_check", label: "Pest check", frequency: "weekly", satisfiedBy: { kind: "record", recordType: "pest_check" } },
      { key: "calibration", label: "Thermometer check", frequency: "monthly", satisfiedBy: { kind: "record", recordType: "calibration" } },
      { key: "self_check", label: "NP2 self-check", frequency: "monthly", satisfiedBy: { kind: "audit", templateKey: "np2_self_check" } },
      { key: "mock_recall", label: "Mock recall", frequency: "yearly", satisfiedBy: { kind: "record", recordType: "mock_recall" } },
    ],
  },
  NP3: {
    key: "NP3",
    name: "National Programme 3",
    receivingPrompts: COMMON_PROMPTS,
    recordTypes: [...COMMON_RECORDS, SICKNESS, TRANSPORT, COOKING, COOLING, REHEATING, WATER_ACTIVITY, PH],
    templates: [
      selfCheck("NP3", [
        SICKNESS_QUESTION,
        ...PROCESS_QUESTIONS,
        { id: "np3a", section: "Process controls", text: "Reheated food reached 75°C and was kept above 60°C", type: "yesno", sectors: ["retail_handling"] },
        { id: "np3b", section: "Transport", text: "Hot and cold food temperatures were recorded during transport", type: "yesno" },
      ]),
    ],
    schedule: [
      DAILY_CHILLED,
      { key: "pest_check", label: "Pest check", frequency: "weekly", satisfiedBy: { kind: "record", recordType: "pest_check" } },
      { key: "calibration", label: "Thermometer check", frequency: "monthly", satisfiedBy: { kind: "record", recordType: "calibration" } },
      { key: "self_check", label: "NP3 self-check", frequency: "monthly", satisfiedBy: { kind: "audit", templateKey: "np3_self_check" } },
      { key: "mock_recall", label: "Mock recall", frequency: "yearly", satisfiedBy: { kind: "record", recordType: "mock_recall" } },
    ],
  },
};

/** Does a sector-scoped item apply to a business with `sectors`? */
export function applies(item: SectorScoped, sectors: string[]) {
  if (item.sectors && !item.sectors.some((s) => sectors.includes(s))) return false;
  if (item.excludeSectors?.some((s) => sectors.includes(s))) return false;
  return true;
}

/** A built-in module with everything that doesn't apply to these sectors removed. */
export function moduleFor(key: string, sectors: string[]): ProgrammeModule | undefined {
  const m = MODULES[key as BuiltInProgramme];
  if (!m) return undefined;
  return {
    ...m,
    receivingPrompts: m.receivingPrompts.filter((p) => applies(p, sectors)),
    recordTypes: m.recordTypes.filter((r) => applies(r, sectors)),
    templates: m.templates.map((t) => ({ ...t, questions: t.questions.filter((q) => applies(q, sectors)) })),
    schedule: m.schedule.filter((s) => applies(s, sectors)),
  };
}

export const BUILT_IN_MODULES = MODULES;

/** Values a record's fields say are a problem: one message per failed limit. */
export function failures(type: Pick<RecordType, "fields">, values: Record<string, unknown>) {
  const out: string[] = [];
  for (const f of type.fields) {
    const v = values[f.key];
    if (!f.failIf || v === null || v === undefined || v === "") continue;
    const { equals, above, below, message } = f.failIf;
    if ((equals !== undefined && v === equals) || (above !== undefined && (v as number) > above) || (below !== undefined && (v as number) < below)) {
      out.push(message);
    }
  }
  return out;
}
