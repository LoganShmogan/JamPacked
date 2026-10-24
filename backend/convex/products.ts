import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { diff, logAudit } from "./lib/audit";
import { inBusiness, requireMember, scoped } from "./lib/session";
import { storageType } from "./schema";

export const list = query({
  args: scoped,
  handler: async (ctx, { sessionToken, businessId }) => {
    await requireMember(ctx, sessionToken, businessId);
    return (
      await ctx.db.query("products").withIndex("by_business_name", (q) => q.eq("businessId", businessId)).collect()
    ).filter((p) => p.active);
  },
});

export const byBarcode = query({
  args: { ...scoped, barcode: v.string() },
  handler: async (ctx, { sessionToken, businessId, barcode }) => {
    await requireMember(ctx, sessionToken, businessId);
    return await ctx.db
      .query("products")
      .withIndex("by_business_barcode", (q) => q.eq("businessId", businessId).eq("barcode", barcode))
      .first();
  },
});

export const create = mutation({
  args: {
    ...scoped,
    name: v.string(),
    brand: v.optional(v.string()),
    barcode: v.optional(v.string()),
    storageType,
    allergens: v.array(v.string()),
    ingredients: v.optional(v.string()),
    novaGroup: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    defaultSupplierId: v.optional(v.id("suppliers")),
    parLevel: v.optional(v.number()),
    reorderQty: v.optional(v.number()),
  },
  handler: async (ctx, { sessionToken, businessId, ...data }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId);
    if (!data.name.trim()) throw new ConvexError("Product name is required");
    const id = await ctx.db.insert("products", { ...data, businessId, active: true, createdAt: Date.now() });
    await logAudit(ctx, user, {
      businessId,
      action: "create",
      entityType: "product",
      entityId: id,
      summary: `Added product ${data.name}`,
      changes: data,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    ...scoped,
    id: v.id("products"),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    barcode: v.optional(v.string()),
    storageType: v.optional(storageType),
    allergens: v.optional(v.array(v.string())),
    ingredients: v.optional(v.string()),
    defaultSupplierId: v.optional(v.id("suppliers")),
    parLevel: v.optional(v.number()),
    reorderQty: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionToken, businessId, id, ...patch }) => {
    const { user } = await requireMember(ctx, sessionToken, businessId, ["admin", "manager"]);
    const before = inBusiness(await ctx.db.get(id), businessId, "Product");
    const changes = diff(before, patch);
    await ctx.db.patch(id, patch);
    await logAudit(ctx, user, {
      businessId,
      action: "update",
      entityType: "product",
      entityId: id,
      summary: `Updated product ${before.name} (${Object.keys(changes).join(", ") || "no changes"})`,
      changes,
    });
  },
});

// Allergens that must be declared under FSANZ Food Standards Code Std 1.2.3 (PEAL), applies in NZ & AU.
export const ALLERGENS = [
  "gluten", "wheat", "crustacea", "egg", "fish", "milk", "peanut", "soy",
  "sesame", "almond", "brazil nut", "cashew", "hazelnut", "macadamia", "pecan",
  "pine nut", "pistachio", "walnut", "lupin", "mollusc", "sulphites",
];

const OFF_ALLERGEN_MAP: Record<string, string> = {
  "en:gluten": "gluten", "en:crustaceans": "crustacea", "en:eggs": "egg", "en:fish": "fish",
  "en:milk": "milk", "en:peanuts": "peanut", "en:soybeans": "soy", "en:sesame-seeds": "sesame",
  "en:nuts": "tree nuts", "en:lupin": "lupin", "en:molluscs": "mollusc",
  "en:sulphur-dioxide-and-sulphites": "sulphites",
};

type BarcodeLookup = {
  name: string;
  brand?: string;
  allergens: string[];
  ingredients?: string;
  novaGroup?: number;
  imageUrl?: string;
  storageType: "frozen" | "chilled" | "ambient";
};

/** Looks a barcode up on Open Food Facts to pre-fill product details (name, allergens, NOVA/UPF group). */
export const lookupBarcode = action({
  args: { ...scoped, barcode: v.string() },
  handler: async (ctx, { sessionToken, businessId, barcode }): Promise<BarcodeLookup | null> => {
    await ctx.runQuery(api.settings.get, { sessionToken, businessId }); // throws unless a member
    if (!/^\d{6,14}$/.test(barcode)) return null;
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,allergens_tags,ingredients_text,nova_group,image_front_small_url,categories_tags`,
      { headers: { "User-Agent": "JamPacked/0.1 (https://jampacked.co.nz)" } },
    );
    if (!res.ok) return null;
    const body = await res.json();
    if (body.status !== 1 || !body.product) return null;
    const p = body.product;
    const cats: string[] = p.categories_tags ?? [];
    const guessStorage = cats.some((c) => c.includes("frozen"))
      ? "frozen"
      : cats.some((c) => /dair(y|ies)|meat|fish|seafood|chilled|yogurt|cheese/.test(c))
        ? "chilled"
        : "ambient";
    return {
      name: (p.product_name as string | undefined) ?? "",
      brand: (p.brands as string | undefined)?.split(",")[0]?.trim(),
      allergens: [...new Set(((p.allergens_tags ?? []) as string[]).map((t) => OFF_ALLERGEN_MAP[t] ?? t.replace(/^\w+:/, "")))],
      ingredients: p.ingredients_text as string | undefined,
      novaGroup: typeof p.nova_group === "number" ? p.nova_group : undefined,
      imageUrl: p.image_front_small_url as string | undefined,
      storageType: guessStorage as "frozen" | "chilled" | "ambient",
    };
  },
});
