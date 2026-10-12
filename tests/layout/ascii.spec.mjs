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
// The page's canvas reaches past its pre by this share of the pre's width on each side.
const OVERHANG = 0.176;
// A cover of the pre by the canvas (the fragment's matches its box; the page's reaches past
// it on every side, by the same amount), as for any box edge.
const COVER_TOL = 1;

const PAGES = [
  { name: "/intersect/", path: "/intersect/", pre: "pre[data-nts-ascii]", overhang: true },
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
          role: pre.getAttribute("role"), label: pre.getAttribute("aria-label"), w: pr.width,
        };
      }, p.pre);
      expect(r.canvas, "a canvas inside the pre").toBe(true);
      if (p.overhang) {
        // the page's solid draws past its ring: the canvas covers the pre, centred on it
        const [l, t, rr, b] = r.dx;
        for (const d of [-l, -t, rr, b]) {
          expect(d, "canvas edge outside the pre's box").toBeGreaterThanOrEqual(-COVER_TOL);
          expect(d, "canvas edge's reach past the pre's box").toBeLessThanOrEqual(OVERHANG * r.w + 2 * COVER_TOL); // the inset rounds to the pixel grid
        }
        expect(Math.abs(l + rr), "canvas centre x vs the pre's").toBeLessThanOrEqual(COVER_TOL);
        expect(Math.abs(t + b), "canvas centre y vs the pre's").toBeLessThanOrEqual(COVER_TOL);
      } else for (const d of r.dx) expect(Math.abs(d), "canvas edge vs the pre's box").toBeLessThanOrEqual(COVER_TOL);
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

// The baked still (scripts off, and until the face loads) is the first live frame: same
// glyph size, same zoom and pose, so its glyphs' box matches the live ink's box to within
// two glyph cells: a glyph's ink sits inside its cell, and headless Chromium sets small
// DOM text on whole-pixel advances (5 px for a 4.83 px cell at 390), which stretches a
// still line of 60 glyphs by up to 10 px; the live canvas is scaled to the cell.
const STILL_TOL_CELLS = 2;

test.describe("L3 the baked still is the first live frame", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  for (const p of PAGES) {
    test(`${p.name}: the still's glyph box matches the live frame's ink`, async ({ page, settle }) => {
      await openPage(page, p.path, { live: [p.pre] });
      await page.evaluate(() => document.fonts.ready);
      await settle(page);
      const s = await page.evaluate((sel) => {
        const pre = document.querySelector(sel), still = pre.querySelector(":scope > span.ascii-still");
        // the baked text (sync's markers around it are comments)
        const node = [...still.childNodes].filter((n) => n.nodeType === 3).sort((x, y) => y.textContent.length - x.textContent.length)[0];
        const text = node.textContent, range = document.createRange();
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, at = 0;
        for (const line of text.split("\n")) {
          const a = line.search(/\S/);
          if (a >= 0) {
            range.setStart(node, at + a); range.setEnd(node, at + line.trimEnd().length);
            const r = range.getBoundingClientRect();
            x0 = Math.min(x0, r.left); x1 = Math.max(x1, r.right); y0 = Math.min(y0, r.top); y1 = Math.max(y1, r.bottom);
          }
          at += line.length + 1;
        }
        return { x0, y0, x1, y1, cell: parseFloat(getComputedStyle(pre).fontSize) };
      }, p.pre);
      const k = await canvasInk(page, `${p.pre} > canvas`);
      const ink = { x0: k.bx - k.bw / 2, x1: k.bx + k.bw / 2, y0: k.by - k.bh / 2, y1: k.by + k.bh / 2 };
      for (const e of ["x0", "x1", "y0", "y1"])
        expect(Math.abs(s[e] - ink[e]), `still vs live ink, ${e} (px; cell ${s.cell.toFixed(1)})`).toBeLessThanOrEqual(STILL_TOL_CELLS * s.cell);
    });
  }
});

// The baked still's glyphs are sized by CSS so that data-cols cells of the mono's 0.6em
// advance span the pre: 31.2 = 52 x 0.6, on the page and in a fragment (intersect.css);
// it follows data-cols. Half a pixel across the whole pre.
const FONT_FIT_TOL = 0.5;
test.describe("L3 the still's glyphs span the pre", () => {
  for (const [width, height] of [[390, 844], [1280, 500]]) {
    test.describe(`${width}x${height}`, () => {
      test.use({ viewport: { width, height } });
      for (const [p, k] of [[PAGES[0], 31.2], [PAGES[1], 31.2]]) {
        test(`${p.name}: font size x ${k} is the pre's width`, async ({ page }) => {
          await page.goto(process.env.NTS_BASE + p.path);
          const r = await page.evaluate((sel) => { const cs = getComputedStyle(document.querySelector(sel)); return { fs: parseFloat(cs.fontSize), w: parseFloat(cs.width) }; }, p.pre);
          expect(Math.abs(r.fs * k - r.w), `font size ${r.fs} x ${k} vs pre width ${r.w}`).toBeLessThanOrEqual(FONT_FIT_TOL);
        });
      }
    });
  }
});
