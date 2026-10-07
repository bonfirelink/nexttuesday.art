// Refreshes tests/fonts/ from the pages' Google Fonts links: the CSS (latin
// subsets only) and the woff2 files, plus manifest.json mapping URL -> file.
// Run: npm run fonts
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const out = path.join(root, "tests/fonts");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

function pages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name.endsWith(".html") ? [p] : [];
  });
}

const cssUrls = new Set();
for (const f of pages(site)) {
  for (const m of fs.readFileSync(f, "utf8").matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"'\s]*/g)) {
    cssUrls.add(m[0].replace(/&amp;/g, "&"));
  }
}

const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
const fetchOk = async (url, headers) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
};

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const manifest = { css: {}, files: {} };

for (const url of [...cssUrls].sort()) {
  const css = (await fetchOk(url, { "User-Agent": UA })).toString("utf8");
  // Keep only the "latin" subset blocks.
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
    .filter((m) => m[1] === "latin")
    .map((m) => m[2]);
  if (!blocks.length) throw new Error(`no latin blocks in ${url}`);
  for (const block of blocks) {
    for (const m of block.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) {
      if (manifest.files[m[1]]) continue;
      const name = `${hash(m[1])}.woff2`;
      fs.writeFileSync(path.join(out, name), await fetchOk(m[1]));
      manifest.files[m[1]] = name;
    }
  }
  const name = `${hash(url)}.css`;
  fs.writeFileSync(path.join(out, name), blocks.join("\n") + "\n");
  manifest.css[url] = name;
}

fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`${Object.keys(manifest.css).length} CSS, ${Object.keys(manifest.files).length} woff2 -> tests/fonts/`);
