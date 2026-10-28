import { Doc } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import { lotsOnHand } from "./stock";

export type Fact = { value: string | number | boolean | null; evidence: string };

const fmtDate = (ms: number, tz = 0) => new Date(ms + tz * 60_000).toISOString().slice(0, 10);
const list = (xs: string[], max = 5) =>
  xs.length <= max ? xs.join("; ") : `${xs.slice(0, max).join("; ")} (+${xs.length - max} more)`;

/** Computes auto-fill answers for an audit period from goods inwards & other records. */
export async function computeFacts(
  ctx: QueryCtx,
  business: Doc<"businesses">,
  start: number,
  end: number,
  tz = 0, // client UTC offset in minutes
): Promise<Record<string, Fact>> {
  const settings = business;
  const businessId = business._id;
  const deliveries = (
    await ctx.db.query("deliveries").withIndex("by_business_receivedAt", (q) => q.eq("businessId", businessId).gte("receivedAt", start).lte("receivedAt", end)).collect()
  ).filter((d) => !d.voided);
  const items = (
    await ctx.db.query("deliveryItems").withIndex("by_business_receivedAt", (q) => q.eq("businessId", businessId).gte("receivedAt", start).lte("receivedAt", end)).collect()
  ).filter((i) => !i.voided);
  const accepted = items.filter((i) => i.accepted);
  const rejected = items.filter((i) => !i.accepted);
  const temps = await ctx.db.query("temperatureLogs").withIndex("by_business_checkedAt", (q) => q.eq("businessId", businessId).gte("checkedAt", start).lte("checkedAt", end)).collect();
  const openCAs = await ctx.db.query("correctiveActions").withIndex("by_business_status", (q) => q.eq("businessId", businessId).eq("status", "open")).collect();

  const noDeliveries = deliveries.length === 0;
  const none = (what: string): Fact => ({ value: null, evidence: `No ${what} recorded in this period` });

  const unapproved = deliveries.filter((d) => !d.supplierApproved);
  const tempRequired = items.filter((i) => i.storageType !== "ambient");
  const tempMissing = tempRequired.filter((i) => i.temperatureC === undefined);
  const tempBad = accepted.filter((i) => i.temperatureCompliant === false);
  const condBad = accepted.filter((i) => !i.packagingOk || !i.labelOk);
  const expiredAccepted = accepted.filter((i) => i.useBy !== undefined && i.useBy < i.receivedAt);
  const untraceable = accepted.filter((i) => !i.batchCode || (i.useBy === undefined && i.bestBefore === undefined));
  const dirtyVehicles = deliveries.filter((d) => !d.vehicleClean);
  const rejectedNoReason = rejected.filter((i) => !i.rejectionReason);
  const allergens = [...new Set(accepted.flatMap((i) => i.allergens))].sort();

  const now = Date.now();
  const onHand = await lotsOnHand(ctx, businessId);
  const expiredOnHand = onHand.filter((l) => l.useBy !== undefined && l.useBy < now);
  const held = onHand.filter((l) => l.status === "hold");
  const stocktakes = (
    await ctx.db
      .query("stocktakes")
      .withIndex("by_business_startedAt", (q) => q.eq("businessId", businessId).gte("startedAt", start).lte("startedAt", end))
      .collect()
  ).filter((s) => s.status === "completed");

  const days = new Set(temps.map((t) => fmtDate(t.checkedAt, tz)));
  const missingDays: string[] = [];
  for (let d = start; d <= Math.min(end, now); d += 86_400_000) {
    if (!days.has(fmtDate(d, tz))) missingDays.push(fmtDate(d, tz));
  }
  const tempLogBad = temps.filter((t) => !t.compliant);

  // Programme records: the last year, so yearly checks (mock recall) can be seen from any period.
  const yearRecords = (
    await ctx.db
      .query("records")
      .withIndex("by_business_at", (q) => q.eq("businessId", businessId).gte("at", end - 365 * 86_400_000).lte("at", end))
      .collect()
  ).filter((r) => !r.voided);
  const ofType = (t: string) => yearRecords.filter((r) => r.recordType === t);
  const inPeriod = yearRecords.filter((r) => r.at >= start);
  const mockRecalls = ofType("mock_recall");
  const pestChecks = ofType("pest_check").filter((r) => r.at >= start);
  const pestsFound = pestChecks.filter((r) => r.values.found === true);
  const calibrations = ofType("calibration").filter((r) => r.at >= end - 90 * 86_400_000);
  const trainings = ofType("training");
  const flaggedIds = new Set(inPeriod.filter((r) => r.issues.length).map((r) => r._id as string));
  const openFromRecords = openCAs.filter((c) => c.source === "record" && flaggedIds.has(c.sourceId!));

  return {
    "gi.count": {
      value: deliveries.length,
      evidence: `${deliveries.length} deliveries, ${items.length} line items (${rejected.length} rejected)`,
    },
    "gi.allApprovedSuppliers": noDeliveries ? none("deliveries") : {
      value: unapproved.length === 0,
      evidence: unapproved.length ? `Unapproved: ${list([...new Set(unapproved.map((d) => d.supplierName))])}` : `${new Set(deliveries.map((d) => d.supplierName)).size} supplier(s), all approved`,
    },
    "gi.tempChecked": tempRequired.length === 0 ? none("temperature-controlled deliveries") : {
      value: tempMissing.length === 0,
      evidence: tempMissing.length ? `Missing: ${list(tempMissing.map((i) => i.productName))}` : `${tempRequired.length} temperature readings recorded`,
    },
    "gi.tempCompliant": tempRequired.length === 0 ? none("temperature-controlled deliveries") : {
      value: tempBad.length === 0,
      evidence: tempBad.length
        ? `Out of range: ${list(tempBad.map((i) => `${i.productName} ${i.temperatureC ?? "?"}°C`))}`
        : `All within limits (chilled ≤${settings.chilledMaxC}°C, frozen ≤${settings.frozenMaxC}°C, hot ≥${settings.hotMinC}°C)`,
    },
    "gi.packagingLabels": accepted.length === 0 ? none("accepted goods") : {
      value: condBad.length === 0,
      evidence: condBad.length ? `Issues: ${list(condBad.map((i) => i.productName))}` : `${accepted.length} items checked OK`,
    },
    "gi.noExpiredAccepted": accepted.length === 0 ? none("accepted goods") : {
      value: expiredAccepted.length === 0,
      evidence: expiredAccepted.length ? `Expired on receipt: ${list(expiredAccepted.map((i) => i.productName))}` : "No expired goods accepted",
    },
    "gi.traceable": accepted.length === 0 ? none("accepted goods") : {
      value: untraceable.length === 0,
      evidence: untraceable.length ? `Missing batch/date: ${list(untraceable.map((i) => i.productName))}` : `${accepted.length} items fully traceable`,
    },
    "gi.vehiclesClean": noDeliveries ? none("deliveries") : {
      value: dirtyVehicles.length === 0,
      evidence: dirtyVehicles.length ? `Not clean: ${list(dirtyVehicles.map((d) => `${d.supplierName} ${fmtDate(d.receivedAt, tz)}`))}` : "All vehicles clean",
    },
    "gi.rejectionsHandled": {
      value: rejectedNoReason.length === 0,
      evidence: rejected.length ? `${rejected.length} rejected: ${list(rejected.map((i) => `${i.productName} (${i.rejectionReason ?? "no reason"})`))}` : "No rejections",
    },
    "gi.rejectionRate": {
      value: items.length ? Math.round((rejected.length / items.length) * 1000) / 10 : 0,
      evidence: `${rejected.length} of ${items.length} line items rejected`,
    },
    "gi.allergens": {
      value: allergens.length ? allergens.join(", ") : "None recorded",
      evidence: `From ${accepted.length} accepted items`,
    },
    "stock.noExpired": {
      value: expiredOnHand.length === 0,
      evidence: expiredOnHand.length ? `Past use-by: ${list(expiredOnHand.map((i) => `${i.productName} (${fmtDate(i.useBy!, tz)})`))}` : "No stock on hand is past its use-by",
    },
    "stock.noneOnHold": {
      value: held.length === 0,
      evidence: held.length ? `On hold: ${list(held.map((l) => `${l.productName} (${l.holdReason})`))}` : "Nothing on hold",
    },
    "stock.stocktakeDone": {
      value: stocktakes.length > 0,
      evidence: stocktakes.length ? `${stocktakes.length} stocktake(s) completed, last ${fmtDate(Math.max(...stocktakes.map((s) => s.completedAt!)), tz)}` : "No stocktake completed in this period",
    },
    "temp.count": { value: temps.length, evidence: `${temps.length} checks, ${tempLogBad.length} out of range` },
    "temp.compliant": temps.length === 0 ? none("temperature checks") : {
      value: tempLogBad.length === 0,
      evidence: tempLogBad.length
        ? `Out of range: ${list(tempLogBad.map((t) => `${t.unitName} ${t.temperatureC}°C → ${t.correctiveAction ?? ""}`))}`
        : `${temps.length} checks all within limits`,
    },
    "temp.daily": {
      value: missingDays.length === 0,
      evidence: missingDays.length ? `No checks on: ${list(missingDays)}` : "Checks recorded every day",
    },
    "records.mockRecall": {
      value: mockRecalls.length > 0,
      evidence: mockRecalls.length
        ? `Last mock recall ${fmtDate(Math.max(...mockRecalls.map((r) => r.at)), tz)}`
        : "No mock recall recorded in the last 12 months",
    },
    "records.noPests": pestChecks.length === 0 ? none("pest checks") : {
      value: pestsFound.length === 0,
      evidence: pestsFound.length
        ? `Pests found on ${list(pestsFound.map((r) => fmtDate(r.at, tz)))}`
        : `${pestChecks.length} pest check(s), nothing found`,
    },
    "records.calibrated": {
      value: calibrations.length > 0,
      evidence: calibrations.length
        ? `${calibrations.length} thermometer check(s) in the last 3 months`
        : "No thermometer check in the last 3 months",
    },
    "records.training": {
      value: trainings.length > 0,
      evidence: trainings.length
        ? `${trainings.length} training record(s) in the last 12 months`
        : "No training recorded in the last 12 months",
    },
    "records.issuesHandled": {
      value: openFromRecords.length === 0,
      evidence: flaggedIds.size === 0
        ? "No records flagged a problem"
        : `${flaggedIds.size} record(s) flagged a problem, ${openFromRecords.length} still open`,
    },
    "ca.allClosed": {
      value: openCAs.length === 0,
      evidence: openCAs.length ? `${openCAs.length} open: ${list(openCAs.map((c) => c.title))}` : "No open corrective actions",
    },
  };
}
