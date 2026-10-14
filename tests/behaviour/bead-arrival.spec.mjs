// The home's beads are at full size from the first paint: no arrival animation holds
// them small while the page loads.
import { test, expect } from "../helpers/fixtures.mjs";

test("the home's bead faces have no animation and no scale from first paint", async ({ page }) => {
  await page.addInitScript(() => {
    window.__beads = [];
    const look = () => {
      const faces = document.querySelectorAll(".bead .face");
      if (faces.length) {
        window.__beads.push([...faces].map((f) => ({ anims: f.getAnimations().length, transform: getComputedStyle(f).transform })));
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await page.goto(process.env.NTS_BASE + "/");
  await page.waitForFunction(() => window.__beads.length > 3);
  const seen = await page.evaluate(() => window.__beads);
  expect(seen.length).toBeGreaterThan(3);
  for (const frame of seen) for (const f of frame) {
    expect(f.anims, "running animations on a bead face").toBe(0);
    expect(f.transform, "a bead face's transform").toBe("none");
  }
});
