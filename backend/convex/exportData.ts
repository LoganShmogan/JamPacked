import { PaginationOptions, PaginationResult, paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { RETENTION_YEARS } from "./lib/retention";
import { requireMember, scoped } from "./lib/session";

/** Every table that holds a business's records, in the order an export writes them. */
export const EXPORT_TABLES = [
  "suppliers",
  "products",
  "locations",
  "deliveries",
  "deliveryItems",
  "stockLots",
  "stockMovements",
  "productionRuns",
  "stocktakes",
  "temperatureLogs",
  "records",
  "audits",
  "correctiveActions",
  "memberships",
  "invites",
  "auditLog",
] as const;

const exportTable = v.union(...EXPORT_TABLES.map((t) => v.literal(t)));

// The table and index are only known at runtime, which Convex's generated types can't follow.
// The index map below keeps each table paired with an index that starts with businessId.
type ByBusiness = {
  withIndex: (
    index: string,
    range: (q: { eq: (field: "businessId", value: unknown) => unknown }) => unknown,
  ) => { paginate: (opts: PaginationOptions) => Promise<PaginationResult<Record<string, unknown>>> };
};

/** What an export contains. Admins only: it is every record the business has. */
export const manifest = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    const { business } = await requireMember(ctx, sessionToken, businessId, ["admin"]);
    return { business, tables: EXPORT_TABLES, retentionYears: RETENTION_YEARS, exportedAt: Date.now() };
  },
});

/** One page of one table for the business. The app walks every table until `isDone`. */
export const page = query({
  args: { ...scoped, table: exportTable, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, businessId, table, paginationOpts }) => {
    await requireMember(ctx, sessionToken, businessId, ["admin"]);
    // Every one of these tables has an index whose first field is businessId.
    const index = {
      suppliers: "by_business_name",
      products: "by_business_name",
      locations: "by_business",
      deliveries: "by_business_receivedAt",
      deliveryItems: "by_business_receivedAt",
      stockLots: "by_business_status",
      stockMovements: "by_business_at",
      productionRuns: "by_business_madeAt",
      stocktakes: "by_business_startedAt",
      temperatureLogs: "by_business_checkedAt",
      records: "by_business_at",
      audits: "by_business_startedAt",
      correctiveActions: "by_business",
      memberships: "by_business",
      invites: "by_business",
      auditLog: "by_business_at",
    }[table];
    return await (ctx.db.query(table) as unknown as ByBusiness)
      .withIndex(index, (q) => q.eq("businessId", businessId))
      .paginate(paginationOpts);
  },
});
