// A touch drag that starts on the PHILO page figure turns it and does not scroll the page; one that
// starts on empty space in the figure's box scrolls. Touch events through the browser's input
// protocol (Chromium), since the test runner has no touch drag of its own.
import { test, expect } from "../helpers/fixtures.mjs";
import { recordPaints, paints, figurePoint, lastPose } from "../helpers/behaviour.mjs";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function drag(page, [x, y], dy) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  await send("touchStart", [{ x, y }]);
  for (let i = 1; i <= 12; i++) { await send("touchMove", [{ x, y: y + (dy * i) / 12 }]); await page.waitForTimeout(16); }
  await send("touchEnd", []);
  await page.waitForTimeout(700);
}

async function open(page) {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  await page.locator(".nts-penrose").scrollIntoViewIfNeeded();
  await recordPaints(page);
  await page.waitForTimeout(300);
}

test("TC1 a vertical touch drag from the figure turns it and the page stays; from empty space in the box the page scrolls", async ({ page }) => {
  await open(page);
  let y0 = await page.evaluate(() => scrollY);
  // up the right leg (the way the page would scroll): anticlockwise, toward the right pose
  await drag(page, await figurePoint(page, 2), -70);
  expect((await lastPose(page))[0], "turned").toBeGreaterThan(0.1);
  expect(await page.evaluate(() => scrollY), "the page did not scroll").toBe(y0);

  await open(page);
  y0 = await page.evaluate(() => scrollY);
  const box = await page.locator(".nts-penrose").boundingBox();
  await drag(page, [box.x + 8, box.y + 8], -120);
  expect(await page.evaluate(() => scrollY), "the page scrolled").toBeGreaterThan(y0 + 40);
  expect((await paints(page)).every((p) => p.yaw === 0), "not turned").toBe(true);
});
