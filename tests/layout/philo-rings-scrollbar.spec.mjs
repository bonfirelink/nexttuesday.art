// L2. The PHILO ring plate stays on the orbit when a classic scrollbar takes a gutter off the page width.
import { execFileSync } from "node:child_process";
import { test, expect } from "../helpers/fixtures.mjs";
import { rectOf, probeLength, openPage } from "../helpers/geometry.mjs";

// headless Chromium hides its scrollbars; this file needs classic ones
// (launchOptions replace the config's, so the browser path is found again here)
const executablePath = process.env.CHROMIUM || execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
test.use({ reducedMotion: "reduce", launchOptions: { executablePath, args: ["--no-sandbox"], ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("L2 PHILO ring plate stays on the orbit beside a classic scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 800 });
  await openPage(page, "/not-not-philo/");
  await page.addStyleTag({ content: "html{overflow-y:scroll}::-webkit-scrollbar{width:15px}" });
  const gutter = await page.evaluate(() => innerWidth - document.documentElement.clientWidth);
  expect(gutter, "scrollbar gutter").toBeGreaterThan(0);

  const hero = await rectOf(page, ".philo-rings");
  const trace = await rectOf(page, ".trace", ".philo-rings");
  const cx = hero.x + (await probeLength(page, ".philo-rings", "var(--cx)", "left"));
  const cy = hero.y + (await probeLength(page, ".philo-rings", "var(--cy)", "top"));
  expect(Math.abs(cx - trace.cx), "plate centre x vs orbit centre").toBeLessThan(0.5);
  expect(Math.abs(cy - trace.cy), "plate centre y vs orbit centre").toBeLessThan(0.5);
});
