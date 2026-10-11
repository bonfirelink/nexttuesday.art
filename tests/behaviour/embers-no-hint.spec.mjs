// The EMBERS page shows no interaction hint; the canvas's aria-label still tells screen readers how to use it.
import { test, expect } from "../helpers/fixtures.mjs";

test.use({ viewport: { width: 390, height: 844 } });

test("E1 embers: no visible drag/tap hint", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/embers/");
  await page.waitForSelector("canvas.nts-hearth");
  expect(await page.locator("#hint, .hint, .cue").count()).toBe(0);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/drag|stoke/i);
  expect(await page.locator("canvas.nts-hearth").getAttribute("aria-label")).toBeTruthy();
});
