/* The entity: three square bars arranged in space so that, seen along one
   diagonal, they close into a Penrose triangle. Each bar starts a little
   behind the end of the one before it, all the way round the loop, which is
   the impossibility: it only closes in projection. Tilt the model and the
   loop breaks open at one corner.

   The model is drawn as an engraving: no outlines, only hatching that lives
   on each face and turns with it. Line weight carries the light. The cut
   ends of the bars are hatched in crimson.

   This module is shared by the page (canvas, animated) and by gen.mjs
   (node, which writes the static SVG shown without JavaScript). It has no
   DOM dependencies. */

const S = 1;        // bar thickness
const L = 4.3;      // bar length
const T = 0.13;     // how far each bar sits behind the previous one
const SLABS = 7;    // pieces per bar, for the painter's order
const HATCH = S / 16; // hatch spacing, in model units

// Each bar begins just past the inner face of the one before it, so the
// bars never pass through each other; only the last joint is a trick.
const BARS = [
  { axis: 0, min: [0, 0, 0], max: [L, S, S] },
  { axis: 1, min: [L - S - T, S - T, -T], max: [L - T, L - T, S - T] },
  { axis: 2, min: [L - S - 2 * T, L - S - 2 * T, S - 2 * T], max: [L - 2 * T, L - 2 * T, L - 2 * T] },
];

const centre = [0, 1, 2].map((k) =>
  BARS.reduce((a, b) => a + (b.min[k] + b.max[k]) / 2, 0) / BARS.length);

const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];

// Camera basis for the magic view: looking down the (1,1,1) diagonal, with
// world z pointing up the screen.
const D = norm([1, 1, 1]);
const UP = norm(add(E[2], D, -dot(E[2], D)));
let RIGHT = cross(UP, D);
if (dot(cross(RIGHT, UP), D) < 0) RIGHT = RIGHT.map((x) => -x);

function toCamera(p) {
  return [dot(p, RIGHT), dot(p, UP), dot(p, D)];
}

// Rotation in camera space: tilt by theta about an axis lying in the screen
// plane at angle psi, then spin in the plane by phi.
function rotator(theta, psi, phi) {
  const ax = [Math.cos(psi), Math.sin(psi), 0];
  const c = Math.cos(theta), s = Math.sin(theta), u = 1 - c;
  const R1 = [
    [c + ax[0] * ax[0] * u, ax[0] * ax[1] * u - ax[2] * s, ax[0] * ax[2] * u + ax[1] * s],
    [ax[1] * ax[0] * u + ax[2] * s, c + ax[1] * ax[1] * u, ax[1] * ax[2] * u - ax[0] * s],
    [ax[2] * ax[0] * u - ax[1] * s, ax[2] * ax[1] * u + ax[0] * s, c + ax[2] * ax[2] * u],
  ];
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const R2 = [[cp, -sp, 0], [sp, cp, 0], [0, 0, 1]];
  const mul = (A, v) => [dot(A[0], v), dot(A[1], v), dot(A[2], v)];
  return (v) => mul(R2, mul(R1, v));
}

/* The model as slabs: each bar cut into SLABS boxes along its length. A
   slab's visible faces never overlap on screen (it is convex), so the
   painter's order only has to sort slabs, by the depth of their centres.
   Each face is a rectangle with a local basis (origin p0, axes u and v). */
function pieces() {
  const slabs = [];
  for (const bar of BARS) {
    const a = bar.axis;
    const len = bar.max[a] - bar.min[a];
    for (let sIdx = 0; sIdx < SLABS; sIdx++) {
      const ua = (len * sIdx) / SLABS, ub = (len * (sIdx + 1)) / SLABS;
      const first = sIdx === 0, last = sIdx === SLABS - 1;
      const c = [0, 1, 2].map((k) => (bar.min[k] + bar.max[k]) / 2 - centre[k]);
      c[a] = bar.min[a] + (ua + ub) / 2 - centre[a];
      const faces = [];
      for (let k = 0; k < 3; k++) {
        for (const sign of [1, -1]) {
          const n = E[k].map((x) => x * sign);
          const fixed = sign > 0 ? bar.max[k] : bar.min[k];
          if (k === a) {
            // A cap, on the first or last slab only: a square, hatched on the diagonal.
            if (!(sign > 0 ? last : first)) continue;
            const i = (k + 1) % 3, j = (k + 2) % 3;
            const p0 = [0, 0, 0];
            p0[k] = fixed; p0[i] = bar.min[i]; p0[j] = bar.min[j];
            faces.push({ p0: add(p0, centre, -1), u: E[i], v: E[j], ua: 0, ub: S, lv: S, n, cap: true, eps: [0, 0] });
          } else {
            const j = 3 - k - a; // the remaining axis
            const p0 = [0, 0, 0];
            p0[k] = fixed; p0[a] = bar.min[a]; p0[j] = bar.min[j];
            faces.push({
              p0: add(p0, centre, -1), u: E[a], v: E[j], ua, ub, lv: S, n, cap: false,
              eps: [first ? 0 : 0.015, last ? 0 : 0.015],
            });
          }
        }
      }
      slabs.push({ c, faces });
    }
  }
  return slabs;
}

const PIECES = pieces();
const LIGHT = norm([-0.45, 0.75, 0.55]); // camera space: upper left, in front

/* One frame. Returns the visible face pieces, far to near, each with its
   screen polygon, its hatch segments, a colour role and a line width (in
   model units, before scaling). */
export function frame({ theta = 0, psi = 0, phi = 0 } = {}) {
  const rot = rotator(theta, psi, phi);
  const view = (p) => rot(toCamera(p));
  const slabs = PIECES.map((sl) => ({ depth: rot(toCamera(sl.c))[2], faces: sl.faces }));
  slabs.sort((a, b) => a.depth - b.depth);
  const out = [];
  for (const sl of slabs) {
    for (const f of sl.faces) {
      const n = rot(toCamera(f.n));
      if (n[2] <= 0.02) continue;
      const lambert = Math.max(0, dot(n, LIGHT));
      const P0 = view(f.p0), U = view(f.u), V = view(f.v);
      const at = (a, b) => [P0[0] + a * U[0] + b * V[0], P0[1] + a * U[1] + b * V[1]];
      const ua = f.ua - f.eps[0], ub = f.ub + f.eps[1];
      const poly = [at(ua, 0), at(ub, 0), at(ub, f.lv), at(ua, f.lv)];
      const lines = [];
      if (f.cap) {
        // Diagonal hatch across the square: lines b - a = c.
        const step = HATCH * 0.85 * Math.SQRT2;
        for (let c = -S + step / 2; c < S; c += step) {
          const a0 = Math.max(0, -c), a1 = Math.min(S, S - c);
          if (a1 <= a0) continue;
          const p = at(a0, a0 + c), q = at(a1, a1 + c);
          lines.push([p[0], p[1], q[0], q[1]]);
        }
      } else {
        for (let b = HATCH / 2; b < f.lv; b += HATCH) {
          const p = at(ua, b), q = at(ub, b);
          lines.push([p[0], p[1], q[0], q[1]]);
        }
      }
      out.push({
        poly, lines,
        role: f.cap ? 'cut' : 'ink',
        width: f.cap ? 0.011 : 0.005 + 0.014 * (1 - lambert),
      });
    }
  }
  return out;
}

/* The pose that closes the triangle on screen: no tilt, and an in-plane
   turn so the broken corner sits top right. */
export const CLOSED = { theta: 0, psi: 0, phi: Math.PI / 6 };
export const EXTENT = 3.6; // half-size of the model's screen box, model units
