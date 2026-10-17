// F1-F9. The PHILO figure as drawn in the browser (site/_nts/worlds/cubes.js on a
// canvas): the rest pose is the same at every tick, the cube on top at every
// overlap is the one the order says, nothing jumps through a tick or a turn,
// reduced motion draws the rest pose, turning the figure shows the screw,
// its three tones are the page's tokens with no outline, and a resting figure is not repainted, also once it has
// come to rest on a turned pose.
import { test, expect } from "../helpers/fixtures.mjs";
import { canvasInk } from "../helpers/canvas.mjs";
import { cubes, restAt, midAt } from "../helpers/cubes.mjs";
import { TIP_Y, recordPaints, paints } from "../helpers/behaviour.mjs";

test.use({ viewport: { width: 390, height: 844 } });

// A step changes no more pixels than the larger of its neighbours by this factor,
// plus this many: edges sliding across pixels vary from step to step; a cube
// appearing, vanishing or changing places in the order is a jump far above both
// (a cube is thousands of pixels). The slack is wide because the glide starts and ends
// slowly: an edge moving a fraction of a pixel a step changes few pixels one step and
// several hundred the next.
const JUMP_FACTOR = 1.25;
const JUMP_SLACK = 700;
// Pixels count as changed by more than this (sum over r, g, b).
const CHANGED = 60;
// The clock steps through a tick, s; a turn steps, rad.
const STEP_S = 0.004, STEP_RAD = 0.004;
// Turned, the screw reaches past the closed picture's box by at least this share of its width.
const SCREW_REACH = 0.1;
// Turned, the top turn and at least two turns below it are drawn (the deepest fade out).
const SCREW_MIN_CUBES = 27;

// Drags the figure by its tip cube, dx and dy css px (0.011 rad a px), and lets go.
async function drag(page, host, dx, dy) {
  const box = await host.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height * TIP_Y;
  await page.mouse.move(x, y);
  await page.mouse.move(x + 1, y);
  await page.waitForTimeout(100);
  await page.mouse.down();
  expect(await host.evaluate((h) => h.classList.contains("is-grabbing")), "the press grabbed the figure").toBe(true);
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

// The module, drawing on a canvas of its own in the page, 400 css px at 1x.
async function lab(page) {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => window.NTS && window.NTS.cubes);
  await page.evaluate(() => {
    const B = window.NTS.cubes, c = document.createElement("canvas");
    c.width = c.height = 400;
    const g = c.getContext("2d", { willReadFrequently: true });
    const col = { top: "#f5f5f7", side: "#a6a7b2", dark: "#53566b", ground: "#e6e6e8" };
    const sc = (400 * B.REST.page) / (2 * B.REACH);
    const draw = (t, yaw = 0, pitch = 0, ids = false) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 400, 400);
      B.paint(g, col, t, yaw, pitch, 200, 200, sc, { ids });
      return g.getImageData(0, 0, 400, 400).data;
    };
    const hash = (d, alphaOnly) => { let h = 2166136261; for (let i = alphaOnly ? 3 : 0; i < d.length; i += alphaOnly ? 4 : 1) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; };
    // compared as seen: colour times opacity (a canvas reports a nearly clear pixel's colour in full)
    const changed = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        const ka = a[i + 3] / 255, kb = b[i + 3] / 255;
        if (Math.abs(a[i] * ka - b[i] * kb) + Math.abs(a[i + 1] * ka - b[i + 1] * kb) + Math.abs(a[i + 2] * ka - b[i + 2] * kb) + Math.abs(a[i + 3] - b[i + 3]) > 60) n++;
      }
      return n;
    };
    window.__lab = { B, col, sc, draw, hash, changed };
  });
}

// steps whose change jumps above the two steps either side (a dissolve crossing the
// CHANGED threshold alternates from step to step)
const jumps = (counts) => counts.filter((n, i) => i > 1 && i < counts.length - 2 && n > Math.max(counts[i - 2], counts[i - 1], counts[i + 1], counts[i + 2]) * JUMP_FACTOR + JUMP_SLACK);

test("F1 the rest pose is the same picture at every tick: the same cubes in the same places, tones and all", async ({ page }) => {
  await lab(page);
  const r = await page.evaluate((ts) => ts.map((t) => { const d = window.__lab.draw(t); return [window.__lab.hash(d, true), window.__lab.hash(d, false)]; }), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18].map(restAt));
  expect(new Set(r.map(([a]) => a)).size, "the same cubes in the same places at every tick").toBe(1);
  expect(new Set(r.map(([, b]) => b)).size, "the same pixels at every tick").toBe(1);
});

test("F2 at every overlap the cube drawn on top is the one in front, straight on at rest and mid-tick, and turned", async ({ page }) => {
  await lab(page);
  for (const [t, yaw, pitch] of [[restAt(0), 0, 0], [midAt(0) - 0.3, 0, 0], [midAt(0) + 0.3, 0, 0], [midAt(1), 0, 0], [restAt(3), 0.55, -0.2], [midAt(3), 0.55, -0.2]]) {
    const r = await page.evaluate(([t, yaw, pitch]) => {
      const { B, col, sc, draw } = window.__lab;
      const d = draw(t, yaw, pitch, true);
      const { layers } = B.frame(t, yaw, pitch, 200, 200, sc, col);
      const L = layers[layers.length - 1];
      // the overlap of two convex polygons, its area and centroid
      const sg = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      const sa = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
      const clip = (P, C) => { let out = P; const o = Math.sign(sa(C)) || 1; for (let i = 0; i < C.length && out.length; i++) { const a = C[i], b = C[(i + 1) % C.length], inp = out; out = []; for (let j = 0; j < inp.length; j++) { const p = inp[j], q = inp[(j + 1) % inp.length], sp = o * sg(a, b, p), sq = o * sg(a, b, q); if (sp >= 0) out.push(p); if ((sp >= 0) !== (sq >= 0)) { const k = sp / (sp - sq); out.push([p[0] + k * (q[0] - p[0]), p[1] + k * (q[1] - p[1])]); } } } return out; };
      const centroid = (P) => { let A2 = 0, x = 0, y = 0; P.forEach((p, i) => { const q = P[(i + 1) % P.length], k = p[0] * q[1] - q[0] * p[1]; A2 += k; x += (p[0] + q[0]) * k; y += (p[1] + q[1]) * k; }); return [x / (3 * A2), y / (3 * A2)]; };
      let n = 0; const wrong = [];
      L.over.forEach((tops, b) => {
        for (const f of tops) {
          if (L.items[f].alpha < 0.7 || L.items[b].alpha < 0.7 || L.items[f].c.fade > 0.3 || L.items[b].c.fade > 0.3) continue;
          const I = clip(L.items[f].hull, L.items[b].hull);
          if (I.length < 3 || Math.abs(sa(I)) < 8) continue;
          const [x, y] = centroid(I), shown = d[(Math.round(y) * 400 + Math.round(x)) * 4] - 1;
          n++;
          if (shown === b) wrong.push(`${f} over ${b}`);
        }
      });
      return { n, wrong };
    }, [t, yaw, pitch]);
    expect(r.n, `overlaps checked at t=${t}, yaw ${yaw}`).toBeGreaterThan(8);
    expect(r.wrong, `overlaps drawn the wrong way round at t=${t}, yaw ${yaw}`).toEqual([]);
  }
});

test("F3 nothing jumps: stepping 4 ms through a tick straight on and turned, and turning off the straight view in small steps", async ({ page }) => {
  await lab(page);
  const runs = {
    "a tick, straight on": [1.9, 3.1, 0, 0, 0],
    "a tick, turned": [1.9, 3.1, 0.55, -0.2, 0],
    "a turn from straight on, at rest": [restAt(1), 0, 0, 0, 160],
    "a turn from straight on, mid-tick": [midAt(1), 0, 0, 0, 160],
  };
  for (const [name, [t0, t1, yaw, pitch, turnSteps]] of Object.entries(runs)) {
    const counts = await page.evaluate(([t0, t1, yaw, pitch, turnSteps, ds, dr]) => {
      const { draw, changed } = window.__lab, out = [];
      let prev = null;
      const n = turnSteps || Math.round((t1 - t0) / ds);
      for (let k = 0; k <= n; k++) {
        const d = turnSteps ? draw(t0, yaw + k * dr, pitch) : draw(t0 + k * ds, yaw, pitch);
        if (prev) out.push(changed(prev, d));
        prev = d.slice();
      }
      return out;
    }, [t0, t1, yaw, pitch, turnSteps, STEP_S, STEP_RAD]);
    expect(Math.max(...counts), `${name}: something moves`).toBeGreaterThan(0);
    expect(jumps(counts), `${name}: steps that jump (pixels changed per step: max ${Math.max(...counts)})`).toEqual([]);
  }
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("F4 under reduced motion the page draws the rest pose, and keeps it", async ({ page }) => {
    await page.goto(process.env.NTS_BASE + "/not-not-philo/");
    await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
    const snap = () => page.evaluate(() => {
      const c = document.querySelector(".hero .nts-penrose canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return h >>> 0;
    });
    const a = await snap();
    // sampled across more than a whole tick (3 s), since the picture is alike before and after one
    for (let i = 0; i < 17; i++) {
      await page.waitForTimeout(200);
      expect(await snap(), "unchanged over a tick and more").toBe(a);
    }
    // the same as the module's rest pose drawn as philo.js sizes it: the closed picture
    // at the host's centre, its furthest point at REST.page of the host's half-size
    const rest = await page.evaluate(() => {
      const host = document.querySelector(".hero .nts-penrose"), c = host.querySelector("canvas"), B = window.NTS.cubes;
      const o = document.createElement("canvas"); o.width = c.width; o.height = c.height;
      const g = o.getContext("2d"), dpr = c.width / c.clientWidth, cs = getComputedStyle(host);
      const col = { top: cs.getPropertyValue("--penrose-top").trim(), side: cs.getPropertyValue("--penrose-side").trim(), dark: cs.getPropertyValue("--penrose-dark").trim(), ground: cs.getPropertyValue("--penrose-ground").trim() };
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      B.paint(g, col, 0, 0, 0, c.clientWidth / 2, c.clientHeight / 2, (Math.min(host.clientWidth, host.clientHeight) * B.REST.page) / (2 * B.REACH));
      const d = g.getImageData(0, 0, o.width, o.height).data;
      let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return h >>> 0;
    });
    expect(a, "the rest pose").toBe(rest);
  });
});

test("F5 turning the figure shows the screw going down past the closed picture", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  const host = page.locator(".hero .nts-penrose");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  await host.scrollIntoViewIfNeeded();
  const closed = await canvasInk(page, ".hero .nts-penrose canvas");
  await drag(page, host, 55, -14);
  await page.waitForTimeout(150);
  const turned = await canvasInk(page, ".hero .nts-penrose canvas");
  // the turns below reach out past the closed picture's box (the canvas outgrows the host)
  const edges = (r) => [r.bx - r.bw / 2, r.bx + r.bw / 2, r.by - r.bh / 2, r.by + r.bh / 2];
  const [cx0, cx1, cy0, cy1] = edges(closed), [tx0, tx1, ty0, ty1] = edges(turned);
  const past = Math.max(cx0 - tx0, tx1 - cx1, cy0 - ty0, ty1 - cy1);
  expect(past, "drawn pixels beyond the closed picture's box, in css px").toBeGreaterThan(SCREW_REACH * closed.bw);
  const count = await page.evaluate(() => window.NTS.cubes.frame(0, 0.6, -0.15, 0, 0, 100, { top: "#fff", side: "#888", dark: "#000", ground: "#fff" }).layers.at(-1).items.length);
  expect(count, "cubes drawn turned: the top turn and the turns below").toBeGreaterThanOrEqual(SCREW_MIN_CUBES);
});

// The figure's canvas pixels that are fully opaque, as [{ rgb: "r,g,b", n }] most frequent first,
// and the smallest channel sum among them.
const canvasColours = (page) => page.evaluate(() => {
  const c = document.querySelector(".hero .nts-penrose canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, n = new Map();
  let darkest = 765;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] !== 255) continue;
    const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
    n.set(k, (n.get(k) || 0) + 1);
    darkest = Math.min(darkest, d[i] + d[i + 1] + d[i + 2]);
  }
  return { top: [...n].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([rgb]) => rgb), darkest };
});
// The three tones on the grey ground (top, side, dark) and, before the bleed-in, on the beige.
const TONES = { world: ["245,245,247", "166,167,178", "83,86,107"], home: ["247,241,228", "185,177,163", "103,98,90"] };
const sum = (rgb) => rgb.split(",").reduce((s, v) => s + +v, 0);

test("F6 the figure is three flat tones with no outline and no red, at rest and arriving from the home page", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  let c = await canvasColours(page);
  expect(c.top.slice().sort(), "at rest: the three tones of the tokens").toEqual(TONES.world.slice().sort());
  expect(c.darkest, "no outline darker than the dark tone").toBeGreaterThanOrEqual(sum(TONES.world[2]));

  // arriving from the home, the page opens in the home's set (bleed "before", then "in")
  await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch {} });
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  expect(await page.evaluate(() => document.documentElement.dataset.bleedState), "arriving").toMatch(/^(before|in)$/);
  c = await canvasColours(page);
  expect(c.top.slice().sort(), "arriving from the home: the home's tones").toEqual(TONES.home.slice().sort());
  expect(c.darkest, "no outline arriving").toBeGreaterThanOrEqual(sum(TONES.home[2]));
});

// Paints over the watched window, at most: the cubes move in 1 s of every 3 s tick,
// at 30 frames per second, so about 30 paints a tick; at rest nothing is repainted.
const WATCH_MS = 3000;
const MAX_PAINTS = 45;
// Paints at a whole phase in the window, at most: the frame that lands the cubes at the
// end of each glide, one a tick (one tick ends in 3 s, a second at the edge, and a
// restart's first frame).
const LANDINGS = 3;

// The figure's paints over the window: all of them, and those made while the cubes
// rest (the motion's phase a whole number), which only a turn or a restart causes.
const watchPaints = (page) => page.evaluate((ms) => new Promise((done) => {
  const B = window.NTS.cubes, paint = B.paint;
  let all = 0, atRest = 0;
  B.paint = (...a) => { all++; if (Number.isInteger(B.phase(a[2]))) atRest++; return paint(...a); };
  setTimeout(() => { B.paint = paint; done({ all, atRest }); }, ms);
}), WATCH_MS);

test("F7 while the cubes rest and nothing turns them, the figure is not repainted", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  await page.locator(".hero .nts-penrose").scrollIntoViewIfNeeded();
  const p = await watchPaints(page);
  expect(p.atRest, "paints while the cubes rest, besides each tick's landing").toBeLessThanOrEqual(LANDINGS);
  expect(p.all, "paints in 3 s (30 a second would be 90)").toBeLessThanOrEqual(MAX_PAINTS);
});

// After a drag lets go the figure runs to its pose (a critically damped spring, well under a
// second) and stays there. Then paints stop again.
const SETTLE_MS = 2000;

test("F8 a turned figure stays on its pose, and once there it is no longer repainted at rest", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  const host = page.locator(".hero .nts-penrose");
  await host.scrollIntoViewIfNeeded();
  await recordPaints(page);
  await drag(page, host, 14, 0);
  await page.waitForTimeout(100);
  expect((await paints(page)).some((p) => p.yaw !== 0), "the drag turned the figure").toBe(true);
  await page.waitForTimeout(SETTLE_MS);
  const p = await watchPaints(page);
  expect(p.atRest, "paints while the cubes rest on the pose, besides each tick's landing").toBeLessThanOrEqual(LANDINGS);
  expect(p.all, "paints in 3 s on the pose (30 a second would be 90)").toBeLessThanOrEqual(MAX_PAINTS);
  const last = (await paints(page)).at(-1);
  expect([last.yaw, last.pitch], "still on the left pose, not settled back").toEqual(cubes.turn.POSES[0]);
});

test("F9 the figure turns by drag only: it is not focusable and the arrow keys never turn it", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  const host = page.locator(".hero .nts-penrose");
  await host.scrollIntoViewIfNeeded();
  await host.focus();
  expect(await page.evaluate(() => document.activeElement === document.querySelector(".hero .nts-penrose")), "the host takes focus").toBe(false);
  expect(await host.getAttribute("tabindex"), "no tabindex").toBeNull();
  await recordPaints(page);
  await page.evaluate(() => {
    const h = document.querySelector(".hero .nts-penrose");
    const key = (k) => h.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    for (let i = 0; i < 4; i++) key("ArrowRight");
    key("ArrowUp");
  });
  await page.waitForTimeout(3500); // a whole tick, so the cubes glide in it
  const after = await paints(page);
  expect(after.length, "the cubes kept being painted").toBeGreaterThan(0);
  expect(after.every((p) => p.yaw === 0 && p.pitch === 0), "every paint after the keys is straight on").toBe(true);
});
