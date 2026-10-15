// L3f. The still shown before philo.js runs is the size of the live canvas's first (rest)
// frame, so the figure doesn't jump when the canvas replaces it: on the page and in the
// home's window fragment, each against its own live frame.
import { readFileSync } from "node:fs";
import { test, expect } from "../helpers/fixtures.mjs";
import { out } from "../../tools/gen-stills.mjs";

const TOL = 1; // px, in the host's layout units
const CASES = [
  { name: "the page", path: "/not-not-philo/", host: ".nts-penrose" },
  { name: "the home fragment", path: "/", host: "[data-nts-fragment='philo']" },
];

// The drawn figure's size in the host's layout px: the still's paths as a share of
// the host's rect (a transformed ancestor cancels out), or the canvas's opaque pixels.
const stillSize = (sel) => {
  const host = document.querySelector(sel), hr = host.getBoundingClientRect();
  let a = 1e9, b = -1e9, t = 1e9, u = -1e9;
  // the still's filled shapes
  host.querySelectorAll("svg path").forEach((e) => {
    const r = e.getBoundingClientRect();
    a = Math.min(a, r.left); b = Math.max(b, r.right); t = Math.min(t, r.top); u = Math.max(u, r.bottom);
  });
  const k = host.clientWidth / hr.width;
  return { w: (b - a) * k, h: (u - t) * k };
};
const liveSize = (sel) => {
  const cv = document.querySelector(sel + " canvas"), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let a = 1e9, b = -1, t = 1e9, u = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    if (d[(y * cv.width + x) * 4 + 3] > 20) { a = Math.min(a, x); b = Math.max(b, x); t = Math.min(t, y); u = Math.max(u, y); }
  }
  const k = cv.clientWidth / cv.width;
  return { w: (b - a) * k, h: (u - t) * k };
};

for (const c of CASES) {
  test(`L3f ${c.name}: the PHILO still is as large as the first live frame`, async ({ browser, page }) => {
    const bare = await browser.newContext({ javaScriptEnabled: false, viewport: page.viewportSize() });
    await bare.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
    const p0 = await bare.newPage();
    await p0.goto(process.env.NTS_BASE + c.path);
    const still = await p0.evaluate(stillSize, c.host);
    await bare.close();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(process.env.NTS_BASE + c.path);
    await page.waitForSelector(`${c.host}.is-live`);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const live = await page.evaluate(liveSize, c.host);

    expect(Math.abs(still.w - live.w), `width: still ${still.w.toFixed(1)}, live ${live.w.toFixed(1)}`).toBeLessThanOrEqual(TOL);
    expect(Math.abs(still.h - live.h), `height: still ${still.h.toFixed(1)}, live ${live.h.toFixed(1)}`).toBeLessThanOrEqual(TOL);
  });
}

// The committed stills are what tools/gen-stills.mjs bakes now.
for (const name of ["still-philo.svg", "still-philo-sm.svg"]) {
  test(`L3f ${name} is as baked now`, () => {
    expect(readFileSync(new URL(`../../site/_nts/parts/${name}`, import.meta.url), "utf8")).toBe(out[name]);
  });
}
