/* Writes the home emblem's static drawing, which sync.mjs inlines into the
   home page (<!-- nts:emblem core|orbits -->). Run from anywhere:
     node tools/gen-emblem.mjs
   site/_nts/parts/emblem-core.html, back to front: the seven-point star the
   stop draws in, the dotted ring, the dial, the keylines and colour bands,
   the sunburst, the ticking marks with the north, the pyramids, the eye's
   button and its beams. site/_nts/parts/emblem-orbits.html: the four orbits
   with their star dots, after the beads so the tab order runs eye, beads,
   stars.
   Units: the emblem is a 202 x 202 box centred on 0, the disc r 50; HTML
   parts sit in cqi of the box (100 / 202 a unit). Inks that change with the
   ground are currentColor on a k-* class (orrery.css sets them per ground);
   fixed inks are written in. Every layer that turns is a whole SVG or box,
   so the compositor turns it; nothing here is drawn per frame. */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const parts = join(here, '..', 'site', '_nts', 'parts');

/* the palette's tokens (nts.css, section 1); SVG attributes cannot read
   var(), so ink() moves every token ink into a style attribute */
const C = { ink: 'var(--pal-ink)', red: 'var(--code-embers)', sky: 'var(--pal-sky)', ochre: 'var(--code-events)', grey: 'var(--code-philo)', phos: 'var(--code-intersect)', green: 'var(--pal-reserve)', etch: 'var(--pal-etch)' };
const K = { e: C.red, p: C.grey, i: C.phos, s: C.ochre, g: C.green };
const f = (n) => +n.toFixed(2);
/* a number written short: two decimals, no leading zero (the star's strokes are most of the page's bytes) */
const sh = (n) => String(f(n)).replace(/^(-?)0\./, '$1.');
const pt = (r, deg, off = 0) => { const a = ((deg - 90) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [f(r * c - s * off), f(r * s + c * off)]; };
const quad = (r0, w0, r1, w1, deg) => 'M' + [pt(r0, deg, -w0 / 2), pt(r1, deg, -w1 / 2), pt(r1, deg, w1 / 2), pt(r0, deg, w0 / 2)].map((q) => q.join(' ')).join('L') + 'Z';
const poly = (pts) => 'M' + pts.map((p) => p.join(' ')).join('L') + 'Z';
const U = 100 / 202, cq = (x) => f(x * U) + 'cqi';
const svg = (cls, inner) => `<svg class="${('e-ly ' + cls).trim()}" viewBox="-101 -101 202 202" aria-hidden="true" focusable="false">${inner}</svg>`;

/* line weights, three tiers: KEYW for keylines (band keys, the north), FINE
   for drawn objects (the pyramid's outline, the eye's border, the star dots'
   borders: the live tetrahedron's ratio, 2 on 108), HAIR for hairlines */
const KEYW = 0.9, FINE = 0.45, HAIR = 0.45;
/* the pyramid's outline edge in the other ink, unseen at rest, which holds
   the outline against the grey while the dial fades */
const EDGE = 0.2;

/* marks as thin filled quads, so a whole scale is one path: [r0, r1, width, keep] */
const marksD = (n, specs) => {
  let d = '';
  for (let i = 0; i < n; i++) { const s = specs.find(([, , , keep]) => keep(i)); if (s) d += quad(s[0], s[2], s[1], s[2], (i * 360) / n); }
  return d;
};
const minor = (i) => i % 5 !== 0, major = (i) => i % 5 === 0;

/* the dial's 60 marks, longer every 5 and every 15; mark 0 is the north, a
   layer of its own that stays when the marks fade with the dial */
const dialMarks = `<path class="k-run" fill="currentColor" d="${marksD(60, [[31.4, 34.4, HAIR, minor], [29.9, 34.4, 0.6, (i) => i % 15 !== 0 && i % 5 === 0], [28.4, 34.4, 0.8, (i) => i && i % 15 === 0]])}"/>`;
const north = `<path d="${quad(27, 1, 35.3, 3, 0)}" fill="${C.ochre}" stroke="${C.ink}" stroke-width="${KEYW}" stroke-linejoin="round"/>`;
/* the bezel: 60 marks just outside the disc, carried round with the bands */
const bezel = `<path class="k-dot" fill="currentColor" d="${marksD(60, [[50.6, 52.4, 0.7, major], [50.6, 51.9, HAIR, minor]])}"/>`;
/* the dotted ring, clear of the bezel: 132 whole dots, so the dashes close without a seam */
const ring = `<circle class="k-dot" r="55" fill="none" stroke="currentColor" stroke-width="1.5" pathLength="132" stroke-dasharray=".004 .996" stroke-linecap="round"/>`;

/* the bands and their keylines: an ink ring from the dial's edge (r 35) to
   the rim (r 50), the three bands on it, so every keyline is KEYW wide */
const DIAL_R = 35, RIM_R = 50, BAND = (RIM_R - DIAL_R - 4 * KEYW) / 3;
const dial = `<circle class="k-dial" r="${DIAL_R + 0.45}" fill="currentColor"/>`;
const keyRing = `<circle r="${(DIAL_R + RIM_R) / 2}" fill="none" stroke="${C.ink}" stroke-width="${RIM_R - DIAL_R}"/>`;
const bands = [C.sky, C.ochre, C.red].map((c, i) => `<circle r="${f(DIAL_R + KEYW + BAND / 2 + i * (BAND + KEYW))}" fill="none" stroke="${c}" stroke-width="${f(BAND)}"/>`).join('');

/* the sunburst: 72 faint rays in three lengths, the longest every 30
   degrees, inside r 23; its strength is set per dial (orrery.css) */
const raysD = () => {
  let d = '';
  for (let i = 0; i < 72; i++) {
    const [r0, r1] = i % 6 === 0 ? [8, 23] : i % 2 === 0 ? [12, 20.5] : [14, 18.5];
    const [x0, y0] = pt(r0, i * 5), [x1, y1] = pt(r1, i * 5);
    d += `M${x0} ${y0}L${x1} ${y1}`;
  }
  return d;
};
const geo = `<path class="e-rays" d="${raysD()}" fill="none" stroke="${C.etch}" stroke-width=".32"/>`;

/* the pyramid, drawn like the live tetrahedron: three flat faces meeting at
   the eye (phosphor lit, red, and a shadow of the Philo grey below), one
   fine outline. One copy per ink so the two hand over at the fade's
   midpoint; under the faces, an edge in the other ink. Reduced motion uses
   a third, drawn upside down, instead of turning. */
const TET = { apex: [0, -16.6], l: [-13.46, 8.42], r: [13.46, 8.42] }, TET_SHADE = 'var(--pal-shade)';
const face = (pts, c) => `<path d="${poly(pts)}" fill="${c}" stroke="${c}" stroke-width=".25" stroke-linejoin="round"/>`;
const pyramid = (ink, other, down) => {
  const rim = poly([TET.apex, TET.r, TET.l]);
  return `<g${down ? ' transform="rotate(180)"' : ''}><path class="k-${other}" d="${rim}" fill="none" stroke="currentColor" stroke-width="${f(FINE + 2 * EDGE)}" stroke-linejoin="round"/>`
    + face([TET.l, TET.r, [0, 0]], TET_SHADE) + face([TET.apex, TET.r, [0, 0]], K.e) + face([TET.apex, TET.l, [0, 0]], K.i)
    + `<path class="k-${ink}" d="${rim}" fill="none" stroke="currentColor" stroke-width="${FINE}" stroke-linejoin="round"/>`
    + `<circle class="eye" r="2.1" stroke="${C.ink}" stroke-width="${FINE}"/></g>`;
};
/* the eye's fill is set in orrery.css, which lights it on hover and focus.
   The eye's beam: a ring the CSS scales from the pyramid's incircle out past
   its outline, in the ink of what is behind it (the dial's, or the page's
   once stopped) */
const beam = (ink) => `<div class="e-bm ${ink}" aria-hidden="true"><span class="e-beam"><svg viewBox="-10 -10 20 20" focusable="false"><circle class="k-${ink}" r="9.8" fill="none" stroke="currentColor" stroke-width=".45"/></svg></span></div>`;

/* the star on stop: the society's {7/3} star, one point at north, points at
   r 90, behind the whole emblem. Drawn by hand in chalk: each edge a few
   strokes jittered once from a seeded random (the same on every build),
   uneven widths, opacities and breaks, no filter. A pass: [offset across the
   line, jitter, step, width, opacity, dashes [run] [gap], cap]; steps
   and passes are the fewest that keep the chalk; OV runs each edge past its points. Each
   edge is a box laid along its line; it draws in with a window that slides
   along it (.win) while the drawing slides back (.pen): two transforms, so
   the textured line is rasterised once. Each edge's slice of the pen's
   curve is set inline (--il, --id in; --ol, --od out). */
const STAR_R = 90, OV = 1.8, EH = 4;
const CHALK = [
  [0, 0.25, 6, 0.55, 0.5, [[1.5, 7], [0.08, 0.35]], 'butt'], [0.18, 0.3, 5, 0.35, 0.45, [[0.5, 4], [0.1, 0.6]], 'butt'],
  [-0.2, 0.3, 5, 0.3, 0.4, [[0.3, 2.5], [0.15, 0.8]], 'round']];
/* stroke opacity: the pass's, times the star's .85, times 1.15 (its lift on
   the black, where a broken line loses more); the plywood takes the 1.15
   back with --e-star-op */
const STAR_OP = 0.85 * 1.15;
const rand = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/* the line as relative steps: one start point, then each step's rise */
const wobble = (rnd, x0, x1, dy, amp, step) => {
  const n = Math.max(2, Math.round((x1 - x0) / step)), dx = sh((x1 - x0) / n); let y = 0, py = 0, d = '';
  for (let i = 0; i <= n; i++) {
    y = y * 0.55 + (rnd() - 0.5) * amp;
    const yy = f(dy + y);
    if (!i) d = `M${sh(x0)} ${sh(yy)}`; else { const r = sh(yy - py); d += `l${dx}${r.startsWith('-') ? '' : ' '}${r}`; }
    py = yy;
  }
  return d;
};
const dashes = (rnd, len, [a0, a1], [g0, g1]) => { const out = []; let t = 0; while (t < len) { const a = a0 + rnd() * (a1 - a0), g = g0 + rnd() * (g1 - g0); out.push(sh(a), sh(g)); t += a + g; } return out.join(' '); };
/* the pen's timing: in over 1.3 s from .3 s on (.3, .1, .2, 1), out over
   1.3 s from 0 (.8, 0, .7, .9), last edge first; each edge its own slice */
const bezier = (x1, y1, x2, y2) => (x) => {
  let lo = 0, hi = 1, t = 0.5;
  for (let k = 0; k < 40; k++) { t = (lo + hi) / 2; const xt = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t; if (xt < x) lo = t; else hi = t; }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
};
const timeAt = (curve, y) => { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (curve(m) < y) lo = m; else hi = m; } return (lo + hi) / 2; };
const PEN_IN = bezier(0.3, 0.1, 0.2, 1), PEN_OUT = bezier(0.8, 0, 0.7, 0.9), PEN = 1.3, PEN_AT = 0.3;
const starEdges = () => {
  /* the seed that gives the approved Chalk */
  const si = 0, V = Array.from({ length: 8 }, (_, i) => pt(STAR_R, (((i * 3) % 7) * 360) / 7)), L = 2 * STAR_R * Math.sin((3 * Math.PI) / 7);
  return Array.from({ length: 7 }, (_, i) => {
    const [x0, y0] = V[i], [x1, y1] = V[i + 1], th = f((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI), rnd = rand(97 * si + 13 * i + 5);
    const a = timeAt(PEN_IN, i / 7), b = timeAt(PEN_IN, (i + 1) / 7), c = timeAt(PEN_OUT, 1 - (i + 1) / 7), d = timeAt(PEN_OUT, 1 - i / 7);
    /* the dashes are drawn from the seed before the line: that order gives the approved Chalk */
    const strokes = CHALK.map(([dy, amp, step, w, op, dash, cap]) => {
      const da = `stroke-dasharray="${dashes(rnd, L + 2 * OV, ...dash)}" stroke-dashoffset="${sh(rnd() * 10)}"`;
      return `<path d="${wobble(rnd, -OV, L + OV, dy, amp, step)}" stroke-opacity="${f(Math.min(1, op * STAR_OP))}" stroke-width="${w}" stroke-linecap="${cap}" ${da}/>`;
    }).join('');
    return `<div class="he" style="left:${cq(101 + x0 - OV)};top:${cq(101 + y0 - EH / 2)};width:${cq(L + 2 * OV)};height:${cq(EH)};transform-origin:${cq(OV)} 50%;transform:rotate(${th}deg);`
      + `--il:${f(PEN_AT + PEN * a)}s;--id:${f(PEN * (b - a))}s;--ol:${f(PEN * c)}s;--od:${f(PEN * (d - c))}s">`
      + `<div class="win"><div class="pen"><svg viewBox="${f(-OV)} ${-EH / 2} ${f(L + 2 * OV)} ${EH}" fill="none" stroke="${C.etch}" stroke-linejoin="round" focusable="false">${strokes}</svg></div></div></div>`;
  }).join('\n');
};

/* the orbits, each turned whole with its star dots on it: [class, r, stroke] */
const ORBITS = [
  ['e-o66', 66, 'class="k-orbit" stroke="currentColor" stroke-opacity=".5" stroke-width=".55"'],
  ['e-o78', 78.4, 'class="k-orbit" stroke="currentColor" stroke-opacity=".7" stroke-width=".6" stroke-dasharray=".4 1.4"'],
  ['e-o84', 84, 'class="k-orbit" stroke="currentColor" stroke-opacity=".6" stroke-width=".8" stroke-dasharray=".1 1.6"'],
  ['e-o96', 96.4, `stroke="${C.red}" stroke-opacity=".55" stroke-width=".55" stroke-dasharray="18 3.6 1.8 3.6"`]];
/* the stars: the code dots, quiet marks that go nowhere until their pages
   exist. [orbit r, code, start angle] */
const STARS = [
  [66, 'e', 45], [66, 'e', 160], [66, 'e', 290],
  [78.4, 'p', 110], [78.4, 'p', 235],
  [84, 'i', 25], [84, 'i', 255],
  [96.4, 's', 70], [96.4, 's', 190], [96.4, 'g', 320]];
/* the one star that pulses, now and then */
const PULSE = 7;
/* hit radius per orbit: r 14 (about 43 px on a phone) on the inner and
   outer orbits; the two middle orbits sit 5.6 apart, so theirs stay r 11 */
const HIT = { 66: 14, 78.4: 11, 84: 11, 96.4: 14 };
const star = ([r, k, deg], i) =>
  `<span class="e-pv" style="transform:rotate(${deg}deg)"><span class="st" aria-hidden="true" data-orbit="${r}" data-code="${k}" style="top:${f(-4.703 - r / 2.02)}cqi">`
  + `<svg viewBox="-9.5 -9.5 19 19" aria-hidden="true" focusable="false"><circle class="hit" r="${HIT[r]}" fill="transparent"/><circle class="halo k-halo" r="4.6" fill="none" stroke="currentColor" stroke-width=".6"/>`
  + `<circle r="2.3" fill="${K[k]}" stroke="${C.ink}" stroke-width="${FINE}"/></svg>${i === PULSE ? '<span class="e-pulse" aria-hidden="true"></span>' : ''}</span></span>`;

const core = [
  `<div class="e-star" aria-hidden="true">\n${starEdges()}\n</div>`,
  svg('e-ring', ring),
  svg('e-dial', dial),
  svg('e-key', keyRing),
  svg('e-bands', bezel + bands),
  svg('e-geo e-fade', geo),
  `<div class="e-tick">${svg('e-marks e-fade', dialMarks)}${svg('e-north', north)}</div>`,
  svg('e-tet run up', pyramid('run', 'stop', false)) + svg('e-tet stop', pyramid('stop', 'run', false)) + svg('e-tet down', pyramid('stop', 'run', true)),
  `<button class="e-stop" type="button" aria-pressed="false" aria-label="Stop the machine"></button>${beam('run')}${beam('stop')}`,
].join('\n');

const orbits = ORBITS.map(([cls, r, st]) =>
  `<div class="e-orbit ${cls}">${svg('', `<circle r="${r}" fill="none" ${st}/>`)}\n${STARS.map((s, i) => [s, i]).filter(([s]) => s[0] === r).map(([s, i]) => star(s, i)).join('\n')}\n</div>`).join('\n');

const ink = (html) => html.replace(/<[a-z][^>]*>/g, (tag) => {
  const decl = [];
  tag = tag.replace(/\s(fill|stroke)="(var\([^)]+\))"/g, (m, k, v) => { decl.push(`${k}:${v}`); return ''; });
  if (!decl.length) return tag;
  return /\sstyle="/.test(tag) ? tag.replace(/\sstyle="/, ` style="${decl.join(';')};`) : tag.replace(/\/?>$/, (end) => ` style="${decl.join(';')}"${end}`);
});
writeFileSync(join(parts, 'emblem-core.html'), ink(core) + '\n');
writeFileSync(join(parts, 'emblem-orbits.html'), ink(orbits) + '\n');
console.log('wrote parts/emblem-core.html, parts/emblem-orbits.html');
