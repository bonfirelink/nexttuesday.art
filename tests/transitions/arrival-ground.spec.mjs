import { test, expect } from "../helpers/fixtures.mjs";
import { WORLDS } from "../helpers/transitions.mjs";

// Arriving beige from the home, the root's ground is what the view
// transition's crossfade lies on: where the two snapshots are each partly
// transparent it shows through over the whole page but the header. It stays
// the NTS paper until the world settles, so no frame of the arrival darkens.

// Init script: on a world page, the root's background and the bleed state at
// every frame from the first, and when the arrival's view transition is over.
function sampleRoot() {
  if (!/\/(embers|not-not-philo|intersect)\/$/.test(location.pathname)) return;
  window.__root = [];
  addEventListener("pagereveal", (e) => {
    const done = () => { window.__vtDone = true; };
    if (e.viewTransition) e.viewTransition.finished.then(done, done); else done();
  });
  const tick = () => {
    const d = document.documentElement;
    window.__root.push({ state: d.getAttribute("data-bleed-state"), bg: getComputedStyle(d).backgroundColor });
    if (window.__root.length < 90) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Luminance (0..255) of the ground in each screencast frame: the 75th
// percentile (text and figures are darker than the ground) of a band below
// the header that the hero fills at every size (below the hero the world's
// dark is there from the start).
async function frameLuma(page, frames) {
  const aux = await page.context().newPage();
  try {
    return await aux.evaluate(async (frames) => {
      const out = [];
      for (const png of frames) {
        const img = new Image();
        img.src = "data:image/png;base64," + png;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        const top = Math.round(c.height * 0.1), d = g.getImageData(0, top, c.width, Math.round(c.height * 0.45)).data, v = [];
        for (let i = 0; i < d.length; i += 4 * 23) v.push(Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]));
        v.sort((a, b) => a - b);
        out.push(v[Math.floor(v.length * 0.75)]);
      }
      return out;
    }, frames);
  } finally { await aux.close(); }
}

const SIZES = [["1280x800", { width: 1280, height: 800 }], ["390x844", { width: 390, height: 844 }]];

for (const [label, viewport] of SIZES) {
  test.describe(label, () => {
    test.use({ viewport });
    for (const world of WORLDS) {
      test(`T3 arriving beige at ${world} from the home, no frame darkens, ${label}`, async ({ page }) => {
        await page.addInitScript(sampleRoot);
        await page.goto(process.env.NTS_BASE + "/", { waitUntil: "load" });
        const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

        const cdp = await page.context().newCDPSession(page);
        const frames = [];
        cdp.on("Page.screencastFrame", (f) => {
          frames.push(f.data);
          cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
        });
        await cdp.send("Page.startScreencast", { format: "png", maxWidth: 400, maxHeight: 400, everyNthFrame: 1 });
        await expect.poll(() => frames.length).toBeGreaterThan(0);
        const before = await frameLuma(page, [frames[frames.length - 1]]);
        frames.length = 0;

        await page.locator(`header a[href="/${world}/"]:visible`).first().click();
        await page.waitForURL(`**/${world}/`);
        await page.waitForFunction(() => window.__vtDone);
        await cdp.send("Page.stopScreencast");
        await page.waitForFunction(() => window.__root.length >= 60);

        const root = await page.evaluate(() => window.__root);
        expect(root[0].state, "the arrival is beige").not.toBe("world");
        const unsettled = root.filter((r) => r.state !== "world");
        expect(unsettled.length).toBeGreaterThan(0);
        expect.soft([...new Set(unsettled.map((r) => r.bg))], "the root's ground until the world settles").toEqual([paper]);

        const luma = await frameLuma(page, frames);
        expect(frames.length, "screencast frames").toBeGreaterThan(5);
        expect(Math.min(...luma), `darkest frame (home ${before[0]})`).toBeGreaterThanOrEqual(before[0] - 20);
      });
    }
  });
}
