/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditLog from "../auditLog.js";
import type * as audits from "../audits.js";
import type * as auth from "../auth.js";
import type * as businesses from "../businesses.js";
import type * as correctiveActions from "../correctiveActions.js";
import type * as customProgrammes from "../customProgrammes.js";
import type * as dashboard from "../dashboard.js";
import type * as deliveries from "../deliveries.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_business from "../lib/business.js";
import type * as lib_facts from "../lib/facts.js";
import type * as lib_module from "../lib/module.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_programmes from "../lib/programmes.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_stock from "../lib/stock.js";
import type * as lib_templates from "../lib/templates.js";
import type * as locations from "../locations.js";
import type * as migrations from "../migrations.js";
import type * as products from "../products.js";
import type * as programmes from "../programmes.js";
import type * as records from "../records.js";
import type * as settings from "../settings.js";
import type * as stock from "../stock.js";
import type * as stocktakes from "../stocktakes.js";
import type * as suppliers from "../suppliers.js";
import type * as temperature from "../temperature.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditLog: typeof auditLog;
  audits: typeof audits;
  auth: typeof auth;
  businesses: typeof businesses;
  correctiveActions: typeof correctiveActions;
  customProgrammes: typeof customProgrammes;
  dashboard: typeof dashboard;
  deliveries: typeof deliveries;
  "lib/audit": typeof lib_audit;
  "lib/business": typeof lib_business;
  "lib/facts": typeof lib_facts;
  "lib/module": typeof lib_module;
  "lib/password": typeof lib_password;
  "lib/programmes": typeof lib_programmes;
  "lib/session": typeof lib_session;
  "lib/settings": typeof lib_settings;
  "lib/stock": typeof lib_stock;
  "lib/templates": typeof lib_templates;
  locations: typeof locations;
  migrations: typeof migrations;
  products: typeof products;
  programmes: typeof programmes;
  records: typeof records;
  settings: typeof settings;
  stock: typeof stock;
  stocktakes: typeof stocktakes;
  suppliers: typeof suppliers;
  temperature: typeof temperature;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
