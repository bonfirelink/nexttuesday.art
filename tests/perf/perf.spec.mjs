// Performance guards: counts from a Chromium trace (paints by node, layouts),
// never durations. Each test repeats its run and asserts on the median.
import fs from "node:fs";
import { test, expect } from "../helpers/fixtures.mjs";
import { trace, median } from "../helpers/trace.mjs";

const baselines = JSON.parse(fs.readFileSync(new URL("../fixtures/perf-baselines.json", import.meta.url), "utf8"));

const RUNS = 3; // each guard runs this many times and asserts on the median
const DRAW_IN_MS = 3000; // the emblem's draw-in on the home
const AFTER_DRAW_IN_MS = 1500; // settling after the draw-in before the idle window
const IDLE_WINDOW_MS = 3000; // P1: the traced idle window on the home
const INTERSECT_IDLE_MS = 5000; // P3: the traced idle window on /intersect/
const TEST_TIMEOUT_MS = 180_000; // RUNS traced runs, each with its own load and settle
const SETTLE_MS = 1500; // after load, before a scroll or a trace starts
const FRAMES_PER_VIEWPORT = 54; // P2: scroll speed (0.9 s at 60 fps), counted in frames so a loaded machine renders the same number of them
const WINDOWS = 3; // P2: world windows scrolled open
const IDLE_PAINTS_PER_FRAME = 0.05; // P1: overall paint budget while idle (about one stray paint per 20 frames)
const INTERSECT_IDLE_LAYOUTS = 2; // P3: a one-off layout at settle is fine, one per frame is the regression

const VIEWS = {
  1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

for (const [name, view] of Object.entries(VIEWS)) {
  test.describe(`${name}`, () => {
    test.use(view);
    test.setTimeout(TEST_TIMEOUT_MS);

    // One run in a fresh page of the test's context (own sessionStorage, own state).
    async function run(context, { path, block = false, wait, selectors, action }) {
      const page = await context.newPage();
      try {
        if (block) await page.route(/\/_nts\/worlds\/.*\.js/, (r) => r.abort());
        await page.goto(process.env.NTS_BASE + path, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(wait);
        return await trace(page, action, { selectors });
      } finally {
        await page.close();
      }
    }

    test(`P1 the emblem causes no paints when idle @perf (${name})`, async ({ context }, testInfo) => {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        runs.push(await run(context, {
          path: "/",
          wait: DRAW_IN_MS + AFTER_DRAW_IN_MS,
          selectors: [".orrery"],
          action: (p) => p.waitForTimeout(IDLE_WINDOW_MS),
        }));
      }
      const orrery = median(runs.map((r) => r.byNode.get(".orrery")));
      const perFrame = median(runs.map((r) => r.paints / Math.max(1, r.frames)));
      await testInfo.attach("p1.json", { body: JSON.stringify(runs.map((r) => ({ paints: r.paints, frames: r.frames, byNode: [...r.byNode], others: r.others })), null, 1), contentType: "application/json" });
      expect(orrery, "paints inside .orrery").toBe(0);
      expect(perFrame, "paints per frame overall").toBeLessThanOrEqual(IDLE_PAINTS_PER_FRAME);
    });

    test(`P2 the apertures do not repaint while opening @perf (${name})`, async ({ context }, testInfo) => {
      const allowance = baselines.p2.eclPartPaints[name];
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        runs.push(await run(context, {
          path: "/",
          block: true, // the figures' canvases would paint inside the windows
          wait: SETTLE_MS,
          selectors: [".ecl"], // the windows, discs, rings and the content inside them
          action: async (p) => {
            const open = await p.evaluate(({ n, frames }) => new Promise((ok) => {
              const worlds = [...document.querySelectorAll(".world.ecl")].slice(0, n);
              const last = worlds[worlds.length - 1];
              const target = last.getBoundingClientRect().top + scrollY - innerHeight * 0.2;
              const perFrame = innerHeight / frames;
              let y = 0;
              const step = () => {
                y = Math.min(target, y + perFrame);
                scrollTo({ top: y, behavior: "instant" });
                if (y < target) requestAnimationFrame(step);
                else requestAnimationFrame(() => requestAnimationFrame(() => ok(worlds.filter((w) => w.classList.contains("is-open")).length)));
              };
              requestAnimationFrame(step);
            }), { n: WINDOWS, frames: FRAMES_PER_VIEWPORT });
            expect(open, "windows latched open").toBe(WINDOWS);
          },
        }));
      }
      const parts = (r) => r.repeats.get(".ecl");
      await testInfo.attach("p2.json", { body: JSON.stringify(runs.map((r) => ({ parts: parts(r), paints: r.paints, frames: r.frames, byNode: [...r.byNode], others: r.others })), null, 1), contentType: "application/json" });
      if (process.env.PERF_LOG) console.log(name, "P2", JSON.stringify(runs.map((r) => ({ parts: parts(r), paints: r.paints, frames: r.frames, hits: r.hits }))));
      expect(median(runs.map(parts)), `repaints of .ecl parts (paints after a node's first) over ${WINDOWS} windows`).toBeLessThanOrEqual(allowance);
    });

    test(`P3 INTERSECT does no layout when idle @perf (${name})`, async ({ context }, testInfo) => {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        runs.push(await run(context, {
          path: "/intersect/",
          wait: SETTLE_MS,
          action: (p) => p.waitForTimeout(INTERSECT_IDLE_MS),
        }));
      }
      await testInfo.attach("p3.json", { body: JSON.stringify(runs.map((r) => ({ layouts: r.layouts, frames: r.frames })), null, 1), contentType: "application/json" });
      expect(median(runs.map((r) => r.layouts)), "main-thread layouts while idle").toBeLessThanOrEqual(INTERSECT_IDLE_LAYOUTS);
    });
  });
}
