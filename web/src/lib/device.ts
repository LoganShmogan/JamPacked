import { site } from "./site";

export type Platform = "android" | "ios" | "other";

/** Which store a browser's device uses. iPads report as a Mac, so a touch screen gives them away. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  return "other";
}

/** Where to get the app on this device: its store listing if there is one, otherwise the web app. */
export function appLink(platform: Platform): { url: string; label: string } {
  if (platform === "android" && site.playStoreUrl) return { url: site.playStoreUrl, label: "Get it on Google Play" };
  if (platform === "ios" && site.appStoreUrl) return { url: site.appStoreUrl, label: "Download on the App Store" };
  return { url: site.appUrl, label: "Open the JamPacked web app" };
}
