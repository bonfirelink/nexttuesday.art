// The NOT NOT PHILO hero title is the logotype NOT² PHILO (a charcoal exponent 2 with a red plate);
// the name stays NOT NOT PHILO to assistive tech and in the page's meta, and the hero's lines under it are plain text, not plates.
import { test, expect } from "../helpers/fixtures.mjs";

for (const width of [360, 390, 1440]) {
  test(`P2 philo hero: logotype with an exponent 2, no plate label, at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(process.env.NTS_BASE + "/not-not-philo/");
    const h1 = page.locator("h1#title");
    await expect(h1).toHaveAttribute("aria-label", "NOT NOT PHILO");
    expect((await h1.innerText()).replace(/\s+/g, " ").trim()).toBe("NOT2 PHILO");
    const two = h1.locator(".philo-exp");
    await expect(two).toHaveText("2");
    await expect(two).toHaveAttribute("aria-hidden", "true");
    const st = await two.evaluate((e) => { const c = getComputedStyle(e); return { color: c.color, shadow: c.textShadow, h1: getComputedStyle(e.closest("h1")).color }; });
    expect(st.color).toBe("rgb(43, 45, 62)");
    expect(st.shadow).toMatch(/^rgb\(232, 30, 76\) -4px -4px/); // the plate is the key red, offset like the key's own plate
    // oversized: the 2 is at least .7 of the key's size, so it rises clearly above the caps
    const size = await two.evaluate((e) => parseFloat(getComputedStyle(e).fontSize) / parseFloat(getComputedStyle(e.parentElement).fontSize));
    expect(size).toBeGreaterThanOrEqual(0.7);
    expect(await page.locator(".hero-text .philo-bar").count()).toBe(0);
    expect(await page.locator("meta[property='og:title']").getAttribute("content")).toBe("NOT NOT PHILO");
    expect(await page.title()).toMatch(/NOT NOT PHILO/);
    // the plate and the raised 2 stay inside the viewport
    const r = await two.boundingBox();
    expect(r.x + r.width).toBeLessThanOrEqual(width);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
