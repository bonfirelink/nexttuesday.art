import { test, expect } from "./helpers/fixtures.mjs";

test("home loads and its fonts are loaded", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/");
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [
    document.fonts.check('16px "Fraunces"'),
    document.fonts.check('16px "Red Hat Mono"'),
    [...document.fonts].filter((f) => f.status === "loaded").length,
  ]);
  expect(loaded[0]).toBe(true);
  expect(loaded[1]).toBe(true);
  expect(loaded[2]).toBeGreaterThan(0);
});

test("a request to an external host fails the test", async ({ page, watch }) => {
  test.fail();
  await page.goto(process.env.NTS_BASE + "/");
  await page.evaluate(() => fetch("https://example.com/", { mode: "no-cors" }).catch(() => {}));
  expect(watch.external).toEqual([]);
});
