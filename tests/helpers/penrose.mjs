// Checks on the impossible triangle's geometry (site/_nts/worlds/penrose.js), in node:
// the canvas paints frame()'s faces in order, each over the ones before, so the picture
// is right only if that order agrees with depth wherever two faces overlap on screen.
import { readFileSync } from "node:fs";

// penrose.js is a classic browser script that also fills module.exports; the repo's
// package.json makes .js files ES modules, so node's require can't load it as such.
const module = { exports: {} };
new Function("module", readFileSync(new URL("../../site/_nts/worlds/penrose.js", import.meta.url), "utf8"))(module);
export const penrose = module.exports;

// Samples closer than this to any face's outline are skipped: on an edge, which face
// covers the sample is a matter of rounding. In model units; the figure spans about 5.
export const EDGE = 0.004;
// Depths closer than this count as equal (coplanar pieces of one face).
export const Z_TOL = 1e-6;

function prepare(f) {
  // the quads come in either winding; orient them so that inside is to the left
  const P = f.poly;
  let area = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  const edges = P.map((a, i) => {
    const b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
    return [a[0], a[1], (s * ex) / l, (s * ey) / l];
  });
  const [ox, oy, oz] = f.o, [nx, ny, nz] = f.n;
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const box = [Math.min(...xs) - EDGE, Math.min(...ys) - EDGE, Math.max(...xs) + EDGE, Math.max(...ys) + EDGE];
  return { edges, box, depth: (x, y) => oz - (nx * (x - ox) + ny * (y - oy)) / nz };
}

/**
 * Paints the faces of one pose onto a grid of samples, painter's way (the last face
 * drawn wins) and depth-buffer way (the nearest face wins), and counts the samples
 * where they disagree. Returns { wrong, covered } (covered: samples on the figure).
 */
export function wrongOrder(faces, { grid = 64 } = {}) {
  const F = faces.map(prepare);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of faces) for (const [x, y] of f.poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  let wrong = 0, covered = 0;
  for (let j = 0; j < grid; j++) {
    const y = y0 + ((j + 0.5) * (y1 - y0)) / grid;
    samples: for (let i = 0; i < grid; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / grid;
      let top = -1, near = -1, zNear = -Infinity;
      for (let k = 0; k < F.length; k++) {
        const b = F[k].box;
        if (x < b[0] || y < b[1] || x > b[2] || y > b[3]) continue;
        let d = Infinity;
        for (const [ax, ay, ex, ey] of F[k].edges) d = Math.min(d, ex * (y - ay) - ey * (x - ax));
        if (Math.abs(d) <= EDGE) continue samples;
        if (d < 0) continue;
        top = k;
        const z = F[k].depth(x, y);
        if (z > zNear) { zNear = z; near = k; }
      }
      if (top < 0) continue;
      covered++;
      if (zNear - F[top].depth(x, y) > Z_TOL) wrong++;
    }
  }
  return { wrong, covered };
}

/**
 * Pairs of pieces that lie in one plane, facing the same way, with parallel hatching:
 * one face drawn in pieces, which leaves an anti-aliased seam across its hatching
 * wherever two pieces meet. Returns the number of such pairs.
 */
export function splitFaces(faces) {
  const key = (f) => {
    const [nx, ny, nz] = f.n, off = nx * f.o[0] + ny * f.o[1] + nz * f.o[2];
    const [x1, y1, x2, y2] = f.lines[0] || [0, 0, 1, 0], l = Math.hypot(x2 - x1, y2 - y1) || 1;
    return [nx, ny, nz, off, (x2 - x1) / l, (y2 - y1) / l];
  };
  const K = faces.map(key);
  let n = 0;
  for (let i = 0; i < K.length; i++)
    for (let j = i + 1; j < K.length; j++) {
      const a = K[i], b = K[j];
      const same = [0, 1, 2, 3].every((k) => Math.abs(a[k] - b[k]) < 1e-9) && Math.abs(a[4] * b[5] - a[5] * b[4]) < 1e-9;
      if (same) n++;
    }
  return n;
}

// The poses the figure takes: phi is fixed; theta is the tilt (up to 0.72 by itself,
// further when dragged), psi the drifting tilt axis, all the way round.
export function sweep({ thetas = 13, thetaMax = 1, psis = 24 } = {}) {
  const out = [];
  for (let a = 0; a < thetas; a++)
    for (let b = 0; b < psis; b++)
      out.push({ theta: -thetaMax + (2 * thetaMax * a) / (thetas - 1), psi: (2 * Math.PI * b) / psis, phi: penrose.CLOSED.phi });
  return out;
}
