import { test, expect } from "../helpers/fixtures.mjs";
import {
  WORLDS, recordBleed, clickWorldLink, bleedState, bleedEnd, scrollToY, bleedProgress,
} from "../helpers/transitions.mjs";

const UP = [0.15, 0.3, 0.45, 0.6, 0.75];
const DOWN = [0.4, 0.1, 0];
const ON = [0.5, 0.9, 1.05];

const arrive = async (page, world, how) => {
  await page.addInitScript(recordBleed);
  if (how === "click") {
    await page.goto(process.env.NTS_BASE + "/", { waitUntil: "load" });
    await clickWorldLink(page, world);
  } else {
    await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch (e) {} });
    await page.goto(`${process.env.NTS_BASE}/${world}/`, { waitUntil: "load" });
  }
  // The copy is made at DOMContentLoaded; its `start` event says it exists.
  await expect.poll(() => page.evaluate(() => window.__bleed.events.includes("start"))).toBe(true);
};

function bleedTests(label, viewport, deviceScaleFactor, tag) {
  test.describe(label, () => {
    test.use({ viewport, deviceScaleFactor });
    WORLDS.forEach((world, i) => {
      // One run per world arrives by the real click on the home page.
      const how = label.startsWith("390") ? "click" : "flag";
      test(`T3 the ${world} bleed-in progresses, reverses and settles, ${label} ${how} ${tag}`.trim(), async ({ page }) => {
        await arrive(page, world, how);

        const dcl = await page.evaluate(() => window.__bleed.dcl);
        expect(dcl.state, "state at DOMContentLoaded").toBe("before");
        expect(dcl.night, "no copy yet at DOMContentLoaded").toBe(false);
        expect(await bleedState(page)).toBe("in");

        // While the copy exists: no view-transition-name in it, and the twin's
        // ASCII font size is the original's.
        const copy = await page.evaluate(() => {
          const night = document.querySelector(".nts-night");
          const named = night
            ? [night, ...night.querySelectorAll("*")].filter((e) => getComputedStyle(e).viewTransitionName !== "none").map((e) => e.className)
            : null;
          const pre = document.querySelector("main .hero pre[data-nts-ascii]");
          const twin = pre && window.NTS.bleed.twin(pre);
          return { night: !!night, named, ascii: pre ? [getComputedStyle(pre).fontSize, twin && getComputedStyle(twin).fontSize] : null };
        });
        expect(copy.night).toBe(true);
        expect(copy.named, "elements in the copy with a view-transition-name").toEqual([]);
        if (world === "intersect") {
          expect(copy.ascii, "INTERSECT has its ASCII figure").not.toBeNull();
          expect(copy.ascii[1], "twin font size").toBe(copy.ascii[0]);
        }

        const end = await bleedEnd(page);
        expect(await bleedProgress(page)).toBe(0);
        let last = 0;
        for (const f of UP) {
          await scrollToY(page, Math.round(f * end));
          const p = await bleedProgress(page);
          expect(p, `progress at ${f}`).toBeGreaterThan(last);
          expect(p).toBeLessThanOrEqual(1);
          expect(await bleedState(page), `state at ${f}`).toBe("in");
          last = p;
        }
        for (const f of DOWN) {
          await scrollToY(page, Math.round(f * end));
          const p = await bleedProgress(page);
          if (f === 0) expect(p, "progress back at the top").toBe(0);
          else expect(p, `progress falls at ${f}`).toBeLessThan(last);
          expect(await bleedState(page), `state at ${f}`).toBe("in");
          last = p;
        }
        for (const f of ON) {
          await scrollToY(page, Math.round(f * end));
          const p = await bleedProgress(page);
          if (f < 1) {
            expect(p, `progress rises again at ${f}`).toBeGreaterThan(last);
            expect(p).toBeLessThan(1);
          } else expect(p, "progress at the end").toBe(1);
          last = p;
        }
        await expect.poll(() => bleedState(page), "the state settles").toBe("world");
        await expect.poll(() => page.evaluate(() => window.__bleed.events)).toEqual(["start", "end"]);

        await scrollToY(page, 0);
        expect(await bleedState(page), "world stays world at the top").toBe("world");
        const after = await page.evaluate(() => {
          const hero = document.querySelector("main .hero");
          return {
            night: document.querySelectorAll(".nts-night").length,
            old: document.querySelectorAll(".nts-bleed-old").length,
            styles: [hero, ...hero.querySelectorAll("*")].map((e) => e.getAttribute("style")),
            events: window.__bleed.events,
          };
        });
        expect(after.night, ".nts-night left behind").toBe(0);
        expect(after.old, ".nts-bleed-old left behind").toBe(0);
        expect(after.styles, "hero style attributes as before the bleed").toEqual(dcl.styles);
        expect(after.events).toEqual(["start", "end"]);
      });
    });
  });
}

bleedTests("390 scale 1", { width: 390, height: 844 }, 1, "");
bleedTests("1440 scale 1", { width: 1440, height: 900 }, 1, "");
bleedTests("390 scale 2", { width: 390, height: 844 }, 2, "@slow");

test.describe("no bleed on a direct landing or a reload", () => {
  for (const world of WORLDS) {
    test(`T3 ${world}: landing directly and reloading give world`, async ({ page }) => {
      await page.addInitScript(recordBleed);
      await page.goto(`${process.env.NTS_BASE}/${world}/`, { waitUntil: "load" });
      for (const step of ["landing", "reload"]) {
        if (step === "reload") await page.reload({ waitUntil: "load" });
        const dcl = await page.evaluate(() => window.__bleed.dcl);
        expect(dcl.state, `${step}: state at DOMContentLoaded`).toBe("world");
        expect(dcl.night, `${step}: no copy`).toBe(false);
        expect(await page.locator(".nts-night").count()).toBe(0);
      }
    });
  }
});
