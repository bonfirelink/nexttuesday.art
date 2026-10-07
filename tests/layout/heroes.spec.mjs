// L1. The three world heroes share one centre and one ring size.
import { test, expect } from "../helpers/fixtures.mjs";
import { rectOf, probeLength, openPage } from "../helpers/geometry.mjs";

// The ring and the entity are laid out by CSS from the same box: they agree to a sub-pixel
// rounding, so 1 px is the width of a rounding error, not of a design choice.
const CENTRE_TOL = 1;
// The figure's box (stage, penrose host, pre) is positioned independently of the ring, and
// the ASCII pre's aspect-ratio box rounds a little more.
const FIGURE_TOL = 1.5;
// Ring diameters are one CSS formula, read from three layouts; 1 px as for centres.
const RING_TOL = 1;

const WORLDS = [
  { path: "/embers/", figure: ".hero .hearth-stage", live: [] },
  { path: "/not-not-philo/", figure: ".hero .nts-penrose", live: [".hero .nts-penrose"] },
  { path: "/intersect/", figure: ".hero pre[data-nts-ascii]", live: [".hero pre[data-nts-ascii]"] },
];

test.use({ reducedMotion: "reduce" });

const widths = [[390, 844, ""], [1440, 900, ""], [1024, 900, " @slow"]];
for (const [width, height, tag] of widths) {
  test(`L1 world heroes share one centre and ring size at ${width}${tag}`, async ({ page, freeze, settle }) => {
    await page.setViewportSize({ width, height });
    const rings = [];
    for (const w of WORLDS) {
      await openPage(page, w.path, { live: w.live });
      await freeze(page);
      await settle(page);
      const entity = await rectOf(page, ".entity", ".hero");
      const ring = await rectOf(page, ".trace-ring", ".hero");
      const figure = await rectOf(page, w.figure.replace(".hero ", ""), ".hero");
      const cssRing = await probeLength(page, ".hero .entity", "var(--ring)");

      expect(Math.abs(ring.cx - entity.cx), `${w.path} ring centre x vs entity`).toBeLessThanOrEqual(CENTRE_TOL);
      expect(Math.abs(ring.cy - entity.cy), `${w.path} ring centre y vs entity`).toBeLessThanOrEqual(CENTRE_TOL);
      expect(Math.abs(figure.cx - ring.cx), `${w.path} figure centre x vs ring`).toBeLessThanOrEqual(FIGURE_TOL);
      expect(Math.abs(figure.cy - ring.cy), `${w.path} figure centre y vs ring`).toBeLessThanOrEqual(FIGURE_TOL);
      expect(Math.abs(ring.w - cssRing), `${w.path} ring diameter vs --ring`).toBeLessThanOrEqual(RING_TOL);
      rings.push({ path: w.path, d: ring.w, cx: ring.cx, cy: ring.cy });
    }
    // One ring, one place, on all three worlds.
    for (const r of rings.slice(1)) {
      expect(Math.abs(r.d - rings[0].d), `${r.path} ring diameter vs ${rings[0].path}`).toBeLessThanOrEqual(RING_TOL);
      expect(Math.abs(r.cx - rings[0].cx), `${r.path} ring centre x vs ${rings[0].path}`).toBeLessThanOrEqual(CENTRE_TOL);
      expect(Math.abs(r.cy - rings[0].cy), `${r.path} ring centre y vs ${rings[0].path}`).toBeLessThanOrEqual(CENTRE_TOL);
    }
  });
}
