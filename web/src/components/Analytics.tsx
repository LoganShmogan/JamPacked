"use client";

// PostHog page views, only when NEXT_PUBLIC_POSTHOG_KEY is set. Memory-only persistence: no cookies or
// local storage, so no consent banner is needed. Never send customer record contents to analytics.
import posthog from "posthog-js";
import { useEffect } from "react";

export function Analytics() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      persistence: "memory",
      capture_pageview: "history_change",
      disable_session_recording: true,
    });
  }, []);
  return null;
}
