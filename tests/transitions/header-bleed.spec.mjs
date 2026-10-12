// T8: the header crosses the bleed-in whole. It is a full-width band over the
// hero: it takes the world's colours only once the disc covers all of it (a
// band crossed at its centre goes dark over the cream still around the disc),
// and its ground and its ink cross together (the labels inherit the header's
// own crossfade, frame for frame, rather than chasing it level by level).
import { test, expect } from "../helpers/fixtures.mjs";
import { WORLDS, recordBleed, bleedEnd, scrollToY } from "../helpers/transitions.mjs";

const arrive = async (page, world) => {
  await page.addInitScript(recordBleed);
  await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch (e) {} });
  await page.goto(`${process.env.NTS_BASE}/${world}/`, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__bleed.events.includes("start"))).toBe(true);
};

// Whether the header has crossed, and how much of its box the disc covers:
// its four corners, each inside the disc's circle as it is drawn now.
const headerState = (page) =>
  page.evaluate(() => {
    const h = document.querySelector(".nts-header"), r = h.getBoundingClientRect();
    const disc = document.querySelector(".nts-night-disc").getBoundingClientRect();
    const cx = disc.left + disc.width / 2, cy = disc.top + disc.height / 2, R = disc.width / 2;
    const corners = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]];
    return {
      crossed: !h.classList.contains("nts-bleed-old"),
      covered: corners.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= R + 0.5).length,
    };
  });

test.describe("T8 the header crosses the bleed-in whole", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  WORLDS.forEach((world) => {
    test(`T8 ${world}: the header crosses once the disc covers it, ground and ink together`, async ({ page }) => {
      await arrive(page, world);
      const end = await bleedEnd(page);

      // Down the scroll in small steps: the header never wears the world's
      // colours while any corner of it is still over the hero's NTS ground.
      let at = null;
      for (let y = 0; y < end; y += 4) {
        await scrollToY(page, y);
        const s = await headerState(page);
        if (s.crossed) expect(s.covered, `corners of the header under the disc when it crossed, at scroll ${y}`).toBe(4);
        if (s.crossed && at === null) { at = y; break; }
      }
      expect(at, "the header crosses before the world settles").not.toBeNull();

      // Back above that point, then over it again, sampling every frame of the
      // crossfade: each label's ink is the header's own colour at that frame.
      await scrollToY(page, at - 8);
      await page.waitForTimeout(400);
      const frames = await page.evaluate(async (y) => {
        const h = document.querySelector(".nts-header");
        const labels = [...h.querySelectorAll(".nts-nav a span")];
        scrollTo({ top: y, behavior: "instant" });
        const out = [], t0 = performance.now();
        while (performance.now() - t0 < 600) {
          await new Promise((r) => requestAnimationFrame(r));
          const ink = getComputedStyle(h).color;
          out.push({ t: Math.round(performance.now() - t0), ink, off: labels.map((l) => getComputedStyle(l).color).filter((c) => c !== ink) });
        }
        return out;
      }, at);
      const apart = frames.filter((f) => f.off.length);
      expect(apart.map((f) => `${f.t}ms header ${f.ink} labels ${f.off.join(" ")}`), "frames where a label's ink is not the header's").toEqual([]);
    });
  });
});
