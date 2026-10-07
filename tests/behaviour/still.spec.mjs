// B4 the home portals don't scale on scroll, B5 the top emblem doesn't shrink or dim,
// and the emblem keeps its original size rather than the world ring's.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open, scrollTo } from "../helpers/behaviour.mjs";

const SIZE_TOL = 0.5; // px: sizes read straight from CSS
const OPACITY_DIGITS = 3; // opacity products agree to 0.0005
const ORB_FRACS = [0.7, 0.6, 0.5, 0.4, 0.3]; // where the orb's top sits, as a share of the viewport height
const ORB_ENTRY_K = [0.25, 0.5, 0.75]; // the share of its own height the orb has entered by
const TOP_TOL = 1; // px: how closely a scroll must land on its target
// The emblem's original box in CSS px, as recorded from the live site (the viewport's width on
// a phone). A variant sized to the world ring (559 px at 1440) differs by more than the tolerance.
const EMBLEM_WIDTH = { 390: 390, 1440: 565.72 };

// Everything the aperture parts add (the opening disc and its inverse) is left out.
const APERTURE_PART = ".ecl-disc, .ecl-in";

for (const vp of VIEWPORTS) {
  test.describe(`stillness at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("B4 a home portal keeps its size, scale and opacity while it scrolls", async ({ page, settle }) => {
      await open(page);
      const count = await page.locator(".world .orb").count();
      expect(count).toBe(3);
      // Where the orb's top should sit, in px from the viewport's top. Samples are
      // the shares of the viewport height above, then ones where the orb is only
      // partly in (`innerHeight - k * orbHeight`), which an entry-range animation
      // is still running at.
      const measure = ([i, skip]) => {
        const orb = document.querySelectorAll(".world .orb")[i];
        const r = orb.getBoundingClientRect();
        let opacity = 1;
        const own = [];
        for (let el = orb; el && el !== document.documentElement; el = el.parentElement) {
          const cs = getComputedStyle(el);
          opacity *= parseFloat(cs.opacity);
          if (!el.matches(skip)) own.push(`${cs.scale}|${cs.transform}`);
        }
        return { w: r.width, h: r.height, top: r.top, opacity, own: own.join(";"), inView: r.bottom > 0 && r.top < innerHeight };
      };
      for (let i = 0; i < count; i++) {
        const seen = [];
        const sample = async (label, targetTop) => {
          // The scroll lands on the target or the sample is void: a clamped scroll fails here.
          const doc = await page.evaluate((i) => {
            const r = document.querySelectorAll(".world .orb")[i].getBoundingClientRect();
            return r.top + scrollY;
          }, i);
          const y = doc - targetTop;
          if (y < 0) return null; // the orb sits too near the page top to reach this position
          await scrollTo(page, settle, y);
          const s = await page.evaluate(measure, [i, APERTURE_PART]);
          expect(Math.abs(s.top - targetTop), `orb ${i} at ${label}: top lands on ${targetTop.toFixed(0)}px`).toBeLessThanOrEqual(TOP_TOL);
          return { ...s, label };
        };
        for (const f of ORB_FRACS) {
          const s = await sample(`${f} of the viewport`, vp.height * f);
          if (s) seen.push(s);
        }
        const orbHeight = seen[seen.length - 1]?.h;
        if (i > 0) {
          for (const k of ORB_ENTRY_K) {
            const s = await sample(`${k} of its height in`, vp.height - k * orbHeight);
            if (s) seen.push(s);
          }
          expect(seen.length, `orb ${i} reached every sample`).toBe(ORB_FRACS.length + ORB_ENTRY_K.length);
        }
        expect(seen.length, `orb ${i} has samples`).toBeGreaterThan(0);
        const first = seen[0];
        seen.forEach((s) => {
          const at = `orb ${i} at ${s.label}`;
          expect(s.inView, `${at} is in view`).toBe(true);
          expect(Math.abs(s.w - first.w), `${at} width`).toBeLessThanOrEqual(SIZE_TOL);
          expect(Math.abs(s.h - first.h), `${at} height`).toBeLessThanOrEqual(SIZE_TOL);
          expect(s.own, `${at} scale and transform`).toBe(first.own);
          expect(s.opacity, `${at} opacity`).toBeCloseTo(first.opacity, OPACITY_DIGITS);
        });
      }
    });

    test("B5 the top emblem keeps its size and opacity as it scrolls away", async ({ page, settle }) => {
      await open(page);
      const read = () =>
        page.evaluate(() => {
          const el = document.querySelector(".orrery");
          const r = el.getBoundingClientRect();
          let opacity = 1;
          for (let e = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
          return { w: r.width, h: r.height, opacity };
        });
      const start = await read();
      for (const f of [0.25, 0.5]) {
        await scrollTo(page, settle, vp.height * f);
        const now = await read();
        expect(Math.abs(now.w - start.w), `width at ${f} of a viewport`).toBeLessThanOrEqual(SIZE_TOL);
        expect(Math.abs(now.h - start.h), `height at ${f} of a viewport`).toBeLessThanOrEqual(SIZE_TOL);
        expect(now.opacity, `opacity at ${f} of a viewport`).toBeCloseTo(start.opacity, OPACITY_DIGITS);
      }
    });

    test("the home emblem keeps its original size, not the world ring's", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page);
      const size = await page.evaluate(() => {
        const r = document.querySelector(".orrery").getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      expect(Math.abs(size.w - EMBLEM_WIDTH[vp.name]), "emblem width").toBeLessThanOrEqual(SIZE_TOL);
      expect(Math.abs(size.h - size.w), "emblem is square").toBeLessThanOrEqual(SIZE_TOL);
    });
  });
}
