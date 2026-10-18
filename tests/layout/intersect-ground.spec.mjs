// L11. INTERSECT's ground is a body::before layer under the film grain, and body itself is the
// grain's mean (--w-bg-mean), which is what iPhone Safari samples for its status strip and what
// WebKit paints into the landscape side bands from the bar's colour. At the top the bar is clear
// (the page's grain shows through, no dark edge row); scrolled it is the mean at 80% over a blur.
// The bar has no grain layer of its own. The other worlds' bars are untouched.
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";

// a CSS colour expression as the computed "rgb(r, g, b)", whatever notation it is written in
const resolve = (page, expr) => page.evaluate((e) => {
  const i = document.createElement("i");
  i.style.color = e;
  document.body.append(i);
  const c = getComputedStyle(i).color; i.remove(); return c;
}, expr);

const colours = (page) => page.evaluate(() => {
  const cs = (el, pseudo) => getComputedStyle(el, pseudo);
  const bar = document.querySelector(".nts-header");
  return {
    body: cs(document.body).backgroundColor, bodyBefore: cs(document.body, "::before").backgroundColor,
    html: cs(document.documentElement).backgroundColor,
    barBefore: cs(bar, "::before").content, bar: cs(bar).backgroundColor, barBlur: cs(bar).backdropFilter,
  };
});

// mean grey of each pixel row of the screenshot, over x 400..800 (clear of the wordmark and nav)
const rowMeans = async (page, rows) => {
  const b64 = (await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: rows } })).toString("base64");
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
    const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const out = [];
    for (let y = 0; y < img.height; y++) {
      const d = x.getImageData(400, y, 400, 1).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
      out.push(s / (d.length / 4) / 3);
    }
    return out;
  }, b64);
};

const settled = (page) => page.evaluate(async () => {
  await document.fonts.ready;
  if (document.documentElement.dataset.bleedState) {
    await new Promise((r) => { const t = setInterval(() => { if (document.documentElement.dataset.bleedState === "world") { clearInterval(t); r(); } }, 50); });
  }
});

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

// the bar's height, and the mean grey of the strip behind it and of the ground just below it
const barAndGround = async (page) => {
  const h = await page.evaluate(() => document.querySelector(".nts-header").getBoundingClientRect().height);
  const rows = await rowMeans(page, Math.ceil(h) + 40);
  return { h, rows, bar: mean(rows.slice(2, Math.floor(h) - 4)), ground: mean(rows.slice(Math.ceil(h) + 4)) };
};

// scrolled: the class is on and the colour and blur transitions have ended
const scrolled = async (page) => {
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await page.waitForSelector(".nts-header.is-scrolled");
  await page.waitForFunction(() => document.querySelector(".nts-header").getAnimations({ subtree: true }).every((a) => !(a instanceof CSSTransition) || a.playState !== "running"));
};

test.describe("INTERSECT ground and bar", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });

  test("L11 at the top the bar is the ground: same mean, no dark edge row", async ({ page }) => {
    await open(page, "/intersect/");
    await settled(page);
    const { h, rows, bar, ground } = await barAndGround(page);
    expect(Math.abs(bar - ground)).toBeLessThan(0.5);
    for (const y of [Math.floor(h) - 2, Math.floor(h) - 1, Math.floor(h), Math.ceil(h)]) {
      expect(Math.abs(rows[y] - ground), `row ${y}`).toBeLessThan(1.5);
    }
    // the visible ground is the grained #0a0a0a, whose average is --w-bg-mean (19)
    expect(Math.abs(ground - 19)).toBeLessThan(1.5);
  });

  test("L11 at the top the bar is clear, with no backdrop filter and no grain layer", async ({ page }) => {
    await open(page, "/intersect/");
    await settled(page);
    const c = await colours(page);
    expect(c.bar).toBe("rgba(0, 0, 0, 0)");
    expect(c.barBlur).toBe("none");
    expect(c.barBefore).toBe("none");
  });

  test("L11 scrolled, the bar is the ground's mean (80%) over a blur, within 1.5 of the ground, with no grain layer", async ({ page }) => {
    await open(page, "/intersect/");
    await settled(page);
    await scrolled(page);
    const c = await colours(page);
    expect(c.barBefore).toBe("none");
    expect(c.barBlur).toContain("blur");
    expect(c.bar).toBe(await resolve(page, "color-mix(in srgb, var(--w-bg-mean) 80%, transparent)"));
    // the strip behind the bar and the ground below it, clear of the hero's content
    const { bar, ground } = await barAndGround(page);
    expect(Math.abs(bar - ground)).toBeLessThan(1.5);
  });

  test("L11 body is the ground's mean, body::before paints the ground, html follows once the bleed has settled", async ({ page }) => {
    await open(page, "/intersect/");
    await settled(page);
    const mean = await resolve(page, "var(--w-bg-mean)"), ground = await resolve(page, "var(--w-bg)");
    expect(mean).not.toBe(ground);
    const c = await colours(page);
    expect(c.body).toBe(mean);
    expect(c.bodyBefore).toBe(ground);
    expect(c.html).toBe(mean);
  });

  test("L11 html is not the mean while the bleed runs (before, in): the arrival crossfades over the NTS ground", async ({ page }) => {
    await open(page, "/intersect/");
    await settled(page);
    const mean = await resolve(page, "var(--w-bg-mean)");
    const during = await page.evaluate(() => {
      const d = document.documentElement, prev = d.dataset.bleedState, out = {};
      for (const state of ["before", "in"]) { d.dataset.bleedState = state; out[state] = getComputedStyle(d).backgroundColor; }
      d.dataset.bleedState = prev;
      return out;
    });
    expect(during.before).not.toBe(mean);
    expect(during.in).not.toBe(mean);
  });

  test("L11 the theme-color meta is --w-bg-mean (the token's hand-kept copy)", async ({ page }) => {
    await open(page, "/intersect/");
    const [meta, token] = await page.evaluate(() => [
      document.querySelector('meta[name="theme-color"]').content,
      getComputedStyle(document.body).getPropertyValue("--w-bg-mean").trim(),
    ]);
    expect(meta.toLowerCase()).toBe(token.toLowerCase());
  });

  test("L11 the other worlds' bars have no grain layer and are their --w-bar-bg", async ({ page }) => {
    for (const path of ["/embers/", "/not-not-philo/"]) {
      await open(page, path);
      await scrolled(page);
      const c = await colours(page);
      expect(c.bar, path).toBe(await resolve(page, "var(--w-bar-bg)"));
      expect(c.barBefore, path).toBe("none");
      expect(await page.evaluate(() => getComputedStyle(document.body, "::before").content), path).toBe("none");
    }
  });
});
