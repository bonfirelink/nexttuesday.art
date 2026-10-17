/* Fills the shared regions of every page from the content source, so the
   pages cannot drift from it or from each other. Run from anywhere, after
   any edit:
     node tools/sync.mjs                        every site/**\/*.html that has a region
     node tools/sync.mjs site/embers/index.html  one page (or one folder)
     node tools/sync.mjs --check                exit 1 if anything would change (CI, pre-commit)
   Pages are static HTML; this script rewrites only what sits between
   markers and leaves everything else byte for byte.

   Regions (open and close markers; the content between them is replaced):
     <!-- nts:sprite -->…<!-- /nts:sprite -->        the sigil sprite
     <!-- nts:header -->…<!-- /nts:header -->        the header; aria-current from the file's place
     <!-- nts:footer -->…<!-- /nts:footer -->        the footer
     <!-- nts:emblem core|orbits -->…<!-- /nts:emblem --> the home emblem (tools/gen-emblem.mjs)
     <!-- nts:events -->…<!-- /nts:events -->        the ledger, upcoming then past
     <!-- nts:events upcoming -->, <!-- nts:events past -->, <!-- nts:events world=embers -->,
     <!-- nts:events upcoming limit=3 heading=none -->  subsets (same close marker; heading=h2|h3|none)
     <!-- nts:still embers|philo|intersect -->…<!-- /nts:still -->  a still frame
   A fragment takes the still named <world>-sm when there is one (philo-sm), else <world>.
   Attributes:
     data-nts-copy="key"      the element's inner HTML becomes copy.json[key]
     data-nts-xi              with data-nts-copy: each E of the copy is wrapped in
                              <span class="xi">E</span> (the EMBERS wordmark's Ξ)
     data-nts-fragment="w"    the element's inner HTML becomes the world's still
     <script src="/_nts/nts-head.js">  carries data-bleed="scroll" on the page
                              of an initiative marked bleed, nothing elsewhere
   Links inside generated markup are root-relative (/embers/, /events/…); the
   page a file is (home, or the folder it sits in) marks the nav's current link.

   The initiatives' wiring in the shared CSS and JS (site/_nts/**) comes from
   site.json's `initiatives`, the one list of them, between two comments each
   alone on its line, `nts:<name>` and `/nts:<name>` (the indent of the first
   is kept):
     nts:worlds   nts-head.js: BODY (page to the home's body) and PATHS
     nts:orbits   orrery.css: each body's start angle, period, direction
     nts:riders   orrery.css: each body on its orbit (r of the emblem's 202)
     nts:faces    orrery.css: a world's bead face and sigil tokens
     nts:sigils   nts.css: a world's sigil colour
     nts:kinds    nts.css: a world's ledger tag
     nts:dots     apertures.css: a world's code dot on the black ledger
   Each region sits once, in its file only; an unknown, misplaced, unclosed or
   missing region, or an entry missing a field it needs, is an error (exit 1),
   with or without --check. The list above is kept in step with REGIONS below,
   with the table in INTERNALS.md and with the files by S2 in
   tests/static/sync.spec.mjs.
   NTS_SYNC_ROOT=<dir> syncs another tree with a site/ in it instead of this
   repo's (a broken copy, in the tests). */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.NTS_SYNC_ROOT || join(here, '..');
const site = join(root, 'site');
const nts = join(site, '_nts');
const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const SITE = json(join(nts, 'content', 'site.json'));
const EVENTS = json(join(nts, 'content', 'events.json'));
const COPY = json(join(nts, 'content', 'copy.json'));
const SPRITE = read(join(nts, 'sigils.svg')).trim();
const EMBLEM = { core: read(join(nts, 'parts', 'emblem-core.html')).trim(), orbits: read(join(nts, 'parts', 'emblem-orbits.html')).trim() };
const STILLS = {
  embers: read(join(nts, 'parts', 'still-embers.svg')).trim(),
  philo: read(join(nts, 'parts', 'still-philo.svg')).trim(),
  'philo-sm': read(join(nts, 'parts', 'still-philo-sm.svg')).trim(),
  // the parser drops a newline right after <pre>: this one, not the still's blank first row
  intersect: `<pre aria-hidden="true">\n${esc(read(join(nts, 'parts', 'still-intersect-sm.txt')))}</pre>`,
  'intersect-lg': esc(read(join(nts, 'parts', 'still-intersect.txt'))),
};

/* The initiatives, in order (nav, footer, orbits). An entry whose world is
   "nts" is an NTS page (events): no kit, its sigil named by `sigil`. WORLD
   maps a world key to what the ledger and footer need. */
const fail = (msg) => { console.error(`sync: ${msg}`); process.exit(1); };
const at = (o, k) => k.split('.').reduce((v, p) => (v == null ? v : v[p]), o);
const INITIATIVES = Array.isArray(SITE.initiatives) ? SITE.initiatives : fail('site.json has no `initiatives` list');
const NEEDS = ['slug', 'world', 'name', 'body', 'orbit.r', 'orbit.a', 'orbit.p', 'orbit.d'];
const WORLD_NEEDS = ['colours.sigil', 'colours.face.base', 'colours.face.sigil', 'colours.kind.bg', 'colours.kind.fg'];
INITIATIVES.forEach((i, n) => {
  for (const k of [...NEEDS, ...(i.world === 'nts' ? [] : WORLD_NEEDS)]) if (at(i, k) === undefined) fail(`site.json initiatives[${n}] (${i.slug ?? 'no slug'}): missing ${k}`);
});
const WORLDS = INITIATIVES.filter((i) => i.world !== 'nts');
const WORLD = Object.fromEntries([['nts', SITE.nts], ...WORLDS.map((i) => [i.world, { name: i.name, sigil: i.world }])]);
const token = (v) => (v.startsWith('--') ? `var(${v})` : v);
// each code region: the file under _nts it lives in, and its lines
const REGIONS = {
  worlds: ['nts-head.js', () => [
    `var BODY = { ${INITIATIVES.map((i) => `"${i.slug}": "${i.body}"`).join(', ')} };`,
    `var PATHS = /\\/(${INITIATIVES.map((i) => i.slug).join('|')})\\/(index\\.html)?$/;`]],
  orbits: ['orrery.css', () => INITIATIVES.map(({ body: b, orbit: o }) => `--a-${b}: ${o.a}; --p-${b}: ${o.p}; --d-${b}: ${o.d};`)],
  riders: ['orrery.css', () => INITIATIVES.map(({ body: b, orbit: o }) => `.orrery .o-${b} { --r: ${(o.r * 100 / 202).toFixed(2)}cqi; --a: var(--a-${b}); --p: var(--p-${b}); --d: var(--d-${b}); }`)],
  faces: ['orrery.css', () => WORLDS.map(({ world: w, colours: { face: f } }) => `.bead-face[data-of="${w}"] { --of-base: ${token(f.base)}; --of-sigil: ${token(f.sigil)}; }`)],
  sigils: ['nts.css', () => WORLDS.map(({ world: w, colours: c }) => `.sigil-${w} { color: ${token(c.sigil)}; }`)],
  kinds: ['nts.css', () => WORLDS.map(({ world: w, colours: { kind: k } }) => `.ledger li[data-of="${w}"] { --kind-bg: ${token(k.bg)}; --kind-fg: ${token(k.fg)}; }`)],
  dots: ['apertures.css', () => WORLDS.map(({ world: w }) => `.ledger-ap li[data-of="${w}"] { --kind-dot: var(--code-${w}); }`)],
};

// Checks the file's markers (known, in their file, each opened once and
// closed before the next), then fills each region. Returns the names filled.
function syncCode(file) {
  const rel = relative(nts, file).split(sep).join('/');
  const before = read(file);
  const opened = [];
  let open = null;
  for (const [, close, name] of before.matchAll(/\/\* (\/?)nts:([a-z0-9-]+) \*\//g)) {
    if (!REGIONS[name]) fail(`${rel}: unknown region nts:${name} (known: ${Object.keys(REGIONS).join(', ')})`);
    if (REGIONS[name][0] !== rel) fail(`nts:${name} belongs in ${REGIONS[name][0]}, found in ${rel}`);
    if (close) { if (open !== name) fail(`${rel}: /nts:${name} closes no open nts:${name}`); open = null; }
    else { if (open) fail(`${rel}: nts:${open} has no close before nts:${name}`); if (opened.includes(name)) fail(`${rel}: nts:${name} appears twice`); open = name; opened.push(name); }
  }
  if (open) fail(`${rel}: nts:${open} has no close`);
  const filled = [];
  const after = before.replace(/^([ \t]*)\/\* nts:([a-z0-9-]+) \*\/\n[\s\S]*?^[ \t]*\/\* \/nts:\2 \*\/$/gm, (m, ind, name) => {
    filled.push(name);
    return [`/* nts:${name} */`, ...REGIONS[name][1](), `/* /nts:${name} */`].map((l) => ind + l).join('\n');
  });
  for (const name of opened) if (!filled.includes(name)) fail(`${rel}: nts:${name}: each marker must stand alone on its line`);
  return { before, after, rel, filled };
}

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const sigil = (name, cls = '') => `<svg class="nts-sigil sigil-${name}${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#sigil-${name}"/></svg>`;

function header(prefix, page) {
  const items = INITIATIVES.map((n) => {
    const cur = page === n.slug ? ' aria-current="page"' : '';
    return `<li><a href="${prefix}${n.slug}/"${cur}><span>${n.name}</span></a></li>`;
  }).join('');
  const home = page === 'home' ? ' aria-current="page"' : '';
  return `<header class="nts-header"><div class="wrap bar">
<a class="nts-home" href="${prefix}"${home} aria-label="${SITE.name}, home">${sigil('nts')}<span class="wordmark">${SITE.name}</span></a>
<nav aria-label="Site"><ul class="nts-nav">${items}</ul></nav>
</div></header>`;
}

function footer(prefix) {
  const worlds = INITIATIVES.map((i) => `<li><a href="${prefix}${i.slug}/">${sigil(i.sigil || i.world)}<span>${i.name}</span></a></li>`).join('');
  return `<footer class="nts-footer"><div class="wrap">
<div class="cols">
<div><h2>${SITE.name}</h2><p>${SITE.footer.about}</p><p>${SITE.footer.write}</p></div>
<div><p class="label">Write to us</p><ul><li><a href="mailto:${SITE.email}">${SITE.email}</a></li><li><a href="${SITE.instagram_url}">Instagram · ${SITE.instagram}</a></li><li><a href="${SITE.embers_instagram_url}">EMBERS · ${SITE.embers_instagram}</a></li></ul></div>
<div><p class="label">The initiatives</p><ul class="worlds">${worlds}</ul></div>
</div>
<div class="sign"><p class="small">${SITE.footer.colophon}</p><p class="signoff"><span class="emoji" aria-hidden="true">${SITE.signoff_emoji}</span>${SITE.signoff}</p></div>
</div></footer>`;
}

function ledger(prefix, opts) {
  let list = EVENTS.slice();
  if (opts.world) list = list.filter((e) => e.world === opts.world);
  const groups = [];
  if (!opts.status || opts.status === 'upcoming') groups.push(['upcoming', opts.labels?.upcoming || COPY['events.upcoming']]);
  if (!opts.status || opts.status === 'past') groups.push(['past', opts.labels?.past || COPY['events.past']]);
  const H = opts.heading || 'h2';
  let out = '';
  for (const [status, label] of groups) {
    let items = list.filter((e) => e.status === status);
    if (status === 'past') items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (opts.limit) items = items.slice(0, opts.limit);
    if (!items.length) continue;
    const lis = items.map((e) => {
      const kind = `<span class="kind">${e.kind}</span>`;
      const title = e.link ? `<a href="${prefix}${e.link}">${esc(e.title)}</a>` : esc(e.title);
      const where = e.place ? `<p class="where">${esc(e.place)}</p>` : '';
      return `<li class="${status}" data-of="${e.world}" id="ev-${e.id}">${sigil(WORLD[e.world].sigil)}<p class="when">${esc(e.display_date)}</p><p class="what">${title}${kind}</p>${where}<p class="line">${esc(e.line)}</p></li>`;
    }).join('\n');
    const head = H === 'none' ? '' : `<${H}>${esc(label)}</${H}>`;
    out += `<section class="ledger-group" id="${status}" aria-label="${esc(label)}">${head}<ul class="ledger">\n${lis}\n</ul></section>\n`;
  }
  return out.trim();
}

function parseOpts(s) {
  const o = {};
  for (const tok of s.trim().split(/\s+/).filter(Boolean)) {
    if (tok === 'upcoming' || tok === 'past') o.status = tok;
    else if (tok.includes('=')) { const [k, v] = tok.split('='); o[k] = isNaN(+v) ? v : +v; }
  }
  return o;
}

function region(html, name, fill) {
  const re = new RegExp(`(<!-- nts:${name}((?:[ \\t][^>]*?)?) -->)([\\s\\S]*?)(<!-- /nts:${name} -->)`, 'g');
  return html.replace(re, (m, open, args, body, close) => `${open}\n${fill(args || '')}\n${close}`);
}

function replaceInner(html, attr, resolve) {
  // Replaces the inner HTML of every element carrying attr="value", with
  // the close tag found by counting nested tags of the same name.
  const open = new RegExp(`<([a-zA-Z0-9]+)(\\s[^>]*?\\s?${attr}="([^"]+)"[^>]*)>`, 'g');
  let out = '', last = 0, m;
  while ((m = open.exec(html))) {
    const [tagStr, tag, attrs, value] = m;
    const start = m.index + tagStr.length;
    const step = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'g');
    step.lastIndex = start;
    let depth = 1, close = -1, c;
    while ((c = step.exec(html))) {
      if (c[0].endsWith('/>')) continue;
      depth += c[1] ? -1 : 1;
      if (depth === 0) { close = c.index; break; }
    }
    if (close < 0) continue;
    const v = resolve(value, tag, attrs);
    out += html.slice(last, start);
    if (v === undefined) { console.warn(`  no value for ${attr}="${value}"`); out += html.slice(start, close); }
    else out += v;
    last = close;
    open.lastIndex = close;
  }
  return out + html.slice(last);
}

function sync(file) {
  const rel = relative(site, file).split(sep);
  const prefix = '/';
  const page = rel.length >= 2 ? rel[rel.length - 2] : 'home';
  const before = read(file);
  let html = before;
  html = region(html, 'sprite', () => SPRITE);
  html = region(html, 'header', () => header(prefix, page));
  html = region(html, 'footer', () => footer(prefix));
  html = region(html, 'emblem', (args) => EMBLEM[args.trim()] || '');
  html = region(html, 'events', (args) => ledger(prefix, parseOpts(args)));
  html = region(html, 'still', (args) => STILLS[args.trim()] || '');
  html = replaceInner(html, 'data-nts-copy', (k, tag, attrs) => {
    let v = COPY[k];
    if (v === undefined) return undefined;
    // the wordmark's Es are drawn as Ξ by .xi (Archivo has no Greek); the copy stays plain text,
    // with no markup, since every E in it is wrapped
    if (/\sdata-nts-xi(?=[\s=>]|$)/.test(attrs)) v = v.replace(/E/g, '<span class="xi">E</span>');
    return tag === 'title' ? v.replace(/<[^>]+>/g, '') : v;
  });
  html = replaceInner(html, 'data-nts-fragment', (w) => {
    // a fragment's still may be baked at its own zoom: <world>-sm. INTERSECT's plain key is
    // already its fragment still (its page still is intersect-lg), so it has no -sm.
    const still = STILLS[`${w}-sm`] ?? STILLS[w];
    return still === undefined ? undefined : `<div class="still">${still}</div>`;
  });
  // only a top-level page (site/<slug>/index.html) can be an initiative's
  const own = rel.length === 2 && INITIATIVES.find((i) => i.slug === rel[0]);
  html = html.replace(/<script src="\/_nts\/nts-head\.js"(?: data-bleed="[^"]*")?><\/script>/, `<script src="/_nts/nts-head.js"${own && own.bleed ? ' data-bleed="scroll"' : ''}></script>`);
  // meta content from copy: <meta ... data-nts-copy="key" content="...">
  html = html.replace(/<meta([^>]*?)\sdata-nts-copy="([^"]+)"([^>]*?)\scontent="[^"]*"([^>]*)>/g, (m, a, k, b, c) => {
    const v = COPY[k];
    if (v === undefined) { console.warn(`  no value for meta ${k}`); return m; }
    return `<meta${a} data-nts-copy="${k}"${b} content="${v.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;')}"${c}>`;
  });
  return { before, after: html };
}

// pages: every .html outside _nts; code: every .css and .js inside it
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    const inNts = p.startsWith(nts + sep);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (inNts ? /\.(css|js)$/.test(name) : name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const targets = args.filter((a) => !a.startsWith('--'));
const files = targets.length ? targets.flatMap((t) => { const p = join(root, t); return statSync(p).isDirectory() ? walk(p) : [p]; }) : walk(site);
let changed = 0;
const filled = new Map(); // code file under _nts -> the regions it holds
for (const f of files) {
  const src = read(f);
  const code = /\.(css|js)$/.test(f);
  if (!code && !/<!-- nts:|data-nts-(copy|fragment)=/.test(src)) continue;
  const r = code ? syncCode(f) : sync(f);
  if (code) filled.set(r.rel, r.filled);
  const { before, after } = r;
  if (before !== after) {
    changed++;
    if (check) console.log('would change', relative(root, f));
    else { writeFileSync(f, after); console.log('synced', relative(root, f)); }
  }
}
// every region is in its file, whenever that file was synced
for (const [name, [file]] of Object.entries(REGIONS)) if (filled.has(file) && !filled.get(file).includes(name)) fail(`nts:${name} missing from ${file}`);
if (check && changed) process.exit(1);
if (!changed) console.log('nothing to change');
