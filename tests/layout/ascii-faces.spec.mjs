// L3c. INTERSECT's solid is drawn by its edges only: the faces hide what is behind them
// (they write depth) but carry no glyph, and an edge in front still shows over its faces.
import { readFileSync } from "node:fs";
import { test, expect } from "../helpers/fixtures.mjs";

const module = { exports: {} };
new Function("module", readFileSync(new URL("../../site/_nts/worlds/ascii.js", import.meta.url), "utf8"))(module);
const ascii = module.exports;
const fig = ascii.figure("tetra");
const COLS = 64, ROWS = Math.round(COLS * 0.6), ASPECT = 0.6;
// Share of the samples along an edge that may miss a glyph in front (rounding at cell edges).
const FRONT_MISS = 0.2;
// Samples this close to an edge's ends or to the centre (where the front edge crosses
// the back one) are skipped, as fractions of the edge's length.
const END = 0.15, MIDDLE = 0.12;

// the vertices of the tetra (ascii.js), on the unit sphere
const V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((c) => c / Math.sqrt(3)));

test.describe("L3c the solid's faces are blank", () => {
  test("no face sample emits a glyph, at any pose", () => {
    const faces = { pts: fig.pts.slice(0, fig.faceEnd * 6), flat: false, faceEnd: fig.faceEnd };
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const ls = ascii.lines(faces, COLS, ROWS, ASPECT, { ax: i * 0.8, ay: j * 0.8 }, ascii.fit(fig, ascii.SPAN.hero));
      expect(ls.join("").trim(), `pose ${i},${j}: glyphs from faces alone`).toBe("");
    }
  });

  test("at the square pose the back edge is hidden and the front edge is drawn", () => {
    // ax = ay = 0: looking down z, the edge 1-2 is in front (z < 0) and 0-3 behind (z > 0);
    // they cross on screen at the centre
    const zoom = ascii.fit(fig, ascii.SPAN.hero), ls = ascii.lines(fig, COLS, ROWS, ASPECT, { ax: 0, ay: 0 }, zoom);
    const K1 = zoom * (COLS / 2) * 6;
    const at = (p) => { const o = 1 / (p[2] + 6); return [Math.floor(COLS / 2 + K1 * p[0] * o), Math.floor(ROWS / 2 - K1 * p[1] * o * ASPECT)]; };
    const glyph = (c, r) => (ls[r] || "")[c] || " ";
    const along = (a, b) => {
      const out = [];
      for (let t = END; t <= 1 - END; t += 0.01) {
        if (Math.abs(t - 0.5) < MIDDLE) continue;
        out.push(glyph(...at(a.map((x, k) => x + (b[k] - x) * t))));
      }
      return out;
    };
    const front = along(V[1], V[2]), back = along(V[0], V[3]);
    expect(front.filter((g) => g === " ").length / front.length, "front edge: share of samples with no glyph").toBeLessThanOrEqual(FRONT_MISS);
    expect(back.join("").trim(), "back edge: glyphs drawn along it").toBe("");
  });
});
