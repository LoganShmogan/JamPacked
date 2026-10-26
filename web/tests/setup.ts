import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

// Next's font loader and image component need the Next build; plain stand-ins are enough here.
vi.mock("next/font/google", () => ({ Figtree: () => ({ variable: "font-figtree" }) }));
vi.mock("next/image", () => ({
  // `priority` is Next-only; leave it off the <img>.
  default: (props: Record<string, unknown>) => createElement("img", { ...props, priority: undefined }),
}));
