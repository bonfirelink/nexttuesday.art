// PHILO's figure draws at an even 30 fps while the cubes glide and not at all while they hold,
// in the home's orb and on the page. Timing, so it runs alone with the perf guards.
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";

const WATCH_MS = 9000; // three ticks: two whole holds always fit
const LATE_GAP_MS = 42; // a 30 fps gap is 33 ms; a 15 fps or dropped-remainder gap is 66 or 83 ms
const LATE_SHARE = 0.05; // a loaded machine may be late now and then; the regression is every other gap
const HOLD_MIN_GAP_MS = 1500; // the hold is 2 s with no draw

async function gaps(page, host) {
  await page.evaluate((host) => {
    window.__t = [];
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...a) {
      if (this.canvas.closest(host)) window.__t.push(performance.now());
      return clear.apply(this, a);
    };
  }, host);
  await page.waitForTimeout(WATCH_MS);
  const t = await page.evaluate(() => window.__t);
  // one draw may clear more than once: merge clears within 2 ms
  const draws = t.filter((x, i) => !i || x - t[i - 1] > 2);
  return draws.slice(1).map((x, i) => x - draws[i]);
}

function check(g) {
  const glide = g.filter((x) => x < HOLD_MIN_GAP_MS), holds = g.filter((x) => x >= HOLD_MIN_GAP_MS);
  expect(holds.length, "holds seen").toBeGreaterThanOrEqual(2);
  expect(glide.length, "glide draws").toBeGreaterThan(40);
  expect(glide.filter((x) => x > LATE_GAP_MS).length / glide.length, "share of late gaps inside a glide").toBeLessThanOrEqual(LATE_SHARE);
  const med = [...glide].sort((a, b) => a - b)[Math.floor(glide.length / 2)];
  expect(med, "median glide gap").toBeGreaterThan(30);
  expect(med).toBeLessThan(37);
}

test("@perf G1 the home's PHILO orb draws at an even 30 fps in the glide, nothing in the hold", async ({ page }) => {
  await openPage(page, "/", { live: ["[data-nts-fragment='philo']"] });
  await page.evaluate(() => document.querySelector("#not-not-philo .orb").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(2500);
  check(await gaps(page, "[data-nts-fragment='philo']"));
});

test("@perf G2 the page's PHILO figure draws at an even 30 fps in the glide, nothing in the hold", async ({ page }) => {
  await openPage(page, "/not-not-philo/", { live: [".nts-penrose"] });
  await page.waitForTimeout(1500);
  check(await gaps(page, ".nts-penrose"));
});
