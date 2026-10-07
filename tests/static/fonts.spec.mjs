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
