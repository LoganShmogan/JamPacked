// The app's how-to guides, written once in app/assets/help/guides.json and copied here before each build
// (scripts/sync-guides.mjs), so the website's /help/ page and the app's Help screen say the same thing.
import data from "./guides.json";

export type Guide = {
  id: string;
  title: string;
  icon: string;
  summary: string;
  where: string;
  steps: string[];
  tip?: string;
  screenshot?: string;
};

export const guides: Guide[] = data.guides;
export const supportEmail: string = data.supportEmail;
