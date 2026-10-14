import { test, expect } from "../helpers/fixtures.mjs";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nts = path.join(root, "site/_nts");
const run = (cwd, env = {}) => spawnSync(process.execPath, [path.join(root, "tools/sync.mjs"), "--check"], { cwd, encoding: "utf8", env: { ...process.env, ...env } });

test("S1: sync is clean (generated regions match their sources)", () => {
  const r = run(root);
  expect(
    r.status,
    `tools/sync.mjs --check would change files; run \`node tools/sync.mjs\` and commit the result.\n${r.stdout}${r.stderr}`
  ).toBe(0);
});

// S2 the code regions: the list in sync.mjs's head and the table in
// INTERNALS.md ("Regions in the shared CSS and JS") name the same regions in
// the same files, and each file has each of its regions exactly once, and no
// other. This is the check that keeps the two lists and the files in step.
const listed = (text, re) => [...text.matchAll(re)].map((m) => `${m[1]} ${m[2]}`).sort();
test("S2: each code region is listed in sync.mjs and INTERNALS.md, and sits once in its file", () => {
  const head = listed(readFileSync(path.join(root, "tools/sync.mjs"), "utf8"), /^ {5}nts:([a-z-]+) +([a-z-]+\.(?:css|js)):/gm);
  const doc = listed(readFileSync(path.join(root, "INTERNALS.md"), "utf8"), /^\| `([a-z-]+)` \| `([a-z-]+\.(?:css|js))` \|/gm);
  expect(head.length, "sync.mjs lists its code regions").toBeGreaterThan(0);
  expect(doc, "INTERNALS.md's table lists the regions sync.mjs lists").toEqual(head);
  const found = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(css|js)$/.test(n)) for (const m of readFileSync(p, "utf8").matchAll(/\/\* (\/?)nts:([a-z-]+) \*\//g)) found.push(`${m[2]} ${n}${m[1] ? " close" : ""}`); } };
  walk(nts);
  expect(found.filter((f) => !f.endsWith(" close")).sort(), "open markers").toEqual(head);
  expect(found.filter((f) => f.endsWith(" close")).map((f) => f.replace(/ close$/, "")).sort(), "close markers").toEqual(head);
});

// S3 sync refuses a broken source instead of passing it: a misspelt or
// missing region marker, a region with no close, and a world entry without
// its colours each exit 1 with a message naming what is wrong.
test.describe("S3: sync --check fails on a broken source", () => {
  let dir;
  test.beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "nts-sync-")); cpSync(path.join(root, "site"), path.join(dir, "site"), { recursive: true }); });
  test.afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const edit = (rel, fn) => { const p = path.join(dir, rel); writeFileSync(p, fn(readFileSync(p, "utf8"))); };
  const fails = (re) => { const r = run(dir, { NTS_SYNC_ROOT: dir }); expect(r.status, r.stdout + r.stderr).toBe(1); expect(r.stdout + r.stderr).toMatch(re); };

  test("the copy itself is clean", () => { const r = run(dir, { NTS_SYNC_ROOT: dir }); expect(r.status, r.stdout + r.stderr).toBe(0); });
  test("a misspelt region", () => { edit("site/_nts/apertures.css", (s) => s.replace(/nts:dots \*\//g, "nts:dotz */")); fails(/dotz/); });
  test("a region removed", () => { edit("site/_nts/apertures.css", (s) => s.replace(/^\/\* \/?nts:dots \*\/\n/gm, "")); fails(/dots.*apertures\.css/); });
  test("every region of a file removed", () => { edit("site/_nts/orrery.css", (s) => s.replace(/^[ \t]*\/\* \/?nts:[a-z-]+ \*\/\n/gm, "")); fails(/orrery\.css/); });
  test("a region with no close", () => { edit("site/_nts/nts.css", (s) => s.replace("/* /nts:kinds */", "")); fails(/kinds/); });
  test("a region in another file", () => { edit("site/_nts/nts.css", (s) => s.replace("/* nts:kinds */", "/* nts:dots */").replace("/* /nts:kinds */", "/* /nts:dots */")); fails(/dots.*nts\.css|nts\.css.*dots/); });
  test("a world without its colours", () => {
    edit("site/_nts/content/site.json", (s) => { const j = JSON.parse(s); delete j.initiatives[1].colours.face.sigil; return JSON.stringify(j, null, 2); });
    fails(/not-not-philo.*colours\.face\.sigil/);
  });
});
