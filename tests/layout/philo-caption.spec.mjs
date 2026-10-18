// L2. The PHILO figure caption's text is centred under the orbit, not left-aligned in its box.
import { test, expect } from "../helpers/fixtures.mjs";
import { rectOf, openPage } from "../helpers/geometry.mjs";

test.use({ reducedMotion: "reduce" });

for (const [width, height] of [[390, 844], [1440, 800]]) {
  test(`L2 PHILO figure caption is centred on the orbit at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/not-not-philo/");

    const trace = await rectOf(page, ".trace");
    // the text's own extent: the box spans the figure's column whatever its alignment
    const textCx = await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".fig"));
      const r = range.getBoundingClientRect();
      return r.left + r.width / 2;
    });
    expect(Math.abs(textCx - trace.cx), "caption text centre vs orbit centre").toBeLessThan(1);
  });
}

// The caption sits a line under the cubes' drawn bottom, which the still's own path
// data gives (as a share of its viewBox, which fills the figure box), not under the box.
const cubesBottom = (page) => page.evaluate(() => {
  const svg = document.querySelector(".nts-penrose > svg");
  const ys = [...svg.querySelectorAll("path")].flatMap((p) => [...p.getAttribute("d").matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => Number(m[2])));
  const box = svg.parentElement.getBoundingClientRect(); // the svg fills it, and is hidden once the live canvas runs
  return box.top + scrollY + (Math.max(...ys) / svg.viewBox.baseVal.height) * box.height;
});

for (const [width, height] of [[390, 844], [1440, 900], [844, 390]]) {
  test(`L2 PHILO figure caption sits a line under the cubes at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/not-not-philo/");

    const bottom = await cubesBottom(page);
    const fig = await page.evaluate(() => {
      const r = document.querySelector(".fig").getBoundingClientRect();
      const hero = document.querySelector(".philo-hero").getBoundingClientRect();
      return { top: r.top + scrollY, bottom: r.bottom + scrollY, heroBottom: hero.bottom + scrollY };
    });
    const gap = fig.top - bottom;
    expect(gap, "caption top below the cubes' bottom").toBeGreaterThan(16);
    expect(gap, "caption top below the cubes' bottom").toBeLessThan(36);
    expect(fig.bottom, "caption inside the hero").toBeLessThanOrEqual(fig.heroBottom);
  });
}

// The rings run under the caption, so it carries a halo in the hero's ground colour (every
// layer of it) while its ink stays the quiet muted one.
for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`L2 PHILO figure caption has a halo in the ground colour at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/not-not-philo/");

    const s = await page.evaluate(() => {
      const fig = document.querySelector(".fig");
      const probe = document.createElement("i");
      probe.style.cssText = "background: var(--w-bg); color: var(--w-muted)";
      fig.parentElement.append(probe);
      const ground = getComputedStyle(probe).backgroundColor, muted = getComputedStyle(probe).color;
      probe.remove();
      const cs = getComputedStyle(fig);
      return { ground, muted, color: cs.color, layers: cs.textShadow.match(/rgba?\([^)]*\)/g) ?? [] };
    });
    expect(s.layers.length, "text-shadow layers").toBeGreaterThan(0);
    expect(s.layers.filter((c) => c !== s.ground), "layers not in the ground colour").toEqual([]);
    expect(s.color, "caption ink").toBe(s.muted);
  });
}
