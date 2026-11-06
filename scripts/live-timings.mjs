#!/usr/bin/env node
// What people wait for on the live site: each page loaded in Chrome with an empty cache (a first visit),
// timed to its first paint and full load, the web app to its first frame (the sign-in screen drawn), and
// the round trip to the live backend. Read-only: it only opens public pages and calls a public query.
//
//   node scripts/live-timings.mjs [runs] [--phone]     (default 5 runs)
//
// --phone slows the network to a weak 4G signal (1.6 Mbps, 150 ms) and the CPU 4×, like a mid-range phone.
// Uses this machine's Chrome (CHROME=/path/to/chrome for another) and nothing else. Results:
// docs/performance.md.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const RUNS = Number(args.find((a) => /^\d+$/.test(a)) ?? 5);
const PHONE = args.includes("--phone");
const PAGES = [
  ["Website: home", "https://jampacked.co.nz/"],
  ["Website: pricing", "https://jampacked.co.nz/store/"],
  ["Website: help", "https://jampacked.co.nz/help/"],
  ["Web app: sign-in screen", "https://app.jampacked.co.nz/", true],
];

const profile = mkdtempSync(join(tmpdir(), "jampacked-chrome-"));
const chrome = spawn(process.env.CHROME ?? "google-chrome",
  ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"],
  { stdio: ["ignore", "ignore", "pipe"] });
process.on("exit", () => { chrome.kill(); rmSync(profile, { recursive: true, force: true }); }); // even after an error
const wsUrl = await new Promise((resolve, reject) => {
  let out = "";
  chrome.stderr.on("data", (d) => {
    out += d;
    const m = out.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on("exit", () => reject(new Error(`Chrome didn't start:\n${out}`)));
});

// A minimal Chrome DevTools Protocol client over Node's built-in WebSocket.
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 0;
const pending = new Map();
const listeners = new Set();
ws.addEventListener("message", ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id !== undefined) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  } else for (const l of listeners) l(msg);
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
const waitFor = (sessionId, method, timeoutMs = 120_000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeoutMs);
    const l = (msg) => {
      if (msg.sessionId === sessionId && msg.method === method) {
        clearTimeout(timer);
        listeners.delete(l);
        resolve(msg.params);
      }
    };
    listeners.add(l);
  });
const evaluate = async (sessionId, expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId)).result.value;

async function load(url, isApp) {
  // A new browser context per load: its own cache and connections, like someone visiting for the first time.
  const { browserContextId } = await send("Target.createBrowserContext");
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Network.enable", {}, sessionId);
  await send("Network.clearBrowserCache", {}, sessionId);
  await send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  await send("Network.setBypassServiceWorker", { bypass: true }, sessionId);
  if (PHONE) {
    await send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }, sessionId);
    await send("Emulation.setCPUThrottlingRate", { rate: 4 }, sessionId);
  }
  await send("Page.enable", {}, sessionId);
  // A tab in the background may skip painting, so make this one the focused, visible tab.
  await send("Page.bringToFront", {}, sessionId);
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId);
  // Flutter fires flutter-first-frame once the first screen is drawn.
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "addEventListener('flutter-first-frame', () => { window.__firstFrame = performance.now(); })" }, sessionId);
  let bytes = 0;
  const urls = new Map();
  const files = {};
  const count = (msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Network.responseReceived") urls.set(msg.params.requestId, msg.params.response.url);
    if (msg.method === "Network.loadingFinished") {
      bytes += msg.params.encodedDataLength;
      const url = (urls.get(msg.params.requestId) ?? "?").replace(/[?#].*/, "");
      files[url] = (files[url] ?? 0) + msg.params.encodedDataLength;
    }
  };
  listeners.add(count);
  const loaded = waitFor(sessionId, "Page.loadEventFired");
  await send("Page.navigate", { url }, sessionId);
  await loaded;
  const t = await evaluate(sessionId, `new Promise((resolve) => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = performance.getEntriesByName("first-contentful-paint")[0];
    const done = () => resolve({ first: ${isApp ? "window.__firstFrame" : "paint && paint.startTime"}, load: nav.loadEventEnd });
    if (!${isApp}) return done();
    const started = Date.now();
    (function poll() { window.__firstFrame || Date.now() - started > 90000 ? done() : setTimeout(poll, 50); })();
  })`);
  if (isApp) await new Promise((r) => setTimeout(r, 500)); // let the app's first API calls finish counting
  listeners.delete(count);
  await send("Target.disposeBrowserContext", { browserContextId });
  return { ...t, mb: bytes / 1024 / 1024, files };
}

const stats = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return { fastest: s[0], median: s[Math.floor(s.length / 2)], average: s.reduce((a, b) => a + b, 0) / s.length, slowest: s.at(-1) };
};
const sec = (ms) => (ms / 1000).toFixed(2);

console.log(`Live page loads, ${PHONE ? "phone (weak 4G, 4× slower CPU)" : "this machine's connection"}, ${RUNS} first visits each, ${new Date().toISOString().slice(0, 10)}\n`);
console.log("| Page | First paint or frame: fastest | median | average | slowest (s) | Fully loaded, median (s) | Downloaded (MB) |");
console.log("|---|--:|--:|--:|--:|--:|--:|");
await load(PAGES[0][1], false); // warm-up, not counted: the first load also pays for Chrome starting
let appFiles = {};
for (const [name, url, isApp] of PAGES) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await load(url, isApp));
  if (isApp) appFiles = runs.at(-1).files;
  const first = stats(runs.map((r) => r.first));
  const full = stats(runs.map((r) => r.load));
  console.log(`| ${name} | ${sec(first.fastest)} | ${sec(first.median)} | ${sec(first.average)} | ${sec(first.slowest)} | ${sec(full.median)} | ${stats(runs.map((r) => r.mb)).average.toFixed(2)} |`);
}

// What the web app downloads before its first screen, biggest first.
console.log("\nWeb app downloads, biggest first (MB over the wire):");
for (const [file, n] of Object.entries(appFiles).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`- ${(n / 1024 / 1024).toFixed(2)}  ${file}`);
}

// The round trip the app makes for every call: a public query to the live backend. The first call also
// opens the connection (DNS, TLS); the app's later calls reuse it.
const regions = async (tries = 3) => {
  const t = performance.now();
  try {
    await (await fetch("https://app.jampacked.co.nz/api/query", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "businesses:regions", args: {}, format: "json" }),
    })).json();
  } catch (e) {
    if (tries > 1) return regions(tries - 1); // a failed DNS lookup here and there is this machine, not the server
    throw e;
  }
  return performance.now() - t;
};
const opening = await regions();
const rtt = [];
for (let i = 0; i < 20; i++) rtt.push(await regions());
const r = stats(rtt);
console.log(`\nLive backend round trip (businesses:regions): first call, opening the connection, ${Math.round(opening)} ms; then 20 calls: fastest ${Math.round(r.fastest)} · median ${Math.round(r.median)} · average ${Math.round(r.average)} · slowest ${Math.round(r.slowest)} ms`);

ws.close();
chrome.kill();
rmSync(profile, { recursive: true, force: true });
