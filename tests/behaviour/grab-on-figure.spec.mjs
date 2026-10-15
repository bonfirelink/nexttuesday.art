// A press grabs the figure only on the figure (with a little slack around its outline):
// elsewhere on the canvas it neither drags, stokes nor captures the pointer, and the
// grab cursor shows over the figure only. The same in all three worlds.
import { test, expect } from "../helpers/fixtures.mjs";

test.use({ viewport: { width: 1440, height: 900 } });

const wait = (page, ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);

const WORLDS = {
  embers: {
    path: "/embers/", host: "canvas.nts-hearth", ready: "canvas.nts-hearth",
    // a snapshot that changes while the figure moves (the pose accessor)
    snap: () => JSON.stringify(document.querySelector("canvas.nts-hearth").ntsPose()),
    // the figure's centre is the stage's; the canvas is the whole hero around it
    points: () => {
      const c = document.querySelector("canvas.nts-hearth").getBoundingClientRect();
      const s = document.querySelector(".embers-hero .hearth-stage").getBoundingClientRect();
      return { fig: [s.left + s.width / 2, s.top + s.height / 2], off: [c.left + 24, s.top + s.height / 2] };
    },
  },
  philo: {
    path: "/not-not-philo/", host: ".nts-penrose", ready: ".nts-penrose.is-live",
    // the cubes rest between steps, one every 1.5 s: watch for longer than a step
    beat: 1700,
    snap: () => document.querySelector(".nts-penrose canvas").toDataURL(),
    points: (pixelPoints) => pixelPoints(document.querySelector(".nts-penrose canvas"), document.querySelector(".nts-penrose")),
  },
  intersect: {
    path: "/intersect/", host: "pre[data-nts-ascii]", ready: "pre[data-nts-ascii].is-live",
    snap: () => document.querySelector("pre[data-nts-ascii] canvas").toDataURL(),
    points: (pixelPoints) => pixelPoints(document.querySelector("pre[data-nts-ascii] canvas"), document.querySelector("pre[data-nts-ascii]")),
  },
};

// A drawn pixel nearest the host's centre, and a corner of the host with nothing drawn within 40px.
function pixelPoints(canvas, box) {
  const r = canvas.getBoundingClientRect(), b = box.getBoundingClientRect();
  const k = canvas.width / r.width, g = canvas.getContext("2d");
  const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
  const ink = (x, y) => data[(Math.round(y * k) * canvas.width + Math.round(x * k)) * 4 + 3] > 128;
  const ox = b.left - r.left, oy = b.top - r.top, cx = ox + b.width / 2, cy = oy + b.height / 2;
  let fig = null, best = Infinity;
  for (let y = 0; y < r.height; y += 1) for (let x = 0; x < r.width; x += 1) {
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < best && ink(x, y)) { best = d; fig = [r.left + x, r.top + y]; }
  }
  const clear = (x, y) => { for (let dy = -40; dy <= 40; dy += 2) for (let dx = -40; dx <= 40; dx += 2) { const px = x + dx, py = y + dy; if (px >= 0 && py >= 0 && px < r.width && py < r.height && ink(px, py)) return false; } return true; };
  const corners = [[ox + 8, oy + 8], [ox + b.width - 8, oy + 8], [ox + 8, oy + b.height - 8], [ox + b.width - 8, oy + b.height - 8]].filter(([x, y]) => clear(x, y));
  const off = corners.length ? [r.left + corners[0][0], r.top + corners[0][1]] : null;
  return { fig, off };
}

for (const [name, W] of Object.entries(WORLDS)) {
  test.describe(name, () => {
    let pts;
    test.beforeEach(async ({ page }) => {
      await page.goto(process.env.NTS_BASE + W.path);
      await page.waitForSelector(W.ready);
      await page.locator(W.host).scrollIntoViewIfNeeded();
      await wait(page, 500); // the hero settles (fonts) before the figure's place is read
      pts = await page.evaluate(`(${W.points})(${pixelPoints})`);
      expect(pts.fig, "a point on the figure").toBeTruthy();
      expect(pts.off, "a point on the host with no figure near it").toBeTruthy();
      const under = await page.evaluate(([x, y, sel]) => !!document.elementFromPoint(x, y)?.closest(sel), [...pts.off, W.host]);
      expect(under, "the empty point is over the host").toBe(true);
    });
    const still = async (page) => {
      await wait(page, 200);
      const a = await page.evaluate(W.snap);
      await wait(page, W.beat || 700);
      return a === (await page.evaluate(W.snap));
    };
    const captured = (page, [x, y]) => page.evaluate(([x, y, sel]) => {
      const el = document.elementFromPoint(x, y).closest(sel);
      return [...el.querySelectorAll("*"), el].some((e) => e.hasPointerCapture(1));
    }, [x, y, W.host]);
    const cursor = (page, [x, y]) => page.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, [x, y]);

    test("a press on the figure grabs it: held still, pointer captured", async ({ page }) => {
      await page.mouse.move(...pts.fig);
      await page.mouse.down();
      await page.mouse.move(pts.fig[0] + 6, pts.fig[1] + 2, { steps: 3 });
      expect(await captured(page, pts.fig), "pointer captured").toBe(true);
      expect(await still(page), "figure holds its pose").toBe(true);
      await page.mouse.up();
    });

    test("a press on empty area does nothing: no capture, no hold, no drag", async ({ page }) => {
      await page.mouse.move(...pts.off);
      await page.mouse.down();
      await page.mouse.move(pts.off[0] + 6, pts.off[1] + 2, { steps: 3 });
      expect(await captured(page, pts.off), "no pointer capture").toBe(false);
      expect(await still(page), "figure keeps moving").toBe(false);
      await page.mouse.move(pts.off[0] + 60, pts.off[1] + 10, { steps: 4 });
      await page.mouse.up();
      // a tap there neither grabs nor strokes
      await page.mouse.click(...pts.off);
      expect(await still(page), "figure keeps moving after a tap").toBe(false);
    });

    test("the grab cursor shows over the figure only, grabbing while pressed", async ({ page }) => {
      await page.mouse.move(...pts.off);
      await page.mouse.move(pts.off[0] + 2, pts.off[1] + 2);
      expect(await cursor(page, pts.off), "off the figure").not.toMatch(/grab/);
      await page.mouse.move(...pts.fig);
      await page.mouse.move(pts.fig[0] + 1, pts.fig[1]);
      expect(await cursor(page, pts.fig), "over the figure").toBe("grab");
      await page.mouse.down();
      expect(await cursor(page, pts.fig), "pressed").toBe("grabbing");
      await page.mouse.up();
      await page.mouse.move(pts.off[0], pts.off[1]);
      await page.mouse.move(pts.off[0] + 2, pts.off[1] + 2);
      expect(await cursor(page, pts.off), "back off the figure").not.toMatch(/grab/);
    });
  });
}

// a drag adds dx * 0.012 to the yaw on top of the resting spin, which is slower than that; a
// release leaves the spin it threw, so each case gets its own page
for (const [where, turns] of [["fig", true], ["off", false]]) {
  test(`embers: a drag on ${turns ? "the figure turns it" : "empty area does not"}`, async ({ page }) => {
    await page.goto(process.env.NTS_BASE + "/embers/");
    await page.waitForSelector("canvas.nts-hearth");
    await page.locator("canvas.nts-hearth").scrollIntoViewIfNeeded();
    await wait(page, 500); // the hero settles (fonts) before the figure's place is read
    const pts = await page.evaluate(`(${WORLDS.embers.points})()`);
    const [x, y] = pts[where];
    const turn = (a, b) => Math.abs(((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    const pose = () => page.evaluate(() => document.querySelector("canvas.nts-hearth").ntsPose());
    await page.mouse.move(x, y); await page.mouse.down();
    const a = await pose();
    await page.mouse.move(x + 100, y, { steps: 5 });
    const b = await pose(); await page.mouse.up();
    if (turns) expect(turn(a[0], b[0]), "figure turned by the drag").toBeGreaterThan(0.9);
    else expect(turn(a[0], b[0]), "empty area does not turn it").toBeLessThan(0.3);
  });
}
