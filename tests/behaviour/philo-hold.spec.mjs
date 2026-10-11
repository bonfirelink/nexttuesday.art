// The philo figure holds still under a pressed pointer, as the other worlds' figures do.
import { test, expect } from "../helpers/fixtures.mjs";

test.use({ viewport: { width: 390, height: 844 } });

const grab = (page) => page.evaluate(() => document.querySelector(".nts-penrose canvas").toDataURL());
const wait = (page, ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);

test("H1 philo figure: still while pressed, moving again after release", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  const host = page.locator(".nts-penrose");
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

  // a drag while held still shows
  await page.mouse.move(x + 60, y + 6, { steps: 4 });
  await wait(page, 100);
  expect(await grab(page), "drag repaints").not.toBe(b);

  await page.mouse.up();
  const c = await grab(page);
  await wait(page, 800);
  expect(await grab(page), "moves after release").not.toBe(c);
});
