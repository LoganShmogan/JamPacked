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
import type * as correctiveActions from "../correctiveActions.js";
import type * as dashboard from "../dashboard.js";
import type * as deliveries from "../deliveries.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_facts from "../lib/facts.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_templates from "../lib/templates.js";
import type * as products from "../products.js";
import type * as settings from "../settings.js";
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
  correctiveActions: typeof correctiveActions;
  dashboard: typeof dashboard;
  deliveries: typeof deliveries;
  "lib/audit": typeof lib_audit;
  "lib/facts": typeof lib_facts;
  "lib/password": typeof lib_password;
  "lib/session": typeof lib_session;
  "lib/settings": typeof lib_settings;
  "lib/templates": typeof lib_templates;
  products: typeof products;
  settings: typeof settings;
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
