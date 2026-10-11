// The INTERSECT title's ">" is one red before the bleed-in (NTS paper) and in the world (black).
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";
import { tokens, contrast } from "../helpers/palette.mjs";

test("I1 the title's chevron keeps one red across the bleed, 3:1 on the paper and on the black", async ({ page }) => {
  await open(page, "/intersect/");
  const x = () => page.evaluate(() => {
    const el = document.querySelector(".intersect-hero h1 .x");
    el.style.transition = "none";
    return getComputedStyle(el).color;
  });
  const inWorld = await x();
  await page.evaluate(() => { document.documentElement.dataset.bleedState = "before"; });
  const before = await x();
  expect(before, "before the bleed vs in the world").toBe(inWorld);
  const t = await tokens(page);
  expect(contrast(before, t["--pal-beige"]), "on the paper").toBeGreaterThanOrEqual(3);
  expect(contrast(before, "rgb(10, 10, 10)"), "on the black").toBeGreaterThanOrEqual(3);
});
