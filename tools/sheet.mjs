// Composes the shots of tools/shots.mjs into labelled contact sheets, one PNG per view.
//   node tools/sheet.mjs DIR [--title TEXT] [--per-page] [--scale N]
// With before and after shots: a BEFORE | AFTER pair per path and position.
// With one site: a single labelled cell per shot.
// The title is followed by the view. Writes DIR/sheet-<view>.png and prints the paths. A phone sheet stays within 1600 px,
// a desktop sheet within 1500 px, and narrower when its content is. Rendered by Chromium (an HTML page, screenshotted).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values: o, positionals: [dir] } = parseArgs({
  allowPositionals: true,
  options: { "per-page": { type: "boolean", default: false }, title: { type: "string", default: "" }, scale: { type: "string", default: "1" } },
});
if (!process.env.CHROMIUM) {
  console.error("$CHROMIUM unset; run inside the dev shell");
  process.exit(2);
}
if (!dir) {
  console.error("usage: sheet.mjs DIR [--title TEXT] [--per-page] [--scale N]");
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Cell width in CSS px; a pair is two cells. Phone pairs sit two to a line, desktop pairs one.
const LAYOUT = { phone: { cell: 372, width: 1600 }, desktop: { cell: 730, width: 1500 } };

const cell = (s, tag) => {
  if (!s) return `<figure class="empty"><figcaption>${tag} (missing)</figcaption></figure>`;
  const note = `overflow ${s.overflow}px${s.overflow > 0 ? " (!)" : ""}`;
  return `<figure><figcaption><b>${tag}</b> <span>${note}</span></figcaption>` +
    `<img src="${pathToFileURL(path.resolve(dir, s.file))}"></figure>`;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ["--no-sandbox", "--allow-file-access-from-files"] });
const written = [];
try {
  const slug = (p) => p.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";
  const groups = [];
  for (const view of [...new Set(manifest.shots.map((s) => s.view))]) {
    const ofView = manifest.shots.filter((s) => s.view === view);
    if (!o["per-page"]) groups.push({ view, name: view, title: view, shots: ofView });
    else for (const p of [...new Set(ofView.map((s) => s.path))])
      groups.push({ view, name: `${view}-${slug(p)}`, title: `${view} ${p}`, shots: ofView.filter((s) => s.path === p) });
  }
  for (const { view, name, title, shots } of groups) {
    const { cell: w, width } = LAYOUT[view];
    const keys = [...new Set(shots.map((s) => `${s.path}\t${s.pos}`))];
    const find = (label, key) => shots.find((s) => s.label === label && `${s.path}\t${s.pos}` === key);
    const paired = shots.some((s) => s.label === "before");
    const blocks = keys.map((key) => {
      const ref = shots.find((s) => `${s.path}\t${s.pos}` === key);
      const body = paired ? cell(find("before", key), "BEFORE") + cell(find("after", key), "AFTER") : cell(ref, ref.path);
      return `<section class="${paired ? "pair" : "one"}"><h2>${esc(ref.path)} <span>${esc(ref.posText)}</span></h2><div>${body}</div></section>`;
    });
    const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#1b1b1b;color:#eee;font:15px/1.3 system-ui,sans-serif}
  h1{margin:0;padding:12px 14px 4px;font-size:20px}
  #sheet{display:inline-block;background:#1b1b1b}
  .flow{display:flex;flex-wrap:wrap;gap:14px;padding:12px 14px;width:max-content;max-width:${width - 28}px}
  section{background:#262626;padding:8px;border-radius:6px}
  h2{margin:0 0 6px;font-size:16px}h2 span,figcaption span{color:#9a9a9a;font-weight:400;font-size:13px}
  section>div{display:flex;gap:8px}
  figure{margin:0;width:${w}px}figcaption{padding:2px 0 4px}
  figcaption b{font-size:16px;letter-spacing:.06em}
  figure img{display:block;width:100%;border:1px solid #444}
  .empty{border:1px dashed #666;padding:8px}
  </style><div id="sheet"><h1>${esc([o.title, title].filter(Boolean).join(" "))}${manifest.reduce ? " (reduced motion)" : ""}</h1><div class="flow">${blocks.join("")}</div></div>`;
    const htmlFile = path.resolve(dir, `sheet-${name}.html`);
    fs.writeFileSync(htmlFile, html);
    const out = path.resolve(dir, `sheet-${name}.png`);
    try {
      const page = await browser.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: +o.scale });
      await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
      await page.locator("#sheet").screenshot({ path: out });
      await page.close();
    } finally {
      fs.rmSync(htmlFile, { force: true });
    }
    written.push(out);
  }
} finally {
  await browser.close();
}
console.log(written.join("\n"));
