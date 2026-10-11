// The initiatives' registry (`initiatives` in site/_nts/content/site.json) is
// the one list of the pages the orb morph runs between. Sync generates the
// wiring from it (S1 in sync.spec.mjs catches drift); these check what sync
// cannot write: each entry's page, its world kit and its place on the home.
// R1 every entry has its page, in its world; R2 every world has its kit, and
// its page loads it; R3 the pages that run the bleed are the entries marked
// bleed; R4 every entry's body rides the home's orrery on an orbit the emblem
// draws, and every world has its window on the home and its bead on /events/.
import { test, expect } from "../helpers/fixtures.mjs";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const site = path.join(root, "site");
const read = (p) => readFileSync(path.join(site, p), "utf8");
const SITE = JSON.parse(read("_nts/content/site.json"));
const LIST = SITE.initiatives || [];
const WORLDS = LIST.filter((i) => i.world !== "nts");
const at = (o, k) => k.split(".").reduce((v, p) => (v == null ? v : v[p]), o);

test("R0: the registry lists the initiatives", () => {
  expect(LIST.length, "site.json has an `initiatives` list").toBeGreaterThan(0);
  for (const i of LIST) {
    for (const k of ["slug", "world", "name", "body", "orbit.r", "orbit.a", "orbit.p", "orbit.d"]) expect(at(i, k), `${i.slug}: ${k}`).toBeDefined();
    if (i.world !== "nts") for (const k of ["colours.sigil", "colours.face.base", "colours.face.sigil", "colours.face.text", "colours.kind.bg", "colours.kind.fg"]) expect(at(i, k), `${i.slug}: ${k}`).toBeDefined();
    // the slug goes into a path regex (nts-head.js) and a URL as is
    expect(i.slug).toMatch(/^[a-z0-9-]+$/);
  }
});

test("R1: every entry has its page, in its world", () => {
  for (const i of LIST) {
    const file = `${i.slug}/index.html`;
    expect(existsSync(path.join(site, file)), file).toBe(true);
    expect(read(file), `${file}: <body data-world>`).toMatch(new RegExp(`<body[^>]*\\sdata-world="${i.world}"`));
  }
});

test("R2: every world has its kit, and its page loads it", () => {
  for (const i of WORLDS) {
    expect(existsSync(path.join(site, `_nts/worlds/${i.world}.css`)), `_nts/worlds/${i.world}.css`).toBe(true);
    expect(read(`${i.slug}/index.html`)).toContain(`href="/_nts/worlds/${i.world}.css"`);
  }
});

test("R3: the pages that run the bleed are the entries marked bleed", () => {
  const dirs = readdirSync(site, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const bleed = dirs.filter((n) => existsSync(path.join(site, n, "index.html")) && /data-bleed="scroll"/.test(read(`${n}/index.html`))).sort();
  expect(bleed).toEqual(LIST.filter((i) => i.bleed).map((i) => i.slug).sort());
});

test("R4: every body rides the home's orrery, every world has its window and its bead on /events/", () => {
  const home = read("index.html");
  const orbits = read("_nts/parts/emblem-orbits.html");
  const events = read("events/index.html");
  for (const i of LIST) {
    expect(home, `${i.slug}: the home's bead`).toMatch(new RegExp(`class="pivot orbit o-${i.body}"><a class="bead" data-body="${i.body}" href="/${i.slug}/"`));
    expect(orbits, `${i.slug}: the emblem draws orbit r ${i.orbit.r}`).toContain(`<circle r="${i.orbit.r}"`);
  }
  for (const i of WORLDS) {
    expect(home, `${i.slug}: the home's window`).toMatch(new RegExp(`<a class="orb" data-body="${i.body}" href="/${i.slug}/"`));
    expect(events, `${i.slug}: the bead on /events/`).toContain(`data-of="${i.world}" href="/${i.slug}/"`);
  }
});
