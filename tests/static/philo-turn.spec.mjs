// T1-T6. How the PHILO figure turns (the model in site/_nts/worlds/cubes.js, `turn`): the
// poses along lattice steps, the path between them, the soft edge, the wheel, where a
// release lands and which pose a tap picks.
import { test, expect } from "../helpers/fixtures.mjs";
import { cubes, COL } from "../helpers/cubes.mjs";

const T = cubes.turn, DEG = 180 / Math.PI;
const [LEFT, STRAIGHT, RIGHT] = T.POSES;

// The straight-on places: the centre of each cube's hull and the hull itself, in model
// units about the figure's centre, y up (what a press is tested against).
const places = [];
for (const it of cubes.frame(0, 0, 0, 0, 0, 1, COL).layers[0].items) {
  const hull = it.hull.map(([x, y]) => [x, -y]);
  places[Math.round(it.c.h)] = { hull, at: [hull.reduce((s, p) => s + p[0], 0) / hull.length, hull.reduce((s, p) => s + p[1], 0) / hull.length] };
}
const between = (a, b, f = 0.5) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

test("T1 the poses look along a line between two cubes: left (-10.02, -16.78), straight, right (19.47, 10.89)", () => {
  expect(STRAIGHT).toEqual([0, 0]);
  expect(LEFT.map((x) => x * DEG)[0]).toBeCloseTo(-10.024987862075738, 9);
  expect(LEFT.map((x) => x * DEG)[1]).toBeCloseTo(-16.77865488096037, 9);
  expect(RIGHT.map((x) => x * DEG)[0]).toBeCloseTo(19.4712206344907, 9);
  expect(RIGHT.map((x) => x * DEG)[1]).toBeCloseTo(10.89339464913089, 9);
  // right: place 8 covers place 2 exactly (their hulls are the same shape on the same spot)
  const cube = (j) => cubes.frame(0.5, RIGHT[0], RIGHT[1], 0, 0, 1, COL).layers.at(-1).items.find((it) => Math.round(it.c.h) === j).hull;
  const a = cube(8), b = cube(2);
  const edge = (P) => [Math.min(...P.map((p) => p[0])), Math.max(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[1]))];
  edge(a).forEach((v, i) => expect(v).toBeCloseTo(edge(b)[i], 6));
});

test("T2 the pitch follows the yaw on a smooth path through the three poses, in a straight line past the ends", () => {
  for (const q of T.POSES) expect(T.pitchAt(q[0])).toBeCloseTo(q[1], 12);
  const h = 1e-6, slope = (u) => (T.pitchAt(u + h) - T.pitchAt(u - h)) / (2 * h);
  expect([LEFT[0], 0, RIGHT[0]].map(slope).map((m) => +m.toFixed(4))).toEqual([1.6737, 0.9382, 0.5595]);
  const beyond = RIGHT[0] + 0.3;
  expect(T.pitchAt(beyond)).toBeCloseTo(RIGHT[1] + 0.5595 * 0.3, 3);
});

test("T3 a soft edge: past the end poses at most 9 degrees more, harder the further you pull", () => {
  expect(T.soften(0.1)).toBe(0.1);
  expect(T.soften(RIGHT[0])).toBeCloseTo(RIGHT[0], 12);
  for (const over of [2, 9, 30, 400]) {
    const o = over / DEG, want = 9 * (1 - Math.exp(-over / 9));
    expect((T.soften(RIGHT[0] + o) - RIGHT[0]) * DEG).toBeCloseTo(want, 9);
    expect((LEFT[0] - T.soften(LEFT[0] - o)) * DEG).toBeCloseTo(want, 9);
  }
  expect((T.soften(RIGHT[0] + 50 / DEG) - RIGHT[0]) * DEG).toBeLessThan(9);
});

test("T4 the wheel: anticlockwise round the centre turns right, 0.011 rad a px; left leg up/down, bottom, right leg", () => {
  const down = [0, 10], right = [10, 0];
  // the left leg (place 7), stroked down: anticlockwise, toward the right pose
  expect(T.wheel([places[7].at[0], -places[7].at[1]], down)).toBeGreaterThan(0);
  // the bottom (place 4), stroked to the right: anticlockwise
  expect(T.wheel([places[4].at[0], -places[4].at[1]], right)).toBeGreaterThan(0);
  // the right leg (place 2), stroked down: clockwise, toward the left pose; stroked up, the other way
  expect(T.wheel([places[2].at[0], -places[2].at[1]], down)).toBeLessThan(0);
  expect(T.wheel([places[2].at[0], -places[2].at[1]], [0, -10])).toBeGreaterThan(0);
  // motion along the radius turns nothing; along the circle it is 0.011 rad a px
  expect(T.wheel([50, 0], [10, 0])).toBeCloseTo(0, 12);
  expect(T.wheel([50, 0], [0, 10])).toBeCloseTo(-0.11, 12);
  expect(T.wheel([0, 0], [3, 4])).toBeCloseTo(0, 12);
});

test("T5 a release goes to the next pose when the drag covered over a third of the gap, else back", () => {
  const gapR = RIGHT[0], gapL = -LEFT[0];
  // from straight
  expect(T.landing(0, gapR / 3 - 0.001)).toBe(1);
  expect(T.landing(0, gapR / 3 + 0.001)).toBe(2);
  expect(T.landing(0, -(gapL / 3 - 0.001))).toBe(1);
  expect(T.landing(0, -(gapL / 3 + 0.001))).toBe(0);
  // from a turned pose: toward straight, or on past it? only the next pose counts
  expect(T.landing(RIGHT[0], RIGHT[0] - gapR / 3 + 0.001)).toBe(2);
  expect(T.landing(RIGHT[0], RIGHT[0] - gapR / 3 - 0.001)).toBe(1);
  expect(T.landing(LEFT[0], LEFT[0] + gapL / 3 - 0.001)).toBe(0);
  expect(T.landing(LEFT[0], LEFT[0] + gapL / 3 + 0.001)).toBe(1);
  // dragged further out at an end, there is no next pose: it stays
  expect(T.landing(RIGHT[0], RIGHT[0] + 1)).toBe(2);
});

test("T6 a tap on the straight figure: right on the right leg and on places 3, 4 and 5 (not under 6), else left", () => {
  const RIGHTP = 2, LEFTP = 0;
  const tap = ([x, y]) => T.tapPose(x, y);
  // the right leg, tip to the bottom-right corner
  expect(tap(between(places[0].at, places[3].at, 0.3))).toBe(RIGHTP);
  expect(tap(places[1].at)).toBe(RIGHTP);
  expect(tap(places[2].at)).toBe(RIGHTP);
  // the bottom's cubes 3, 4 and 5
  for (const j of [3, 4, 5]) expect(tap(places[j].at), `place ${j}`).toBe(RIGHTP);
  // the left leg, place 6 (drawn over 5, even where they overlap), the top
  expect(tap(places[7].at)).toBe(LEFTP);
  expect(tap(places[8].at)).toBe(LEFTP);
  expect(tap(between(places[6].at, places[0].at, 0.5))).toBe(LEFTP);
  expect(tap(places[6].at)).toBe(LEFTP);
  expect(tap(places[0].at)).toBe(LEFTP);
  const overlap56 = between(places[5].at, places[6].at, 0.5);
  const inside = (h, [x, y]) => { const s = h.map((a, i) => { const b = h[(i + 1) % h.length]; return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); }); return s.every((v) => v >= 0) || s.every((v) => v <= 0); };
  expect(inside(places[5].hull, overlap56) && inside(places[6].hull, overlap56), "a point in both 5 and 6").toBe(true);
  expect(tap(overlap56)).toBe(LEFTP);
  // the right leg is the one on the right of the picture
  expect(places[2].at[0]).toBeGreaterThan(0);
});
