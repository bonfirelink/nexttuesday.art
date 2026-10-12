// L3e. INTERSECT's glyphs sit on whole device pixels: the page's own paint (fillText, as
// called) starts every line on a whole pixel of a bitmap that maps 1:1 to the screen, so a
// glyph has the same ink wherever it falls (unsnapped, the same bold glyph varied by up to
// 18% across a line at DPR 1). The snap doesn't change the figure's size.
import { readFileSync } from "node:fs";
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";

const module = { exports: {} };
new Function("module", readFileSync(new URL("../../site/_nts/worlds/ascii.js", import.meta.url), "utf8"))(module);
const ascii = module.exports;

// A position that is a whole device pixel, to float error.
const WHOLE = 1e-3;
// The bitmap's size against the canvas's CSS size times the density: rounding only.
const BITMAP_TOL = 0.5;
// Ink of one glyph across 40 positions on a line, as 1 - min/max.
const SPREAD = 0.02;
const PRE = "pre[data-nts-ascii]";

// records each fillText on a canvas inside an INTERSECT pre, in bitmap pixels
function recordFillText() {
  window.__calls = [];
  const f = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
    if (this.canvas.closest && this.canvas.closest("pre")) {
      const t = this.getTransform();
      window.__calls.push({ x: t.a * x + t.e, y: t.d * y + t.f, a: t.a, d: t.d, rx: x, ry: y, page: !!this.canvas.closest("pre[data-nts-ascii]") });
    }
    return f.call(this, text, x, y);
  };
}
const turn = (page) => page.evaluate((sel) => {
  window.__calls = [];
  document.querySelector(sel).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}, PRE);

for (const [dsf, width, height] of [[1, 390, 844], [2, 390, 844], [2.625, 412, 915], [3, 390, 844]]) {
  test.describe(`L3e glyphs on device pixels at DPR ${dsf}`, () => {
    test.use({ reducedMotion: "reduce", viewport: { width, height }, deviceScaleFactor: dsf });
    test("the page's paint starts every line on a whole device pixel of a 1:1 bitmap", async ({ page }) => {
      await page.addInitScript(recordFillText);
      await openPage(page, "/intersect/", { live: [PRE] });
      await turn(page);
      const r = await page.evaluate((sel) => {
        const c = document.querySelector(sel + " > canvas"), cs = getComputedStyle(c);
        return { calls: window.__calls.filter((k) => k.page), bw: c.width, bh: c.height, cw: parseFloat(cs.width), ch: parseFloat(cs.height) };
      }, PRE);
      expect(r.calls.length, "lines drawn after a turn").toBeGreaterThan(0);
      for (const k of r.calls) {
        expect(Math.abs(k.x - Math.round(k.x)), `line origin x ${k.x}`).toBeLessThanOrEqual(WHOLE);
        expect(Math.abs(k.y - Math.round(k.y)), `line baseline y ${k.y}`).toBeLessThanOrEqual(WHOLE);
      }
      expect(Math.abs(r.bw - r.cw * dsf), "bitmap width vs CSS width x DPR").toBeLessThanOrEqual(BITMAP_TOL);
      expect(Math.abs(r.bh - r.ch * dsf), "bitmap height vs CSS height x DPR").toBeLessThanOrEqual(BITMAP_TOL);
    });
  });
}

// The page's canvas, cleared, gets one line of 40 # in the transform and at the origin its own
// paint used (ten cells in, on screen): the ink of each # in its bitmap is the same. (A
// screenshot of the same strip in headless Chromium spread 6.6% whatever the canvas's
// sub-pixel position, against 0.4% in the bitmap: the capture, not the paint.)
test.describe("L3e a glyph has the same ink along a line, in the page's canvas", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  test("a strip of # drawn as the page draws a line has an even ink", async ({ page }) => {
    await page.addInitScript(recordFillText);
    await openPage(page, "/intersect/", { live: [PRE] });
    await turn(page);
    const spread = await page.evaluate((sel) => {
      const pre = document.querySelector(sel), c = pre.querySelector(":scope > canvas"), x = c.getContext("2d"), k = window.__calls.find((q) => q.page), m = pre.ntsCells();
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
      x.setTransform(k.a, 0, 0, k.d, 0, 0); x.font = m.font; x.fillStyle = "#000"; x.textBaseline = "alphabetic";
      x.fillText("#".repeat(40), k.rx + (10 * m.cell) / m.sx, k.ry);
      const X0 = Math.round(k.x + 10 * m.cell * m.kx), CD = Math.round(m.cell * m.kx), Y0 = Math.round(k.y - m.size * m.ky), H = Math.round(m.size * 1.4 * m.ky);
      const d = x.getImageData(X0, Y0, CD * 40, H).data, sums = [];
      for (let q = 0; q < 40; q++) { let t = 0; for (let y = 0; y < H; y++) for (let i = q * CD; i < (q + 1) * CD; i++) t += d[(y * CD * 40 + i) * 4 + 3]; sums.push(t); }
      return 1 - Math.min(...sums) / Math.max(...sums);
    }, PRE);
    expect(spread, "ink spread of # across 40 positions in the canvas").toBeLessThan(SPREAD);
  });
});

// The snap moves glyphs onto pixels, not the figure's size: the figure's scale is the
// unsnapped one (cell x unit = cols x the unsnapped cell) and the fit isn't cut short.
test.describe("L3e the snap keeps the figure's size", () => {
  for (const [dsf, width, height] of [[1, 1280, 800], [2.625, 412, 915]]) {
    test.describe(`${width}x${height} at DPR ${dsf}`, () => {
      test.use({ reducedMotion: "reduce", viewport: { width, height }, deviceScaleFactor: dsf });
      test("the figure's scale is the unsnapped one and its zoom unclamped", async ({ page }) => {
        await openPage(page, "/intersect/", { live: [PRE] });
        const m = await page.evaluate((sel) => { const c = document.querySelector(sel).ntsCells(); return { cell: c.cell, unit: c.unit, ideal: c.ideal, cols: c.cols, zoom: c.zoom }; }, PRE);
        expect(m.unit, "ntsCells().unit").toBeDefined();
        expect(Math.abs(m.cell * m.unit - m.cols * m.ideal), "figure scale vs unsnapped (px)").toBeLessThanOrEqual(1e-6);
        const want = ascii.fit(ascii.figure("tetra"), ascii.SPAN.hero);
        expect(Math.abs(m.zoom / want - 1), "zoom vs the unclamped fit").toBeLessThanOrEqual(0.005);
      });
    });
  }
});

// A fragment's grid covers its box at every density: no column cut at its edges.
test.describe("L3e the fragment's grid covers its box", () => {
  for (const [dsf, width] of [[1, 390], [1, 320], [2, 390]]) {
    test.describe(`${width} at DPR ${dsf}`, () => {
      test.use({ reducedMotion: "reduce", viewport: { width, height: 844 }, deviceScaleFactor: dsf });
      test("the fragment's grid spans its canvas", async ({ page }) => {
        await openPage(page, "/", { live: ["[data-nts-fragment=intersect] pre"] });
        const m = await page.evaluate(() => { const pre = document.querySelector("[data-nts-fragment=intersect] pre"), c = pre.ntsCells && pre.ntsCells(); return c && { ox: c.ox, grid: c.grid, cell: c.cell, cw: parseFloat(getComputedStyle(pre.querySelector("canvas")).width) }; });
        expect(m, "the fragment's ntsCells()").not.toBeNull();
        expect(m.ox, "grid's left edge").toBeLessThanOrEqual(1e-6);
        expect(m.ox + m.grid * m.cell, "grid's right edge").toBeGreaterThanOrEqual(m.cw - 1e-6);
      });
    });
  }
});
