/* Writes site/_nts/sigils.svg, the sigil sprite. Run from anywhere:
     node tools/gen-sigils.mjs
   Every sigil is line art on a 64 x 64 box in currentColor, stroke 2.4, and
   every stroked path carries pathLength="1" so the draw-in behaviour can
   animate it with one dash rule. The geometry is computed here so the seven
   points of the heptagram and the impossible triangle stay exact. */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'site', '_nts', 'sigils.svg');
const C = 32, f = (n) => (Math.round(n * 100) / 100).toString();
const pt = (r, deg) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
const poly = (pts, close = true) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + (close ? 'Z' : '');
const P = (d, extra = '') => `<path pathLength="1" d="${d}"${extra}/>`;
const DOT = (x, y, r = 2.6) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="currentColor" stroke="none"/>`;

/* NTS: a ring, the heptagram {7/3} (seven points for seven days, Tuesday
   among them), and a point at the centre. */
function nts() {
  const V = Array.from({ length: 7 }, (_, i) => pt(23, -90 + (i * 360) / 7));
  const star = [];
  for (let i = 0, k = 0; i < 7; i++, k = (k + 3) % 7) star.push(V[k]);
  return `<circle pathLength="1" cx="${C}" cy="${C}" r="28.5"/>` + P(poly(star)) + DOT(C, C, 2.2);
}

/* EMBERS: the alchemical sign of fire, a triangle, with three lines of heat
   rippling through it. The lines are the hearth's own scan lines. */
function embers() {
  const top = 7.5, base = 55, half = 26.5;
  const tri = poly([[C, top], [C + half, base], [C - half, base]]);
  let waves = '';
  for (const y of [29, 38, 47]) {
    const hw = ((y - top) / (base - top)) * half - 2.2;
    const x0 = C - hw, x1 = C + hw, n = 3, seg = (x1 - x0) / n, a = 2.1;
    let d = `M${f(x0)} ${f(y)}`;
    for (let i = 0; i < n; i++) {
      const xa = x0 + seg * i;
      d += `Q${f(xa + seg * 0.25)} ${f(y - a)} ${f(xa + seg * 0.5)} ${f(y)}Q${f(xa + seg * 0.75)} ${f(y + a)} ${f(xa + seg)} ${f(y)}`;
    }
    waves += P(d);
  }
  return P(tri, ' stroke-linejoin="round"') + waves;
}

/* NOT NOT PHILO: the impossible triangle as three chevrons, each one
   ending where the next begins and nowhere else. Side s, band h. */
function philo() {
  const s = 46, h = 7.4, R = s / Math.sqrt(3);
  const V = [pt(R, -90), pt(R, 30), pt(R, 150)];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1]];
  const unit = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
  let d = '';
  for (let k = 0; k < 3; k++) {
    const a = V[k], b = V[(k + 1) % 3], c = V[(k + 2) % 3];
    const dk = unit(sub(b, a)), dn = unit(sub(c, b));
    // inward normal of side k: towards c
    const mid = add(a, dk, s / 2), nk = unit(sub(c, mid));
    const p2 = add(b, dn, 1.1547 * h);               // cap on the next side
    const p3 = add(add(a, nk, h), dk, 1.732 * h);    // meets the previous chevron
    d += poly([a, b, p2, p3], false);
  }
  return P(d, ' stroke-linejoin="round" stroke-linecap="round"');
}

/* INTERSECT: a crossroads inside a ring of ticks, with the assembly, a
   small square, where the roads meet. */
function intersect() {
  // Four arcs of a ring, broken where the roads pass through it.
  const R = 27, gap = 11;
  let ring = '';
  for (const a of [45, 135, 225, 315]) {
    const [x0, y0] = pt(R, a + gap), [x1, y1] = pt(R, a + 90 - gap);
    ring += `M${f(x0)} ${f(y0)}A${R} ${R} 0 0 1 ${f(x1)} ${f(y1)}`;
  }
  const q = 5.2, r = 31;
  const roads = [45, 135, 225, 315].map((a) => `M${f(C + q * 1.35 * Math.cos((a * Math.PI) / 180))} ${f(C + q * 1.35 * Math.sin((a * Math.PI) / 180))}L${f(pt(r, a)[0])} ${f(pt(r, a)[1])}`).join('');
  const sq = poly([[C - q, C - q], [C + q, C - q], [C + q, C + q], [C - q, C + q]]);
  return P(ring) + P(roads, ' stroke-linecap="round"') + P(sq, ' stroke-linejoin="round"');
}

/* The four-point star, Ome's ✴︎ mark, for events and dividers. */
function star() {
  const o = 26, i = 4.6;
  const pts = [];
  for (let k = 0; k < 8; k++) pts.push(pt(k % 2 ? i : o, -90 + k * 45));
  return P(poly(pts), ' stroke-linejoin="round"');
}

/* Tuesdays: the gathering, seven at a table. */
function gathering() {
  let dots = '';
  for (let i = 0; i < 7; i++) { const [x, y] = pt(23, -90 + (i * 360) / 7); dots += DOT(x, y, 2.4); }
  return `<circle pathLength="1" cx="${C}" cy="${C}" r="23"/>` + dots + `<circle pathLength="1" cx="${C}" cy="${C}" r="7"/>`;
}

const symbols = { nts: nts(), embers: embers(), philo: philo(), intersect: intersect(), star: star(), gathering: gathering() };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" class="nts-sprite" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">\n`;
for (const [id, body] of Object.entries(symbols)) {
  svg += `<symbol id="sigil-${id}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4">${body}</symbol>\n`;
}
svg += '</svg>\n';
writeFileSync(out, svg);
console.log('wrote', out, (svg.length / 1024).toFixed(1) + 'K');
