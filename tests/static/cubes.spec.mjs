// G1-G6. The PHILO figure's model (site/_nts/worlds/cubes.js), in node: the order of
// overlapping cubes straight on and turned, the red that rides with its cubes, the
// screw, and a motion with no jumps from one tick to the next.
import { test, expect } from "../helpers/fixtures.mjs";
import { cubes, COL, CX, CY, SC, PLACES, restAt, midAt, fronts } from "../helpers/cubes.mjs";

const mod = (a, n) => ((a % n) + n) % n;
const layers = (t, yaw = 0, pitch = 0) => cubes.frame(t, yaw, pitch, CX, CY, SC, COL).layers;
// a turn well past the handover, so only the screw is drawn
const TURNED = { yaw: 0.55, pitch: -0.2 };
// positions agree to this, in model units, across a tick's end
const POS_TOL = 1e-6;
// the faces as axes: x the dark face, y the left, z the top
const FACE = ["dark", "left", "top"];

test("G1 straight on, the cube further along the loop is in front: the 1934 drawing's twelve overlaps at rest", () => {
  const [L] = layers(restAt(0));
  expect(L.items.length, "nine cubes straight on").toBe(9);
  const seen = fronts(L).map(([f, b]) => `${PLACES[Math.round(L.items[f].c.x) % 9]}>${PLACES[Math.round(L.items[b].c.x) % 9]}`).sort();
  // each cube covers the next along the loop; at each corner, the cube after it covers the one before
  const sides = PLACES.map((p, j) => `${PLACES[(j + 1) % 9]}>${p}`);
  const corners = [0, 3, 6].map((c) => `${PLACES[(c + 1) % 9]}>${PLACES[(c + 8) % 9]}`);
  expect(seen).toEqual([...sides, ...corners].sort());
});

test("G2 the loop's order holds through a tick: at rest and mid-glide, every overlap has the cube further along in front", () => {
  for (const t of [restAt(2), midAt(2), midAt(5), restAt(7)]) {
    const [L] = layers(t);
    const wrong = fronts(L).filter(([f, b]) => mod(L.items[f].c.x - L.items[b].c.x, 9) >= 4.5);
    expect(wrong.length, `overlaps against the loop at t=${t}`).toBe(0);
  }
});

test("G3 turned, the screw is drawn in true depth: every overlap has the nearer cube in front", () => {
  for (const t of [restAt(1), midAt(1)]) {
    const L = layers(t, TURNED.yaw, TURNED.pitch);
    expect(L.length, "only the turned layer past the handover").toBe(1);
    const wrong = fronts(L[0]).filter(([f, b]) => L[0].items[f].z < L[0].items[b].z);
    expect(wrong.length, `overlaps with the farther cube in front at t=${t}`).toBe(0);
  }
});

test("G4 red rides with its cube on one face for good; every ninth tick it is back on the corners as at the start", () => {
  const redAt = (t) => cubes.cubesAt(t, false).filter((c) => c.red >= 0).map((c) => `${PLACES[Math.round(c.x) % 9]}:${FACE[c.red]}`).sort();
  // at the start: the tip's top, the bottom right's dark face, the bottom left's left face
  expect(redAt(restAt(0))).toEqual(["BL:left", "BR:dark", "T:top"]);
  for (let k = 0; k < 9; k++) {
    // tick k: the three red cubes have each moved k places, each still on its face
    const want = [[0, "top"], [3, "dark"], [6, "left"]].map(([j, f]) => `${PLACES[(j + k) % 9]}:${f}`).sort();
    expect(redAt(restAt(k)), `tick ${k}`).toEqual(want);
    expect(redAt(restAt(k + 9)), `tick ${k + 9} repeats tick ${k}`).toEqual(want);
  }
  // mid-glide, each red face is on the cube between its two places
  const mid = cubes.cubesAt(midAt(0), false).filter((c) => c.red >= 0).map((c) => [c.x.toFixed(2), FACE[c.red]]);
  expect(mid.map(([x]) => x).sort(), "red cubes halfway along").toEqual(["0.50", "3.50", "6.50"]);
});

test("G5 turned, the screw goes on below: four turns under the top one, fading; straight on, only the nine", () => {
  const screw = cubes.cubesAt(restAt(0), true);
  expect(Math.min(...screw.map((c) => c.h)), "places reach four turns down").toBeLessThanOrEqual(-9 * cubes.TURNS + 1);
  expect(screw.filter((c) => c.h >= 0).every((c) => c.fade === 0), "the top turn at full strength").toBe(true);
  const deep = screw.filter((c) => c.h < -9);
  expect(deep.every((c) => c.fade > 0), "the turns below fade").toBe(true);
  expect(cubes.cubesAt(restAt(0), false).length).toBe(9);
});

test("G6 no jumps from one tick to the next: the cubes at a tick's end are the cubes at the next tick's start", () => {
  const key = (c) => c.P.map((v) => v.toFixed(5)).join(",");
  for (const screw of [false, true]) {
    for (const k of [0, 4, 8]) {
      const end = (k + 1) * cubes.TICK - 1e-9, start = (k + 1) * cubes.TICK + 1e-9;
      const a = cubes.cubesAt(end, screw), b = cubes.cubesAt(start, screw);
      const B = new Map(b.map((c) => [key(c), c]));
      for (const c of a) {
        const d = B.get(key(c));
        // straight on, the cube arriving at the tip ends on place 0's path, where the next tick starts it
        if (!d && !screw && Math.abs(c.h - 9) < 1e-6) continue;
        if (!d && screw && c.alpha < 1e-6) continue;
        expect(d, `${screw ? "screw" : "loop"} tick ${k}: a cube at place ${c.h.toFixed(3)} is there at the next tick`).toBeTruthy();
        expect(Math.abs(d.alpha - c.alpha), "same opacity").toBeLessThan(POS_TOL);
        expect(d.red, "same red").toBe(c.red);
      }
    }
  }
});
