"use client";

// The owner dashboard: how JamPacked is doing. Signs in with the app's own accounts (until Clerk) and
// only works for users with `platformAdmin` set; the check happens in Convex (platform:overview).
import { useEffect, useState } from "react";
import { convex, fns, type Overview } from "@/lib/convex";

const TOKEN_KEY = "jampacked-admin-token";

// sessionStorage can throw (private windows, blocked storage); the page works without it.
const stored = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (v: string) => { try { sessionStorage.setItem(TOKEN_KEY, v); } catch {} },
  clear: () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch {} },
};

const message = (e: unknown) => {
  const data = (e as { data?: unknown }).data;
  return typeof data === "string" ? data : e instanceof Error ? e.message : "Something went wrong";
};

const date = (t: number) => new Date(t).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });

function ago(t: number | null) {
  if (t === null) return "Never";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(t: string) {
    try {
      setData(await convex.query(fns.overview, { sessionToken: t }));
      setToken(t);
      setError(null);
    } catch (e) {
      setError(message(e));
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  // Pick up a sign-in from earlier in this tab; an expired one just shows the sign-in form.
  useEffect(() => {
    const t = stored.get();
    if (!t) return;
    convex.query(fns.overview, { sessionToken: t }).then(
      (d) => { setData(d); setToken(t); },
      () => stored.clear(),
    );
  }, []);

  // onSubmit rather than a form action, which would clear the email after a wrong password.
  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { token: t } = await convex.action(fns.login, {
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      stored.set(t);
      await load(t);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  async function signOut() {
    if (token) await convex.mutation(fns.logout, { sessionToken: token }).catch(() => {});
    stored.clear();
    setToken(null);
    setData(null);
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-2xl font-bold">Owner dashboard</h1>
        <p className="mt-2 text-sm text-muted">For JamPacked staff. Sign in with your JamPacked account.</p>
        <form onSubmit={signIn} className="mt-6 flex flex-col gap-3">
          <input name="email" type="email" required autoComplete="email" placeholder="Email"
            className="rounded-lg border border-border bg-surface px-3 py-2" />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Password"
            className="rounded-lg border border-border bg-surface px-3 py-2" />
          <button disabled={busy} className="rounded-lg bg-jam px-4 py-2 font-semibold text-on-jam hover:bg-jam-dark disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {error && <p role="alert" className="text-sm text-jam-dark">{error}</p>}
        </form>
      </div>
    );
  }

  const b = data.businesses;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Owner dashboard</h1>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>Updated {new Date(data.generatedAt).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })}</span>
          <button onClick={() => { if (token) { setBusy(true); void load(token); } }} disabled={busy} className="hover:text-ink">Refresh</button>
          <button onClick={signOut} className="hover:text-ink">Sign out</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Businesses" value={b.total - b.archived} note={b.archived ? `+ ${b.archived} archived` : undefined} />
        <Stat label="Active, last 7 days" value={b.active7d} note={`${b.active30d} in the last 30 days`} />
        <Stat label="Users" value={data.users.total} note={`${data.users.active} active`} />
        <Stat label="Paying" value="–" note="Shows once Stripe billing is live" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <WeeklyBars title="New businesses per week" weeks={data.signupsByWeek.businesses} />
        <WeeklyBars title="New users per week" weeks={data.signupsByWeek.users} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Breakdown title="Businesses by programme" counts={b.byProgramme} />
        <ByCountry countries={b.byCountry} />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-surface">
        <h2 className="px-5 pt-4 font-semibold">Businesses</h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Programme</th>
                <th className="px-3 py-2 font-medium">Where</th>
                <th className="px-3 py-2 font-medium text-right">Members</th>
                <th className="px-3 py-2 font-medium">Signed up</th>
                <th className="px-5 py-2 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {data.businessList.map((x) => (
                <tr key={x._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2">
                    {x.name}
                    {x.archived && <span className="ml-2 text-xs text-muted">(archived)</span>}
                  </td>
                  <td className="px-3 py-2">{x.programme}</td>
                  <td className="px-3 py-2">{x.region ?? "–"}, {COUNTRY[x.jurisdiction] ?? x.jurisdiction}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{x.members}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{date(x.createdAt)}</td>
                  <td className="px-5 py-2 whitespace-nowrap">{ago(x.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-4 text-xs text-muted">
        Counts only: no business&apos;s records are shown here. Usage funnels will live in PostHog once it&apos;s set up.
      </p>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

// One series per chart, so no legend: the title names it. Each bar has a hover/focus tooltip, and the
// numbers are also in a table underneath for screen readers and anyone who wants them exactly.
function WeeklyBars({ title, weeks }: { title: string; weeks: Overview["signupsByWeek"]["users"] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const total = weeks.reduce((n, w) => n + w.count, 0);
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-muted">{total} in {weeks.length} weeks</span>
      </div>
      {/* The tallest bar fills 80%, leaving room at the top for the tooltip. */}
      <div className="mt-4 flex h-40 items-end gap-[2px] border-b border-border" aria-hidden>
        {weeks.map((w, i) => (
          <div key={w.weekStart} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
            <div
              className="w-full rounded-t-[4px] bg-jam group-hover:bg-jam-dark group-focus:bg-jam-dark"
              style={{ height: w.count ? `${(w.count / max) * 80}%` : 0 }}
            />
            <div className={`pointer-events-none absolute top-0 z-10 hidden whitespace-nowrap ${i < weeks.length / 2 ? "left-0" : "right-0"} rounded-md border border-border bg-surface px-2 py-1 text-xs shadow group-hover:block group-focus:block`}>
              Week of {date(w.weekStart)}: <b>{w.count}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{date(weeks[0].weekStart)}</span>
        <span>This week</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">Show as a table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {weeks.map((w) => (
              <tr key={w.weekStart}>
                <td className="py-0.5">Week of {date(w.weekStart)}</td>
                <td className="py-0.5 text-right tabular-nums">{w.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

const COUNTRY: Record<string, string> = { NZ: "New Zealand", AU: "Australia" };

// Each country with its total, then its regions as bars on one shared scale, so regions in different
// countries compare directly.
function ByCountry({ countries }: { countries: Overview["businesses"]["byCountry"] }) {
  const max = Math.max(1, ...countries.flatMap((c) => c.regions.map((r) => r.count)));
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Businesses by country and region</h2>
      {countries.length === 0 && <p className="mt-3 text-sm text-muted">No businesses yet.</p>}
      {countries.map((c) => (
        <div key={c.country} className="mt-3">
          <h3 className="flex justify-between text-sm font-semibold">
            <span>{COUNTRY[c.country] ?? c.country}</span>
            <span className="tabular-nums">{c.count}</span>
          </h3>
          <ul className="mt-1 flex flex-col gap-1.5">
            {c.regions.map((r) => (
              <li key={r.region} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3 text-sm">
                <span className={`truncate ${r.region === "Not set" ? "text-muted" : ""}`} title={r.region}>{r.region}</span>
                <span className="h-3 rounded-r-[4px] bg-jam" style={{ width: `${(r.count / max) * 100}%` }} />
                <span className="text-right tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Breakdown({ title, counts }: { title: string; counts: Record<string, number> }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 && <p className="mt-3 text-sm text-muted">No businesses yet.</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map(([key, n]) => (
          <li key={key} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-3 text-sm">
            <span>{key}</span>
            <span className="h-3 rounded-r-[4px] bg-jam" style={{ width: `${(n / max) * 100}%` }} />
            <span className="text-right tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
