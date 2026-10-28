import { ConvexError } from "convex/values";

/** Where a business is: NZ regions (plus the Chatham Islands) and AU states and territories. */
export const REGIONS = {
  NZ: [
    "Northland",
    "Auckland",
    "Waikato",
    "Bay of Plenty",
    "Gisborne",
    "Hawke's Bay",
    "Taranaki",
    "Manawatū-Whanganui",
    "Wellington",
    "Tasman",
    "Nelson",
    "Marlborough",
    "West Coast",
    "Canterbury",
    "Otago",
    "Southland",
    "Chatham Islands",
  ],
  AU: [
    "New South Wales",
    "Victoria",
    "Queensland",
    "Western Australia",
    "South Australia",
    "Tasmania",
    "Australian Capital Territory",
    "Northern Territory",
  ],
} as const;

export type Jurisdiction = keyof typeof REGIONS;

/** A region must be one of its country's. */
export function checkRegion(jurisdiction: Jurisdiction, region: string) {
  if (!(REGIONS[jurisdiction] as readonly string[]).includes(region)) {
    throw new ConvexError(`${region} isn't a region of ${jurisdiction === "NZ" ? "New Zealand" : "Australia"}`);
  }
}
