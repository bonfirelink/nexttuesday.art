// L9 the nav is in its place from the first frame: each label's box at
//    `pagereveal` (the layout the first frame paints, and the image a view
//    transition starts from) is the box it keeps once the fonts are in. A
//    label laid out in a fallback face and swapped later moves the labels and
//    the current bar a few px after the page appears. The suite's font
//    routes are not cached, so every document here fetches its fonts afresh,
//    as on a first visit.
import { test, expect } from "../helpers/fixtures.mjs";
import { INITIATIVES } from "../helpers/registry.mjs";

const PAGES = ["/", ...INITIATIVES.map((i) => `/${i.slug}/`)];

function recordReveal() {
  const boxes = () => [...document.querySelectorAll(".nts-nav a span")].map((s) => {
    const r = s.getBoundingClientRect();
    return { label: s.textContent, left: r.left, width: r.width, top: r.top };
  });
  window.__navBoxes = boxes;
  addEventListener("pagereveal", () => { window.__navReveal = boxes(); });
}

async function settledShift(page) {
  await page.waitForFunction(() => window.__navReveal);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(() => {
    const now = window.__navBoxes();
    return window.__navReveal.map((b, i) => ({
      label: b.label,
      dx: +(now[i].left - b.left).toFixed(2),
      dw: +(now[i].width - b.width).toFixed(2),
      dy: +(now[i].top - b.top).toFixed(2),
    }));
  });
}

const still = (shift) => shift.filter((s) => Math.abs(s.dx) >= 0.5 || Math.abs(s.dw) >= 0.5 || Math.abs(s.dy) >= 0.5);

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`L9 the nav from the first frame at ${vp.width}px`, () => {
    test.use({ viewport: vp });
    for (const p of PAGES) {
      test(`${p} loaded directly: the labels do not move once the fonts are in`, async ({ page }) => {
        await page.addInitScript(recordReveal);
        await page.goto(process.env.NTS_BASE + p, { waitUntil: "load" });
        expect(still(await settledShift(page)), "labels that moved after the first frame (px)").toEqual([]);
      });
    }
  });
}

for (const [from, to] of [["/events/", "/embers/"], ["/embers/", "/not-not-philo/"]]) {
  test(`L9 ${from} to ${to} by the nav: the arrived labels do not move once the fonts are in`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(recordReveal);
    await page.goto(process.env.NTS_BASE + from, { waitUntil: "load" });
    await page.locator(`.nts-nav a[href="${to}"]`).click();
    await page.waitForURL("**" + to);
    expect(still(await settledShift(page)), "labels that moved after the first frame (px)").toEqual([]);
  });
}
