// B. INTERSECT's ASCII glyphs are drawn in the mono's bold (700) on the page and in the
// fragments, and the face the solid waits for and checks is the pre's own weight, so the
// first fit measures the face it draws with.
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";

const PAGES = [
  { name: "/intersect/", path: "/intersect/", pre: "pre[data-nts-ascii]" },
  { name: "the home fragment", path: "/", pre: "[data-nts-fragment=intersect] pre" },
];

test.describe("B ASCII glyph weight", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  for (const p of PAGES) {
    test(`${p.name}: the glyphs are bold, and the face loaded and checked is the pre's`, async ({ page }) => {
      // record every face the page asks the font set to load or check
      await page.addInitScript(() => {
        const asked = (window.__faces = []);
        for (const k of ["load", "check"]) {
          const f = FontFaceSet.prototype[k];
          FontFaceSet.prototype[k] = function (font, text) { asked.push(font); return f.call(this, font, text); };
        }
      });
      await openPage(page, p.path, { live: [p.pre] });
      const r = await page.evaluate((sel) => {
        const pre = document.querySelector(sel), c = pre.querySelector(":scope > canvas");
        return { weight: getComputedStyle(pre).fontWeight, font: c.getContext("2d").font, faces: window.__faces.filter((f) => /Red Hat Mono/.test(f)) };
      }, p.pre);
      expect(r.weight, "the pre's computed font-weight").toBe("700");
      expect(r.font, "the canvas's font").toMatch(/^(?:normal )?(?:700|bold) /);
      expect(r.faces.length, "faces of the mono loaded or checked").toBeGreaterThan(0);
      for (const f of r.faces) expect(f, "a face the solid loads or checks").toMatch(/^(?:normal )?(?:700|bold) /);
    });
  }
});
