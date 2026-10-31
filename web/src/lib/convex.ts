// Talks to the same Convex backend as the app. Function names are written out rather than imported
// from backend/, so this folder builds on its own (e.g. on Vercel).
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

// Production goes through app.jampacked.co.nz, whose nginx forwards /api to Convex.
export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://app.jampacked.co.nz";
export const convex = new ConvexHttpClient(convexUrl);

type Week = { weekStart: number; count: number };

export type Overview = {
  generatedAt: number;
  users: { total: number; active: number };
  businesses: {
    total: number;
    archived: number;
    active7d: number;
    active30d: number;
    byProgramme: Record<string, number>;
    byCountry: { country: string; count: number; regions: { region: string; count: number }[] }[];
  };
  signupsByWeek: { users: Week[]; businesses: Week[] };
  taskTimes: { task: string; count: number; medianMs: number | null; businesses: number }[];
  businessList: {
    _id: string;
    name: string;
    programme: string;
    jurisdiction: string;
    region: string | null;
    archived: boolean;
    createdAt: number;
    members: number;
    lastActivityAt: number | null;
  }[];
};

export const fns = {
  login: makeFunctionReference<"action", { email: string; password: string }, { token: string }>("auth:login"),
  logout: makeFunctionReference<"mutation", { sessionToken: string }, null>("auth:logout"),
  overview: makeFunctionReference<"query", { sessionToken: string }, Overview>("platform:overview"),
};
