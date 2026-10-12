// L3b. INTERSECT's ASCII solid is as large against the ring as the other worlds' figures,
// whatever pose it has turned to, and no pose is cut off at the edge of its canvas.
import { readFileSync } from "node:fs";
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";
import { canvasInk } from "../helpers/canvas.mjs";

// The other worlds' figures span 0.92 to 1.28 of the ring as they turn (mean about 1.08);
// the solid's span, averaged over its turn, sits at about the ring's diameter.
const SPAN_MIN = 0.95, SPAN_MAX = 1.05;
// The fragment keeps the size it had (mean glyph span 0.975 of its box at zoom 1.25).
const FRAG_MIN = 0.95, FRAG_MAX = 1.0;
// A glyph touching the canvas's edge is a glyph cut off; one device pixel of clearance.
const EDGE = 1;
// Poses stepped with the arrow keys (each turns ax or ay by 0.25 rad): 6 tilts x 13 turns.
const TILTS = 6, TURNS = 13;

// ascii.js is a classic browser script that also fills module.exports (see gen-stills).
const module = { exports: {} };
new Function("module", readFileSync(new URL("../../site/_nts/worlds/ascii.js", import.meta.url), "utf8"))(module);
const ascii = module.exports;

test.describe("L3b ASCII solid fits the ring", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });

  test("/intersect/: across its turn the solid spans the ring and never leaves its canvas", async ({ page, freeze, settle }) => {
    const pre = "pre[data-nts-ascii]";
    await openPage(page, "/intersect/", { live: [pre] });
    await freeze(page);
    await settle(page);
    const ring = await page.evaluate(() => document.querySelector(".hero .trace-ring").getBoundingClientRect().width);
    const spans = [];
    for (let i = 0; i < TILTS; i++) {
      for (let j = 0; j < TURNS; j++) {
        const k = await canvasInk(page, `${pre} > canvas`);
        spans.push(Math.max(k.bw, k.bh) / ring);
        const c = k.rect;
        const gap = Math.min(k.bx - k.bw / 2 - c.left, c.right - (k.bx + k.bw / 2), k.by - k.bh / 2 - c.top, c.bottom - (k.by + k.bh / 2));
        expect(gap, `pose ${i},${j}: ink's clearance from the canvas edge (px)`).toBeGreaterThanOrEqual(EDGE);
        await page.evaluate((sel) => { const el = document.querySelector(sel); for (const key of ["ArrowRight", "ArrowRight"]) el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); }, pre);
      }
      await page.evaluate((sel) => { const el = document.querySelector(sel); for (let n = 0; n < 4; n++) el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); }, pre);
    }
    const mean = spans.reduce((s, x) => s + x, 0) / spans.length;
    expect(mean, "mean span over the ring's diameter").toBeGreaterThanOrEqual(SPAN_MIN);
    expect(mean, "mean span over the ring's diameter").toBeLessThanOrEqual(SPAN_MAX);
  });

  test("the fit holds over every pose a turn or a drag reaches (node)", () => {
    const fig = ascii.figure("tetra");
    expect(typeof ascii.fit, "ascii.fit").toBe("function");
    // the fragment: its 48-column box, no overhang; mean glyph span over the pose torus
    const cols = 48, rows = Math.round(cols * 0.6), zoom = ascii.fit(fig, ascii.SPAN.fragment), spans = [];
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const ls = ascii.lines(fig, cols, rows, 0.6, { ax: (i / 16) * 2 * Math.PI, ay: (j / 16) * 2 * Math.PI }, zoom);
      let x0 = cols, x1 = 0, y0 = rows, y1 = 0;
      ls.forEach((l, r) => { const a = l.search(/\S/); if (a < 0) return; x0 = Math.min(x0, a); x1 = Math.max(x1, l.length); y0 = Math.min(y0, r); y1 = Math.max(y1, r + 1); });
      spans.push(Math.max((x1 - x0) / cols, (y1 - y0) / rows));
    }
    const mean = spans.reduce((s, x) => s + x, 0) / spans.length;
    expect(mean, "fragment's mean span over its box").toBeGreaterThanOrEqual(FRAG_MIN);
    expect(mean, "fragment's mean span over its box").toBeLessThanOrEqual(FRAG_MAX);
    // the hero: no pose reaches past the room it is given
    const room = 1.28, C = Math.floor(84 * room), hz = ascii.fit(fig, ascii.SPAN.hero, (C - 4) / 84);
    expect(hz * 0.95, "the room does not cut the hero's size (zoom, unclamped vs clamped)").toBeCloseTo(ascii.fit(fig, ascii.SPAN.hero) * 0.95, 3);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const ls = ascii.lines(fig, C, C, 1, { ax: (i / 16) * 2 * Math.PI + 0.1, ay: (j / 16) * 2 * Math.PI + 0.2 }, hz, 84);
      expect(ls[0].trim() + ls[C - 1].trim(), `pose ${i},${j}: top and bottom rows of the grid`).toBe("");
      expect(Math.max(...ls.map((l) => l.length)), `pose ${i},${j}: rightmost glyph`).toBeLessThan(C);
      expect(Math.min(...ls.filter((l) => l.trim()).map((l) => l.search(/\S/))), `pose ${i},${j}: leftmost glyph`).toBeGreaterThan(0);
    }
  });
});
