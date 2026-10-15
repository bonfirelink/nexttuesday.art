// F1-F8. The PHILO figure as drawn in the browser (site/_nts/worlds/cubes.js on a
// canvas): the rest pose is the same at every tick, the cube on top at every
// overlap is the one the order says, nothing jumps through a tick or a turn,
// reduced motion draws the rest pose, turning the figure shows the screw,
// its red is the title's, and a resting figure is not repainted, also once it has
// settled back from a turn.
import { test, expect } from "../helpers/fixtures.mjs";
import { canvasInk } from "../helpers/canvas.mjs";

test.use({ viewport: { width: 390, height: 844 } });

// A step changes no more pixels than the larger of its neighbours by this factor,
// plus this many: edges sliding across pixels vary from step to step; a cube
// appearing, vanishing or changing places in the order is a jump far above both.
const JUMP_FACTOR = 1.25;
const JUMP_SLACK = 250;
// Pixels count as changed by more than this (sum over r, g, b).
const CHANGED = 60;
// The clock steps through a tick, s; a turn steps, rad.
const STEP_S = 0.004, STEP_RAD = 0.004;
// Turned, the screw reaches past the closed picture's box by at least this share of its width.
const SCREW_REACH = 0.1;
// Turned, the top turn and at least two turns below it are drawn (the deepest fade out).
const SCREW_MIN_CUBES = 27;

// The module, drawing on a canvas of its own in the page, 400 css px at 1x.
async function lab(page) {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => window.NTS && window.NTS.cubes);
  await page.evaluate(() => {
    const B = window.NTS.cubes, c = document.createElement("canvas");
    c.width = c.height = 400;
    const g = c.getContext("2d", { willReadFrequently: true });
    const col = { ink: "#2b2d3e", cut: "#e5174a", ground: "#e6e6e8" };
    const sc = (400 * 0.952) / (2 * B.REACH);
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
const restAt = (k) => k * 1.5 + 0.3;

// steps whose change jumps above both neighbours
const jumps = (counts) => counts.filter((n, i) => i > 0 && i < counts.length - 1 && n > Math.max(counts[i - 1], counts[i + 1]) * JUMP_FACTOR + JUMP_SLACK);

test("F1 the rest pose is the same at every tick: the same shape every tick, the same picture every ninth", async ({ page }) => {
  await lab(page);
  const r = await page.evaluate((ts) => ts.map((t) => { const d = window.__lab.draw(t); return [window.__lab.hash(d, true), window.__lab.hash(d, false)]; }), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18].map(restAt));
  expect(new Set(r.map(([a]) => a)).size, "the same cubes in the same places at every tick").toBe(1);
  expect(r[9][1], "tick 9 is tick 0 again, red and all").toBe(r[0][1]);
  expect(r[11][1], "tick 18 is tick 0 again").toBe(r[0][1]);
  expect(r[10][1], "tick 10 is tick 1 again").toBe(r[1][1]);
  expect(r[1][1], "the red has moved between ticks").not.toBe(r[0][1]);
});

test("F2 at every overlap the cube drawn on top is the one in front, straight on at rest and mid-tick, and turned", async ({ page }) => {
  await lab(page);
  for (const [t, yaw, pitch] of [[restAt(0), 0, 0], [restAt(1) + 0.98, 0, 0], [restAt(3), 0.55, -0.2], [restAt(3) + 0.98, 0.55, -0.2]]) {
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
    "a tick, straight on": [1.0, 1.62, 0, 0, 0],
    "a tick, turned": [1.0, 1.62, 0.55, -0.2, 0],
    "a turn from straight on, at rest": [restAt(1), 0, 0, 0, 160],
    "a turn from straight on, mid-tick": [restAt(1) + 0.98, 0, 0, 0, 160],
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
    await page.waitForTimeout(1800);
    expect(await snap(), "unchanged over a tick and more").toBe(a);
    // the same as the module's rest pose drawn as philo.js sizes it: the closed picture
    // at the host's centre, its furthest point at 0.952 of the host's half-size
    const rest = await page.evaluate(() => {
      const host = document.querySelector(".hero .nts-penrose"), c = host.querySelector("canvas"), B = window.NTS.cubes;
      const o = document.createElement("canvas"); o.width = c.width; o.height = c.height;
      const g = o.getContext("2d"), dpr = c.width / c.clientWidth, cs = getComputedStyle(host);
      const col = { ink: cs.getPropertyValue("--penrose-ink").trim(), cut: cs.getPropertyValue("--penrose-cut").trim(), ground: cs.getPropertyValue("--penrose-ground").trim() };
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      B.paint(g, col, 0, 0, 0, c.clientWidth / 2, c.clientHeight / 2, (Math.min(host.clientWidth, host.clientHeight) * 0.952) / (2 * B.REACH));
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
  await host.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  const turned = await canvasInk(page, ".hero .nts-penrose canvas");
  // the turns below reach out past the closed picture's box (the canvas outgrows the host)
  const edges = (r) => [r.bx - r.bw / 2, r.bx + r.bw / 2, r.by - r.bh / 2, r.by + r.bh / 2];
  const [cx0, cx1, cy0, cy1] = edges(closed), [tx0, tx1, ty0, ty1] = edges(turned);
  const past = Math.max(cx0 - tx0, tx1 - cx1, cy0 - ty0, ty1 - cy1);
  expect(past, "drawn pixels beyond the closed picture's box, in css px").toBeGreaterThan(SCREW_REACH * closed.bw);
  const count = await page.evaluate(() => window.NTS.cubes.frame(0, 0.6, -0.15, 0, 0, 100, { ink: "#000", cut: "#f00", ground: "#fff" }).layers.at(-1).items.length);
  expect(count, "cubes drawn turned: the top turn and the turns below").toBeGreaterThanOrEqual(SCREW_MIN_CUBES);
});

// The red the figure's canvas draws most: opaque pixels well toward red, as "r,g,b".
const canvasRed = (page) => page.evaluate(() => {
  const c = document.querySelector(".hero .nts-penrose canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, n = new Map();
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255 && d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 130) { const k = `${d[i]},${d[i + 1]},${d[i + 2]}`; n.set(k, (n.get(k) || 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
});
// The title's red, #e81e4c (--philo-red-key).
const TITLE_RED = "232,30,76";

test("F6 the figure's red is the title's red, at rest and arriving from the home page", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".hero .philo-key")).color), "the title's red").toBe("rgb(232, 30, 76)");
  expect(await canvasRed(page), "at rest").toBe(TITLE_RED);

  // arriving from the home, the page opens in the home's set (bleed "before", then "in")
  await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch {} });
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  expect(await page.evaluate(() => document.documentElement.dataset.bleedState), "arriving").toMatch(/^(before|in)$/);
  expect(await canvasRed(page), "arriving from the home").toBe(TITLE_RED);
});

// Paints over the watched window, at most: the cubes move in 0.42 s of every 1.5 s tick,
// at 30 frames per second, so about 13 paints a tick; at rest nothing is repainted.
const WATCH_MS = 3000;
const MAX_PAINTS = 40;
// Paints at a whole phase in the window, at most: the frame that lands the cubes at the
// end of each glide, one a tick (two ticks end in 3 s, a third at the edge).
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

// After a key turns the figure it is held 1.2 s, then settles back (0.7 s to 1/e) and snaps
// straight within half a pixel: about 4.2 s for a key's turn. Then paints stop again.
const SETTLE_MS = 5000;

test("F8 once a turned figure has settled back, it is no longer repainted at rest", async ({ page }) => {
  await page.goto(process.env.NTS_BASE + "/not-not-philo/");
  await page.waitForFunction(() => document.querySelector(".hero .nts-penrose")?.classList.contains("is-live"));
  const host = page.locator(".hero .nts-penrose");
  await host.scrollIntoViewIfNeeded();
  await host.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(SETTLE_MS);
  const p = await watchPaints(page);
  expect(p.atRest, "paints while the cubes rest after settling, besides each tick's landing").toBeLessThanOrEqual(LANDINGS);
  expect(p.all, "paints in 3 s after settling (30 a second would be 90)").toBeLessThanOrEqual(MAX_PAINTS);
});
