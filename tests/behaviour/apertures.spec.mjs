// B2 apertures open across the visible screen, B3 they latch open and never close.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open, putTop, scaleOf, scrollTo } from "../helpers/behaviour.mjs";

const CLOSED = 0.01; // at or below this the disc is closed: it rests at .001
const FULL = 0.99; // at or above this it is open
const PAST_LINE = 0.29; // the latch line is 30% exactly, and a card touching it is not yet across; one point past
const LATCH_STEP = 300; // px per scroll step on the there-and-back walk

const WORLD_PAGES = ["/embers/", "/not-not-philo/", "/intersect/"];

const discScale = (page, selector) =>
  page.evaluate((s) => getComputedStyle(document.querySelector(s + " .ecl-disc")).scale, selector).then(scaleOf);

// Scroll the card's top through 80%, 55%, 45% and just past 30% of the viewport, in that order.
async function checkOpening(page, settle, selector) {
  await putTop(page, settle, selector, 0.8);
  expect(await discScale(page, selector), "scale at 80%").toBeLessThanOrEqual(CLOSED);
  await putTop(page, settle, selector, 0.55);
  const at55 = await discScale(page, selector);
  await putTop(page, settle, selector, 0.45);
  const at45 = await discScale(page, selector);
  for (const [at, s] of [[55, at55], [45, at45]]) {
    expect(s, `scale at ${at}%`).toBeGreaterThan(CLOSED);
    expect(s, `scale at ${at}%`).toBeLessThan(FULL);
  }
  expect(at45, "scale grows as the card climbs").toBeGreaterThan(at55);
  await putTop(page, settle, selector, PAST_LINE);
  await expect(page.locator(selector).first()).toHaveClass(/is-open/);
}

for (const vp of VIEWPORTS) {
  test.describe(`apertures at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("B2 the opening runs from 25vh to 70vh of travel, across the screen", async ({ page, settle }) => {
      await open(page);
      const range = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return [s.getPropertyValue("--ecl-open-start").trim(), s.getPropertyValue("--ecl-open-end").trim()];
      });
      expect(range).toEqual(["25vh", "70vh"]);
      await checkOpening(page, settle, "#not-not-philo");
    });

    for (const path of WORLD_PAGES) {
      test(`B2 a band on ${path} opens across the screen`, async ({ page, settle }) => {
        await open(page, path);
        await checkOpening(page, settle, ".band.ecl");
      });
    }

    test("B3 apertures latch open and never close", async ({ page, settle }) => {
      await open(page);
      await page.evaluate(() => {
        window.__opens = [];
        document.querySelectorAll(".ecl").forEach((el, i) => {
          let was = el.classList.contains("is-open");
          new MutationObserver(() => {
            const now = el.classList.contains("is-open");
            if (now !== was) window.__opens.push({ card: i, on: now });
            was = now;
          }).observe(el, { attributes: true, attributeFilter: ["class"] });
        });
      });
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      // Scale of the discs of every card that has opened, read after each step: all stay at 1.
      const stray = [];
      const check = async (y) => {
        const bad = await page.evaluate(() =>
          [...document.querySelectorAll(".ecl.is-open")]
            .map((el) => [el.id, getComputedStyle(el.querySelector(".ecl-disc")).scale])
            .filter(([, s]) => s !== "none" && parseFloat(s) !== 1)
        );
        if (bad.length) stray.push(`y=${y}: ${JSON.stringify(bad)}`);
      };
      const walk = [];
      for (let y = 0; y < max; y += LATCH_STEP) walk.push(y);
      walk.push(max);
      for (const y of [...walk, ...walk.slice().reverse(), ...walk]) {
        await scrollTo(page, settle, y);
        await check(y);
      }
      expect(stray, "open cards whose disc is not at scale 1").toEqual([]);

      const changes = await page.evaluate(() => window.__opens);
      expect(changes.filter((c) => !c.on), "is-open removed").toEqual([]);
      const perCard = {};
      for (const c of changes) perCard[c.card] = (perCard[c.card] || 0) + 1;
      expect(Object.values(perCard).every((n) => n === 1), "is-open added more than once: " + JSON.stringify(perCard)).toBe(true);

      const state = await page.evaluate(() =>
        [...document.querySelectorAll(".ecl")].filter((el) => el.classList.contains("is-open")).map((el) => ({
          id: el.id,
          scale: getComputedStyle(el.querySelector(".ecl-disc")).scale,
          running: el.getAnimations({ subtree: true }).filter((a) => a.animationName?.startsWith("ecl-")).map((a) => a.animationName),
        }))
      );
      expect(state.length, "cards that opened").toBeGreaterThanOrEqual(3);
      for (const c of state) {
        expect(scaleOf(c.scale), `#${c.id} disc scale`).toBe(1);
        expect(c.running, `#${c.id} aperture animations`).toEqual([]);
      }
    });
  });
}
