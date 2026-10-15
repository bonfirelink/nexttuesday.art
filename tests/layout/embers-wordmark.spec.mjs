// L1b. The EMBERS wordmark reads "EMBERS" but draws its two Es as Ξ.
import { test, expect } from "../helpers/fixtures.mjs";

const PAGES = [["/embers/", "#title"], ["/", "#h-embers"]];

// Archivo has no Greek: the Es stay text (search, readers, copy) and are painted transparent
// while a ::before draws the bars.
for (const [path, sel] of PAGES) {
  test(`the wordmark on ${path} is EMBERS text with two Ξ-drawn Es`, async ({ page }) => {
    await page.goto(process.env.NTS_BASE + path);
    await page.evaluate(() => document.fonts.ready);
    const w = await page.evaluate((s) => {
      const el = document.querySelector(s);
      const px = (v) => parseFloat(v);
      return {
        text: el.textContent,
        ink: getComputedStyle(el).color,
        xi: [...el.querySelectorAll(".xi")].map((x) => {
          const cs = getComputedStyle(x, "::before");
          const r = x.getBoundingClientRect();
          const l = px(cs.left), t = px(cs.top);
          return {
            text: x.textContent,
            color: getComputedStyle(x).color,
            bars: cs.content,
            width: px(cs.width),
            height: px(cs.height),
            // the ::before box, as offsets, lies inside the span's rect
            inside: l >= 0 && t >= 0 && l + px(cs.width) <= r.width + 0.5 && t + px(cs.height) <= r.height + 0.5,
            barColors: cs.backgroundImage.match(/rgba?\([^)]*\)/g),
          };
        }),
      };
    }, sel);
    expect(w.text).toBe("EMBERS");
    expect(w.xi.map((x) => x.text)).toEqual(["E", "E"]);
    for (const x of w.xi) {
      expect(x.color).toBe("rgba(0, 0, 0, 0)");
      expect(x.bars).not.toBe("none");
      expect(x.width).toBeGreaterThan(0);
      expect(x.height).toBeGreaterThan(0);
      expect(x.inside).toBe(true);
      // three bars, each the heading's own colour
      expect(x.barColors.length).toBeGreaterThanOrEqual(3);
      for (const c of x.barColors) expect(c).toBe(w.ink);
    }
  });

  test(`selecting the wordmark on ${path} keeps the real E hidden under the bars`, async ({ page }) => {
    await page.goto(process.env.NTS_BASE + path);
    await page.evaluate(() => document.fonts.ready);
    const colors = await page.evaluate((s) => {
      const el = document.querySelector(s);
      const r = document.createRange();
      r.selectNodeContents(el);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      return [...el.querySelectorAll(".xi")].map((x) => getComputedStyle(x, "::selection").color);
    }, sel);
    expect(colors).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
  });
}

test("link preview title is ΞMBΞRS, the page title stays EMBERS", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/embers/");
  expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBe("ΞMBΞRS");
  expect(await page.title()).toMatch(/^EMBERS/);
});
