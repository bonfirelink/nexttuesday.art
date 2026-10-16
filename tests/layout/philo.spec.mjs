// L2. The PHILO figure is centred on its ring and sized like the other worlds' figures.
import { test, expect } from "../helpers/fixtures.mjs";
import { rectOf, openPage } from "../helpers/geometry.mjs";
import { canvasInk } from "../helpers/canvas.mjs";

// Pixel centroids of an anti-aliased drawing: the pivot is the closed triangle's centroid,
// so the drawn pixels' centroid sits on it to a pixel or so; 2 px covers the rest pose's rounding.
const CENTROID_TOL = 2;
// On the home orb the canvas is smaller, so the same rounding is relatively larger.
const FRAGMENT_CENTROID_TOL = 1.5;
// Ratios of two measured lengths, each good to a pixel on ~300-800 px.
const RATIO_TOL = 0.02;

// The drawn bounding box's width over the ring's diameter, recorded for the nine cubes at
// rest (the figure's longest side about as long as the ring, as on the other worlds). The
// figure's size comes from the hero box, which is the ring plus a fixed margin, so the ratio
// drifts a little with the viewport; one recorded value per width.
const HERO_RATIO = { 390: 1.011, 1024: 0.989, 1440: 0.976 };
// On the home orb the loop overshoots (about 1.09 orb widths, see home-bands.spec.mjs), so
// the canvas's box cuts it: the drawn width is the whole box.
const ORB_FILL = 0.98;
// the pivot is the triangle's centroid, so the loop's drawn box sits this share of the orb off the box's centre (measured 0.067)
const VERTICAL_OFFSET = 0.067, VERTICAL_TOL = 0.015;

test.use({ reducedMotion: "reduce" });

const widths = [[390, 844, ""], [1440, 900, ""], [1024, 900, " @slow"]];
for (const [width, height, tag] of widths) {
  test(`L2 PHILO hero is centred on its ring and sized like the others at ${width}${tag}`, async ({ page, freeze, settle }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/not-not-philo/", { live: [".hero .nts-penrose"] });
    await freeze(page);
    await settle(page);
    const ring = await rectOf(page, ".trace-ring", ".hero");
    const ink = await canvasInk(page, ".hero .nts-penrose canvas");
    expect(ink.n, "drawn pixels").toBeGreaterThan(0);
    expect(Math.abs(ink.cx - ring.cx), "centroid x vs ring centre").toBeLessThanOrEqual(CENTROID_TOL);
    expect(Math.abs(ink.cy - ring.cy), "centroid y vs ring centre").toBeLessThanOrEqual(CENTROID_TOL);
    const ratio = ink.bw / ring.w;
    expect(ratio, "drawn width over ring diameter").toBeGreaterThan(HERO_RATIO[width] * (1 - RATIO_TOL));
    expect(ratio, "drawn width over ring diameter").toBeLessThan(HERO_RATIO[width] * (1 + RATIO_TOL));
  });
}

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`L2 PHILO on the home orb is centred and sized like the others at ${width}`, async ({ page, freeze, settle }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/", { live: ["[data-nts-fragment=philo]"] });
    await freeze(page);
    await settle(page);
    // the orb's box is its window: the disc reaches past it, for the lid
    const box = await rectOf(page, ".orb[data-body=philo]");
    const ink = await canvasInk(page, "[data-nts-fragment=philo] canvas");
    expect(ink.n, "drawn pixels").toBeGreaterThan(0);
    expect(Math.abs(ink.bx - box.cx), "drawn box centre x vs box centre").toBeLessThanOrEqual(FRAGMENT_CENTROID_TOL);
    expect(ink.bw / box.w, "drawn width over orb diameter: the figure reaches the orb's edge").toBeGreaterThan(ORB_FILL);
    expect(Math.abs(Math.abs(ink.by - box.cy) - VERTICAL_OFFSET * box.w), "drawn box centre y: its offset from the box centre").toBeLessThanOrEqual(VERTICAL_TOL * box.w);
  });
}

test("PHILO title is the one key line, with nothing above it", async ({ page }) => {
  await openPage(page, "/not-not-philo/");
  const h1 = await page.evaluate(() => {
    const el = document.querySelector("#title");
    return { text: el.textContent.trim(), kids: el.children.length };
  });
  expect(h1.text).toBe("NOT2 PHILO"); // the logotype: an exponent 2 stands for the second NOT
  expect(h1.kids, "only the key span").toBe(1);
});
