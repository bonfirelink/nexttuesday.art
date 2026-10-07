/* The impossible triangle: three square bars arranged in space so that,
   seen along one diagonal, they close into a Penrose triangle. They make a
   real, open solid: each bar sits on the end of the one before it, and the
   last one's end only meets the first one's start in projection, which is
   the impossibility. Tilt the model and the loop breaks open at that
   corner.
   Drawn as an engraving: no outlines, only hatching that lives on each face
   and turns with it; line weight carries the light; the cut ends of the
   bars are hatched in red.
   Pure geometry, no DOM: philo.js draws it on canvases, and
   tools/gen-stills.mjs bakes the still SVG shown with scripts off. In the
   browser it is window.NTS.penrose; in node, module.exports. */
(function () {
  "use strict";
  const S = 1, L = 4.3, HATCH = S / 16;
  /* The bars touch but never overlap, so each pair has a plane between
     them (SEP) and a painter's order exists at every pose: drawing the bars
     whole in that order is exact, and a face drawn whole has no seams. */
  const BARS = [
    { axis: 0, min: [0, 0, 0], max: [L, S, S] },
    { axis: 1, min: [L - S, S, 0], max: [L, L, S] },
    { axis: 2, min: [L - S, L - S, S], max: [L, L, L] },
  ];
  /* [a, b, k]: bar b lies on the +k side of bar a */
  const SEP = [];
  for (let a = 0; a < BARS.length; a++) for (let b = a + 1; b < BARS.length; b++) {
    for (let k = 0; k < 3; k++) {
      if (BARS[a].max[k] <= BARS[b].min[k]) { SEP.push([a, b, k]); break; }
      if (BARS[b].max[k] <= BARS[a].min[k]) { SEP.push([b, a, k]); break; }
    }
  }
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
    return BARS.map((bar) => {
      const a = bar.axis, faces = [];
      for (let k = 0; k < 3; k++) {
        for (const sign of [1, -1]) {
          const n = E[k].map((x) => x * sign);
          const fixed = sign > 0 ? bar.max[k] : bar.min[k];
          if (k === a) {
            const i = (k + 1) % 3, j = (k + 2) % 3;
            const p0 = [0, 0, 0]; p0[k] = fixed; p0[i] = bar.min[i]; p0[j] = bar.min[j];
            faces.push({ p0: add(p0, centre, -1), u: E[i], v: E[j], ua: 0, ub: S, lv: S, n, cap: true });
          } else {
            const j = 3 - k - a;
            const p0 = [0, 0, 0]; p0[k] = fixed; p0[a] = bar.min[a]; p0[j] = bar.min[j];
            faces.push({ p0: add(p0, centre, -1), u: E[a], v: E[j], ua: 0, ub: bar.max[a] - bar.min[a], lv: S, n, cap: false });
          }
        }
      }
      return faces;
    });
  }
  let PIECES = pieces();
  const LIGHT = norm([-0.45, 0.75, 0.55]);
  /* One frame: the visible face pieces, far to near, each with its screen
     polygon, hatch segments, a colour role ('ink' or 'cut'), a line width
     in model units, and its plane in view space (a point o and the normal
     n; depth grows towards the viewer) for checking the drawing order. */
  function frame({ theta = 0, psi = 0, phi = 0 } = {}) {
    const rot = rotator(theta, psi, phi);
    const view = (p) => rot(toCamera(p));
    /* far to near: of two bars, the one on the viewer's side of the plane
       between them goes last */
    const toward = E.map((e) => rot(toCamera(e))[2]);
    const after = BARS.map(() => []);
    for (const [a, b, k] of SEP) { if (toward[k] > 0) after[b].push(a); else after[a].push(b); }
    const order = [];
    while (order.length < BARS.length) {
      let i = BARS.findIndex((_, i) => !order.includes(i) && after[i].every((j) => order.includes(j)));
      if (i < 0) i = BARS.findIndex((_, i) => !order.includes(i));
      order.push(i);
    }
    const out = [];
    for (const bi of order) {
      for (const f of PIECES[bi]) {
        const n = rot(toCamera(f.n));
        if (n[2] <= 0.02) continue;
        const lambert = Math.max(0, dot(n, LIGHT));
        const P0 = view(f.p0), U = view(f.u), V = view(f.v);
        const at = (a, b) => [P0[0] + a * U[0] + b * V[0], P0[1] + a * U[1] + b * V[1]];
        const ua = f.ua, ub = f.ub;
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
        out.push({ poly, lines, role: f.cap ? "cut" : "ink", width: f.cap ? 0.011 : 0.005 + 0.014 * (1 - lambert), o: P0, n });
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
  const api = { frame, CLOSED, EXTENT: 2.6 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") { window.NTS = window.NTS || {}; window.NTS.penrose = api; }
})();
