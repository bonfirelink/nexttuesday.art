/* Bakes the still frames the pages show with scripts off. Run from anywhere:
     node tools/gen-stills.mjs
   Writes, in site/_nts/parts/:
     still-philo.svg          the impossible triangle at its closed pose
     still-intersect.txt      the ASCII tetrahedron, 52 columns
     still-intersect-sm.txt   the same at 52 columns, for fragments (the same frame, smaller)
   The SVG uses the --penrose-* custom properties with fallbacks, so the
   same still follows day and night once inlined. tools/sync.mjs inlines
   these into the pages. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const parts = join(here, '..', 'site', '_nts', 'parts');
/* The figures are classic browser scripts that also fill module.exports;
   the repo's package.json makes .js files ES modules, so they are run here
   with a module object of their own rather than through require. */
const load = (rel) => {
  const module = { exports: {} };
  new Function('module', readFileSync(join(here, rel), 'utf8'))(module);
  return module.exports;
};
const penrose = load('../site/_nts/worlds/penrose.js');
const ascii = load('../site/_nts/worlds/ascii.js');
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

const tetra = ascii.figure('tetra');
/* A still is the live solid's first frame: its pose and its zoom, in the
   cell grid of its box (the page's CSS sizes the still's glyphs so the grid
   spans the box, as the live glyphs do). */
const still = (cols, span) => ascii.render(tetra, cols, Math.round(cols * 0.6), 0.6, ascii.POSE, ascii.fit(tetra, span));
const out = {
  'still-philo.svg': philoStill(),
  /* sync writes the page's still after a newline of its own, which the pre
     shows as the first row: the baked first row (always blank, the pose
     keeps a glyph clear of the edge) goes */
  'still-intersect.txt': still(52, ascii.SPAN.hero).replace(/^[^\n]*\n/, ''),
  'still-intersect-sm.txt': still(52, ascii.SPAN.fragment),
};
for (const [name, text] of Object.entries(out)) {
  writeFileSync(join(parts, name), text);
  console.log(name, (text.length / 1024).toFixed(1) + 'K');
}
