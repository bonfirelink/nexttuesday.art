// Performance guards: counts from a Chromium trace (paints by node, layouts),
// never durations. Each test repeats its run and asserts on the median.
import fs from "node:fs";
import { test, expect } from "../helpers/fixtures.mjs";
import { trace, median } from "../helpers/trace.mjs";
import { WORLD_ENTRIES } from "../helpers/registry.mjs";

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
const ORB_IDLE_MS = 3000; // P6: the traced idle window, with every orb in view and none hovered
const ALL_ORBS_HEIGHT = 1700; // P6: a viewport tall enough to hold the three orbs at once (about 1570 px apart at both widths)
const INTERSECT_IDLE_LAYOUTS = 2; // P3: a one-off layout at settle is fine, one per frame is the regression
const EMBERS_IDLE_MS = 3000; // P7: the traced idle window on /embers/
const EMBERS_IDLE_LAYOUTS = 2; // P7: as P3

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

    test(`P6 the home's orbs cause no paints when idle in view @perf (${name})`, async ({ context }, testInfo) => {
      const bodies = WORLD_ENTRIES.map((i) => i.body);
      const sels = bodies.map((b) => `.orb[data-body="${b}"]`);
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const page = await context.newPage();
        try {
          await page.goto(process.env.NTS_BASE + "/", { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          // One viewport tall enough for every orb to be in view at once, so they share one idle window.
          await page.setViewportSize({ width: view.viewport.width, height: ALL_ORBS_HEIGHT });
          await page.mouse.move(1, 1);
          await page.evaluate(() => { document.querySelector(".orb").scrollIntoView({ block: "start", behavior: "instant" }); });
          await page.waitForTimeout(SETTLE_MS);
          const inView = await page.evaluate((ss) => ss.map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), sels);
          expect(inView, "every orb inside the viewport").toEqual(bodies.map(() => true));
          const r = await trace(page, (p) => p.waitForTimeout(ORB_IDLE_MS), { selectors: sels });
          // the live figures' canvases are meant to paint; nothing else in the orb is
          const hitsOf = (k) => r.hitsBy.get(sels[k]).filter((h) => !/ canvas/.test(h));
          const sum = (hs) => hs.reduce((n, h) => n + parseInt(h, 10), 0);
          runs.push({
            byOrb: Object.fromEntries(bodies.map((b, k) => [b, sum(hitsOf(k))])),
            hits: bodies.flatMap((b, k) => hitsOf(k).map((h) => `${b}: ${h}`)),
          });
        } finally {
          await page.close();
        }
      }
      await testInfo.attach("p6.json", { body: JSON.stringify(runs, null, 1), contentType: "application/json" });
      if (process.env.PERF_LOG) console.log(name, "P6", JSON.stringify(runs));
      for (const b of bodies) {
        expect(median(runs.map((r) => r.byOrb[b])), `paints of the ${b} orb's parts other than the figure's canvas: ${runs.map((r) => r.hits.filter((h) => h.startsWith(b)).join(", ")).join(" / ")}`).toBe(0);
      }
    });

    test(`P7 EMBERS: when idle nothing in the hero repaints but the hearth's live canvas, and nothing lays out @perf (${name})`, async ({ context }, testInfo) => {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const r = await run(context, { path: "/embers/", wait: SETTLE_MS, selectors: [".embers-hero"], action: (p) => p.waitForTimeout(EMBERS_IDLE_MS) });
        // the live layer is meant to change every frame; anything else in the hero painted
        // more than once (its first paint may fall in the window) is the regression
        const others = r.hitsBy.get(".embers-hero").filter((h) => !/canvas\.nts-hearth-live/.test(h));
        runs.push({ repaints: others.reduce((n, h) => n + Math.max(0, parseInt(h, 10) - 1), 0), others, layouts: r.layouts, frames: r.frames });
      }
      await testInfo.attach("p7.json", { body: JSON.stringify(runs, null, 1), contentType: "application/json" });
      if (process.env.PERF_LOG) console.log(name, "P7", JSON.stringify(runs));
      expect(median(runs.map((r) => r.repaints)), `repaints in the hero outside the live layer: ${runs.map((r) => r.others.join(", ")).join(" / ")}`).toBe(0);
      expect(median(runs.map((r) => r.layouts)), "main-thread layouts while idle").toBeLessThanOrEqual(EMBERS_IDLE_LAYOUTS);
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
