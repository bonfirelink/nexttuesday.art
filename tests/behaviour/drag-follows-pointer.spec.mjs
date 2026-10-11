// Dragging grabs the figure like a real object: the surface that reads as the front follows the
// pointer (the nearest one; in EMBERS the bright one, which is the far one) (drag right and the front turns right, drag down and it turns down), on both axes,
// with EMBERS' release momentum and the arrow keys turning the same way.
// The rotation conventions are read from the drawing code: EMBERS draws the vertices at
// -n * R of the face normals, turned by yaw about y then pitch about x, with screen x to the
// right, screen y down and the viewer on +z; INTERSECT turns by Rx(ax) * Ry(ay), with screen x
// to the right, screen y up and the viewer on -z.
import { test, expect } from "../helpers/fixtures.mjs";

test.use({ viewport: { width: 1440, height: 900 } });

// hover the figure (the grab cursor is set on a move), then press
async function grab(page, at) {
  await page.mouse.move(...at); await page.mouse.move(at[0] + 1, at[1]);
  await wait(page, 100);
  await page.mouse.down();
}
const wait = (page, ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);

// each world: how a pose turns a vector, as [screen x right, screen y down, depth towards the viewer]
const MODELS = {
  embers: ([yaw, p], [x, y, z0]) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(p), sx = Math.sin(p), z = -x * sy + z0 * cy;
    return [x * cy + z0 * sy, y * cx - z * sx, y * sx + z * cx];
  },
  intersect: ([ax, ay], [x, y, z]) => {
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    const X = cy * x + sy * z, Z0 = -sy * x + cy * z;
    return [X, -(cx * y - sx * Z0), -(sx * y + cx * Z0)];
  },
};

// where the surface point that faces the viewer head-on at pose a (dead ahead on the line of
// sight, the one a grab takes hold of) is at pose b, relative to where it was: [dx right, dy down]
// (depth -1: the point dead behind it instead)
function frontMotion_(turn, a, b, depth = 1) {
  const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => turn(a, e)); // the pose's columns
  const q = E.map((col) => col[2] * depth); // its inverse (the transpose) applied to the front, (0, 0, 1)
  const at = turn(b, q);
  return [at[0], at[1]];
}

const WORLDS = {
  embers: {
    path: "/embers/", ready: "canvas.nts-hearth", host: "canvas.nts-hearth",
    pose: () => document.querySelector("canvas.nts-hearth").ntsPose(),
    fig: () => {
      const s = document.querySelector(".embers-hero .hearth-stage").getBoundingClientRect();
      return [s.left + s.width / 2, s.top + s.height / 2];
    },
  },
  intersect: {
    path: "/intersect/", ready: "pre[data-nts-ascii].is-live", host: "pre[data-nts-ascii]",
    pose: () => document.querySelector("pre[data-nts-ascii]").ntsPose(),
    fig: () => {
      const r = document.querySelector("pre[data-nts-ascii]").getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    },
  },
};

// EMBERS draws the faces nearest the viewer faintest and the far ones brightest, so the bright
// side reads as the front: it is the one that follows the pointer, the geometric back
const DEPTH = { embers: -1, intersect: 1 };
for (const [name, W] of Object.entries(WORLDS)) {
  test.describe(name, () => {
    const model = MODELS[name], depth = DEPTH[name];
    const frontMotion = (t, a, b) => frontMotion_(t, a, b, depth);
    let at;
    test.beforeEach(async ({ page }) => {
      await page.goto(process.env.NTS_BASE + W.path);
      await page.waitForSelector(W.ready);
      await page.locator(W.host).scrollIntoViewIfNeeded();
      await wait(page, 500);
      at = await page.evaluate(W.fig);
    });
    const pose = (page) => page.evaluate(W.pose);

    for (const [label, dx, dy] of [["right", 30, 0], ["left", -30, 0], ["down", 0, 30], ["up", 0, -30]]) {
      test(`a drag ${label} carries the front ${label}`, async ({ page }) => {
        await grab(page, at);
        const a = await pose(page);
        await page.mouse.move(at[0] + dx, at[1] + dy, { steps: 5 });
        const b = await pose(page); await page.mouse.up();
        const [mx, my] = frontMotion(model, a, b);
        // the front moves with the pointer along the dragged axis, and not against it on the other
        if (dx) expect(Math.sign(mx), `front x after a drag ${label}`).toBe(Math.sign(dx));
        if (dy) expect(Math.sign(my), `front y after a drag ${label}`).toBe(Math.sign(dy));
        expect(Math.abs(dx ? mx : my), "a clear turn").toBeGreaterThan(0.1);
      });
    }

    test("the arrow keys turn the front the way a drag does", async ({ page }) => {
      const keys = await page.evaluate((sel) => {
        const el = document.querySelector(sel), out = {};
        for (const k of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]) {
          const a = el.ntsPose();
          el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
          out[k] = [a, el.ntsPose()];
        }
        return out;
      }, W.host);
      const want = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
      for (const [k, [a, b]] of Object.entries(keys)) {
        const [mx, my] = frontMotion(model, a, b);
        const [wx, wy] = want[k];
        // EMBERS has only the horizontal keys
        if (name === "embers" && wy) continue;
        if (wx) expect(Math.sign(mx), `${k}: front x`).toBe(wx);
        if (wy) expect(Math.sign(my), `${k}: front y`).toBe(wy);
      }
    });
  });
}

// a flick leaves the figure turning on the way it was thrown: thrown left it turns left even
// though its resting spin is the other way
test("embers: released after a drag left, the front keeps turning left", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/embers/");
  await page.waitForSelector("canvas.nts-hearth");
  await page.locator("canvas.nts-hearth").scrollIntoViewIfNeeded();
  await wait(page, 500);
  const at = await page.evaluate(WORLDS.embers.fig);
  await grab(page, at);
  await page.mouse.move(at[0] - 80, at[1], { steps: 4 });
  const b = await page.evaluate(WORLDS.embers.pose); await page.mouse.up();
  await wait(page, 100);
  const c = await page.evaluate(WORLDS.embers.pose);
  expect(frontMotion_(MODELS.embers, b, c, -1)[0], "front x after the release").toBeLessThan(-0.05);
});
