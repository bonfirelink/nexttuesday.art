// L5 compass position, B1 the compass hides only while the footer shows.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open, scrollTo } from "../helpers/behaviour.mjs";

const INSET_TOL = 1; // px: geometry read with getBoundingClientRect
const TOGGLE_TOL = 4; // px of scroll: on and off happen at one place, a step (3 px) apart at most
const STEP = 3; // px per scroll step
const SWEEP = 1200; // px above the bottom where the sweep starts
const SWEEP_TIMEOUT = 120_000; // ms: ~800 steps of a frame each, there and back

for (const vp of VIEWPORTS) {
  test.describe(`compass at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("L5 the compass sits --compass-inset from the right and bottom edges", async ({ page, settle }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page);
      await scrollTo(page, settle, 2 * vp.height);
      await expect(page.locator(".compass")).toHaveClass(/is-on/);
      // The token is read through a probe, so the test follows the CSS rather than a number.
      const inset = await page.evaluate(() => {
        const p = document.createElement("div");
        p.style.cssText = "position:absolute;visibility:hidden;width:var(--compass-inset)";
        document.body.append(p);
        const w = p.getBoundingClientRect().width;
        p.remove();
        return w;
      });
      expect(inset).toBeGreaterThan(0);
      await expect
        .poll(() =>
          page.evaluate((inset) => {
            const r = document.querySelector(".compass").getBoundingClientRect();
            return Math.max(
              Math.abs(document.documentElement.clientWidth - r.right - inset),
              Math.abs(innerHeight - r.bottom - inset)
            );
          }, inset)
        )
        .toBeLessThanOrEqual(INSET_TOL);
    });

    test("B1 the compass hides only while the footer is in view, once each way", async ({ page, settle }) => {
      test.setTimeout(SWEEP_TIMEOUT);
      // Reduced motion keeps the figures still, so each of the 800 frames is cheap.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page);
      await expect(page.locator(".compass")).not.toHaveClass(/is-on/);
      expect(await page.locator(".compass").evaluate((c) => getComputedStyle(c).visibility)).toBe("hidden");

      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await scrollTo(page, settle, max - SWEEP);
      await expect(page.locator(".compass")).toHaveClass(/is-on/);

      const run = await page.evaluate(
        async ({ from, to, step }) => {
          // One frame after a scroll, the observer's task has run: read, then move on to the next step.
          const frame = () => new Promise((r) => requestAnimationFrame(r));
          const compass = document.querySelector(".compass"), foot = document.querySelector(".nts-footer");
          const changes = [];
          let was = compass.classList.contains("is-aside");
          new MutationObserver(() => {
            const now = compass.classList.contains("is-aside");
            if (now !== was) changes.push({ on: now, y: scrollY });
            was = now;
          }).observe(compass, { attributes: true, attributeFilter: ["class"] });
          const wrong = [];
          const sweep = async (a, b, dir) => {
            for (let y = a; dir > 0 ? y <= b : y >= b; y += dir * step) {
              scrollTo({ top: y, behavior: "instant" });
              await frame();
              const bottom = innerHeight - parseFloat(getComputedStyle(compass).bottom); // the compass's layout bottom edge
              const top = foot.getBoundingClientRect().top;
              const aside = compass.classList.contains("is-aside");
              if (top < bottom - 1 && !aside) wrong.push(`y=${y} footer overlaps the compass, not aside`);
              if (top >= innerHeight && aside) wrong.push(`y=${y} footer out of view, aside`);
            }
          };
          await sweep(from, to, 1);
          await sweep(to, from, -1);
          return { changes, wrong };
        },
        { from: max - SWEEP, to: max, step: STEP }
      );
      expect(run.wrong).toEqual([]);
      expect(run.changes.map((c) => c.on), "is-aside changes").toEqual([true, false]);
      expect(Math.abs(run.changes[0].y - run.changes[1].y), "scroll positions of on and off").toBeLessThanOrEqual(TOGGLE_TOL);
    });
  });
}
