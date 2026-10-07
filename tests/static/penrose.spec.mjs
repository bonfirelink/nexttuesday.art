// G1-G2. The impossible triangle is drawn as a solid at every pose it takes, in node on
// penrose.js's frames (the canvas paints those faces in order, each over the ones before).
import { test, expect } from "../helpers/fixtures.mjs";
import { penrose, wrongOrder, splitFaces, sweep } from "../helpers/penrose.mjs";

// Samples (of a 64 x 64 grid over the figure) where a farther face is painted over a
// nearer one. Exact geometry leaves none away from the outlines (see EDGE in the helper).
const MAX_WRONG_SAMPLES = 0;

const label = ({ theta, psi }) => `theta ${theta.toFixed(2)} psi ${((psi * 180) / Math.PI).toFixed(0)}deg`;

test("G1: PHILO's faces are painted in depth order at every pose", () => {
  const bad = [];
  for (const pose of [penrose.CLOSED, ...sweep()]) {
    const r = wrongOrder(penrose.frame(pose));
    if (r.wrong > MAX_WRONG_SAMPLES) bad.push(`${label(pose)}: ${r.wrong}/${r.covered}`);
  }
  expect(bad, `poses where a farther face covers a nearer one (wrong/covered samples)`).toEqual([]);
});

test("G2: each face of PHILO's bars is drawn whole, so its hatching has no seams", () => {
  const bad = [];
  for (const pose of [penrose.CLOSED, ...sweep()]) {
    const n = splitFaces(penrose.frame(pose));
    if (n) bad.push(`${label(pose)}: ${n}`);
  }
  expect(bad.slice(0, 5), `poses with faces drawn in pieces (${bad.length} in all)`).toEqual([]);
});
