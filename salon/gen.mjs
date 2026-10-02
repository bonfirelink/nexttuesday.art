/* Writes the salon's drawn assets. Run from anywhere:
     node site/salon/gen.mjs
   It writes, next to itself:
     entity.svg        the impossible object at its closed pose (no-JS frame)
     plate-rings.svg   concentric engraved rings, thick at the heart
     plate-cube.svg    horizontal hatching bulging over a cube
     plate-sphere.svg  the same over a sphere
     plate-fire.svg    the same over a tetrahedron, for the night
     plate-cross.svg   two hatch fields crossing
   Everything is a line drawing in one colour (currentColor is not available
   to <img>, so the ink is baked in: charcoal, or pale grey for the night). */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frame, CLOSED, EXTENT } from './entity.js';

const here = dirname(fileURLToPath(import.meta.url));
const INK = '#2b2d3e', CUT = '#e5174a', GROUND = '#e6e6e8', PALE = '#e6e6e8', NIGHT = '#2b2d3e';
const f2 = (x) => (Math.round(x * 100) / 100).toString();

/* ---------- entity.svg ---------- */
function clipSegment(p, q, poly) {
  // Cyrus-Beck against a convex polygon of unknown winding.
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sgn = area > 0 ? 1 : -1;
  let t0 = 0, t1 = 1;
  const d = [q[0] - p[0], q[1] - p[1]];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const e = [b[0] - a[0], b[1] - a[1]];
    // inside when cross(e, x - a) * sgn >= 0
    const num = (e[0] * (p[1] - a[1]) - e[1] * (p[0] - a[0])) * sgn;
    const den = (e[0] * d[1] - e[1] * d[0]) * sgn;
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue; }
    const t = -num / den;
    if (den > 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  if (t0 > t1) return null;
  return [[p[0] + t0 * d[0], p[1] + t0 * d[1]], [p[0] + t1 * d[0], p[1] + t1 * d[1]]];
}

function entitySvg() {
  const size = 600, scale = size / (2 * EXTENT), cx = size / 2, cy = size / 2;
  const X = (x) => cx + x * scale, Y = (y) => cy - y * scale;
  const faces = frame(CLOSED);
  let body = '';
  for (const f of faces) {
    const poly = f.poly.map(([x, y]) => [X(x), Y(y)]);
    let d = '';
    for (const [x1, y1, x2, y2] of f.lines) {
      const c = clipSegment([X(x1), Y(y1)], [X(x2), Y(y2)], poly);
      if (c) d += `M${f2(c[0][0])} ${f2(c[0][1])}L${f2(c[1][0])} ${f2(c[1][1])}`;
    }
    body += `<polygon points="${poly.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' ')}" fill="${GROUND}"/>`;
    body += `<path d="${d}" stroke="${f.role === 'cut' ? CUT : INK}" stroke-width="${f2(f.width * scale)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" stroke-linecap="butt">${body}</svg>`;
}

/* ---------- plates: hatching displaced by a hidden solid ---------- */
// A convex solid is a list of planes {n, d} with n.p <= d inside. The map
// at (x, y) is how much of a ray along z lies inside the solid: zero at the
// silhouette, so the lifted lines stay continuous.
function height(planes, x, y) {
  let lo = -Infinity, hi = Infinity;
  for (const { n, d } of planes) {
    const rhs = d - n[0] * x - n[1] * y;
    if (Math.abs(n[2]) < 1e-9) { if (rhs < 0) return null; continue; }
    const z = rhs / n[2];
    if (n[2] > 0) hi = Math.min(hi, z); else lo = Math.max(lo, z);
  }
  return hi >= lo ? hi - lo : null;
}

function planesFromHull(verts, faces) {
  const c = [0, 1, 2].map((k) => verts.reduce((a, v) => a + v[k], 0) / verts.length);
  return faces.map(([i, j, k]) => {
    const a = verts[i], b = verts[j], cc = verts[k];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...n); n = n.map((x) => x / l);
    let d = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] > d) { n = n.map((x) => -x); d = -d; }
    return { n, d };
  });
}

function rotate(v, ax, ay, az) {
  let [x, y, z] = v;
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  return [x, y, z];
}

// Horizontal engraved lines across a W x H field, lifted where they cross
// the solid's height map (centred at cx, cy, scaled by r).
function hatchPlate({ W, H, step, ink, heightAt, lift, width = 0.9 }) {
  let d = '';
  for (let y0 = step / 2; y0 < H; y0 += step) {
    // Straight where the line misses the solid, sampled every 3px inside it.
    d += `M0 ${f2(y0)}`;
    let inside = false;
    for (let x = 0; x <= W; x += 3) {
      const h = heightAt(x, y0);
      if (h == null) { if (inside) d += `L${x} ${f2(y0)}`; inside = false; continue; }
      if (!inside) d += `L${x - 3} ${f2(y0)}`;
      inside = true;
      d += `L${x} ${f2(y0 - h * lift)}`;
    }
    d += `L${W} ${f2(y0)}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="${ink}" stroke-width="${width}" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

function spherePlate(ink) {
  const W = 800, H = 800, cx = 400, cy = 400, r = 300;
  return hatchPlate({
    W, H, step: 7, ink, lift: 0.14,
    heightAt: (x, y) => { const q = r * r - (x - cx) ** 2 - (y - cy) ** 2; return q > 0 ? Math.sqrt(q) : null; },
  });
}

function cubePlate(ink) {
  const W = 800, H = 800, cx = 400, cy = 420, r = 190;
  const a = 1;
  const verts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) verts.push(rotate([sx * a, sy * a, sz * a], 0.62, -0.5, 0.15));
  // Faces of a cube by vertex index: bit order x(4) y(2) z(1).
  const faces = [[0, 1, 3], [4, 6, 7], [0, 4, 5], [2, 3, 7], [0, 2, 6], [1, 5, 7]];
  const planes = planesFromHull(verts, faces);
  return hatchPlate({
    W, H, step: 7, ink, lift: 0.16,
    heightAt: (x, y) => { const h = height(planes, (x - cx) / r, (y - cy) / r); return h == null ? null : h * r; },
  });
}

function firePlate(ink) {
  const W = 800, H = 900, cx = 400, cy = 480, r = 230;
  const t = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => rotate(v, 0.35, 0.2, 0.0));
  // Stand it on a vertex-up pose: rotate so one vertex points up the screen.
  const verts = t.map((v) => rotate(v, -0.9553, 0, 0.7854));
  const faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
  const planes = planesFromHull(verts, faces);
  return hatchPlate({
    W, H, step: 7, ink, lift: 0.18,
    heightAt: (x, y) => { const h = height(planes, (x - cx) / r, -(y - cy) / r); return h == null ? null : h * r; },
  });
}

function ringsPlate(ink) {
  const W = 800, H = 800, cx = 400, cy = 400;
  let body = '';
  for (let r = 6; r < 600; r += 7) {
    const k = Math.max(0, 1 - r / 330);
    const w = 0.6 + 3.4 * k * k;
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="${f2(w)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="${ink}">${body}</svg>`;
}

function crossPlate(ink) {
  const W = 800, H = 800;
  let d = '';
  for (let c = -H; c < W + H; c += 9) d += `M${c} 0L${c + H} ${H}`;
  for (let c = 0; c < W + H; c += 9) d += `M${c} 0L${c - H} ${H}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="${ink}" stroke-width="0.8"><path d="${d}"/></svg>`;
}

const out = {
  'entity.svg': entitySvg(),
  'plate-rings.svg': ringsPlate(INK),
  'plate-cube.svg': cubePlate(INK),
  'plate-sphere.svg': spherePlate(INK),
  'plate-fire.svg': firePlate(CUT),
  'plate-cross.svg': crossPlate(INK),
};
for (const [name, svg] of Object.entries(out)) {
  writeFileSync(join(here, name), svg);
  console.log(name, (svg.length / 1024).toFixed(1) + 'K');
}
void NIGHT;
