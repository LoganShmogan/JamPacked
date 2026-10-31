import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const role = v.union(v.literal("admin"), v.literal("manager"), v.literal("staff"));

export const storageType = v.union(
  v.literal("chilled"),
  v.literal("frozen"),
  v.literal("hot"),
  v.literal("ambient"),
);

export const locationKind = v.union(
  v.literal("chiller"),
  v.literal("freezer"),
  v.literal("dry"),
  v.literal("display"),
  v.literal("other"),
);

export const movementType = v.union(
  v.literal("receive"),
  v.literal("use"),
  v.literal("sell"),
  v.literal("dispatch"),
  v.literal("waste"),
  v.literal("adjust"),
  v.literal("stocktake"),
  v.literal("transfer"),
  v.literal("hold"),
  v.literal("release"),
  v.literal("void"),
);

export const frequency = v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly"));

/** A custom programme's parts, shaped like the built-in modules in convex/lib/programmes.ts. */
export const customField = v.object({
  key: v.string(),
  label: v.string(),
  type: v.union(v.literal("yesno"), v.literal("number"), v.literal("text"), v.literal("date")),
  required: v.optional(v.boolean()),
  unit: v.optional(v.string()),
  failIf: v.optional(
    v.object({ equals: v.optional(v.boolean()), above: v.optional(v.number()), below: v.optional(v.number()), message: v.string() }),
  ),
});
export const customRecordType = v.object({
  key: v.string(),
  name: v.string(),
  description: v.string(),
  fields: v.array(customField),
  frequency: v.optional(frequency),
});
export const customPrompt = v.object({ key: v.string(), text: v.string(), guidance: v.optional(v.string()) });
export const customChecklist = v.object({
  key: v.string(),
  name: v.string(),
  description: v.string(),
  defaultPeriodDays: v.number(),
  frequency: v.optional(frequency),
  questions: v.array(
    v.object({
      id: v.string(),
      section: v.string(),
      text: v.string(),
      type: v.union(v.literal("yesno"), v.literal("number"), v.literal("text")),
      guidance: v.optional(v.string()),
      autoFill: v.optional(v.string()), // kept when copied from a built-in checklist
    }),
  ),
});

/** A made product's recipe: what one batch of `yieldQty` takes. Ingredient quantities are in the ingredient's stock unit. */
export const recipe = v.object({
  yieldQty: v.number(),
  shelfLifeDays: v.optional(v.number()), // sets the use-by of each batch
  ingredients: v.array(v.object({ productId: v.id("products"), productName: v.string(), qty: v.number(), unit: v.string() })),
});

export const productKind = v.union(v.literal("supply"), v.literal("made"));

/** Tasks the app times from opening the form to saving it (analytics.ts). */
export const timedTask = v.union(v.literal("goodsIn"), v.literal("production"), v.literal("temperature"), v.literal("record"));

export const answerValue = v.union(v.string(), v.number(), v.boolean(), v.null());

export const programmeKey = v.union(v.literal("NP1"), v.literal("NP2"), v.literal("NP3"), v.literal("custom"));

// Every record belongs to one business. Optional only so existing single-business data still
// validates until `migrations:toMultiBusiness` has stamped it; all writes set it.
const businessId = v.optional(v.id("businesses"));

export default defineSchema({
  // ---- Accounts (local dev auth; to be replaced by Clerk) ----
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.optional(role), // legacy single-business role; roles now live on memberships
    passwordHash: v.string(),
    passwordSalt: v.string(),
    active: v.boolean(),
    platformAdmin: v.optional(v.boolean()), // JamPacked staff: can see the owner dashboard (platform.ts)
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  // ---- Businesses: one account can own or work at several ----
  businesses: defineTable({
    name: v.string(),
    jurisdiction: v.union(v.literal("NZ"), v.literal("AU")),
    region: v.optional(v.string()), // NZ region or AU state (convex/lib/regions.ts); unset on older businesses
    registrationNumber: v.optional(v.string()), // NZ FCP/NP registration or AU council licence
    address: v.optional(v.string()),
    chilledMaxC: v.number(),
    frozenMaxC: v.number(),
    hotMinC: v.number(),
    expiryWarningDays: v.number(),
    programme: programmeKey, // the standard this business follows (convex/lib/programmes.ts)
    customProgrammeId: v.optional(v.id("customProgrammes")), // when programme is "custom"
    sectors: v.array(v.string()), // programme sectors that apply, e.g. "ece", "transport"
    ownerId: v.id("users"),
    archived: v.boolean(), // businesses are archived, never deleted (records kept 7 years)
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Programmes people build themselves; owned by a user so they can reuse them across businesses.
  customProgrammes: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    dailyChilledCheck: v.boolean(),
    receivingPrompts: v.array(customPrompt),
    recordTypes: v.array(customRecordType),
    templates: v.array(customChecklist),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  memberships: defineTable({
    userId: v.id("users"),
    businessId: v.id("businesses"),
    role,
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_business", ["businessId"])
    .index("by_user_business", ["userId", "businessId"]),

  // Staff invited by email before they have an account; claimed when they register.
  invites: defineTable({
    businessId: v.id("businesses"),
    email: v.string(),
    role,
    invitedByName: v.string(),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_business", ["businessId"]),

  // Legacy single-row settings, read once by migrations:toMultiBusiness.
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
    businessId,
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
  }).index("by_business_name", ["businessId", "name"]),

  products: defineTable({
    businessId,
    name: v.string(),
    brand: v.optional(v.string()),
    barcode: v.optional(v.string()),
    storageType,
    allergens: v.array(v.string()),
    ingredients: v.optional(v.string()),
    novaGroup: v.optional(v.number()), // 1-4 (ultra-processed = 4), from Open Food Facts
    imageUrl: v.optional(v.string()),
    defaultSupplierId: v.optional(v.id("suppliers")),
    parLevel: v.optional(v.number()), // reorder when on hand falls below this
    reorderQty: v.optional(v.number()),
    kind: v.optional(productKind), // unset = supply: bought in. "made" = produced here (production.ts)
    unit: v.optional(v.string()), // the unit it's counted in, remembered from the first delivery or batch
    recipe: v.optional(recipe),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_business_barcode", ["businessId", "barcode"])
    .index("by_business_name", ["businessId", "name"]),

  // ---- Goods inwards (receiving) ----
  deliveries: defineTable({
    businessId,
    receivedAt: v.number(),
    supplierId: v.id("suppliers"),
    supplierName: v.string(),
    supplierApproved: v.boolean(), // snapshot at time of receipt
    invoiceNumber: v.optional(v.string()),
    vehicleClean: v.boolean(),
    vehicleTempC: v.optional(v.number()),
    status: v.union(v.literal("accepted"), v.literal("partial"), v.literal("rejected")),
    notes: v.optional(v.string()),
    // The programme's extra receiving checks (true / false / null = not applicable)
    programmeAnswers: v.optional(
      v.array(v.object({ key: v.string(), text: v.string(), value: v.union(v.boolean(), v.null()) })),
    ),
    receivedById: v.id("users"),
    receivedByName: v.string(),
    voided: v.boolean(),
    voidReason: v.optional(v.string()),
  })
    .index("by_business_receivedAt", ["businessId", "receivedAt"])
    .index("by_supplier", ["supplierId", "receivedAt"]),

  deliveryItems: defineTable({
    businessId,
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
    .index("by_business_receivedAt", ["businessId", "receivedAt"])
    .index("by_business_batch", ["businessId", "batchCode"])
    .index("by_product", ["productId", "receivedAt"]),

  // ---- Stock: lots on hand, where they are and everything that happened to them ----
  locations: defineTable({
    businessId: v.id("businesses"),
    name: v.string(),
    kind: locationKind,
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_business", ["businessId"]),

  // One lot per accepted delivery line (or opening stock). FIFO by use-by / best-before.
  stockLots: defineTable({
    businessId: v.id("businesses"),
    productId: v.optional(v.id("products")),
    productName: v.string(),
    barcode: v.optional(v.string()),
    deliveryId: v.optional(v.id("deliveries")),
    deliveryItemId: v.optional(v.id("deliveryItems")),
    productionRunId: v.optional(v.id("productionRuns")), // made here rather than delivered
    supplierName: v.optional(v.string()),
    batchCode: v.optional(v.string()),
    useBy: v.optional(v.number()),
    bestBefore: v.optional(v.number()),
    locationId: v.optional(v.id("locations")),
    storageType,
    unit: v.string(),
    qtyReceived: v.number(),
    qtyOnHand: v.number(),
    status: v.union(v.literal("available"), v.literal("hold"), v.literal("depleted")),
    holdReason: v.optional(v.string()),
    receivedAt: v.number(),
  })
    .index("by_business_status", ["businessId", "status"])
    .index("by_business_product", ["businessId", "productId"])
    .index("by_business_batch", ["businessId", "batchCode"])
    .index("by_deliveryItem", ["deliveryItemId"])
    .index("by_productionRun", ["productionRunId"]),

  // Append-only: qty is the signed change to the lot's on-hand quantity.
  stockMovements: defineTable({
    businessId: v.id("businesses"),
    lotId: v.id("stockLots"),
    productName: v.string(),
    type: movementType,
    qty: v.number(),
    qtyAfter: v.number(),
    reason: v.optional(v.string()),
    customer: v.optional(v.string()), // dispatch: who the food went to (NP tracing "one step forward")
    toLocationId: v.optional(v.id("locations")),
    productionRunId: v.optional(v.id("productionRuns")), // use: the batch this went into
    at: v.number(),
    byId: v.id("users"),
    byName: v.string(),
  })
    .index("by_lot", ["lotId", "at"])
    .index("by_business_at", ["businessId", "at"]),

  // ---- Production: products made here from stock on hand (supplies or other made products) ----
  // Inputs are taken out of their lots as "use" movements and the output becomes a new lot, so a
  // finished batch traces back to the supplier batches that went into it, and forward to customers.
  productionRuns: defineTable({
    businessId: v.id("businesses"),
    productId: v.id("products"),
    productName: v.string(),
    batchCode: v.string(),
    qty: v.number(),
    unit: v.string(),
    fromRecipe: v.boolean(),
    inputs: v.array(
      v.object({
        lotId: v.id("stockLots"),
        productName: v.string(),
        batchCode: v.optional(v.string()),
        supplierName: v.optional(v.string()),
        qty: v.number(),
        unit: v.string(),
      }),
    ),
    allergens: v.array(v.string()), // everything the inputs carry
    useBy: v.optional(v.number()),
    bestBefore: v.optional(v.number()),
    lotId: v.optional(v.id("stockLots")), // the batch's stock; set straight after the run is recorded
    notes: v.optional(v.string()),
    madeAt: v.number(),
    madeById: v.id("users"),
    madeByName: v.string(),
  })
    .index("by_business_madeAt", ["businessId", "madeAt"])
    .index("by_business_batch", ["businessId", "batchCode"]),

  stocktakes: defineTable({
    businessId: v.id("businesses"),
    locationId: v.optional(v.id("locations")),
    title: v.string(),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    startedAt: v.number(),
    startedByName: v.string(),
    completedAt: v.optional(v.number()),
    completedByName: v.optional(v.string()),
    lines: v.array(
      v.object({
        lotId: v.id("stockLots"),
        productName: v.string(),
        batchCode: v.optional(v.string()),
        unit: v.string(),
        expected: v.number(),
        counted: v.union(v.number(), v.null()),
      }),
    ),
  }).index("by_business_startedAt", ["businessId", "startedAt"]),

  // ---- Programme records: pest checks, calibration, training, mock recalls, cooking... ----
  // One generic table; what fields each record type has comes from the business's programme.
  records: defineTable({
    businessId: v.id("businesses"),
    programme: v.string(),
    recordType: v.string(),
    recordName: v.string(),
    values: v.record(v.string(), answerValue),
    issues: v.array(v.string()), // limits this record failed; each raised a corrective action
    at: v.number(),
    byId: v.id("users"),
    byName: v.string(),
    voided: v.boolean(),
    voidReason: v.optional(v.string()),
  })
    .index("by_business_at", ["businessId", "at"])
    .index("by_business_type", ["businessId", "recordType", "at"]),

  // ---- Temperature monitoring ----
  temperatureLogs: defineTable({
    businessId,
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
  }).index("by_business_checkedAt", ["businessId", "checkedAt"]),

  // ---- Audits / inspections (templates live in convex/lib/templates.ts) ----
  audits: defineTable({
    businessId,
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
  }).index("by_business_startedAt", ["businessId", "startedAt"]),

  // ---- Corrective actions / non-conformances ----
  correctiveActions: defineTable({
    businessId,
    title: v.string(),
    description: v.optional(v.string()),
    source: v.union(
      v.literal("goods_inward"),
      v.literal("temperature"),
      v.literal("audit"),
      v.literal("stock"),
      v.literal("record"),
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
  })
    .index("by_business", ["businessId"])
    .index("by_business_status", ["businessId", "status", "raisedAt"]),

  // ---- Usage: how long tasks take (analytics.ts). Usage data, not food safety records: no audit-log entry. ----
  taskTimings: defineTable({
    businessId: v.id("businesses"),
    userId: v.id("users"),
    task: timedTask,
    durationMs: v.number(),
    at: v.number(),
  })
    .index("by_business_at", ["businessId", "at"])
    .index("by_at", ["at"]),

  // ---- Immutable audit trail: who did what, when ----
  auditLog: defineTable({
    businessId,
    at: v.number(),
    userId: v.optional(v.id("users")),
    userName: v.string(),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    summary: v.string(),
    changes: v.optional(v.any()),
  })
    .index("by_business_at", ["businessId", "at"])
    .index("by_entity", ["entityType", "entityId", "at"])
    .index("by_business_user", ["businessId", "userId", "at"]),
});
