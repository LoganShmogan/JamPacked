// Analytics (off without a key) and which backend the site talks to.
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const init = vi.fn();
vi.mock("posthog-js", () => ({ default: { init: (...a: unknown[]) => init(...a) } }));

describe("Analytics", () => {
  beforeEach(() => init.mockClear());

  test("does nothing without a PostHog key", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const { Analytics } = await import("@/components/Analytics");
    const { container } = render(<Analytics />);
    expect(container).toBeEmptyDOMElement();
    expect(init).not.toHaveBeenCalled();
  });

  test("with a key: page views only, nothing stored in the browser, no recordings", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const { Analytics } = await import("@/components/Analytics");
    render(<Analytics />);
    expect(init).toHaveBeenCalledWith("phc_test", {
      api_host: "https://us.i.posthog.com",
      persistence: "memory",
      capture_pageview: "history_change",
      disable_session_recording: true,
    });
  });

  test("the PostHog host can be changed (e.g. the EU region)", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const { Analytics } = await import("@/components/Analytics");
    render(<Analytics />);
    expect(init.mock.calls[0][1]).toMatchObject({ api_host: "https://eu.i.posthog.com" });
  });
});

describe("convex", () => {
  beforeEach(() => vi.resetModules());

  test("production by default", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
    const { convexUrl } = await import("@/lib/convex");
    expect(convexUrl).toBe("https://app.jampacked.co.nz");
  });

  test("NEXT_PUBLIC_CONVEX_URL points it at another deployment", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3210");
    const { convexUrl } = await import("@/lib/convex");
    expect(convexUrl).toBe("http://127.0.0.1:3210");
  });
});
