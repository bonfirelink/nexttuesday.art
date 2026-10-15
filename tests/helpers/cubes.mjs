// The PHILO figure's model (site/_nts/worlds/cubes.js) in node, and the plane
// geometry its checks need.
import { readFileSync } from "node:fs";

// cubes.js is a classic browser script that also fills module.exports; the repo's
// package.json makes .js files ES modules, so node's require can't load it as such.
const module = { exports: {} };
new Function("module", readFileSync(new URL("../../site/_nts/worlds/cubes.js", import.meta.url), "utf8"))(module);
export const cubes = module.exports;

// Any colours will do for the model's checks; the drawing passes them through.
// Three distinct tones, so a face can be told by its fill.
export const COL = { top: "#f5f5f7", side: "#a6a7b2", dark: "#53566b", ground: "#e6e6e8" };
// A frame laid out at this centre and scale, in px.
export const CX = 300, CY = 300, SC = 100;
// The clock at rest in tick k: the cubes move only in a tick's last GLIDE seconds.
export const restAt = (k) => k * cubes.TICK + 0.3;
// Halfway through tick k's glide.
export const midAt = (k) => (k + 1) * cubes.TICK - cubes.GLIDE / 2;

// The loop's places as the picture names them: the tip, then down the right side,
// along the bottom and up the left side (the way the cubes go).
export const PLACES = ["T", "R", "R2", "BR", "B2", "B1", "BL", "L2", "L1"];

const sgn = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const signedArea = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

// The overlap of two convex polygons (Sutherland-Hodgman), and its area.
export function overlap(P, C) {
  let out = P;
  const o = Math.sign(signedArea(C)) || 1;
  for (let i = 0; i < C.length && out.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length], inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], sp = o * sgn(a, b, p), sq = o * sgn(a, b, q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
  }
  return out;
}
export const area = (P) => (P.length < 3 ? 0 : Math.abs(signedArea(P)));

// The overlapping pairs of a layer, each as [front, behind] item indices.
// Overlaps smaller than minArea px² (corners that only touch) are left out.
export function fronts({ items, over }, minArea = 1) {
  const out = [];
  over.forEach((tops, b) => {
    for (const t of tops) if (area(overlap(items[t].hull, items[b].hull)) >= minArea) out.push([t, b]);
  });
  return out;
}
