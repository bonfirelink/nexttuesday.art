/* Bakes the still frames the pages show with scripts off. Run from anywhere:
     node tools/gen-stills.mjs            write them
     node tools/gen-stills.mjs --check    exit 1 if a committed still is stale
   Writes, in site/_nts/parts/:
     still-philo.svg          the nine cubes at rest, straight on, at the page's rest zoom
     still-philo-sm.svg       the same at the fragment's rest zoom
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
const cubes = load('../site/_nts/worlds/cubes.js');
const ascii = load('../site/_nts/worlds/ascii.js');
const f2 = (x) => (Math.round(x * 100) / 100).toString();

/* Convex polygons and segments, cut by convex polygons: for a still drawn
   with plain paths, no clip-path (a figure in an orb composites with none). */
const orient = (P) => Math.sign(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) || 1;
/* the side of edge a-b a point is on, positive inside polygon of orientation o */
const side = (a, b, p, o) => o * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
function halfPlane(P, a, b, o, keepInside) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], sp = keepInside ? side(a, b, p, o) : -side(a, b, p, o), sq = keepInside ? side(a, b, q, o) : -side(a, b, q, o);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return out;
}
const inside = (P, C) => { const o = orient(C); let out = P; for (let i = 0; i < C.length && out.length; i++) out = halfPlane(out, C[i], C[(i + 1) % C.length], o, true); return out; };
/* P less C, as convex pieces: outside C's first edge, or inside it and outside the second, ... */
function outside(P, C) {
  const o = orient(C), pieces = [];
  let rest = P;
  for (let i = 0; i < C.length && rest.length >= 3; i++) {
    const a = C[i], b = C[(i + 1) % C.length], piece = halfPlane(rest, a, b, o, false);
    if (piece.length >= 3) pieces.push(piece);
    rest = halfPlane(rest, a, b, o, true);
  }
  return pieces;
}
/* the stretch [t0, t1] of segment p-q inside convex C, or null */
function span(p, q, C) {
  const o = orient(C);
  let t0 = 0, t1 = 1;
  for (let i = 0; i < C.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length], sp = side(a, b, p, o), sq = side(a, b, q, o);
    if (sp < 0 && sq < 0) return null;
    if (sp < 0) t0 = Math.max(t0, sp / (sp - sq));
    else if (sq < 0) t1 = Math.min(t1, sp / (sp - sq));
  }
  return t0 < t1 ? [t0, t1] : null;
}
const at = (p, q, t) => [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];

/* Just enough of a canvas 2D context to record cubes.js's drawing as SVG
   paths. Its clips are a convex polygon to stay inside (clip()) or to stay
   out of (clip("evenodd") on a covering rectangle and the polygon); fills and
   outlines are cut to them here. */
class SvgContext {
  constructor() { this.sub = []; this.out = []; this.clips = [[]]; this.globalAlpha = 1; this.fillStyle = ''; this.strokeStyle = ''; this.lineWidth = 1; }
  beginPath() { this.sub = []; }
  moveTo(x, y) { this.sub.push([[x, y]]); }
  lineTo(x, y) { this.sub[this.sub.length - 1].push([x, y]); }
  closePath() {}
  rect(x, y, w, h) { this.sub.push({ rect: true }); }
  save() { this.clips.push([...this.clips[this.clips.length - 1]]); }
  restore() { this.clips.pop(); }
  clip(rule = 'nonzero') {
    const polys = this.sub.filter((s) => !s.rect);
    this.clips[this.clips.length - 1].push({ out: rule === 'evenodd', poly: polys[0] });
  }
  get cuts() { return this.clips[this.clips.length - 1]; }
  alpha() { return this.globalAlpha < 1 ? ` opacity="${f2(this.globalAlpha)}"` : ''; }
  fill() {
    let pieces = [this.sub[0]];
    for (const c of this.cuts) pieces = c.out ? pieces.flatMap((P) => outside(P, c.poly)) : pieces.map((P) => inside(P, c.poly)).filter((P) => P.length >= 3);
    if (!pieces.length) return;
    const d = pieces.map((P) => P.map(([x, y], i) => `${i ? 'L' : 'M'}${f2(x)} ${f2(y)}`).join('') + 'Z').join('');
    this.out.push(`<path d="${d}" fill="${this.fillStyle}"${this.alpha()}/>`);
  }
  stroke() {
    const P = this.sub[0];
    let segs = P.map((p, i) => [p, P[(i + 1) % P.length]]);
    for (const c of this.cuts) {
      segs = segs.flatMap(([p, q]) => {
        const s = span(p, q, c.poly);
        if (!c.out) return s ? [[at(p, q, s[0]), at(p, q, s[1])]] : [];
        if (!s) return [[p, q]];
        return [[p, at(p, q, s[0])], [at(p, q, s[1]), q]].filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.01);
      });
    }
    if (!segs.length) return;
    const d = segs.map(([a, b]) => `M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}`).join('');
    this.out.push(`<path d="${d}" stroke="${this.strokeStyle}" stroke-width="${f2(this.lineWidth)}"${this.alpha()}/>`);
  }
}

/* The live canvas's first frame: the figure at rest, straight on, at the
   host's rest zoom (cubes.REST), for the page and, larger in its box, the
   home's fragment. */
function philoStill(rest) {
  const size = 600, sc = (size * rest) / (2 * cubes.REACH);
  const col = { ink: 'var(--penrose-ink,#2b2d3e)', cut: 'var(--penrose-cut,#e81e4c)', ground: 'var(--penrose-ground,#e6e6e8)' };
  const g = new SvgContext();
  const { layers: [layer], lw } = cubes.frame(0, 0, 0, size / 2, size / 2, sc, col);
  cubes.composite(g, layer, lw);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${g.out.join('')}</svg>`;
}

const tetra = ascii.figure('tetra');
/* A still is the live solid's first frame: its pose and its zoom, in the
   cell grid of its box (the page's CSS sizes the still's glyphs so the grid
   spans the box, as the live glyphs do). */
const still = (cols, span) => ascii.render(tetra, cols, Math.round(cols * 0.6), 0.6, ascii.POSE, ascii.fit(tetra, span));
/* what a run writes, by file name; importing this module writes nothing */
export const out = {
  'still-philo.svg': philoStill(cubes.REST.page),
  'still-philo-sm.svg': philoStill(cubes.REST.fragment),
  /* sync writes the page's still after a newline of its own, which the pre
     shows as the first row: the baked first row (always blank, the pose
     keeps a glyph clear of the edge) goes */
  'still-intersect.txt': still(52, ascii.SPAN.hero).replace(/^[^\n]*\n/, ''),
  'still-intersect-sm.txt': still(52, ascii.SPAN.fragment),
};
/* run directly: --check writes nothing, says which committed still differs
   from what the figures draw now, and exits 1 if any does; else it writes them */
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--check')) {
  const stale = Object.entries(out).filter(([name, text]) => readFileSync(join(parts, name), 'utf8') !== text).map(([name]) => name);
  if (stale.length) { console.log('stale:', stale.join(', ')); process.exit(1); }
  console.log('stills match the figures');
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [name, text] of Object.entries(out)) {
    writeFileSync(join(parts, name), text);
    console.log(name, (text.length / 1024).toFixed(1) + 'K');
  }
}
