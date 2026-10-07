// Frame pacing and main-thread cost of a scripted top-to-bottom scroll, per
// URL, path and viewport, under CPU throttle. Built for before/after
// comparisons: pass one labelled base URL per variant.
//
//   node tools/bench.mjs before=<url> after=<url> [paths=/,/embers/] [views=phone,desktop]
//        [throttle=4] [runs=3] [speed=1.2] [--json] [--trace[=<absolute dir>]]
//
// Run it inside the dev shell (it exports $CHROMIUM). Each number is the median over `runs`.
// --trace writes one trace per run, by default into a fresh directory under the OS temp dir;
// a dir given must be absolute, so traces never land in the repo by accident.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { trace, median } from "../tests/helpers/trace.mjs";
import { installFontRoutes } from "../tests/helpers/fixtures.mjs";

const VIEWS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
};
const LONG_FRAME_MS = 50;
const SETTLE_MS = 1500; // after load, before throttling and the scroll
const MAX_SCROLL_MS = 60_000; // a page this long is scrolled partway

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--") && !a.includes("=")));
const opt = Object.fromEntries(args.filter((a) => a.includes("=") && !a.startsWith("--")).map((a) => [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]));
if (!process.env.CHROMIUM) { console.error("$CHROMIUM unset; run inside the dev shell"); process.exit(2); }
const traceArg = args.find((a) => a.startsWith("--trace="))?.slice(8);
if (traceArg !== undefined && !path.isAbsolute(traceArg)) { console.error("--trace needs an absolute directory (outside the repo)"); process.exit(2); }
const traceDir = traceArg || (flags.has("--trace") ? fs.mkdtempSync(path.join(os.tmpdir(), "nts-bench-")) : "");
const variants = Object.entries(opt).filter(([k]) => !["paths", "views", "throttle", "runs", "speed"].includes(k));
if (!variants.length) {
  console.error("usage: node tools/bench.mjs label=<base url> [label=<base url> ...] [paths=/,/embers/] [views=phone,desktop] [throttle=4] [runs=3] [speed=1.2] [--json] [--trace[=<absolute dir>]]");
  process.exit(2);
}
const paths = (opt.paths || "/,/embers/,/not-not-philo/,/intersect/").split(",");
const views = (opt.views || "phone,desktop").split(",");
const throttle = Number(opt.throttle ?? 4);
const runs = Number(opt.runs ?? 3);
const speed = Number(opt.speed ?? 1.2); // viewport heights per second
for (const v of views) if (!VIEWS[v]) throw new Error(`unknown view ${v}; use ${Object.keys(VIEWS)}`);

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };

// Union of the main thread's top-level task intervals, in ms.
function busyMs(main) {
  const tasks = main
    .filter((e) => e.ph === "X" && e.dur && (e.name === "ThreadControllerImpl::RunTask" || e.name === "RunTask"))
    .map((e) => [e.ts, e.ts + e.dur])
    .sort((a, b) => a[0] - b[0]);
  let total = 0, cur = null;
  for (const [a, b] of tasks) {
    if (cur && a <= cur[1]) cur[1] = Math.max(cur[1], b);
    else { if (cur) total += cur[1] - cur[0]; cur = [a, b]; }
  }
  if (cur) total += cur[1] - cur[0];
  return total / 1000;
}

// Scrolls to the page bottom at `speed` viewports/s, one scrollTo per frame, and returns the rAF intervals.
const scrollDown = (page) => page.evaluate(({ speed, maxMs }) => new Promise((done) => {
  const target = document.documentElement.scrollHeight - innerHeight;
  const duration = Math.min(maxMs, (target / (innerHeight * speed)) * 1000);
  const t0 = performance.now();
  const dts = [];
  let last = t0;
  const step = (now) => {
    dts.push(now - last);
    last = now;
    const u = Math.min(1, (now - t0) / duration);
    scrollTo({ top: target * u, behavior: "instant" });
    if (u < 1) requestAnimationFrame(step);
    else done({ dts: dts.slice(1), wall: now - t0, scrollWidth: document.documentElement.scrollWidth - innerWidth });
  };
  requestAnimationFrame(step);
}), { speed, maxMs: MAX_SCROLL_MS });

async function once(browser, label, base, urlPath, viewName, outFile) {
  const context = await browser.newContext(VIEWS[viewName]);
  try {
    // Cached fonts as in the suite; any other host than the preview fails.
    process.env.NTS_BASE = base;
    await installFontRoutes(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
    const res = await page.goto(new URL(urlPath, base).href, { waitUntil: "load" });
    if (!res?.ok()) throw new Error(`${label} ${urlPath}: HTTP ${res?.status()}; is the preview up (devshell status)?`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    let scroll;
    const t = await trace(page, async (p) => { scroll = await scrollDown(p); });
    if (outFile) fs.writeFileSync(outFile, JSON.stringify({ traceEvents: t.events }));
    const { dts, wall } = scroll;
    return {
      fps: dts.length / (wall / 1000),
      p50: pct(dts, 0.5), p95: pct(dts, 0.95),
      long: dts.filter((d) => d > LONG_FRAME_MS).length,
      frames: dts.length,
      busyMs: busyMs(t.main),
      busyPct: (busyMs(t.main) / wall) * 100,
      paintsPerFrame: t.paints / dts.length,
      layoutsPerFrame: t.layouts / dts.length,
      hscroll: scroll.scrollWidth,
      errors: errors.length,
    };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--no-sandbox"] });
const results = [];
try {
  if (traceDir) fs.mkdirSync(traceDir, { recursive: true });
  for (const urlPath of paths) for (const view of views) for (const [label, base] of variants) {
    const rs = [];
    for (let i = 0; i < runs; i++) {
      const file = traceDir ? path.join(traceDir, `${label}${urlPath.replace(/\//g, "_")}${view}-${i}.json`) : "";
      rs.push(await once(browser, label, base, urlPath, view, file));
    }
    const m = (k) => median(rs.map((r) => r[k]));
    results.push({ label, path: urlPath, view, runs, throttle, ...Object.fromEntries(["fps", "p50", "p95", "long", "frames", "busyMs", "busyPct", "paintsPerFrame", "layoutsPerFrame", "hscroll", "errors"].map((k) => [k, m(k)])) });
  }
} finally {
  await browser.close();
}

if (flags.has("--json")) {
  console.log(JSON.stringify(results, null, 1));
} else {
  console.log(`throttle ${throttle}x, ${runs} run(s), median; scroll ${speed} viewports/s; long frame > ${LONG_FRAME_MS} ms`);
  const cols = ["label", "path", "view", "fps", "p50", "p95", "long", "frames", "busyMs", "busy%", "paints/f", "layouts/f", "hscroll", "errors"];
  const rows = results.map((r) => [r.label, r.path, r.view, r.fps.toFixed(1), r.p50.toFixed(1), r.p95.toFixed(1), r.long, r.frames, r.busyMs.toFixed(0), r.busyPct.toFixed(0), r.paintsPerFrame.toFixed(2), r.layoutsPerFrame.toFixed(2), r.hscroll, r.errors].map(String));
  const w = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => (i < 3 ? c.padEnd(w[i]) : c.padStart(w[i]))).join("  ");
  console.log(line(cols));
  for (const r of rows) console.log(line(r));
  if (traceDir) console.log(`traces in ${traceDir} (open in Perfetto or chrome://tracing)`);
}
