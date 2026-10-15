// The philo figure holds still under a pressed pointer, as the other worlds' figures do.
import { test, expect } from "../helpers/fixtures.mjs";

test.use({ viewport: { width: 390, height: 844 } });

const grab = (page) => page.evaluate(() => document.querySelector(".nts-penrose canvas").toDataURL());
const wait = (page, ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
// The cubes rest between steps, one every 3 s, and look alike after a whole tick: watch
// for longer than a tick, comparing every snapshot rather than the ends.
const BEAT_MS = 3200;
const SAMPLE_MS = 100;
// Whether the canvas differs from `first` at any sample over BEAT_MS.
async function changes(page, first) {
  for (let t = 0; t < BEAT_MS; t += SAMPLE_MS) {
    await wait(page, SAMPLE_MS);
    if ((await grab(page)) !== first) return true;
  }
  return false;
}
// The tip cube, which a cube always fills at rest: centred, this share of the host's height down.
const TIP_Y = 0.17;

test("H1 philo figure: still while pressed, a drag still repaints", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  const host = page.locator(".nts-penrose");
  await host.scrollIntoViewIfNeeded();
  const box = await host.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height * TIP_Y;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 6, { steps: 4 });
  await wait(page, 200);
  const a = await grab(page);
  expect(await changes(page, a), "pose while held").toBe(false);
  const b = await grab(page);

  // a drag while held still shows
  await page.mouse.move(x + 60, y + 6, { steps: 4 });
  await wait(page, 100);
  expect(await grab(page), "drag repaints").not.toBe(b);

  await page.mouse.up();
});

test("H2 philo figure: a press without a turn holds it, and the cubes move again after release", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  const host = page.locator(".nts-penrose");
  await host.scrollIntoViewIfNeeded();
  const box = await host.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * TIP_Y);
  await page.mouse.down();
  await wait(page, 200);
  expect(await changes(page, await grab(page)), "held, not turned").toBe(false);
  await page.mouse.up();
  // no turn to settle back: any change is the cubes' tick
  expect(await changes(page, await grab(page)), "moves after release").toBe(true);
});
