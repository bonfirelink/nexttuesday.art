// R1-R6. Turning the PHILO page figure by hand: a tap picks a pose (from straight by where it
// lands, from a turned pose back to straight), a drag turns it like a wheel with a soft edge
// and lands by how far it went, and it stays on the pose it is let go on; the bleed-in's twin figure is
// masked while it is turned.
import { test, expect } from "../helpers/fixtures.mjs";
import { cubes } from "../helpers/cubes.mjs";
import { recordPaints, paints, figurePoint, lastPose } from "../helpers/behaviour.mjs";

test.use({ viewport: { width: 390, height: 844 } });

const [LEFT, STRAIGHT, RIGHT] = cubes.turn.POSES, DEG = 180 / Math.PI;
// the spring runs to its pose well inside this
const SETTLE_MS = 900;

async function open(page) {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  await page.locator(".nts-penrose").scrollIntoViewIfNeeded();
  await recordPaints(page);
  await page.waitForTimeout(300);
}
const near = (pose, want) => { expect(pose[0] * DEG).toBeCloseTo(want[0] * DEG, 1); expect(pose[1] * DEG).toBeCloseTo(want[1] * DEG, 1); };
// Presses at [x, y], moves by (dx, dy) in steps, lets go; for a tap, no move.
async function stroke(page, [x, y], dx = 0, dy = 0, steps = 10) {
  await page.mouse.move(x, y);
  await page.mouse.move(x + 0.5, y);
  await page.waitForTimeout(80);
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (dx || dy) await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
}

test("R1 a tap on the straight figure turns it right on the right leg and on places 3, 4 and 5; left on the left leg, place 6 and the top", async ({ page }) => {
  const cases = [[1, RIGHT], [2, RIGHT], [3, RIGHT], [4, RIGHT], [7, LEFT], [8, LEFT], [6, LEFT], [0, LEFT]];
  for (const [place, want] of cases) {
    await open(page);
    await stroke(page, await figurePoint(page, place));
    near(await lastPose(page), want);
  }
});

test("R2 from either turned pose any tap goes back to straight, and the figure stays on a pose until then", async ({ page }) => {
  for (const to of [LEFT, RIGHT]) {
    await open(page);
    await stroke(page, await figurePoint(page, to === LEFT ? 7 : 1));
    near(await lastPose(page), to);
    // held 1.2 s and more: it used to settle back by now
    await page.waitForTimeout(2500);
    near(await lastPose(page), to);
    // any tap on the turned figure, on a cube of the top turn
    await stroke(page, await figurePoint(page, to === LEFT ? 1 : 7, ...to));
    near(await lastPose(page), STRAIGHT);
  }
});

test("R3 the wheel: anticlockwise round the centre turns right (left leg down, bottom to the right), clockwise left (right leg down); the edge is soft", async ({ page }) => {
  const cases = [[7, 0, 60, RIGHT, "the left leg, down"], [4, 60, 0, RIGHT, "the bottom, to the right"], [2, 0, 60, LEFT, "the right leg, down"]];
  for (const [place, dx, dy, want, what] of cases) {
    await open(page);
    await stroke(page, await figurePoint(page, place), dx, dy);
    near(await lastPose(page), want);
    // the 60 px pulled past the pose; the figure gave at most 9 degrees there
    const yaws = (await paints(page)).map((p) => p.yaw * DEG);
    const past = want === RIGHT ? Math.max(...yaws) - RIGHT[0] * DEG : LEFT[0] * DEG - Math.min(...yaws);
    expect(past, `${what}: past the pose at the soft edge`).toBeGreaterThan(0.5);
    expect(past, `${what}: but by under 9 degrees`).toBeLessThan(9);
  }
});

test("R4 a drag under a third of the gap to the next pose goes back, over it goes there", async ({ page }) => {
  // left leg, down: 0.011 rad a px, so 8 px is 5 degrees and 14 px is 8.8, either side of 6.5 (a third of 19.5)
  await open(page);
  await stroke(page, await figurePoint(page, 7), 0, 8, 4);
  near(await lastPose(page), STRAIGHT);
  await stroke(page, await figurePoint(page, 7), 0, 14, 7);
  near(await lastPose(page), RIGHT);
});

test("R5 under 6 px of travel is a tap, over it a drag; the spring never passes the pose; a cancelled press is no tap", async ({ page }) => {
  // left leg, down: a 5 px stroke is a tap (straight to left), a 7 px one a drag of 4.4 degrees (back)
  await open(page);
  await stroke(page, await figurePoint(page, 7), 0, 5, 5);
  near(await lastPose(page), LEFT);
  await open(page);
  await stroke(page, await figurePoint(page, 7), 0, 7, 7);
  expect((await paints(page)).every((p) => p.yaw === 0 || Math.abs(p.yaw) < 0.1), "turned a little at most").toBe(true);
  near(await lastPose(page), STRAIGHT);

  // the run to the pose is critically damped: the yaw rises to the right pose and never beyond it
  await open(page);
  await stroke(page, await figurePoint(page, 2));
  const yaws = (await paints(page)).map((p) => p.yaw);
  expect(yaws.length, "painted on the way").toBeGreaterThan(3);
  expect(yaws.every((y, i) => i === 0 || y >= yaws[i - 1] - 1e-9), "rising").toBe(true);
  expect(Math.max(...yaws), "not past the pose").toBeLessThanOrEqual(RIGHT[0] + 1e-9);

  // a press the browser cancels after a small move does not count as a tap
  await open(page);
  const [x, y] = await figurePoint(page, 2);
  await page.mouse.move(x, y);
  await page.mouse.move(x + 0.5, y);
  await page.waitForTimeout(80);
  await page.mouse.down();
  await page.mouse.move(x, y + 2, { steps: 2 });
  await page.evaluate(() => document.querySelector(".nts-penrose").dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, bubbles: true })));
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
  expect((await paints(page)).every((p) => Math.abs(p.yaw) < 0.05), "still straight").toBe(true);
});

test("R6 arriving from the home page, the bleed-in's twin figure is masked like the real one while it is turned", async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1245 });
  await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch {} });
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  await recordPaints(page);
  await page.waitForTimeout(300);
  // the twin is cloned while the figure is straight; the turn comes after
  await stroke(page, await figurePoint(page, 1));
  await page.evaluate(() => { scrollTo({ top: 220, behavior: "instant" }); });
  const twinMask = () => page.evaluate(() => {
    const cv = document.querySelector(".nts-night .nts-penrose canvas");
    if (!cv) return "no twin";
    const s = getComputedStyle(cv);
    return s.maskImage !== "none" ? s.maskImage : s.webkitMaskImage;
  });
  expect(await page.evaluate(() => window.NTS.bleed.progress()), "the disc is partway open").toBeGreaterThan(0);
  await expect.poll(twinMask, "turned: the twin canvas is masked").not.toMatch(/^(none|no twin)$/);
  await stroke(page, await figurePoint(page, 1, ...RIGHT));
  await expect.poll(twinMask, "straight: the twin canvas is unmasked").toBe("none");
});
