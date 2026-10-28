"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { appLink, detectPlatform, type Platform } from "@/lib/device";
import { site } from "@/lib/site";

export const REDIRECT_SECONDS = 5;

// The device never changes while the page is open, and is unknown while the page is pre-rendered.
const noSubscription = () => () => {};
const browserPlatform = () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
const prerendered = () => null;

/** Sends a new customer to the right place for their device, after a moment to read the page. */
export function GetTheApp() {
  const platform = useSyncExternalStore<Platform | null>(noSubscription, browserPlatform, prerendered);
  const [cancelled, setCancelled] = useState(false);
  const link = platform && appLink(platform);
  const url = link?.url;

  useEffect(() => {
    if (!url || cancelled) return;
    const t = setTimeout(() => window.location.assign(url), REDIRECT_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [url, cancelled]);

  if (!link) return null;
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
      <a href={link.url} className="block rounded-lg bg-jam px-5 py-4 text-center text-lg font-semibold text-on-jam hover:bg-jam-dark">
        {link.label}
      </a>
      {cancelled ? (
        <p className="mt-3 text-center text-sm text-muted">Take your time.</p>
      ) : (
        <p className="mt-3 text-center text-sm text-muted">
          Taking you there in {REDIRECT_SECONDS} seconds.{" "}
          <button onClick={() => setCancelled(true)} className="font-semibold underline">Stay here</button>
        </p>
      )}
      <p className="mt-6 text-sm text-muted">On another device?</p>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-jam">
        {site.playStoreUrl && <li><a href={site.playStoreUrl}>Google Play</a></li>}
        {site.appStoreUrl && <li><a href={site.appStoreUrl}>App Store</a></li>}
        <li><a href={site.appUrl}>Web app ({site.appUrl.replace("https://", "")})</a></li>
      </ul>
    </div>
  );
}
