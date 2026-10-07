import { test, expect } from "../helpers/fixtures.mjs";
import {
  WORLDS, groundLuma, rowLuma, recordBleed, clickWorldLink, bleedState, bleedEnd, scrollToY, bleedProgress,
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
          return {
            night: document.querySelectorAll(".nts-night").length,
            old: document.querySelectorAll(".nts-bleed-old").length,
            styles: window.__heroStyles(),
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

// The dark the visitor sees while the disc opens (inside the disc over the
// hero, and on the ground below the hero) is the settled world's ground:
// the same colour and the same texture (INTERSECT's grain), not a flatter or
// lighter one that switches later. Median luminance, in 0..255.
const GROUND_TOLERANCE = 2;

for (const [label, viewport] of [["1000x560", { width: 1000, height: 560 }], ["390x844", { width: 390, height: 844 }]]) {
  test.describe(`bleed ground ${label}`, () => {
    test.use({ viewport, deviceScaleFactor: 1 });
    for (const world of WORLDS) {
      test(`T3 the ${world} bleed shows the settled ground in the disc and below the hero, ${label}`, async ({ page }) => {
        await arrive(page, world, "flag");
        await page.waitForTimeout(700); // the grain's own fade, if any
        const end = await bleedEnd(page);
        // The section's own text and figures are not the ground: the median skips them.
        const measure = () => page.evaluate(() => {
          const hero = document.querySelector("main .hero").getBoundingClientRect();
          const disc = document.querySelector(".nts-night-disc");
          const d = disc && disc.getBoundingClientRect();
          return {
            heroBottom: hero.bottom,
            disc: d && { cx: d.left + d.width / 2, cy: d.top + d.height / 2, r: d.width / 2 },
          };
        });
        const regions = (m) => [
          { x: 0, y: 60, w: viewport.width, h: Math.max(0, m.heroBottom - 60), disc: m.disc && { cx: m.disc.cx, cy: m.disc.cy, r: m.disc.r - 4 } },
          { x: 0, y: m.heroBottom + 4, w: viewport.width, h: Math.max(0, viewport.height - m.heroBottom - 4) },
        ];
        const y = Math.round(0.5 * end);
        await scrollToY(page, y);
        expect(await bleedState(page)).toBe("in");
        const m = await measure();
        const during = await groundLuma(page, regions(m));
        // Settle, come back to the same scroll: the same view in the world.
        await scrollToY(page, Math.round(end) + 5);
        await expect.poll(() => bleedState(page)).toBe("world");
        await scrollToY(page, y);
        await page.waitForTimeout(700);
        const after = await groundLuma(page, regions(m));
        expect(during[0], "ground sampled inside the disc over the hero").not.toBeNull();
        expect(after[0]).not.toBeNull();
        expect(Math.abs(during[0] - after[0]), `disc ground ${during[0]} vs settled ${after[0]}`).toBeLessThanOrEqual(GROUND_TOLERANCE);
        if (during[1] !== null && after[1] !== null) {
          expect(Math.abs(during[1] - after[1]), `ground below the hero ${during[1]} vs settled ${after[1]}`).toBeLessThanOrEqual(GROUND_TOLERANCE);
        }
      });
    }
  });
}

// The hero's foot is seamless: no row across the boundary between the disc
// (the hero's night copy) and the section below differs from the ground
// beside it, at state `in` and settled, on a width where the disc layer lands off the device pixel grid.
const SEAM_TOLERANCE = 2;
const SEAM_SCALES = [2, 3];

for (const scale of SEAM_SCALES) {
  test.describe(`bleed seam scale ${scale}`, () => {
    test.use({ viewport: { width: 1117, height: 700 }, deviceScaleFactor: scale });
    for (const world of WORLDS) {
      test(`T3 the ${world} bleed has no seam at the hero's foot, scale ${scale}`, async ({ page }) => {
        await arrive(page, world, "flag");
        await page.waitForTimeout(700);
        const end = await bleedEnd(page);
        const y = Math.round(0.5 * end);
        const rows = async () => {
          const foot = await page.evaluate(() => document.querySelector("main .hero").getBoundingClientRect().bottom);
          const dev = Math.round(foot * scale), band = 10 * scale;
          // the columns where the disc covers the hero's foot: the right fifth
          const r = await rowLuma(page, Math.round(800 * scale), Math.round(980 * scale), dev - band, dev + band);
          const ref = [...r.slice(0, 4), ...r.slice(-4)].sort((a, b) => a - b)[4];
          return { ref, worst: Math.max(...r.map((v) => Math.abs(v - ref))), r };
        };
        await scrollToY(page, y);
        expect(await bleedState(page)).toBe("in");
        const during = await rows();
        expect(during.worst, `in: ground ${during.ref}, rows ${during.r.join(",")}`).toBeLessThanOrEqual(SEAM_TOLERANCE);
        await scrollToY(page, Math.round(end) + 5);
        await expect.poll(() => bleedState(page)).toBe("world");
        await scrollToY(page, y);
        await page.waitForTimeout(700);
        const after = await rows();
        expect(after.worst, `world: ground ${after.ref}, rows ${after.r.join(",")}`).toBeLessThanOrEqual(SEAM_TOLERANCE);
      });
    }
  });
}
