// L10. The lines of the home emblem and of the beads keep their on-screen widths: each line,
// read as drawn (tests/helpers/lines.mjs), at a phone's 390 and a desktop's 1440. A change to
// a --line-* token, or to the space a line is drawn in, moves one of these on purpose: update
// the table with it. The emblem's lines are three weights (fine, line, bold: 0.48 / 0.77 / 1.44
// px at 390, 0.84 / 1.35 / 2.52 at 1440) besides the seam and the ring's dots; "line" at 1440 is
// the bead sigils' line.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open } from "../helpers/behaviour.mjs";
import { measureLines } from "../helpers/lines.mjs";

const TOL = 0.05; // px
// px at [390, 1440]; the emblem's box is 324.14 / 565.72 px, a bead 44 / 62.22 px
const WIDTHS = {
  north: [1.4442, 2.5205], keyline: [1.4442, 2.5205],
  outline: [0.775, 1.3527], outlineEdge: [1.4442, 2.5205], eye: [0.775, 1.3527], seam: [0.4012, 0.7001],
  ringDots: [2.407, 4.2009], rays: [0.4814, 0.8402], beam: [1.448, 2.5242],
  orbit66: [0.775, 1.3527], orbit78: [0.775, 1.3527], orbit84: [1.4442, 2.5205], orbit96: [0.775, 1.3527],
  halo: [0.7749, 1.3525], dot: [0.7749, 1.3525],
  chalk: [0.7736, 1.3509], chalkMid: [0.4805, 0.8391], chalkFine: [0.4805, 0.8391],
  pulse: [1, 1], hint: [1, 1],
  sigilEmbers: [0.9568, 1.3529], sigilPhilo: [0.9568, 1.3529], sigilIntersect: [0.9568, 1.3529], starBead: [0.9568, 1.3529],
  emblem: [324.1406, 565.7188], bead: [44, 62.2188],
};

for (const [i, vp] of VIEWPORTS.entries()) {
  test.describe(`at ${vp.name}`, () => {
    // the running state: the bead's hint ring exists only with motion
    test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "no-preference" });
    test("L10 every line of the emblem and the beads is drawn at its width", async ({ page }) => {
      await open(page);
      const got = await measureLines(page);
      const off = Object.entries(WIDTHS)
        .filter(([k, w]) => !(Math.abs(got[k] - w[i]) <= TOL))
        .map(([k, w]) => `${k}: ${got[k]?.toFixed(4)} px, was ${w[i]}`);
      expect(off).toEqual([]);
    });
  });
}
