// L11. On INTERSECT the bar at the top of the page is the ground itself (clear, so the page's film
// grain shows through, with no dark edge row); scrolled, it carries the same grain tile at the same
// opacity, screen-blended. The other worlds' bars have none.
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";

const read = (page) => page.evaluate(() => {
  const bar = getComputedStyle(document.querySelector(".nts-header"), "::before");
  const page_ = getComputedStyle(document.querySelector(".intersect-grain"));
  return {
    barImage: bar.backgroundImage, pageImage: page_.backgroundImage,
    barOpacity: bar.opacity, pageOpacity: page_.opacity,
    barDur: bar.transitionDuration, pageDur: page_.transitionDuration,
    barInset: [bar.top, bar.right, bar.bottom, bar.left].join(" "), barZ: bar.zIndex,
    barBlend: bar.mixBlendMode, barEvents: bar.pointerEvents, barPos: bar.position,
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

// the spread of a row's grey across x 400..800, averaged over rows: flat is 0, grain is not
const spread = async (page, y0, y1) => {
  const b64 = (await page.screenshot()).toString("base64");
  return page.evaluate(async ([b64, y0, y1]) => {
    const img = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
    const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    let tot = 0;
    for (let y = y0; y < y1; y++) {
      const d = x.getImageData(400, y, 400, 1).data; const v = [];
      for (let i = 0; i < d.length; i += 4) v.push(d[i] + d[i + 1] + d[i + 2]);
      const m = v.reduce((s, a) => s + a, 0) / v.length;
      tot += Math.sqrt(v.reduce((s, a) => s + (a - m) ** 2, 0) / v.length) / 3;
    }
    return tot / (y1 - y0);
  }, [b64, y0, y1]);
};

test.describe("INTERSECT bar grain", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });

  test("L11 at the top the bar is the ground: same mean, no dark edge row", async ({ page }) => {
    await open(page, "/intersect/");
    await settled(page);
    const h = await page.evaluate(() => document.querySelector(".nts-header").getBoundingClientRect().height);
    const rows = await rowMeans(page, Math.ceil(h) + 40);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const bar = mean(rows.slice(2, Math.floor(h) - 4)), ground = mean(rows.slice(Math.ceil(h) + 4));
    expect(Math.abs(bar - ground)).toBeLessThan(0.5);
    for (const y of [Math.floor(h) - 2, Math.floor(h) - 1, Math.floor(h), Math.ceil(h)]) {
      expect(Math.abs(rows[y] - ground), `row ${y}`).toBeLessThan(1.5);
    }
  });

  test("L11 scrolled, the bar has the page's grain tile at the page's opacity", async ({ page }) => {
    await open(page, "/intersect/");
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
    await page.waitForSelector(".nts-header.is-scrolled");
    await page.waitForTimeout(500);
    const g = await read(page);
    expect(g.pageImage).toContain("feTurbulence");
    expect(g.barImage).toBe(g.pageImage);
    expect(g.barOpacity).toBe(g.pageOpacity);
    expect(g.barDur).toBe(g.pageDur);
    expect(g.barBlend).toBe("screen");
    expect(g.barEvents).toBe("none");
    expect(g.barPos).toBe("absolute");
    expect(g.barInset).toBe("0px 0px 0px 0px");
    expect(g.barZ).toBe("-1");
    expect(await spread(page, 5, 45)).toBeGreaterThan(0.5);
  });

  test("L11 the bar's grain layer exists before scrolling, so the switch only fades it", async ({ page }) => {
    await open(page, "/intersect/");
    await settled(page);
    const before = await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector(".nts-header"), "::before");
      return { content: c.content, opacity: c.opacity };
    });
    expect(before.content).not.toBe("none");
    expect(before.opacity).toBe("0");
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
    await page.waitForSelector(".nts-header.is-scrolled");
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      content: getComputedStyle(document.querySelector(".nts-header"), "::before").content,
      bar: getComputedStyle(document.querySelector(".nts-header"), "::before").opacity,
      page: getComputedStyle(document.querySelector(".intersect-grain")).opacity,
    }));
    expect(after.content).toBe(before.content);
    expect(after.bar).toBe(after.page);
  });

  test("L11 the other worlds' bars have no grain", async ({ page }) => {
    for (const path of ["/embers/", "/not-not-philo/"]) {
      await open(page, path);
      await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
      await page.waitForSelector(".nts-header.is-scrolled");
      const bar = await page.evaluate(() => getComputedStyle(document.querySelector(".nts-header"), "::before").backgroundImage);
      expect(bar, path).toBe("none");
    }
  });
});
