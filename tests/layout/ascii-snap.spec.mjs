// L3e. INTERSECT's glyphs sit on whole device pixels: the cell width and each line's origin
// are snapped, so a glyph has the same ink wherever it falls in the figure (unsnapped, the
// same bold glyph varied by up to 18% across a line at DPR 1).
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";

// Spread of one glyph's ink across 60 positions on a line, as 1 - min/max.
const SPREAD = 0.02;
// A snapped length is a whole number of device pixels, to float error.
const WHOLE = 1e-6;

for (const dsf of [1, 2]) {
  test.describe(`L3e glyphs on device pixels at DPR ${dsf}`, () => {
    test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, deviceScaleFactor: dsf });
    test(`the page's cells and line origins are whole device pixels, and a glyph's ink is the same at every position`, async ({ page }) => {
      const pre = "pre[data-nts-ascii]";
      await openPage(page, "/intersect/", { live: [pre] });
      const r = await page.evaluate((sel) => {
        const el = document.querySelector(sel), m = el.ntsCells && el.ntsCells();
        if (!m) return null;
        const whole = (v) => Math.abs(v * m.dpr - Math.round(v * m.dpr));
        // the page's paint, replayed: each glyph repeated along one line, as paint() draws a line
        const n = 60, cv = document.createElement("canvas"), c = cv.getContext("2d");
        cv.width = Math.ceil((m.ox + n * m.cell) * m.dpr) + 4; cv.height = Math.ceil(4 * m.size * m.dpr) + 4;
        c.setTransform(m.dpr * m.sx, 0, 0, m.dpr, 0, 0); c.font = m.font; c.fillStyle = "#000"; c.textBaseline = "alphabetic";
        const G = ["#", "@", "+"], spread = {};
        G.forEach((g, i) => c.fillText(g.repeat(n), m.ox / m.sx, m.line(i)));
        const d = c.getImageData(0, 0, cv.width, cv.height).data;
        G.forEach((g, i) => {
          const sums = [];
          for (let k = 0; k < n; k++) {
            const x0 = Math.round((m.ox + k * m.cell) * m.dpr), x1 = Math.round((m.ox + (k + 1) * m.cell) * m.dpr);
            const y0 = Math.round((m.line(i) - m.base) * m.dpr), y1 = Math.round((m.line(i) - m.base + m.size) * m.dpr);
            let s = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += d[(y * cv.width + x) * 4 + 3];
            sums.push(s);
          }
          spread[g] = 1 - Math.min(...sums) / Math.max(...sums);
        });
        return { spread, cell: whole(m.cell), ox: whole(m.ox), lines: Math.max(...[0, 1, 2, 7, 20].map((i) => whole(m.line(i)))) };
      }, pre);
      expect(r, "the pre's paint metrics (ntsCells)").not.toBeNull();
      expect(r.cell, "cell width off whole device pixels").toBeLessThanOrEqual(WHOLE);
      expect(r.ox, "line origin x off whole device pixels").toBeLessThanOrEqual(WHOLE);
      expect(r.lines, "line baselines off whole device pixels").toBeLessThanOrEqual(WHOLE);
      for (const [g, s] of Object.entries(r.spread)) expect(s, `"${g}": ink spread across a line`).toBeLessThan(SPREAD);
    });
  });
}
