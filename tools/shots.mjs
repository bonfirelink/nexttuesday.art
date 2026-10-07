// Screenshots of one site, or of two (before and after), at phone and desktop sizes.
//   node tools/shots.mjs --out DIR --before URL --after URL [options]
//   node tools/shots.mjs --out DIR --url URL [options]
// Options:
//   --paths /,/embers/     pages to load (default /)
//   --views phone,desktop  phone = 390x844@3 mobile+touch, desktop = 1440x900@2 (default both)
//   --scroll 0,800,50%     scroll positions: px, or % of the scrollable height (default 0)
//   --moments N            instead of scroll positions: N frames 1.5 s apart from load (moving content)
//   --reduce               prefers-reduced-motion: reduce
//   --settle MS            wait after fonts are ready, before the first frame (default 1500)
//   --clip x,y,w,h         crop each shot to this rectangle (CSS px, viewport coordinates)
// Writes DIR/<label>/<view>/<path>-<position>.png and DIR/manifest.json (read by sheet.mjs).
// The URL pairs with $NTS_BRANCH: a preview is http://<name>.nexttuesday-art.localhost:18000/.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { installFontRoutes } from "../tests/helpers/fixtures.mjs";

const VIEWS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
};
const MOMENT_GAP = 1500;

const { values: o } = parseArgs({
  options: {
    out: { type: "string" }, url: { type: "string" }, before: { type: "string" }, after: { type: "string" },
    paths: { type: "string", default: "/" }, views: { type: "string", default: "phone,desktop" },
    scroll: { type: "string", default: "0" }, moments: { type: "string" }, reduce: { type: "boolean", default: false },
    settle: { type: "string", default: "1500" }, clip: { type: "string" },
  },
});

if (!process.env.CHROMIUM) {
  console.error("$CHROMIUM unset; run inside the dev shell");
  process.exit(2);
}
const usage = (msg) => {
  console.error(`shots.mjs: ${msg}`);
  process.exit(2);
};
if (o.url && (o.before || o.after)) usage("--url excludes --before/--after");
if (o.moments && o.scroll !== "0") usage("--moments excludes --scroll");
if (o.moments && !/^[1-9]\d*$/.test(o.moments)) usage("--moments must be a positive integer");
if (o.clip && !/^\d+(\.\d+)?(,\d+(\.\d+)?){3}$/.test(o.clip)) usage("--clip must be x,y,w,h (four numbers)");

const sites = o.url ? { shot: o.url } : { before: o.before, after: o.after };
if (!o.out || Object.values(sites).some((u) => !u)) {
  console.error("usage: shots.mjs --out DIR (--url URL | --before URL --after URL) [--paths --views --scroll --moments --reduce --settle --clip]");
  process.exit(2);
}
const views = o.views.split(",");
for (const v of views) if (!VIEWS[v]) throw new Error(`unknown view ${v}`);
const paths = o.paths.split(",");
const positions = o.moments
  ? Array.from({ length: +o.moments }, (_, i) => ({ id: `m${i + 1}` }))
  : o.scroll.split(",").map((s) => ({ id: `y${s.replace("%", "pct")}`, text: s.endsWith("%") ? `scroll ${s}` : `scroll ${s}px`, at: s }));
const clip = o.clip && Object.fromEntries(o.clip.split(",").map((n, i) => [["x", "y", "width", "height"][i], +n]));
const slug = (p) => p.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM,
  args: ["--no-sandbox"],
});
const manifest = { reduce: o.reduce, shots: [] };
try {

  for (const [label, url] of Object.entries(sites)) {
    for (const view of views) {
      for (const p of paths) {
        // A fresh context per load: no cache, storage or scroll carries over.
        const context = await browser.newContext({ ...VIEWS[view], reducedMotion: o.reduce ? "reduce" : "no-preference" });
        // The suite's font cache answers Google Fonts; the helper lets only $NTS_BASE's host through.
        process.env.NTS_BASE = url;
        const external = [];
        await installFontRoutes(context, { external });
        const page = await context.newPage();
        const problems = [];
        page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
        page.on("pageerror", (e) => problems.push(String(e)));
        page.on("response", (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));
        try {
          await page.goto(new URL(p, url).href, { waitUntil: "load" });
        } catch (e) {
          throw new Error(`${e.message}\nis the preview up (\`devshell status\`)?`);
        }
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(+o.settle);
        const dir = path.join(o.out, label, view);
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          if (pos.at !== undefined) {
            await page.evaluate((at) => {
              const max = document.documentElement.scrollHeight - innerHeight;
              scrollTo({ top: at.endsWith("%") ? max * parseFloat(at) / 100 : parseFloat(at), behavior: "instant" });
            }, pos.at);
            await page.waitForTimeout(400);
          } else if (i) {
            await page.waitForTimeout(MOMENT_GAP);
          }
          const file = path.join(dir, `${slug(p)}-${pos.id}.png`);
          await page.screenshot({ path: file, ...(clip && { clip }) });
          // Time since navigation start, so a moment's label is the real elapsed time.
          const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, scrollY: Math.round(scrollY), t: performance.now() }));
          const posText = pos.text ?? `${(m.t / 1000).toFixed(1)} s`;
          manifest.shots.push({ label, view, path: p, pos: pos.id, posText, file: path.relative(o.out, file), overflow: m.overflow, scrollY: m.scrollY });
        }
        const issues = [...problems, ...external.map((u) => `external ${u}`)];
        console.log(`${label} ${view} ${p}: ${issues.length ? "ISSUES " + JSON.stringify(issues) : "no errors"}`);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(o.out, "manifest.json"), JSON.stringify(manifest, null, 2));
