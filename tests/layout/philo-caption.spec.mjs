// L2. The PHILO figure caption's text is centred under the orbit, not left-aligned in its box.
import { test, expect } from "../helpers/fixtures.mjs";
import { rectOf, openPage } from "../helpers/geometry.mjs";

test.use({ reducedMotion: "reduce" });

for (const [width, height] of [[390, 844], [1440, 800]]) {
  test(`L2 PHILO figure caption is centred on the orbit at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/not-not-philo/");

    const trace = await rectOf(page, ".trace");
    // the text's own extent: the box spans the figure's column whatever its alignment
    const textCx = await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".fig"));
      const r = range.getBoundingClientRect();
      return r.left + r.width / 2;
    });
    expect(Math.abs(textCx - trace.cx), "caption text centre vs orbit centre").toBeLessThan(1);
  });
}
