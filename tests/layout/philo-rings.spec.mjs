// L2. The PHILO ring plate spans the screen, is centred on the orbit and fades out before the hero's edges.
import { test, expect } from "../helpers/fixtures.mjs";
import { rectOf, probeLength, openPage } from "../helpers/geometry.mjs";

test.use({ reducedMotion: "reduce" });

for (const [width, height] of [[390, 844], [1024, 768], [1440, 800]]) {
  test(`L2 PHILO ring plate is centred on the orbit and spans the screen at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/not-not-philo/");

    // the plate is the hero's ::before box; its centre is the point the CSS resolves --cx/--cy to
    const hero = await rectOf(page, ".philo-rings");
    const trace = await rectOf(page, ".trace", ".philo-rings");
    const cx = hero.x + (await probeLength(page, ".philo-rings", "var(--cx)", "left"));
    const cy = hero.y + (await probeLength(page, ".philo-rings", "var(--cy)", "top"));
    expect(cx, "plate centre x vs orbit centre").toBeCloseTo(trace.cx, 0);
    expect(cy, "plate centre y vs orbit centre").toBeCloseTo(trace.cy, 0);

    expect(hero.x, "plate left edge").toBeCloseTo(0, 0);
    expect(hero.w, "plate width vs viewport").toBeCloseTo(width, 0);

    const fade = await page.evaluate(() => getComputedStyle(document.querySelector(".philo-rings"), "::after").backgroundImage);
    expect(fade, "fade over the plate's top and bottom").toContain("linear-gradient");

    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, "horizontal overflow").toBeLessThanOrEqual(0);
  });
}
