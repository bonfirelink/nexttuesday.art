// T8: the header crosses the bleed-in whole. It is a full-width band over the
// hero: it takes the world's colours only once the disc covers all of it (a
// band crossed at its centre goes dark over the cream still around the disc),
// and its ground and its ink cross together (the labels inherit the header's
// own crossfade, frame for frame, rather than chasing it level by level).
import { test, expect } from "../helpers/fixtures.mjs";
import { WORLDS, recordBleed, BLEED_FIRE_AT, BLEED_MS } from "../helpers/transitions.mjs";

const arrive = async (page, world) => {
  await page.addInitScript(recordBleed);
  await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch (e) {} });
  await page.goto(`${process.env.NTS_BASE}/${world}/`, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__bleed.events.includes("start"))).toBe(true);
};

test.describe("T8 the header crosses the bleed-in whole", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  WORLDS.forEach((world) => {
    test(`T8 ${world}: the header crosses once the disc covers it, ground and ink together`, async ({ page }) => {
      await arrive(page, world);
      // Every frame of the run: the header is not crossed at the start, never
      // wears the world's colours while a corner of it is still over the hero's
      // NTS ground, and while it fades each label's ink is the header's own.
      const frames = await page.evaluate(async ({ fire, ms }) => {
        const h = document.querySelector(".nts-header");
        const labels = [...h.querySelectorAll(".nts-nav a span")];
        const out = [], t0 = performance.now();
        scrollTo({ top: fire, behavior: "instant" });
        while (performance.now() - t0 < ms + 1000 && document.documentElement.getAttribute("data-bleed-state") !== "world") {
          await new Promise((r) => requestAnimationFrame(r));
          const d = document.querySelector(".nts-night-disc");
          if (!d) break;
          const r = h.getBoundingClientRect(), disc = d.getBoundingClientRect();
          const cx = disc.left + disc.width / 2, cy = disc.top + disc.height / 2, R = disc.width / 2;
          const corners = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]];
          const ink = getComputedStyle(h).color;
          out.push({
            t: Math.round(performance.now() - t0),
            crossed: !h.classList.contains("nts-bleed-old"),
            covered: corners.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= R + 0.5).length,
            ink,
            off: labels.map((l) => getComputedStyle(l).color).filter((c) => c !== ink),
          });
        }
        return out;
      }, { fire: BLEED_FIRE_AT + 4, ms: BLEED_MS });
      const first = frames.findIndex((f) => f.crossed);
      expect(first, "the header crosses before the world settles").toBeGreaterThan(0);
      for (const f of frames.slice(first)) expect(f.covered, `corners of the header under the disc at ${f.t}ms`).toBe(4);
      const apart = frames.filter((f) => f.off.length);
      expect(apart.map((f) => `${f.t}ms header ${f.ink} labels ${f.off.join(" ")}`), "frames where a label's ink is not the header's").toEqual([]);
    });
  });
});
