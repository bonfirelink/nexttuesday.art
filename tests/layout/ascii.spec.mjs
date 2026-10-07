// L3. INTERSECT's ASCII solid is the same size on every cold load, and drawn on a canvas.
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";
import { canvasInk } from "../helpers/canvas.mjs";
import { coldPage } from "../helpers/cold.mjs";

// Discrete facts: the glyph size, and so the pre's font size, is one value across loads.
const FONT_SPREAD = 0;
// Layout widths and heights are CSS lengths; half a pixel is below any visible shift, and the
// bug this guards moved the page by about 16 px.
const LAYOUT_SPREAD = 0.5;
// The drawn solid's bounding box, in a single reduced-motion frame, scales with the glyph size:
// a pixel of spread is below the size changes the bug caused.
const INK_SPREAD = 1;
// The face is held this long on the delayed loads, longer than the page needs to start drawing.
const FONT_DELAY = 1500;
const FAST_TIMEOUT_MS = 120_000; // a describe's tests each load cold pages 3 to 4 times
const SLOW_TIMEOUT_MS = 300_000; // 10 cold loads per test
// A cover of the pre by the canvas, as for any box edge.
const COVER_TOL = 1;

const PAGES = [
  { name: "/intersect/", path: "/intersect/", pre: "pre[data-nts-ascii]" },
  { name: "the home fragment", path: "/", pre: "[data-nts-fragment=intersect] pre" },
];

async function measure(page, pre, reduced) {
  await page.waitForSelector(`${pre}.is-live`, { state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  // two frames: a refit after the face loads is requested on a frame
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const m = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return { fontSize: getComputedStyle(el).fontSize, width: el.getBoundingClientRect().width, scrollHeight: document.documentElement.scrollHeight };
  }, pre);
  if (reduced) {
    const ink = await canvasInk(page, `${pre} canvas`);
    m.inkW = ink.bw; m.inkH = ink.bh;
  }
  return m;
}

function spread(rows, key) {
  const v = rows.map((r) => r[key]);
  return Math.max(...v) - Math.min(...v);
}

async function coldLoads(browser, { path, pre }, n, { delayed, ...options }) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const cold = await coldPage(browser, { fontDelay: delayed(i) ? FONT_DELAY : 0, ...options });
    try {
      await cold.page.goto(process.env.NTS_BASE + path);
      rows.push(await measure(cold.page, pre, options.reducedMotion === "reduce"));
      expect(cold.external, "requests that left for an external host").toEqual([]);
    } finally {
      await cold.close();
    }
  }
  return rows;
}

function expectStable(rows, reduced) {
  expect(spread(rows.map((r) => ({ f: parseFloat(r.fontSize) })), "f"), "font size across loads").toBeLessThanOrEqual(FONT_SPREAD);
  expect(spread(rows, "width"), "pre width across loads").toBeLessThanOrEqual(LAYOUT_SPREAD);
  expect(spread(rows, "scrollHeight"), "page height across loads").toBeLessThanOrEqual(LAYOUT_SPREAD);
  if (reduced) {
    expect(spread(rows, "inkW"), "drawn solid's width across loads").toBeLessThanOrEqual(INK_SPREAD);
    expect(spread(rows, "inkH"), "drawn solid's height across loads").toBeLessThanOrEqual(INK_SPREAD);
  }
}

test.describe("L3 ASCII size across cold loads", () => {
  test.setTimeout(FAST_TIMEOUT_MS);
  for (const p of PAGES) {
    test(`${p.name} is the same size on 3 cold loads at 390`, async ({ browser }) => {
      const opts = { viewport: { width: 390, height: 844 }, reducedMotion: "reduce", delayed: () => false };
      expectStable(await coldLoads(browser, p, 3, opts), true);
    });
    test(`${p.name} is the same size when the font arrives late`, async ({ browser }) => {
      // two prompt loads and two with the face held, all compared with each other
      const opts = { viewport: { width: 390, height: 844 }, reducedMotion: "reduce", delayed: (i) => i % 2 === 1 };
      expectStable(await coldLoads(browser, p, 4, opts), true);
    });
  }
});

test.describe("L3 ASCII size across cold loads @slow", () => {
  test.setTimeout(SLOW_TIMEOUT_MS);
  for (const p of PAGES)
    for (const [width, height, deviceScaleFactor] of [[390, 844, 3], [1440, 900, 1]])
      for (const reducedMotion of ["reduce", "no-preference"])
        test(`${p.name}, 10 loads at ${width} (${reducedMotion}) @slow`, async ({ browser }) => {
          const opts = { viewport: { width, height }, deviceScaleFactor, reducedMotion, delayed: (i) => i % 2 === 1 };
          expectStable(await coldLoads(browser, p, 10, opts), reducedMotion === "reduce");
        });
});

test.describe("L3 the solid is drawn on a canvas", () => {
  test.use({ reducedMotion: "reduce" });
  for (const p of PAGES) {
    test(`${p.name}: a canvas covers the pre and the baked text is hidden`, async ({ page, freeze, settle }) => {
      await openPage(page, p.path, { live: [p.pre] });
      await freeze(page);
      await settle(page);
      const r = await page.evaluate((sel) => {
        const pre = document.querySelector(sel);
        const c = pre.querySelector(":scope > canvas"), still = pre.querySelector(":scope > span.ascii-still");
        const pr = pre.getBoundingClientRect(), cr = c && c.getBoundingClientRect();
        return {
          canvas: !!c, still: !!still, stillVisibility: still && getComputedStyle(still).visibility,
          stillText: still ? still.textContent.trim().length : 0,
          dx: cr && [cr.left - pr.left, cr.top - pr.top, cr.right - pr.right, cr.bottom - pr.bottom],
          role: pre.getAttribute("role"), label: pre.getAttribute("aria-label"),
        };
      }, p.pre);
      expect(r.canvas, "a canvas inside the pre").toBe(true);
      for (const d of r.dx) expect(Math.abs(d), "canvas edge vs the pre's box").toBeLessThanOrEqual(COVER_TOL);
      expect(r.still, "span.ascii-still").toBe(true);
      expect(r.stillText, "the baked text is kept").toBeGreaterThan(0);
      expect(r.stillVisibility, "the baked text is hidden once live").toBe("hidden");
      expect((await canvasInk(page, `${p.pre} canvas`)).n, "drawn pixels").toBeGreaterThan(0);
      if (p.path === "/intersect/") {
        expect(r.role).toBe("img");
        expect(r.label).toMatch(/tetrahedron/i);
      }
    });
  }
});
