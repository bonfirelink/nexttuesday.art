/* The impossible triangle: three square bars arranged in space so that,
   seen along one diagonal, they close into a Penrose triangle. Each bar
   starts a little behind the end of the one before it, all the way round
   the loop, which is the impossibility: it only closes in projection. Tilt
   the model and the loop breaks open at one corner.
   Drawn as an engraving: no outlines, only hatching that lives on each face
   and turns with it; line weight carries the light; the cut ends of the
   bars are hatched in red.
   Pure geometry, no DOM: philo.js draws it on canvases, and
   tools/gen-stills.mjs bakes the still SVG shown with scripts off. In the
   browser it is window.NTS.penrose; in node, module.exports. */
(function () {
  "use strict";
  const S = 1, L = 4.3, T = 0.13, SLABS = 7, HATCH = S / 16;
  const BARS = [
    { axis: 0, min: [0, 0, 0], max: [L, S, S] },
    { axis: 1, min: [L - S - T, S - T, -T], max: [L - T, L - T, S - T] },
    { axis: 2, min: [L - S - 2 * T, L - S - 2 * T, S - 2 * T], max: [L - 2 * T, L - 2 * T, L - 2 * T] },
  ];
  /* The model's pivot (the origin of every pose), in model coordinates. It
     starts at the mean of the bars' centres; see PIVOT below for where it
     ends up. */
  let centre = [0, 1, 2].map((k) => BARS.reduce((a, b) => a + (b.min[k] + b.max[k]) / 2, 0) / BARS.length);
  const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return a.map((x) => x / l); };
  const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
  const D = norm([1, 1, 1]);
  const UP = norm(add(E[2], D, -dot(E[2], D)));
  let RIGHT = cross(UP, D);
  if (dot(cross(RIGHT, UP), D) < 0) RIGHT = RIGHT.map((x) => -x);
  const toCamera = (p) => [dot(p, RIGHT), dot(p, UP), dot(p, D)];
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
  function pieces() {
    const slabs = [];
    for (const bar of BARS) {
      const a = bar.axis, len = bar.max[a] - bar.min[a];
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
              if (!(sign > 0 ? last : first)) continue;
              const i = (k + 1) % 3, j = (k + 2) % 3;
              const p0 = [0, 0, 0]; p0[k] = fixed; p0[i] = bar.min[i]; p0[j] = bar.min[j];
              faces.push({ p0: add(p0, centre, -1), u: E[i], v: E[j], ua: 0, ub: S, lv: S, n, cap: true, eps: [0, 0] });
            } else {
              const j = 3 - k - a;
              const p0 = [0, 0, 0]; p0[k] = fixed; p0[a] = bar.min[a]; p0[j] = bar.min[j];
              faces.push({ p0: add(p0, centre, -1), u: E[a], v: E[j], ua, ub, lv: S, n, cap: false, eps: [first ? 0 : 0.015, last ? 0 : 0.015] });
            }
          }
        }
        slabs.push({ c, faces });
      }
    }
    return slabs;
  }
  let PIECES = pieces();
  const LIGHT = norm([-0.45, 0.75, 0.55]);
  /* One frame: the visible face pieces, far to near, each with its screen
     polygon, hatch segments, a colour role ('ink' or 'cut') and a line
     width in model units. */
  function frame({ theta = 0, psi = 0, phi = 0 } = {}) {
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
        out.push({ poly, lines, role: f.cap ? "cut" : "ink", width: f.cap ? 0.011 : 0.005 + 0.014 * (1 - lambert) });
      }
    }
    return out;
  }
  const CLOSED = { theta: 0, psi: 0, phi: Math.PI / 6 };
  /* PIVOT: the mean of the bars' centres is not where the closed triangle's
     centre is on screen (the loop is lopsided in depth), so the figure sat
     off its ring. Move the pivot, once, to the area centroid of the closed
     pose's silhouette (the hull's: the closed loop is three-fold symmetric,
     so it is also the circumcentre of the triangle). Every pose then turns
     about that point and the rest pose is centred at (0, 0) by
     construction, with no per-frame measuring. */
  (function () {
    const pts = [];
    for (const f of frame(CLOSED)) for (const p of f.poly) pts.push(p);
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (list) => { const h = []; for (const p of list) { while (h.length > 1 && cr(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
    const hull = half(pts).concat(half(pts.slice().reverse()));
    let A = 0, gx = 0, gy = 0;
    hull.forEach((p, i) => {
      const q = hull[(i + 1) % hull.length], k = p[0] * q[1] - q[0] * p[1];
      A += k; gx += (p[0] + q[0]) * k; gy += (p[1] + q[1]) * k;
    });
    const x = gx / (3 * A), y = gy / (3 * A);
    /* the view is the camera frame turned by CLOSED.phi about the view axis */
    const c = Math.cos(CLOSED.phi), s = Math.sin(CLOSED.phi);
    const a = c * x + s * y, b = -s * x + c * y;
    centre = add(add(centre, RIGHT, a), UP, b);
    PIECES = pieces();
  })();
  const api = { frame, CLOSED, EXTENT: 3.6 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") { window.NTS = window.NTS || {}; window.NTS.penrose = api; }
})();
