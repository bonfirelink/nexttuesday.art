// G1-G7. The PHILO figure's model (site/_nts/worlds/cubes.js), in node: the order of
// overlapping cubes straight on and turned, the three flat tones of every cube alike,
// the screw, a motion with no jumps from one tick to the next, and the tick's timing.
import { test, expect } from "../helpers/fixtures.mjs";
import { cubes, COL, CX, CY, SC, PLACES, restAt, midAt, fronts, area, overlap } from "../helpers/cubes.mjs";

const mod = (a, n) => ((a % n) + n) % n;
const layers = (t, yaw = 0, pitch = 0) => cubes.frame(t, yaw, pitch, CX, CY, SC, COL).layers;
// a turn well past the handover, so only the screw is drawn
const TURNED = { yaw: 0.55, pitch: -0.2 };
// positions agree to this, in model units, across a tick's end
const POS_TOL = 1e-6;

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

test("G4 every cube is drawn alike: three flat tones by face (top, side, dark), none red, over a seam core in the top tone", () => {
  const tones = [COL.top, COL.side, COL.dark];
  for (const t of [restAt(0), restAt(4), midAt(2)]) {
    for (const L of layers(t)) {
      for (const it of L.items) {
        expect(it.faces.map((f) => f.fill).sort(), `a cube's three faces at t=${t}`).toEqual([...tones].sort());
        expect(it.coreFill, "the core under the faces").toBe(COL.top);
        expect(it.core.length, "the core is the cube's shape drawn a hair inside").toBe(it.hull.length);
        expect(area(it.core), "the core is smaller than the hull").toBeLessThan(area(it.hull));
        const shared = overlap(it.hull, it.core);
        expect(shared.length && Math.abs(area(shared) - area(it.core)) < 1e-6, "the core lies inside the hull").toBe(true);
      }
    }
  }
  // a cube carries no mark of its own: the faces' tones depend on the view only
  const [L] = layers(restAt(0));
  const byFace = (it) => it.faces.map((f) => f.fill).join();
  expect(new Set(L.items.map(byFace)).size, "the same faces on every cube").toBe(1);
  expect(cubes.cubesAt(restAt(0), false).every((c) => !("red" in c)), "no cube is marked").toBe(true);
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
      }
    }
  }
});

test("G7 the cubes tick every 3 s: at rest for 2 s, then a 1 s glide of one place", () => {
  expect([cubes.TICK, cubes.GLIDE]).toEqual([3, 1]);
  for (const k of [0, 3, 8]) {
    const at = (u) => cubes.phase(k * cubes.TICK + u);
    expect(at(0), `tick ${k} starts at rest`).toBe(k);
    expect(at(1.99), "still at rest 2 s in").toBe(k);
    expect(at(2.5), "halfway through the glide, halfway along").toBeCloseTo(k + 0.5, 6);
    expect(at(2.999), "the glide lands").toBeCloseTo(k + 1, 2);
    expect(at(3), "the next tick starts at rest").toBe(k + 1);
    const p = [2.1, 2.3, 2.5, 2.7, 2.9].map(at);
    expect(p.every((v, i) => i === 0 || v > p[i - 1]), "the glide only goes forward").toBe(true);
  }
});

test("G8 the seam core is filled under the faces of a cube at full opacity, and left out of a fading one", () => {
  // a canvas that records its fills
  const fills = (item) => {
    const out = [];
    const ctx = {
      globalAlpha: 1, fillStyle: "", beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, rect() {}, clip() {}, save() {}, restore() {},
      fill() { out.push({ alpha: this.globalAlpha, style: this.fillStyle }); },
    };
    cubes.composite(ctx, { items: [item], over: [[]] });
    return out;
  };
  const [L] = layers(midAt(1), TURNED.yaw, TURNED.pitch);
  const whole = L.items.find((it) => it.alpha === 1 && it.c.fade === 0), fading = L.items.find((it) => it.alpha < 1);
  expect(whole && fading, "a mid-glide screw has both whole and fading cubes").toBeTruthy();
  const a = fills(whole), b = fills(fading);
  expect(a.length, "core and three faces").toBe(4);
  expect(a[0].style, "the core first, in the top tone").toBe(whole.coreFill);
  expect(b.length, "three faces and no core").toBe(3);
  expect(b.map((f) => f.style).sort(), "the faces' own tones").toEqual(fading.faces.map((f) => f.fill).sort());
  expect(b.every((f) => f.alpha === fading.alpha), "at the cube's opacity").toBe(true);
});
