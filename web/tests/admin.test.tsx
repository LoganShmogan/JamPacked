// The owner dashboard: sign-in, who gets in, and what it shows.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Overview } from "@/lib/convex";

const convex = vi.hoisted(() => ({ query: vi.fn(), action: vi.fn(), mutation: vi.fn() }));
vi.mock("@/lib/convex", () => ({
  convex,
  fns: { login: "auth:login", logout: "auth:logout", overview: "platform:overview" },
}));
import AdminPage from "@/app/admin/page";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 27, 0, 0);

function overview(over: Partial<Overview["businesses"]> = {}, list?: Overview["businessList"]): Overview {
  const weeks = (counts: number[]) => counts.map((count, i) => ({ weekStart: NOW - (counts.length - i) * 7 * DAY, count }));
  return {
    generatedAt: NOW,
    users: { total: 5, active: 4 },
    businesses: {
      total: 4,
      archived: 1,
      active7d: 2,
      active30d: 3,
      byProgramme: { NP2: 2, NP1: 1 },
      byCountry: [
        { country: "NZ", count: 2, regions: [{ region: "Otago", count: 1 }, { region: "Not set", count: 1 }] },
        { country: "XX", count: 1, regions: [{ region: "Somewhere", count: 1 }] },
      ],
      ...over,
    },
    signupsByWeek: { users: weeks([0, 1, 0, 3]), businesses: weeks([2, 0, 0, 1]) },
    businessList: list ?? [
      { _id: "b1", name: "Kai Cafe", programme: "NP2", jurisdiction: "NZ", region: "Otago", archived: false, createdAt: NOW - 2 * DAY, members: 3, lastActivityAt: Date.now() },
      { _id: "b2", name: "Old Co", programme: "NP1", jurisdiction: "AU", region: null, archived: true, createdAt: NOW - 40 * DAY, members: 1, lastActivityAt: Date.now() - DAY },
      { _id: "b3", name: "Quiet Co", programme: "NP2", jurisdiction: "XX", region: "Somewhere", archived: false, createdAt: NOW - DAY, members: 0, lastActivityAt: Date.now() - 5 * DAY },
      { _id: "b4", name: "New Co", programme: "NP2", jurisdiction: "NZ", region: null, archived: false, createdAt: NOW, members: 1, lastActivityAt: null },
    ],
  };
}

async function signIn(email = "logan@savepoint.co.nz", password = "secret123") {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Email"), email);
  await user.type(screen.getByPlaceholderText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}

beforeEach(() => {
  convex.query.mockReset();
  convex.action.mockReset();
  convex.mutation.mockReset();
  vi.restoreAllMocks();
});

describe("signing in", () => {
  test("a platform admin sees the dashboard, and the token is kept for this tab", async () => {
    convex.action.mockResolvedValue({ token: "tok" });
    convex.query.mockResolvedValue(overview());
    render(<AdminPage />);
    await signIn();
    expect(await screen.findByRole("heading", { name: "Owner dashboard" })).toBeInTheDocument();
    expect(convex.action).toHaveBeenCalledWith("auth:login", { email: "logan@savepoint.co.nz", password: "secret123" });
    expect(convex.query).toHaveBeenCalledWith("platform:overview", { sessionToken: "tok" });
    expect(sessionStorage.getItem("jampacked-admin-token")).toBe("tok");
    expect(screen.queryByPlaceholderText("Email")).not.toBeInTheDocument();
  });

  test("shows 'Signing in…' while waiting", async () => {
    let finish!: (v: { token: string }) => void;
    convex.action.mockReturnValue(new Promise((r) => (finish = r)));
    convex.query.mockResolvedValue(overview());
    render(<AdminPage />);
    await signIn();
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    await act(async () => finish({ token: "tok" }));
    expect(await screen.findByText("Businesses by programme")).toBeInTheDocument();
  });

  test("a wrong password shows the server's message and keeps the email", async () => {
    convex.action.mockRejectedValue(new ConvexError("Incorrect email or password"));
    render(<AdminPage />);
    await signIn("tim@example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(screen.getByPlaceholderText("Email")).toHaveValue("tim@example.com");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  test("a customer gets in but is refused the numbers", async () => {
    convex.action.mockResolvedValue({ token: "tok" });
    convex.query.mockRejectedValue(new ConvexError("Only JamPacked staff can see this"));
    render(<AdminPage />);
    await signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Only JamPacked staff can see this");
  });

  test("network failures and odd errors still say something", async () => {
    convex.action.mockRejectedValueOnce(new Error("Failed to fetch")).mockRejectedValueOnce("??");
    render(<AdminPage />);
    const user = await signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});

describe("an earlier sign-in in this tab", () => {
  test("is picked up on load", async () => {
    sessionStorage.setItem("jampacked-admin-token", "old");
    convex.query.mockResolvedValue(overview());
    render(<AdminPage />);
    expect(await screen.findByText("Businesses by programme")).toBeInTheDocument();
    expect(convex.query).toHaveBeenCalledWith("platform:overview", { sessionToken: "old" });
  });

  test("is forgotten when it has expired", async () => {
    sessionStorage.setItem("jampacked-admin-token", "old");
    convex.query.mockRejectedValue(new ConvexError("Not signed in or session expired"));
    render(<AdminPage />);
    await waitFor(() => expect(sessionStorage.getItem("jampacked-admin-token")).toBeNull());
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("the page still works when the browser blocks storage", async () => {
    const blocked = () => { throw new DOMException("blocked", "SecurityError"); };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);
    convex.action.mockResolvedValue({ token: "tok" });
    convex.query.mockResolvedValue(overview());
    convex.mutation.mockResolvedValue(null);
    render(<AdminPage />);
    const user = await signIn();
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
  });
});

describe("the dashboard", () => {
  async function shown(data = overview()) {
    sessionStorage.setItem("jampacked-admin-token", "tok");
    convex.query.mockResolvedValue(data);
    render(<AdminPage />);
    await screen.findByText("Businesses by programme");
    return userEvent.setup();
  }

  // The KPI tiles are the only places a label is a <p> on its own.
  const tile = (label: string) => screen.getByText(label, { selector: "p" }).parentElement!;

  test("headline numbers", async () => {
    await shown();
    expect(tile("Businesses")).toHaveTextContent("3+ 1 archived");
    expect(tile("Active, last 7 days")).toHaveTextContent("23 in the last 30 days");
    expect(tile("Users")).toHaveTextContent("54 active");
    expect(tile("Paying")).toHaveTextContent("–Shows once Stripe billing is live");
  });

  test("no archived note when nothing is archived", async () => {
    await shown(overview({ archived: 0 }));
    expect(tile("Businesses")).toHaveTextContent(/^Businesses4$/);
  });

  test("sign-ups per week as bars with tooltips and a table", async () => {
    await shown();
    const chart = screen.getByRole("heading", { name: "New users per week" }).closest("section")!;
    expect(chart).toHaveTextContent("4 in 4 weeks");
    // Bars scale to the busiest week (80% of the height); empty weeks have no bar.
    const bars = chart.querySelectorAll<HTMLElement>(".group > div:first-child");
    expect([...bars].map((b) => b.style.height)).toEqual(["0px", `${(1 / 3) * 80}%`, "0px", "80%"]);
    // Tooltips sit inside the chart: left-aligned on the first half, right-aligned on the second.
    const tips = chart.querySelectorAll(".group > div:last-child");
    expect(tips[0]).toHaveClass("left-0");
    expect(tips[3]).toHaveClass("right-0");
    expect(tips[3]).toHaveTextContent("Week of 20 Oct 2026: 3");
    const rows = within(chart).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual([
      "Week of 29 Sept 2026" + "0", "Week of 6 Oct 2026" + "1", "Week of 13 Oct 2026" + "0", "Week of 20 Oct 2026" + "3",
    ]);
  });

  test("businesses by programme and by country, then region", async () => {
    await shown();
    const programmes = screen.getByRole("heading", { name: "Businesses by programme" }).closest("section")!;
    expect(within(programmes).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["NP22", "NP11"]);

    const where = screen.getByRole("heading", { name: "Businesses by country and region" }).closest("section")!;
    expect(within(where).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["New Zealand2", "XX1"]);
    expect(within(where).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Otago1", "Not set1", "Somewhere1"]);
    expect(within(where).getByText("Not set")).toHaveClass("text-muted");
    expect(within(where).getByText("Otago")).not.toHaveClass("text-muted");
  });

  test("empty breakdowns say so", async () => {
    await shown(overview({ byProgramme: {}, byCountry: [] }, []));
    expect(screen.getAllByText("No businesses yet.")).toHaveLength(2);
  });

  test("the business list: where, members, sign-up date and last activity", async () => {
    await shown();
    const rows = screen.getAllByRole("row").filter((r) => r.closest("section")?.textContent?.startsWith("Businesses"));
    expect(rows.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent))).toEqual([
      [],
      ["Kai Cafe", "NP2", "Otago, New Zealand", "3", "25 Oct 2026", "Today"],
      ["Old Co(archived)", "NP1", "–, Australia", "1", "17 Sept 2026", "Yesterday"],
      ["Quiet Co", "NP2", "Somewhere, XX", "0", "26 Oct 2026", "5 days ago"],
      ["New Co", "NP2", "–, New Zealand", "1", "27 Oct 2026", "Never"],
    ]);
  });

  test("Refresh fetches again; a failed refresh goes back to signing in", async () => {
    const user = await shown();
    convex.query.mockResolvedValueOnce(overview({ active7d: 9 }));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(tile("Active, last 7 days")).toHaveTextContent("9"));

    convex.query.mockRejectedValueOnce(new ConvexError("Not signed in or session expired"));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not signed in or session expired");
  });

  test("Sign out ends the session, even if the server can't be reached", async () => {
    const user = await shown();
    convex.mutation.mockRejectedValue(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(convex.mutation).toHaveBeenCalledWith("auth:logout", { sessionToken: "tok" });
    expect(await screen.findByPlaceholderText("Email")).toBeInTheDocument();
    expect(sessionStorage.getItem("jampacked-admin-token")).toBeNull();
  });
});
