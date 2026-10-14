import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const role = v.union(v.literal("admin"), v.literal("manager"), v.literal("staff"));

export const storageType = v.union(
  v.literal("chilled"),
  v.literal("frozen"),
  v.literal("hot"),
  v.literal("ambient"),
);

export const answerValue = v.union(v.string(), v.number(), v.boolean(), v.null());

export default defineSchema({
  // ---- Accounts (local dev auth; to be replaced by Clerk) ----
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role,
    passwordHash: v.string(),
    passwordSalt: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  // ---- Business settings (single row) ----
  settings: defineTable({
    businessName: v.string(),
    jurisdiction: v.union(v.literal("NZ"), v.literal("AU")),
    registrationNumber: v.optional(v.string()), // NZ FCP/NP registration or AU council licence
    address: v.optional(v.string()),
    chilledMaxC: v.number(),
    frozenMaxC: v.number(),
    hotMinC: v.number(),
    expiryWarningDays: v.number(),
  }),

  suppliers: defineTable({
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    approved: v.boolean(),
    approvalNotes: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  products: defineTable({
    name: v.string(),
    brand: v.optional(v.string()),
    barcode: v.optional(v.string()),
    storageType,
    allergens: v.array(v.string()),
    ingredients: v.optional(v.string()),
    novaGroup: v.optional(v.number()), // 1-4 (ultra-processed = 4), from Open Food Facts
    imageUrl: v.optional(v.string()),
    defaultSupplierId: v.optional(v.id("suppliers")),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_barcode", ["barcode"])
    .index("by_name", ["name"]),

  // ---- Goods inwards (receiving) ----
  deliveries: defineTable({
    receivedAt: v.number(),
    supplierId: v.id("suppliers"),
    supplierName: v.string(),
    supplierApproved: v.boolean(), // snapshot at time of receipt
    invoiceNumber: v.optional(v.string()),
    vehicleClean: v.boolean(),
    vehicleTempC: v.optional(v.number()),
    status: v.union(v.literal("accepted"), v.literal("partial"), v.literal("rejected")),
    notes: v.optional(v.string()),
    receivedById: v.id("users"),
    receivedByName: v.string(),
    voided: v.boolean(),
    voidReason: v.optional(v.string()),
  })
    .index("by_receivedAt", ["receivedAt"])
    .index("by_supplier", ["supplierId", "receivedAt"]),

  deliveryItems: defineTable({
    deliveryId: v.id("deliveries"),
    receivedAt: v.number(),
    supplierId: v.id("suppliers"),
    productId: v.optional(v.id("products")),
    productName: v.string(),
    barcode: v.optional(v.string()),
    batchCode: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    useBy: v.optional(v.number()),
    bestBefore: v.optional(v.number()),
    storageType,
    temperatureC: v.optional(v.number()),
    temperatureCompliant: v.union(v.boolean(), v.null()), // null = not required (ambient)
    packagingOk: v.boolean(),
    labelOk: v.boolean(),
    allergens: v.array(v.string()),
    accepted: v.boolean(),
    rejectionReason: v.optional(v.string()),
    voided: v.boolean(),
  })
    .index("by_delivery", ["deliveryId"])
    .index("by_receivedAt", ["receivedAt"])
    .index("by_batch", ["batchCode"])
    .index("by_product", ["productId", "receivedAt"]),

  // ---- Temperature monitoring ----
  temperatureLogs: defineTable({
    checkedAt: v.number(),
    unitName: v.string(),
    unitType: v.union(
      v.literal("chiller"),
      v.literal("freezer"),
      v.literal("hot_hold"),
      v.literal("cooking"),
      v.literal("cooling"),
    ),
    temperatureC: v.number(),
    compliant: v.boolean(),
    correctiveAction: v.optional(v.string()),
    checkedById: v.id("users"),
    checkedByName: v.string(),
  }).index("by_checkedAt", ["checkedAt"]),

    // ---- Audits / inspections (templates live in convex/lib/templates.ts) ----
  audits: defineTable({
    templateKey: v.string(),
    templateName: v.string(),
    standardRef: v.string(),
    title: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
    tzOffsetMinutes: v.optional(v.number()), // client UTC offset, for local-day boundaries
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    startedAt: v.number(),
    startedById: v.id("users"),
    startedByName: v.string(),
    completedAt: v.optional(v.number()),
    completedById: v.optional(v.id("users")),
    completedByName: v.optional(v.string()),
    score: v.optional(v.number()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        section: v.string(),
        text: v.string(),
        type: v.union(v.literal("yesno"), v.literal("number"), v.literal("text")),
        guidance: v.optional(v.string()),
        value: answerValue,
        autoFilled: v.boolean(),
        evidence: v.optional(v.string()),
        notes: v.optional(v.string()),
        answeredByName: v.optional(v.string()),
        answeredAt: v.optional(v.number()),
      }),
    ),
  }).index("by_startedAt", ["startedAt"]),

  // ---- Corrective actions / non-conformances ----
  correctiveActions: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    source: v.union(
      v.literal("goods_inward"),
      v.literal("temperature"),
      v.literal("audit"),
      v.literal("manual"),
    ),
    sourceId: v.optional(v.string()),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    status: v.union(v.literal("open"), v.literal("closed")),
    raisedAt: v.number(),
    raisedById: v.id("users"),
    raisedByName: v.string(),
    closedAt: v.optional(v.number()),
    closedByName: v.optional(v.string()),
    resolution: v.optional(v.string()),
  }).index("by_status", ["status", "raisedAt"]),

  // ---- Immutable audit trail: who did what, when ----
  auditLog: defineTable({
    at: v.number(),
    userId: v.optional(v.id("users")),
    userName: v.string(),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    summary: v.string(),
    changes: v.optional(v.any()),
  })
    .index("by_at", ["at"])
    .index("by_entity", ["entityType", "entityId", "at"])
    .index("by_user", ["userId", "at"]),
});
