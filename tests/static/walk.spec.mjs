// I1 + L6: one walk over every page, two assertions. Each page is scrolled to
// the bottom in steps and back; the watch log must stay empty (I1) and the
// document must never be wider than the viewport at any step (L6).
import { test, expect } from "../helpers/fixtures.mjs";

const PAGES = ["/", "/embers/", "/not-not-philo/", "/intersect/", "/events/", "/404.html"];
const STEP = 400; // px per scroll step: apertures, orbits and the bleed layer can overflow mid-scroll
const WALK_TIMEOUT = 90_000; // the home page alone takes ~20 s to walk on a quiet machine, more under parallel load
const MAX_STEPS = 200; // runaway guard for pages whose height keeps growing

const FAST = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
const SLOW = [
  { width: 360, height: 780 },
  { width: 430, height: 932 },
];

// Scrolls to the bottom and back; returns the horizontal overflow seen at each step.
async function walk(page, settle) {
  const overflow = [];
  const measure = async (y) => {
    await page.evaluate((y) => scrollTo(0, y), y);
    await settle(page);
    const o = await page.evaluate(() => ({
      y: Math.round(scrollY),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    overflow.push(o);
    return o;
  };
  await measure(0);
  let y = 0;
  for (let i = 0; i < MAX_STEPS; i++) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (y >= h) break;
    y = Math.min(y + STEP, h);
    await measure(y);
  }
  for (; y > 0; ) {
    y = Math.max(y - STEP, 0);
    await measure(y);
  }
  return overflow;
}

function walkTests(vp, reducedMotion, tag = "") {
  const label = `${vp.width}${reducedMotion ? " reduced" : ""}`;
  test.describe(`walk at ${label}${tag}`, () => {
    test.use({ viewport: vp, reducedMotion: reducedMotion ? "reduce" : "no-preference" });
    for (const path of PAGES) {
      test(`I1+L6 ${path} at ${label}${tag}`, async ({ page, watch, settle }) => {
        test.setTimeout(WALK_TIMEOUT);
        const bad = [];
        page.on("response", (r) => {
          // The 404 page itself may be served as a 404.
          if (r.status() >= 400 && !(path === "/404.html" && r.request().isNavigationRequest())) {
            bad.push(`${r.status()} ${r.url()}`);
          }
        });
        await page.goto(process.env.NTS_BASE + path);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await walk(page, settle);

        expect(bad, "responses at 400 or above").toEqual([]);
        expect(watch.errors, "console and page errors").toEqual([]);
        expect(watch.failed, "failed requests").toEqual([]);
        expect(overflow.filter((o) => o.over !== 0), "horizontal overflow (scrollWidth - clientWidth) by scroll position").toEqual([]);
      });
    }
  });
}

for (const vp of FAST) walkTests(vp, false);
for (const vp of SLOW) walkTests(vp, false, " @slow");
for (const vp of [...FAST, ...SLOW]) walkTests(vp, true, " @slow");
