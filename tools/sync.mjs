/* Fills the shared regions of every page from the content source, so the
   five variants cannot drift. Run from anywhere, after any edit:
     node tools/sync.mjs            every site/<folder>/**\/*.html that has a region
     node tools/sync.mjs site/doors  one folder
     node tools/sync.mjs --check    exit 1 if anything would change (CI, pre-commit)
   Pages are static HTML; this script rewrites only what sits between
   markers and leaves everything else byte for byte.

   Regions (open and close markers; the content between them is replaced):
     <!-- nts:sprite -->…<!-- /nts:sprite -->        the sigil sprite
     <!-- nts:header -->…<!-- /nts:header -->        the header; aria-current from the file's place
     <!-- nts:footer -->…<!-- /nts:footer -->        the footer
     <!-- nts:mega-sigil -->…<!-- /nts:mega-sigil --> the mega-sigil SVG
     <!-- nts:events -->…<!-- /nts:events -->        the ledger, upcoming then past
     <!-- nts:events upcoming -->, <!-- nts:events past -->, <!-- nts:events world=embers -->,
     <!-- nts:events upcoming limit=3 -->              subsets (same close marker)
     <!-- nts:still embers|philo|intersect -->…<!-- /nts:still -->  a still frame
   Attributes:
     data-nts-copy="key"      the element's inner HTML becomes copy.json[key]
     data-nts-fragment="w"    the element's inner HTML becomes the world's still
   Links inside generated markup are prefixed with the folder the page is in
   (site/doors/… gets /doors/…), so a variant is one folder, copied whole. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const site = join(root, 'site');
const nts = join(site, '_nts');
const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const SITE = json(join(nts, 'content', 'site.json'));
const EVENTS = json(join(nts, 'content', 'events.json'));
const COPY = json(join(nts, 'content', 'copy.json'));
const SPRITE = read(join(nts, 'sigils.svg')).trim();
const MEGA = read(join(nts, 'parts', 'mega-sigil.svg')).trim();
const STILLS = {
  embers: read(join(nts, 'parts', 'still-embers.svg')).trim(),
  philo: read(join(nts, 'parts', 'still-philo.svg')).trim(),
  intersect: `<pre aria-hidden="true">${esc(read(join(nts, 'parts', 'still-intersect-sm.txt')))}</pre>`,
  'intersect-lg': esc(read(join(nts, 'parts', 'still-intersect.txt'))),
};

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const sigil = (name, cls = '') => `<svg class="nts-sigil sigil-${name}${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#sigil-${name}"/></svg>`;

function header(prefix, page) {
  const items = SITE.nav.map((n) => {
    const cur = page === n.slug ? ' aria-current="page"' : '';
    return `<li><a href="${prefix}${n.slug}/"${cur}>${sigil(n.world)}<span>${n.label}</span></a></li>`;
  }).join('');
  const home = page === 'home' ? ' aria-current="page"' : '';
  return `<header class="nts-header"><div class="wrap bar">
<a class="nts-home" href="${prefix}"${home} aria-label="${SITE.name}, home">${sigil('nts')}<span class="wordmark">${SITE.name}</span></a>
<nav aria-label="Site"><ul class="nts-nav">${items}</ul></nav>
</div></header>`;
}

function footer(prefix) {
  const worlds = ['embers', 'philo', 'intersect'].map((w) => {
    const W = SITE.worlds[w];
    return `<li><a href="${prefix}${W.home}">${sigil(w)}<span>${W.name}</span></a></li>`;
  }).join('');
  return `<footer class="nts-footer"><div class="wrap">
<div class="cols">
<div><h2>${SITE.name}</h2><p>${SITE.footer.about}</p><p>${SITE.footer.write}</p></div>
<div><p class="label">Write to us</p><ul><li><a href="mailto:${SITE.email}">${SITE.email}</a></li><li><a href="${SITE.instagram_url}">Instagram · ${SITE.instagram}</a></li><li><a href="${SITE.embers_instagram_url}">EMBERS · ${SITE.embers_instagram}</a></li></ul></div>
<div><p class="label">The initiatives</p><ul class="worlds">${worlds}<li><a href="${prefix}events/">${sigil('star')}<span>Events</span></a></li></ul></div>
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
      return `<li class="${status}" data-world="${e.world}" id="ev-${e.id}">${sigil(SITE.worlds[e.world].sigil)}<p class="when">${esc(e.display_date)}</p><p class="what">${title}${kind}</p>${where}<p class="line">${esc(e.line)}</p></li>`;
    }).join('\n');
    out += `<section class="ledger-group" id="${status}"><${H}>${esc(label)}</${H}><ul class="ledger">\n${lis}\n</ul></section>\n`;
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
    const v = resolve(value, tag);
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
  const folder = rel.length > 1 ? rel[0] : '';
  const prefix = folder ? `/${folder}/` : '/';
  const page = rel.length === 2 ? 'home' : rel.length >= 3 ? rel[rel.length - 2] : 'home';
  const before = read(file);
  let html = before;
  html = region(html, 'sprite', () => SPRITE);
  html = region(html, 'header', () => header(prefix, page));
  html = region(html, 'footer', () => footer(prefix));
  html = region(html, 'mega-sigil', () => MEGA);
  html = region(html, 'events', (args) => ledger(prefix, parseOpts(args)));
  html = region(html, 'still', (args) => STILLS[args.trim()] || '');
  html = replaceInner(html, 'data-nts-copy', (k, tag) => {
    const v = COPY[k];
    if (v === undefined) return undefined;
    return tag === 'title' ? v.replace(/<[^>]+>/g, '') : v;
  });
  html = replaceInner(html, 'data-nts-fragment', (w) => STILLS[w] === undefined ? undefined : `<div class="still">${STILLS[w]}</div>`);
  // meta content from copy: <meta ... data-nts-copy="key" content="...">
  html = html.replace(/<meta([^>]*?)\sdata-nts-copy="([^"]+)"([^>]*?)\scontent="[^"]*"([^>]*)>/g, (m, a, k, b, c) => {
    const v = COPY[k];
    if (v === undefined) { console.warn(`  no value for meta ${k}`); return m; }
    return `<meta${a} data-nts-copy="${k}"${b} content="${v.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;')}"${c}>`;
  });
  return { before, after: html };
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (p !== nts && name !== '_variants') walk(p, acc); }
    else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const targets = args.filter((a) => !a.startsWith('--'));
const files = targets.length ? targets.flatMap((t) => { const p = join(root, t); return statSync(p).isDirectory() ? walk(p) : [p]; }) : walk(site);
let changed = 0;
for (const f of files) {
  const src = read(f);
  if (!/<!-- nts:|data-nts-(copy|fragment)=/.test(src)) continue;
  const { before, after } = sync(f);
  if (before !== after) {
    changed++;
    if (check) console.log('would change', relative(root, f));
    else { writeFileSync(f, after); console.log('synced', relative(root, f)); }
  }
}
if (check && changed) process.exit(1);
if (!changed) console.log('nothing to change');
