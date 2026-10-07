// The suite's `test`: fonts from the cache, any other external request fails,
// plus the watch, freeze and settle helpers.
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fontsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fonts");
const manifest = JSON.parse(fs.readFileSync(path.join(fontsDir, "manifest.json"), "utf8"));

export const test = base.extend({
  // Milliseconds to hold every font response (the ASCII race needs a slow font).
  fontDelay: [0, { option: true }],

  // Console errors, page errors, failed requests and external requests.
  watch: async ({ page }, use, testInfo) => {
    const log = { errors: [], failed: [], external: [] };
    page.on("console", (m) => m.type() === "error" && log.errors.push(m.text()));
    page.on("pageerror", (e) => log.errors.push(String(e)));
    page.on("requestfailed", (r) => log.failed.push(`${r.url()} ${r.failure()?.errorText}`));
    await use(log);
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach("watch.json", { body: JSON.stringify(log, null, 2), contentType: "application/json" });
    }
  },

  // Fonts from tests/fonts/, anything else that leaves for an external host fails the test.
  _routes: [async ({ context, fontDelay, watch }, use) => {
    const base = process.env.NTS_BASE ? new URL(process.env.NTS_BASE).host : "";
    await context.route(
      (url) => /^https?:$/.test(url.protocol) && url.host !== base,
      async (route) => {
        const url = route.request().url();
        const u = new URL(url);
        const file =
          u.host === "fonts.googleapis.com" ? manifest.css[url] :
          u.host === "fonts.gstatic.com" ? manifest.files[url] : null;
        if (!file) {
          watch.external.push(url);
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
    await use();
    expect(watch.external, "requests that left for an external host").toEqual([]);
  }, { auto: true }],

  // Pause every document-timeline animation at time t (transitions and scroll timelines are left alone).
  freeze: async ({}, use) => {
    await use((page, t = 0) =>
      page.evaluate((t) => {
        for (const a of document.getAnimations()) {
          if (a.transitionProperty || !(a.timeline instanceof DocumentTimeline)) continue;
          a.pause();
          a.currentTime = t;
        }
      }, t)
    );
  },

  // Two animation frames, so IntersectionObserver callbacks after a scroll have run.
  settle: async ({}, use) => {
    await use((page) =>
      page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    );
  },
});

export { expect };
