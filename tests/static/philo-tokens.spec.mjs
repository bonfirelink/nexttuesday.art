// K2-K4. The figure's fallback tones in philo.js (used before the host's custom properties
// are read) are the PHILO world's tones in philo.css; the page figure's canvas is masked at
// its edge, the home fragment's is not, and the mask fades only beyond the rest figure.
import { test, expect } from "../helpers/fixtures.mjs";
import { readFileSync } from "node:fs";
import { TIP_Y, figurePoint } from "../helpers/behaviour.mjs";
import { cubes } from "../helpers/cubes.mjs";

const read = (f) => readFileSync(new URL(`../../site/_nts/worlds/${f}`, import.meta.url), "utf8");

test("K2 philo.js's fallback tones are philo.css's --penrose-* tokens", () => {
  const css = read("philo.css"), js = read("philo.js");
  const fallback = js.match(/let col = \{ top: "(#[0-9a-f]{6})", side: "(#[0-9a-f]{6})", dark: "(#[0-9a-f]{6})", ground: "(#[0-9a-f]{6})" \}/);
  expect(fallback, "philo.js's fallback col").toBeTruthy();
  const root = css.match(/--penrose-top: (#[0-9a-f]{6});\s*--penrose-side: (#[0-9a-f]{6});\s*--penrose-dark: (#[0-9a-f]{6});\s*--penrose-ground: (#[0-9a-f]{6});/);
  expect(root, "philo.css's :root tones").toBeTruthy();
  expect(fallback.slice(1)).toEqual(root.slice(1));
});

const heroMask = (page) => page.evaluate(() => getComputedStyle(document.querySelector(".nts-penrose canvas")).maskImage);
// Turns the figure by a drag from its tip cube and lets go.
async function turn(page) {
  const box = await page.locator(".nts-penrose").boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height * TIP_Y;
  await page.mouse.move(x, y);
  await page.mouse.move(x + 1, y);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 6, { steps: 6 });
  await page.mouse.up();
}
// Turned, the figure runs to its pose and stays; a tap on it sends it back.
const SETTLE_MS = 2000;

// K3. Only the page figure's canvas dissolves the screw at its edge, and only while the figure
// is turned: none at rest, the gradient while turned, none again once a tap has sent it straight.
test("K3 philo.css masks the page figure's canvas while it is turned, not at rest, not the home fragment's", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  await page.locator(".nts-penrose").scrollIntoViewIfNeeded();
  expect(await heroMask(page), "at rest").toBe("none");
  await turn(page);
  expect(await heroMask(page), "turned").toMatch(/radial-gradient/);
  await page.waitForTimeout(SETTLE_MS);
  expect(await heroMask(page), "still turned on its pose").toMatch(/radial-gradient/);
  await page.mouse.click(...(await figurePoint(page, 2, ...cubes.turn.POSES[0])));
  await page.waitForTimeout(SETTLE_MS);
  expect(await heroMask(page), "straight again").toBe("none");
  await page.goto(process.env.NTS_BASE + "/");
  await page.waitForFunction(() => document.querySelector("[data-nts-fragment='philo'] canvas"));
  const frag = await page.evaluate(() => getComputedStyle(document.querySelector("[data-nts-fragment='philo'] canvas")).maskImage);
  expect(frag, "the fragment canvas has no mask").toBe("none");
});

// K4. The mask's fade (from the last stop at full alpha to the first at none) begins beyond
// the rest figure's reach, so the rest pose is not touched.
test("K4 the mask starts fading beyond the rest figure's reach", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".nts-penrose")?.classList.contains("is-live"));
  await page.locator(".nts-penrose").scrollIntoViewIfNeeded();
  await turn(page);
  const m = await page.evaluate(() => {
    const host = document.querySelector(".nts-penrose"), c = host.querySelector("canvas");
    return {
      mask: getComputedStyle(c).maskImage,
      // the rest figure's furthest point, as a share of the canvas's half-size
      reach: (window.NTS.cubes.REST.page * Math.min(host.clientWidth, host.clientHeight)) / c.clientWidth,
    };
  });
  const stops = [...m.mask.matchAll(/rgba?\(([^)]*)\)\s+([\d.]+)%/g)].map((s) => { const v = s[1].split(",").map(Number); return { a: v.length > 3 ? v[3] : 1, at: +s[2] / 100 }; });
  expect(stops.length, "the mask's stops").toBeGreaterThan(2);
  const start = Math.max(...stops.filter((s) => s.a === 1).map((s) => s.at));
  const end = Math.min(...stops.filter((s) => s.a === 0).map((s) => s.at));
  expect(end, "the fade ends after it starts").toBeGreaterThan(start);
  expect(m.reach, "the rest figure's reach is inside the fade's start").toBeLessThan(start);
});
