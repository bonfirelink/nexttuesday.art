// The philo figure keeps ticking under a pressed pointer, unlike the other worlds' figures.
import { test, expect } from "../helpers/fixtures.mjs";
import { TIP_Y, recordPaints, paints } from "../helpers/behaviour.mjs";

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

async function open(page) {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  const host = page.locator(".nts-penrose");
  await host.scrollIntoViewIfNeeded();
  const box = await host.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height * TIP_Y };
}

test("H1 philo figure: the cubes keep moving while the pointer is down after a drag", async ({ page }) => {
  const { x, y } = await open(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 6, { steps: 4 });
  await wait(page, 200);
  // the pointer rests, still down: any change is the cubes' tick
  expect(await changes(page, await grab(page)), "pose while held").toBe(true);

  // and a drag while held still turns it: the latest paint's yaw follows the pointer
  await recordPaints(page);
  await page.mouse.move(x + 1, y + 6);
  await wait(page, 200);
  const yawBefore = (await paints(page)).at(-1)?.yaw ?? 0;
  await page.mouse.move(x + 60, y + 6, { steps: 4 });
  await wait(page, 200);
  const turned = await paints(page);
  expect(turned.length, "paints after the drag").toBeGreaterThan(0);
  // 40 px more at 0.011 rad a px
  expect(turned.at(-1).yaw - yawBefore, "the second drag turns it").toBeGreaterThan(0.3);
  await page.mouse.up();
});

test("H2 philo figure: a press without a turn does not hold the cubes", async ({ page }) => {
  const { x, y } = await open(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await wait(page, 200);
  expect(await page.evaluate(() => document.querySelector(".nts-penrose").classList.contains("is-grabbing")), "the press grabbed").toBe(true);
  expect(await changes(page, await grab(page)), "pressed, not turned").toBe(true);
  await page.mouse.up();
});
