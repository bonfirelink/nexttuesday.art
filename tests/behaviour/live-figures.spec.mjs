// B6 one live home figure at a time, and still until its window is open.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open, scrollTo } from "../helpers/behaviour.mjs";

// The duration is the measurement: at the slowest figure's 15 fps, 600 ms is at least 4 frames.
const WATCH_MS = 600;
const POSITIONS = 12;

// Snapshot every figure canvas, wait WATCH_MS, snapshot again; report which changed.
async function watchCanvases(page) {
  return page.evaluate(async (ms) => {
    const frags = [...document.querySelectorAll("[data-nts-fragment]")];
    const win = (f) => f.closest(".world.ecl");
    const grab = () => frags.map((f) => [...f.querySelectorAll("canvas")].map((c) => c.toDataURL()).join("|"));
    const openBefore = frags.map((f) => win(f).classList.contains("is-open"));
    const a = grab();
    await new Promise((r) => setTimeout(r, ms));
    const b = grab();
    const openAfter = frags.map((f) => win(f).classList.contains("is-open"));
    return frags.map((f, i) => ({
      world: f.getAttribute("data-nts-fragment"),
      canvases: f.querySelectorAll("canvas").length,
      changed: a[i] !== b[i],
      closed: !openBefore[i] && !openAfter[i],
    }));
  }, WATCH_MS);
}

for (const vp of VIEWPORTS) {
  test.describe(`live figures at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("B6 at most one figure moves, none before its window is open, one when it is", async ({ page, settle }) => {
      await open(page);
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let i = 0; i < POSITIONS; i++) {
        const y = Math.round((max * i) / (POSITIONS - 1));
        await scrollTo(page, settle, y);
        const seen = await watchCanvases(page);
        for (const s of seen) expect(s.canvases, `${s.world} has a canvas`).toBeGreaterThan(0);
        const moving = seen.filter((s) => s.changed).map((s) => s.world);
        expect(moving.length, `moving at y=${y}: ${moving}`).toBeLessThanOrEqual(1);
        const early = seen.filter((s) => s.changed && s.closed).map((s) => s.world);
        expect(early, `moving before their window opened, at y=${y}`).toEqual([]);
      }

      // A window open in the middle of the viewport: its figure, and only its figure, moves.
      for (const id of ["embers", "not-not-philo", "field"]) {
        await page.evaluate((id) => {
          const r = document.getElementById(id).getBoundingClientRect();
          scrollTo({ top: r.top + scrollY + r.height / 2 - innerHeight / 2, behavior: "instant" });
        }, id);
        await settle(page);
        await expect(page.locator("#" + id)).toHaveClass(/is-open/);
        const world = await page.evaluate((id) => document.getElementById(id).dataset.world, id);
        const moving = (await watchCanvases(page)).filter((s) => s.changed).map((s) => s.world);
        expect(moving, `moving with #${id} in the middle`).toEqual([world]);
      }
    });
  });
}
