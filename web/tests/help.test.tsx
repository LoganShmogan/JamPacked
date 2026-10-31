// The Help page (the app's guides, kept in step with the app), the screenshots, and formatting durations.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Help, { metadata } from "@/app/help/page";
import { Phone } from "@/components/Phone";
import { duration } from "@/lib/format";
import { guides, supportEmail } from "@/lib/guides";
import { shots } from "@/lib/screenshots";
import { site } from "@/lib/site";

// Tests run from web/.
const appGuides = resolve("../app/assets/help/guides.json");

describe("guides", () => {
  test("are the app's guides: run `npm run sync-guides` if this fails", () => {
    expect(existsSync(appGuides)).toBe(true);
    const app = JSON.parse(readFileSync(appGuides, "utf8"));
    expect(guides).toEqual(app.guides);
    expect(supportEmail).toBe(app.supportEmail);
  });

  test("the support email is the website's contact address", () => {
    expect(supportEmail).toBe(site.email);
  });

  test("every screenshot a guide names exists, and every screenshot file is there", () => {
    for (const g of guides.filter((g) => g.screenshot)) expect(Object.keys(shots)).toContain(g.screenshot);
    for (const s of Object.values(shots)) expect(existsSync(resolve(`public${s.src}`)), s.src).toBe(true);
  });
});

describe("Help page", () => {
  test("every guide with its steps, where to find it, tips and screenshots", () => {
    const { container } = render(<Help />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How to use JamPacked");
    const toc = within(screen.getByRole("navigation", { name: "Guides" }));
    expect(toc.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(guides.map((g) => `#${g.id}`));
    for (const g of guides) {
      const section = container.querySelector<HTMLElement>(`section#${g.id}`)!;
      expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent(g.title);
      expect(section).toHaveTextContent(`Where: ${g.where}`);
      expect(within(section).getAllByRole("listitem")).toHaveLength(g.steps.length);
      expect(section.textContent!.includes("Tip:")).toBe(Boolean(g.tip));
      expect(section.querySelectorAll("img")).toHaveLength(g.screenshot ? 1 : 0);
    }
    expect(screen.getByRole("link", { name: supportEmail })).toHaveAttribute("href", `mailto:${supportEmail}`);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq/");
    expect(metadata.alternates).toEqual({ canonical: "/help/" });
  });

  test("a screenshot is framed, with alt text and a caption", () => {
    render(<Phone shot={shots.trace} className="w-56" />);
    expect(screen.getByRole("img", { name: shots.trace.alt })).toHaveAttribute("src", "/screenshots/trace.png");
    expect(screen.getByText("Trace and recall in seconds").tagName).toBe("FIGCAPTION");
    expect(screen.getByRole("figure")).toHaveClass("w-56");
  });
});

test("duration", () => {
  expect(duration(null)).toBe("–");
  expect(duration(45_400)).toBe("45 s");
  expect(duration(180_000)).toBe("3 min");
  expect(duration(272_000)).toBe("4 min 32 s");
  expect(duration(7_200_000)).toBe("2 h");
  expect(duration(3_900_000)).toBe("1 h 5 min");
});
