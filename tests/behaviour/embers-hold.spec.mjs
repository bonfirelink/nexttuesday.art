// The EMBERS figure holds still under a pressed pointer, as the other worlds' figures do.
import { test, expect } from "../helpers/fixtures.mjs";

test.use({ viewport: { width: 390, height: 844 } });

// the figure's yaw and pitch, read through the canvas's pose accessor
const grab = (page) => page.evaluate(() => JSON.stringify(document.querySelector("canvas.nts-hearth").ntsPose()));
const wait = (page, ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);

test("H2 embers figure: rotation still while pressed, moving again after release", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/embers/");
  await page.waitForSelector("canvas.nts-hearth");
  const host = page.locator("canvas.nts-hearth");
  await host.scrollIntoViewIfNeeded();
  const box = await host.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 6, { steps: 4 });
  await wait(page, 200);
  const a = await grab(page);
  await wait(page, 800);
  const b = await grab(page);
  expect(b, "pose while held").toBe(a);

  await page.mouse.move(x + 60, y + 6, { steps: 4 });
  await wait(page, 100);
  expect(await grab(page), "drag turns it").not.toBe(b);

  await page.mouse.up();
  const c = await grab(page);
  await wait(page, 800);
  expect(await grab(page), "moves after release").not.toBe(c);
});
