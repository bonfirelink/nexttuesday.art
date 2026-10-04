/* Bakes the still frames the pages show with scripts off. Run from anywhere:
     node tools/gen-stills.mjs
   Writes, in site/_nts/parts/:
     still-philo.svg          the impossible triangle at its closed pose
     still-intersect.txt      the ASCII tetrahedron, 84 columns
     still-intersect-sm.txt   the same at 48 columns, for fragments
   The SVG uses the --penrose-* custom properties with fallbacks, so the
   same still follows day and night once inlined. tools/sync.mjs inlines
   these into the pages. */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const parts = join(here, '..', 'site', '_nts', 'parts');
const require = createRequire(import.meta.url);
const penrose = require('../site/_nts/worlds/penrose.js');
const ascii = require('../site/_nts/worlds/ascii.js');
const f2 = (x) => (Math.round(x * 100) / 100).toString();

function clipSegment(p, q, poly) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1;
  let t0 = 0, t1 = 1;
  const d = [q[0] - p[0], q[1] - p[1]];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], e = [b[0] - a[0], b[1] - a[1]];
    const num = (e[0] * (p[1] - a[1]) - e[1] * (p[0] - a[0])) * sgn, den = (e[0] * d[1] - e[1] * d[0]) * sgn;
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue; }
    const t = -num / den;
    if (den > 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  if (t0 > t1) return null;
  return [[p[0] + t0 * d[0], p[1] + t0 * d[1]], [p[0] + t1 * d[0], p[1] + t1 * d[1]]];
}

function philoStill() {
  const size = 600, scale = size / (2 * penrose.EXTENT), cx = size / 2, cy = size / 2;
  const X = (x) => cx + x * scale, Y = (y) => cy - y * scale;
  let body = '';
  for (const f of penrose.frame(penrose.CLOSED)) {
    const poly = f.poly.map(([x, y]) => [X(x), Y(y)]);
    let d = '';
    for (const [x1, y1, x2, y2] of f.lines) {
      const c = clipSegment([X(x1), Y(y1)], [X(x2), Y(y2)], poly);
      if (c) d += `M${f2(c[0][0])} ${f2(c[0][1])}L${f2(c[1][0])} ${f2(c[1][1])}`;
    }
    body += `<polygon points="${poly.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' ')}" fill="var(--penrose-ground,#e6e6e8)"/>`;
    body += `<path d="${d}" stroke="var(--penrose-${f.role === 'cut' ? 'cut,#e5174a' : 'ink,#2b2d3e'})" stroke-width="${f2(f.width * scale)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" stroke-linecap="butt" aria-hidden="true">${body}</svg>`;
}

const pose = { phi: 0.6, alpha: 0.52, spin: 0.3, ax: -0.5, ay: 0.4 };
const tetra = ascii.figure('tetra');
const out = {
  'still-philo.svg': philoStill(),
  'still-intersect.txt': ascii.render(tetra, 84, Math.round(84 * 0.6), 0.6, pose),
  'still-intersect-sm.txt': ascii.render(tetra, 48, Math.round(48 * 0.6), 0.6, pose),
};
for (const [name, text] of Object.entries(out)) {
  writeFileSync(join(parts, name), text);
  console.log(name, (text.length / 1024).toFixed(1) + 'K');
}
