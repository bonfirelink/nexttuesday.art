// The compass turns only while it shows: hidden, or stepped aside for the
// footer, its animations are paused (a running animation under a hidden
// element makes every main frame rebuild the page's layers). On show each dot
// is back at its bead's angle.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open, scrollTo } from "../helpers/behaviour.mjs";

const BODIES = ["star", "embers", "philo", "intersect"];
const ANGLE_TOL = 1.5; // degrees: the fastest dot (70 s a turn) moves 0.1 deg in a frame
const HIDDEN_MS = 2500; // long enough for a dot to drift visibly (>7 deg) if it were not caught up

const states = (page) =>
  page.evaluate(() => {
    const c = document.querySelector(".compass");
    return c.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation).map((a) => a.playState);
  });

// Each dot's angle against its bead's, in degrees (both clockwise from up).
const gaps = (page) =>
  page.evaluate((bodies) => {
    const centre = document.querySelector(".orrery .pivot").getBoundingClientRect();
    return bodies.map((b) => {
      const r = document.querySelector(`.orrery .bead[data-body="${b}"]`).getBoundingClientRect();
      const bead = (Math.atan2(r.left + r.width / 2 - centre.left, -(r.top + r.height / 2 - centre.top)) * 180) / Math.PI;
      const dot = parseFloat(getComputedStyle(document.querySelector(`.compass .c-${b} .c-dot`)).rotate);
      const d = (((dot - bead) % 360) + 540) % 360 - 180;
      return Math.abs(d);
    });
  }, BODIES);

for (const vp of VIEWPORTS) {
  test.describe(`compass pause at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("P4 the compass's animations are paused while it is hidden or aside, and its dots match their beads when it shows", async ({ page, settle }) => {
      await open(page);
      const compass = page.locator(".compass");
      const n = (await states(page)).length;
      expect(n, "the sun, four dots and four needles turn").toBeGreaterThanOrEqual(5);

      // Hidden at the top.
      await expect(compass).not.toHaveClass(/is-on/);
      expect(new Set(await states(page)), "hidden at the top").toEqual(new Set(["paused"]));

      // Shown after a hidden spell: running, in step with the sky.
      await page.waitForTimeout(HIDDEN_MS);
      await scrollTo(page, settle, 2 * vp.height);
      await expect(compass).toHaveClass(/is-on/);
      await page.waitForTimeout(300);
      expect(new Set(await states(page)), "shown").toEqual(new Set(["running"]));
      for (const g of await gaps(page)) expect(g).toBeLessThanOrEqual(ANGLE_TOL);

      // Hidden again by going back up, then shown after a spell.
      await scrollTo(page, settle, 0);
      await expect(compass).not.toHaveClass(/is-on/);
      await page.waitForTimeout(700);
      expect(new Set(await states(page)), "hidden after scrolling back up").toEqual(new Set(["paused"]));
      await page.waitForTimeout(HIDDEN_MS);
      await scrollTo(page, settle, 2 * vp.height);
      await expect(compass).toHaveClass(/is-on/);
      await page.waitForTimeout(300);
      for (const g of await gaps(page)) expect(g).toBeLessThanOrEqual(ANGLE_TOL);

      // Aside over the footer: paused; and in step again on the way back.
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await scrollTo(page, settle, max);
      await expect(compass).toHaveClass(/is-aside/);
      await page.waitForTimeout(700);
      expect(new Set(await states(page)), "aside over the footer").toEqual(new Set(["paused"]));
      await page.waitForTimeout(HIDDEN_MS);
      await scrollTo(page, settle, max - 2 * vp.height);
      await expect(compass).not.toHaveClass(/is-aside/);
      await page.waitForTimeout(300);
      for (const g of await gaps(page)) expect(g).toBeLessThanOrEqual(ANGLE_TOL);
    });
  });
}
