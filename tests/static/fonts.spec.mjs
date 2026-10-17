import { test, expect } from "../helpers/fixtures.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fonts/manifest.json"), "utf8"));

function pages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name.endsWith(".html") ? [p] : [];
  });
}

test("every page's Google Fonts URL is in the offline fonts manifest", () => {
  const missing = [];
  for (const f of pages(path.join(root, "site"))) {
    const html = fs.readFileSync(f, "utf8");
    for (const m of html.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"'\s]*/g)) {
      const url = m[0].replace(/&amp;/g, "&");
      if (!manifest.css[url]) missing.push(`${path.relative(root, f)}: ${url}`);
    }
  }
  expect(
    missing,
    "font URLs missing from tests/fonts/manifest.json; run `npm run fonts` and commit tests/fonts/"
  ).toEqual([]);
});

// The nav's face is fetched with the page's CSS, not after its first layout:
// laid out in a fallback and swapped later, the labels move a few px after the
// page appears (L9). The preload must name the file the page's own Google CSS
// gives the nav's glyphs (Instrument Sans, upright, latin), or it fetches a
// file nobody uses; `npm run fonts` refreshes the CSS this reads.
test("every page with a nav preloads the nav's face, the file its Google CSS names", () => {
  const wrong = [];
  for (const f of pages(path.join(root, "site"))) {
    const html = fs.readFileSync(f, "utf8");
    if (!html.includes('class="nts-nav"')) continue;
    const rel = path.relative(root, f);
    const link = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]*)">/);
    if (!link) { wrong.push(`${rel}: no fonts link`); continue; }
    const cssFile = manifest.css[link[1].replace(/&amp;/g, "&")];
    if (!cssFile) { wrong.push(`${rel}: CSS not in manifest (run npm run fonts)`); continue; }
    const css = fs.readFileSync(path.join(root, "tests/fonts", cssFile), "utf8");
    const face = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]).find((b) =>
      /font-family:\s*'Instrument Sans'/.test(b) && /font-style:\s*normal/.test(b) && /unicode-range:\s*U\+0000-00FF/.test(b));
    if (!face) { wrong.push(`${rel}: no Instrument Sans latin face in its CSS`); continue; }
    const want = `<link rel="preload" href="${face.match(/url\(([^)]+)\)/)[1]}" as="font" type="font/woff2" crossorigin>`;
    const preloads = [...html.matchAll(/<link rel="preload"[^>]*>/g)].map((m) => m[0]);
    if (preloads.length !== 1 || preloads[0] !== want) { wrong.push(`${rel}: ${preloads.join(" ") || "no preload"} (want ${want})`); continue; }
    // before the fonts link, so the preload scanner asks for both at once
    if (html.indexOf(want) > link.index) wrong.push(`${rel}: the preload comes after the fonts link`);
  }
  expect(wrong, "pages whose nav face is not preloaded as their CSS names it").toEqual([]);
});
