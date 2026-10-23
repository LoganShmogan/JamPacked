// Built-in audit templates aligned to NZ (Food Act 2014, MPI Food Control Plan / National Programmes)
// and AU (FSANZ Food Standards Code Std 3.2.2, 3.2.2A). Questions with `autoFill` are answered from
// goods inwards, temperature logs and corrective actions for the audit period.

export type Question = {
  id: string;
  section: string;
  text: string;
  type: "yesno" | "number" | "text";
  autoFill?: string;
  guidance?: string;
};

export type Template = {
  key: string;
  name: string;
  description: string;
  standardRef: string;
  defaultPeriodDays: number;
  questions: Question[];
};

export const TEMPLATES: Template[] = [
  {
    key: "goods_receipt",
    name: "Goods Receipt & Supplier Verification",
    description: "Verifies deliveries were received safely from approved suppliers and are traceable.",
    standardRef: "MPI FCP 'Buying & receiving' · FSANZ 3.2.2 cl.5 & cl.12 · 3.2.2A",
    defaultPeriodDays: 7,
    questions: [
      { id: "gr1", section: "Deliveries", text: "Number of deliveries received this period", type: "number", autoFill: "gi.count" },
      { id: "gr2", section: "Suppliers", text: "All goods came from approved/registered suppliers", type: "yesno", autoFill: "gi.allApprovedSuppliers", guidance: "Keep an approved supplier list. Only buy from registered food businesses." },
      { id: "gr3", section: "Temperature", text: "Temperatures recorded for all chilled, frozen and hot deliveries", type: "yesno", autoFill: "gi.tempChecked" },
      { id: "gr4", section: "Temperature", text: "All accepted chilled/frozen/hot food was within temperature limits", type: "yesno", autoFill: "gi.tempCompliant", guidance: "Chilled ≤5°C, hot ≥60°C, frozen received frozen hard." },
      { id: "gr5", section: "Condition", text: "Packaging intact and labels correct on all accepted goods", type: "yesno", autoFill: "gi.packagingLabels" },
      { id: "gr6", section: "Condition", text: "No goods past their use-by date were accepted", type: "yesno", autoFill: "gi.noExpiredAccepted" },
      { id: "gr7", section: "Traceability", text: "Batch/lot code and date mark recorded for all accepted goods", type: "yesno", autoFill: "gi.traceable", guidance: "Required so you can trace and recall food 'one step back'." },
      { id: "gr8", section: "Condition", text: "Delivery vehicles were clean", type: "yesno", autoFill: "gi.vehiclesClean" },
      { id: "gr9", section: "Rejections", text: "All rejected goods have a reason and a corrective action", type: "yesno", autoFill: "gi.rejectionsHandled" },
      { id: "gr10", section: "Allergens", text: "Allergens brought on site this period", type: "text", autoFill: "gi.allergens", guidance: "Check allergen information is up to date for menu/labelling." },
      { id: "gr11", section: "Sign-off", text: "Staff receiving goods have been trained in receiving checks", type: "yesno" },
    ],
  },
  {
    key: "daily_check",
    name: "Daily Food Safety Check",
    description: "Opening/closing checks (FCP diary). Auto-fills today's deliveries and temperature checks.",
    standardRef: "MPI FCP Diary · FSANZ 3.2.2 cl.4 (skills & knowledge), 3.2.2A",
    defaultPeriodDays: 1,
    questions: [
      { id: "dc1", section: "Opening", text: "Chillers and freezers checked and within limits", type: "yesno", autoFill: "temp.compliant" },
      { id: "dc2", section: "Opening", text: "Temperature checks recorded today", type: "number", autoFill: "temp.count" },
      { id: "dc3", section: "Opening", text: "Hand basins stocked with soap, warm water and paper towels", type: "yesno" },
      { id: "dc4", section: "Opening", text: "Staff fit for work (no vomiting/diarrhoea in last 48h)", type: "yesno" },
      { id: "dc5", section: "Deliveries", text: "Deliveries received today", type: "number", autoFill: "gi.count" },
      { id: "dc6", section: "Deliveries", text: "All of today's deliveries were within temperature limits", type: "yesno", autoFill: "gi.tempCompliant" },
      { id: "dc7", section: "Stock", text: "No out-of-date stock on hand", type: "yesno", autoFill: "stock.noExpired" },
      { id: "dc8", section: "Closing", text: "Food covered, labelled and dated in storage", type: "yesno" },
      { id: "dc9", section: "Closing", text: "Cleaning schedule completed for today", type: "yesno" },
      { id: "dc10", section: "Closing", text: "Anything go wrong today? What did you do?", type: "text" },
    ],
  },
  {
    key: "monthly_review",
    name: "Monthly Food Safety Review",
    description: "Monthly verification that the plan is working. Pulls a month of records automatically.",
    standardRef: "MPI FCP 'Checking for problems' / verification · FSANZ 3.2.2A cl.10 (records)",
    defaultPeriodDays: 30,
    questions: [
      { id: "mr1", section: "Records", text: "Number of deliveries received this month", type: "number", autoFill: "gi.count" },
      { id: "mr2", section: "Records", text: "Temperature checks recorded every day", type: "yesno", autoFill: "temp.daily" },
      { id: "mr3", section: "Records", text: "All temperature checks within limits (or corrective action recorded)", type: "yesno", autoFill: "temp.compliant" },
      { id: "mr4", section: "Suppliers", text: "All goods came from approved suppliers", type: "yesno", autoFill: "gi.allApprovedSuppliers" },
      { id: "mr5", section: "Suppliers", text: "Supplier rejection rate (%)", type: "number", autoFill: "gi.rejectionRate" },
      { id: "mr6", section: "Traceability", text: "All accepted goods are traceable (batch + date mark)", type: "yesno", autoFill: "gi.traceable" },
      { id: "mr11", section: "Stock", text: "A stocktake was completed this month", type: "yesno", autoFill: "stock.stocktakeDone" },
      { id: "mr12", section: "Stock", text: "No stock on hand is past its use-by date", type: "yesno", autoFill: "stock.noExpired" },
      { id: "mr13", section: "Stock", text: "Nothing is left on hold without a decision", type: "yesno", autoFill: "stock.noneOnHold", guidance: "Held stock must be released, returned or wasted, with a record of what you did." },
      { id: "mr7", section: "Problems", text: "All corrective actions are closed", type: "yesno", autoFill: "ca.allClosed" },
      { id: "mr8", section: "Problems", text: "Recurring problems identified and procedures updated", type: "text" },
      { id: "mr9", section: "People", text: "Food handlers have current food safety training", type: "yesno" },
      { id: "mr10", section: "Premises", text: "No evidence of pests", type: "yesno" },
    ],
  },
  {
    key: "hygiene",
    name: "Cleaning, Pest & Personal Hygiene",
    description: "Walk-through inspection of premises, cleaning and food handler practices.",
    standardRef: "MPI FCP 'Cleaning & sanitising', 'Pests' · FSANZ 3.2.2 cl.13–24, 3.2.3",
    defaultPeriodDays: 1,
    questions: [
      { id: "hy1", section: "Premises", text: "Floors, walls and ceilings clean and in good repair", type: "yesno" },
      { id: "hy2", section: "Premises", text: "Food contact surfaces cleaned and sanitised", type: "yesno" },
      { id: "hy3", section: "Pests", text: "No signs of pests (droppings, damage, insects)", type: "yesno" },
      { id: "hy4", section: "Pests", text: "Pest control devices checked and records current", type: "yesno" },
      { id: "hy5", section: "People", text: "Staff wearing clean clothing, hair restrained", type: "yesno" },
      { id: "hy6", section: "People", text: "Handwashing observed at correct times", type: "yesno" },
      { id: "hy7", section: "Waste", text: "Bins clean, lidded and emptied regularly", type: "yesno" },
      { id: "hy8", section: "Chemicals", text: "Chemicals stored away from food and labelled", type: "yesno" },
      { id: "hy9", section: "Notes", text: "Other observations", type: "text" },
    ],
  },
];
