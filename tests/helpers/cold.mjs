// A page in a brand-new browser context (no cache, no storage) for tests that compare
// cold loads. It does what the fixtures' route does: fonts from tests/fonts/ (optionally
// held for `fontDelay` ms), any other external request is recorded and aborted.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fontsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fonts");
const manifest = JSON.parse(fs.readFileSync(path.join(fontsDir, "manifest.json"), "utf8"));

/** A page in a fresh context made from `browser`; returns { page, external, close }. */
export async function coldPage(browser, { fontDelay = 0, ...contextOptions } = {}) {
  const context = await browser.newContext(contextOptions);
  const external = [];
  const base = new URL(process.env.NTS_BASE).host;
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && url.host !== base,
    async (route) => {
      const url = route.request().url();
      const u = new URL(url);
      const file =
        u.host === "fonts.googleapis.com" ? manifest.css[url] :
        u.host === "fonts.gstatic.com" ? manifest.files[url] : null;
      if (!file) {
        external.push(url);
        return route.abort("blockedbyclient");
      }
      if (fontDelay) await new Promise((r) => setTimeout(r, fontDelay));
      await route.fulfill({
        body: fs.readFileSync(path.join(fontsDir, file)),
        contentType: file.endsWith(".css") ? "text/css; charset=utf-8" : "font/woff2",
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  );
  const page = await context.newPage();
  return { page, external, close: () => context.close() };
}
