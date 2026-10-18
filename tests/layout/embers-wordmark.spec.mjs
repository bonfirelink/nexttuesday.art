// L1b. The EMBERS wordmark reads "EMBERS" but draws its two Es as Ξ.
import { test, expect } from "../helpers/fixtures.mjs";

const PAGES = [["/embers/", "#title"], ["/", "#h-embers"]];

// Archivo has no Greek: the Es stay text (search, readers, copy) and are set in "Nts Xi", a
// one-glyph font whose E is three bars (tools/gen-xi.py), so colour and selection are the text's.
// Bar centres in em from the span's left edge and from its baseline (Archivo's E at wdth 125,
// weight 700: ink from .0925em to .8025em, stroke .1375em, cap height .6875em, ascent .878em).
const BAR_X = 0.0925 + 0.71 / 2;
const STEM_X = 0.12; // inside the stem of Archivo's E, between the bars of the Ξ
const BARS = { top: 0.6875 - 0.1375 / 2, middle: 0.6875 / 2, bottom: 0.1375 / 2 };

for (const [path, sel] of PAGES) {
  test(`the wordmark on ${path} is EMBERS text with two Ξ-drawn Es`, async ({ page }) => {
    await page.goto(process.env.NTS_BASE + path);
    await page.evaluate(() => document.fonts.ready);
    const w = await page.evaluate((s) => {
      const el = document.querySelector(s);
      return {
        text: el.textContent,
        xi: [...el.querySelectorAll(".xi")].map((x) => ({
          text: x.textContent,
          family: getComputedStyle(x).fontFamily,
          loaded: [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Nts Xi" && f.status === "loaded"),
          width: x.getBoundingClientRect().width,
          size: parseFloat(getComputedStyle(x).fontSize),
          spacing: parseFloat(getComputedStyle(x).letterSpacing) || 0,
        })),
      };
    }, sel);
    expect(w.text).toBe("EMBERS");
    expect(w.xi.map((x) => x.text)).toEqual(["E", "E"]);
    for (const x of w.xi) {
      expect(x.family.startsWith('"Nts Xi"')).toBe(true);
      expect(x.loaded).toBe(true);
      // the glyph's advance is Archivo's E (.865em), so the wordmark keeps its width
      expect(Math.abs(x.width - (0.865 * x.size + x.spacing))).toBeLessThan(1.5);
    }
  });

  for (const state of ["plain", "selected"]) {
    test(`the Ξ bars on ${path} are drawn in the text colour, ${state}`, async ({ page }) => {
      await page.goto(process.env.NTS_BASE + path);
      await page.evaluate(() => document.fonts.ready);
      await page.locator(sel).scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const info = await page.evaluate(([s, st]) => {
        const el = document.querySelector(s);
        el.style.textShadow = "none";
        for (const c of el.querySelectorAll("*")) c.style.textShadow = "none";
        if (st === "selected") {
          const r = document.createRange();
          r.selectNodeContents(el);
          getSelection().removeAllRanges();
          getSelection().addRange(r);
        }
        const x = el.querySelector(".xi");
        const r = x.getBoundingClientRect();
        const cs = getComputedStyle(x);
        return {
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
          size: parseFloat(cs.fontSize),
          color: st === "selected" ? getComputedStyle(x, "::selection").color : cs.color,
        };
      }, [sel, state]);
      const { x: rx, y: ry, w: rw, h: rh } = info.rect;
      const pad = 4;
      const png = await page.screenshot({
        clip: { x: Math.max(0, rx - pad), y: Math.max(0, ry - pad), width: rw + 2 * pad, height: rh + 2 * pad },
      });
      const origin = { x: Math.max(0, rx - pad), y: Math.max(0, ry - pad) };
      // the span's box is the font's content area: baseline at .878em from its top
      const base = ry + 0.878 * info.size;
      const at = (em, xem = BAR_X) => [Math.round(rx + xem * info.size - origin.x), Math.round(base - em * info.size - origin.y)];
      const probe = await (await page.context().newPage()).evaluate(
        async ([b64, pts]) => {
          const img = new Image();
          img.src = "data:image/png;base64," + b64;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width; c.height = img.height;
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          return pts.map(([x, y]) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)]);
        },
        [png.toString("base64"), [at(BARS.top), at(BARS.middle), at(BARS.bottom), at(0.2065), at(0.2065, STEM_X), at(0.48, STEM_X)]],
      );
      const want = info.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const near = (p) => p.every((v, i) => Math.abs(v - want[i]) <= 14);
      const [top, mid, bottom, gap, stemLow, stemHigh] = probe;
      expect(near(top), `top bar ${top} vs ${want}`).toBe(true);
      expect(near(mid), `middle bar ${mid} vs ${want}`).toBe(true);
      expect(near(bottom), `bottom bar ${bottom} vs ${want}`).toBe(true);
      // between the bars the ground shows
      expect(near(gap), `gap ${gap} must not be ${want}`).toBe(false);
      // Archivo's E has a stem here, the Ξ does not
      expect(near(stemLow), `stem ${stemLow} must not be ${want}`).toBe(false);
      expect(near(stemHigh), `stem ${stemHigh} must not be ${want}`).toBe(false);
    });
  }

  test(`print and forced colours keep the wordmark's Es in "Nts Xi" on ${path}`, async ({ page }) => {
    await page.goto(process.env.NTS_BASE + path);
    await page.evaluate(() => document.fonts.ready);
    for (const media of [{ media: "print" }, { forcedColors: "active" }]) {
      await page.emulateMedia(media);
      const xi = await page.evaluate((s) => {
        const loaded = [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Nts Xi" && f.status === "loaded");
        return [...document.querySelector(s).querySelectorAll(".xi")].map((x) => ({ family: getComputedStyle(x).fontFamily, loaded }));
      }, sel);
      expect(xi).toHaveLength(2);
      for (const x of xi) {
        expect(x.family.startsWith('"Nts Xi"'), `${JSON.stringify(media)}: ${x.family}`).toBe(true);
        expect(x.loaded).toBe(true);
      }
    }
  });
}

test("link preview title is ΞMBΞRS, the page title stays EMBERS", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/embers/");
  expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBe("ΞMBΞRS");
  expect(await page.title()).toMatch(/^EMBERS/);
});
