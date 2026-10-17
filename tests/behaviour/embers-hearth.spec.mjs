// The EMBERS hearth on its page: a small live canvas over the box around the
// solid is the only thing redrawn; the straight lines around it are the hearth
// canvas's CSS background, masked off the box, and meet the live lines without
// a seam. The hearth canvas keeps the pointer and the keys. At rest nothing
// rises; a stoke throws one burst of glyphs, and only while they are in the
// air does the live canvas reach up and out.
import { test, expect } from "../helpers/fixtures.mjs";
import { clickWorldLink } from "../helpers/transitions.mjs";

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
// what sits over the hearth in the hero, hidden for pixel reads of the lines
const BARE = ".embers-hero .hero-text, .embers-hero .trace, .embers-bar, header { visibility: hidden !important; }";

async function openHearth(page) {
  await page.goto(process.env.NTS_BASE + "/embers/");
  await page.waitForSelector("canvas.nts-hearth.is-split");
  await page.evaluate(() => document.fonts.ready);
  // settled: the box is centred on the stage the solid is anchored to
  await page.waitForFunction(() => {
    const c = document.querySelector("canvas.nts-hearth"), b = c.ntsHearth().box;
    if (!b) return false;
    const s = document.querySelector(".embers-hero .hearth-stage").getBoundingClientRect(), r = c.getBoundingClientRect();
    // a box clamped to the hero's sides (on a phone) is centred on the hero instead
    const target = b[0] <= 0 && b[0] + b[2] >= r.width - 1 ? r.left + r.width / 2 : s.left + s.width / 2;
    return Math.abs(r.left + b[0] + b[2] / 2 - target) <= 1;
  });
}
// the hearth's state, through its accessor: heat, frame-rate cap, resolution, box (css px of the hero)
const hearth = (page) => page.evaluate(() => document.querySelector("canvas.nts-hearth").ntsHearth());
const rects = (page) => page.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
  const c = document.querySelector("canvas.nts-hearth"), l = document.querySelector(".nts-hearth-live");
  return { hero: r(".embers-hero"), canvas: r("canvas.nts-hearth"), live: r(".nts-hearth-live"), stage: r(".embers-hero .hearth-stage"), backing: [c.width, c.height], liveBacking: [l.width, l.height] };
});
// a screenshot of the hero, decoded in the page: rows of [r, g, b] per device px
async function heroPixels(page) {
  const hero = await page.evaluate(() => document.querySelector(".embers-hero").getBoundingClientRect().toJSON());
  const png = await page.screenshot({ clip: { x: hero.x, y: hero.y, width: hero.width, height: hero.height } });
  return { hero, png };
}
async function pixelDiff(page, pngs, pairs) {
  // pairs: [[x1, y1, x2, y2], ...] in device px of the shot; per pair, the smallest channel
  // difference over the shots (an ember passing through one shot is not a seam)
  return page.evaluate(async ([b64s, pairs]) => {
    const shots = [];
    for (const b64 of b64s) {
      const im = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
      const k = document.createElement("canvas"); k.width = im.width; k.height = im.height;
      const c = k.getContext("2d"); c.drawImage(im, 0, 0);
      shots.push({ d: c.getImageData(0, 0, im.width, im.height).data, W: im.width });
    }
    const at = (s, x, y) => { const i = (y * s.W + x) * 4; return [s.d[i], s.d[i + 1], s.d[i + 2]]; };
    return pairs.map(([x1, y1, x2, y2]) => Math.min(...shots.map((s) => {
      const a = at(s, x1, y1), b = at(s, x2, y2);
      return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
    })));
  }, [pngs.map((p) => p.toString("base64")), pairs]);
}

test.describe("desktop", () => {
  test.use(DESKTOP);

  test("E8 the live canvas covers the box around the solid, not the hero; the hearth canvas keeps no pixels and shows the lines as its masked background", async ({ page }) => {
    await openHearth(page);
    const r = await rects(page), h = await hearth(page);
    expect(r.backing, "the hearth canvas's backing store").toEqual([0, 0]);
    expect(r.canvas.width).toBeCloseTo(r.hero.width, -1);
    // the live layer: over the stage's centre, a fraction of the hero
    const cx = r.stage.x + r.stage.width / 2, cy = r.stage.y + r.stage.height / 2;
    expect(cx).toBeGreaterThan(r.live.x); expect(cx).toBeLessThan(r.live.x + r.live.width);
    expect(cy).toBeGreaterThan(r.live.y); expect(cy).toBeLessThan(r.live.y + r.live.height);
    expect(r.live.width * r.live.height, "live area vs hero area").toBeLessThan(0.6 * r.hero.width * r.hero.height);
    expect(r.liveBacking[0]).toBeCloseTo(r.live.width * h.dpr, -1);
    // the box lies inside the live layer
    expect(h.box[0]).toBeGreaterThanOrEqual(r.live.x - r.canvas.x - 0.01);
    expect(h.box[0] + h.box[2]).toBeLessThanOrEqual(r.live.x - r.canvas.x + r.live.width + 0.01);
    const css = await page.evaluate(() => {
      const c = document.querySelector("canvas.nts-hearth"), l = document.querySelector(".nts-hearth-live"), s = getComputedStyle(c);
      return { bg: s.backgroundImage.slice(0, 20), mask: (s.maskImage || s.webkitMaskImage), liveHidden: l.getAttribute("aria-hidden"), livePointer: getComputedStyle(l).pointerEvents };
    });
    expect(css.bg).toMatch(/^url\("?data:image\/png/);
    expect(css.mask).toMatch(/linear-gradient.*linear-gradient/);
    expect(css.liveHidden).toBe("true");
    expect(css.livePointer).toBe("none");
  });

  test("E9 a tap on the solid and the keys stoke the hearth through canvas.nts-hearth", async ({ page }) => {
    await openHearth(page);
    const r = await rects(page), h0 = await hearth(page);
    await page.mouse.click(r.stage.x + r.stage.width / 2, r.stage.y + r.stage.height / 2);
    const h1 = await hearth(page);
    expect(h1.heat, "heat after a tap").toBeGreaterThan(h0.heat + 0.5);
    expect(h1.fps, "a stoke's burst runs at 60").toBe(60);
    await page.waitForFunction(() => document.querySelector("canvas.nts-hearth").ntsHearth().heat < 0.4, null, { timeout: 10_000 });
    const h2 = await hearth(page);
    await page.locator("canvas.nts-hearth").focus();
    await page.keyboard.press("Enter");
    expect((await hearth(page)).heat, "heat after Enter").toBeGreaterThan(h2.heat + 0.5);
  });

  test("E10 a fine pointer: the page's frame rate (30), the largest grid resolution within the budget", async ({ page }) => {
    await openHearth(page);
    const h = await hearth(page), r = await rects(page);
    expect(h.fps).toBe(30);
    const D = DESKTOP.deviceScaleFactor, budget = await page.evaluate(() => +document.querySelector("canvas.nts-hearth").dataset.maxPx);
    // on the screen's grid: D * m / n for some n up to 8
    expect([1, 2, 3, 4, 5, 6, 7, 8].some((n) => Math.abs(((h.dpr / D) * n) - Math.round((h.dpr / D) * n)) < 1e-9), `dpr ${h.dpr} on the grid`).toBe(true);
    expect(h.dpr).toBeLessThanOrEqual(D);
    // the live canvas at rest stays within the budget, and takes the screen's resolution when that fits
    expect(r.liveBacking[0] * r.liveBacking[1]).toBeLessThanOrEqual(budget);
    if (r.live.width * r.live.height * D * D <= budget) expect(h.dpr).toBe(D);
  });

  test("E11 the lines outside the live layer stay put from frame to frame", async ({ page }) => {
    await openHearth(page);
    await page.addStyleTag({ content: BARE });
    const r = await rects(page);
    const clip = { x: r.hero.x, y: r.hero.y, width: Math.floor(r.live.x - r.hero.x) - 1, height: r.hero.height };
    const a = await page.screenshot({ clip });
    await page.waitForTimeout(700);
    const b = await page.screenshot({ clip });
    expect(a.equals(b), "the hero left of the live layer, 0.7 s apart").toBe(true);
    // while the box moves
    const box = { x: r.live.x, y: r.hero.y, width: r.live.width, height: r.live.height };
    const c = await page.screenshot({ clip: box });
    await page.waitForTimeout(300);
    expect(c.equals(await page.screenshot({ clip: box })), "the live layer moves").toBe(false);
  });

  test("E12 no seam where the lines cross the box's left edge", async ({ page }) => {
    await openHearth(page);
    await page.addStyleTag({ content: BARE });
    const h = await hearth(page), D = DESKTOP.deviceScaleFactor;
    const shots = [];
    for (let i = 0; i < 3; i++) { shots.push((await heroPixels(page)).png); await page.waitForTimeout(250); }
    const e = Math.round(h.box[0] * D), pairs = [];
    for (let y = Math.round(h.box[1] * D); y < Math.round((h.box[1] + h.box[3]) * D); y++) pairs.push([e - 1, y, e, y]);
    const d = await pixelDiff(page, shots, pairs);
    expect(Math.max(...d), "largest channel difference across the edge").toBe(0);
  });

  test("E13 under reduced motion the hearth draws one still frame", async ({ browser }) => {
    const context = await browser.newContext({ ...DESKTOP, reducedMotion: "reduce" });
    const page = await context.newPage();
    await openHearth(page);
    const grab = () => page.evaluate(() => document.querySelector(".nts-hearth-live").toDataURL());
    const a = await grab();
    await page.waitForTimeout(800);
    expect(await grab()).toBe(a);
    const blank = await page.evaluate(() => { const l = document.querySelector(".nts-hearth-live"), k = document.createElement("canvas"); k.width = l.width; k.height = l.height; return k.toDataURL(); });
    expect(a, "the still frame has the solid in it").not.toBe(blank);
    await context.close();
  });

  test("E14 with scripts off: the still drawing, no live layer, no lines background", async ({ browser }) => {
    const context = await browser.newContext({ ...DESKTOP, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(process.env.NTS_BASE + "/embers/");
    await expect(page.locator(".embers-hero .hearth-still")).toBeVisible();
    expect(await page.locator(".nts-hearth-live").count()).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector("canvas.nts-hearth")).backgroundImage)).toBe("none");
    await context.close();
  });
});

test.describe("phone", () => {
  test.use(PHONE);

  test("E10 a touch screen: 24fps at 1.5x, and a stoke's burst at 60", async ({ page }) => {
    await openHearth(page);
    const h = await hearth(page);
    expect(h.fps).toBe(24);
    expect(h.dpr).toBe(1.5);
    const r = await rects(page);
    await page.touchscreen.tap(r.stage.x + r.stage.width / 2, r.stage.y + r.stage.height / 2);
    expect((await hearth(page)).fps).toBe(60);
  });

  test("E11 the lines below the live layer stay put from frame to frame", async ({ page }) => {
    await openHearth(page);
    await page.addStyleTag({ content: BARE });
    const r = await rects(page);
    const top = Math.ceil(r.live.y + r.live.height) + 1;
    const clip = { x: r.hero.x, y: top, width: r.hero.width, height: Math.floor(r.hero.y + r.hero.height - top) };
    const a = await page.screenshot({ clip });
    await page.waitForTimeout(700);
    expect(a.equals(await page.screenshot({ clip }))).toBe(true);
  });

  test("E12 the last line in the box matches the first below it", async ({ page }) => {
    await openHearth(page);
    await page.addStyleTag({ content: BARE });
    const h = await hearth(page), D = PHONE.deviceScaleFactor;
    const shots = [];
    for (let i = 0; i < 3; i++) { shots.push((await heroPixels(page)).png); await page.waitForTimeout(250); }
    // the lines are evenly spaced; the box's bottom falls between two of them
    const sp = h.spacing, top = h.firstLine, bottom = h.box[1] + h.box[3];
    const yIn = top + Math.floor((bottom - top) / sp) * sp, yOut = yIn + sp, pairs = [];
    for (const x of [6, 20, h.box[2] - 20]) for (let dy = -Math.round(6 * D); dy < Math.round(6 * D); dy++) {
      pairs.push([Math.round(x * D), Math.round(yIn * D) + dy, Math.round(x * D), Math.round(yOut * D) + dy]);
    }
    const d = await pixelDiff(page, shots, pairs);
    // the live layer at 1.5x is scaled 2x to the screen, the lines' tile too; the two
    // resamplings differ by a few levels at most
    expect(Math.max(...d), "largest channel difference between the two lines").toBeLessThanOrEqual(4);
  });
});

// a tap on the solid's stage, as E9
async function tapStage(page) {
  const r = await rects(page);
  await page.mouse.click(r.stage.x + r.stage.width / 2, r.stage.y + r.stage.height / 2);
}
const restingHeat = (page) => page.evaluate(() => +document.querySelector("canvas.nts-hearth").dataset.stoke || 0);

test.describe("desktop: a stoke's burst", () => {
  test.use(DESKTOP);

  test("E15 at rest no embers rise", async ({ page }) => {
    await openHearth(page);
    await page.waitForTimeout(2500);
    expect((await hearth(page)).embers).toBe(0);
  });

  test("E16 at rest the live canvas is the box, short of the hero's top", async ({ page }) => {
    await openHearth(page);
    const h = await hearth(page), r = await rects(page);
    expect(h.layer).toEqual(h.box);
    expect(h.layer[1], "the box's top, below the hero's").toBeGreaterThan(0);
    // the element is where the accessor says
    expect(r.live.x - r.canvas.x).toBeCloseTo(h.layer[0], 1);
    expect(r.live.y - r.canvas.y).toBeCloseTo(h.layer[1], 1);
    expect(r.live.height).toBeCloseTo(h.layer[3], 1);
  });

  test("E17 a tap's burst: the live canvas reaches up and out at 60fps while its glyphs are in the air, then shrinks back to the box", async ({ page }) => {
    await openHearth(page);
    const rest = await hearth(page), stoke0 = await restingHeat(page);
    await tapStage(page);
    const h = await hearth(page);
    expect(h.embers, "glyphs thrown").toBeGreaterThan(0);
    expect(h.layer[1], "up to the hero's top").toBe(0);
    expect(h.layer[0]).toBeLessThan(rest.layer[0]);
    expect(h.layer[0] + h.layer[2]).toBeGreaterThan(rest.layer[0] + rest.layer[2]);
    expect(h.fps).toBe(60);
    // the heat cools before the glyphs do; the burst keeps its 60 while they fly
    await page.waitForFunction((s) => document.querySelector("canvas.nts-hearth").ntsHearth().heat < s + 0.15, stoke0, { timeout: 5000 });
    const cooled = await hearth(page);
    expect(cooled.embers, "glyphs still in the air once the heat is down").toBeGreaterThan(0);
    expect(cooled.fps).toBe(60);
    await page.waitForFunction(() => document.querySelector("canvas.nts-hearth").ntsHearth().embers === 0, null, { timeout: 10_000 });
    const after = await hearth(page);
    expect(after.layer).toEqual(after.box);
    expect(after.fps).toBe(30);
  });

  test("E18 the glyphs are blitted from a sheet drawn once: no text is drawn while they fly", async ({ page }) => {
    await page.addInitScript(() => {
      const ink = (window.__ink = { text: 0, liveBlits: 0 }), P = CanvasRenderingContext2D.prototype;
      const fillText = P.fillText, drawImage = P.drawImage;
      P.fillText = function (...a) { ink.text++; return fillText.apply(this, a); };
      P.drawImage = function (...a) { if (this.canvas.classList.contains("nts-hearth-live")) ink.liveBlits++; return drawImage.apply(this, a); };
    });
    await openHearth(page);
    await tapStage(page);
    // the burst is in the air and its sheet drawn
    await page.waitForFunction(() => { const h = document.querySelector("canvas.nts-hearth").ntsHearth(); return h.embers > 0 && h.glyphSheets.length === 1; });
    await page.evaluate(() => { window.__ink.text = 0; window.__ink.liveBlits = 0; });
    await page.waitForTimeout(500);
    const ink = await page.evaluate(() => window.__ink), h = await hearth(page);
    expect(ink.text, "text drawn during the burst").toBe(0);
    expect(ink.liveBlits, "glyphs blitted to the live canvas").toBeGreaterThan(10);
    expect(h.glyphSheets, "one sheet, the night's").toEqual(["night"]);
  });

  test("E19 through the bleed-in the glyphs take the palette of the ground under them: a sheet for the day and one for the night", async ({ page }) => {
    await page.goto(process.env.NTS_BASE + "/");
    await page.evaluate(() => document.fonts.ready);
    await clickWorldLink(page, "embers");
    await page.waitForSelector("canvas.nts-hearth.is-split");
    // halfway through the disc's opening, both palettes are drawn
    await page.evaluate(() => {
      const r = document.querySelector("main .hero").getBoundingClientRect(), t = document.querySelector("main .hero h1").getBoundingClientRect();
      const bar = document.querySelector(".nts-header").getBoundingClientRect().height;
      const end = Math.max(Math.min(r.top + scrollY + r.height / 2, t.top + scrollY - bar - Math.round(innerHeight * 0.02)), innerHeight * 0.1);
      scrollTo({ top: end / 2, behavior: "instant" });
    });
    await page.waitForFunction(() => { const q = window.NTS.bleed.progress(); return q > 0 && q < 1; });
    // right after the navigation the view transition's pseudo-elements take the hit test
    await page.waitForFunction(() => {
      const s = document.querySelector(".embers-hero .hearth-stage").getBoundingClientRect();
      return document.elementFromPoint(s.x + s.width / 2, s.y + s.height / 2) === document.querySelector("canvas.nts-hearth");
    });
    await tapStage(page);
    await page.waitForFunction(() => document.querySelector("canvas.nts-hearth").ntsHearth().glyphSheets.length === 2, null, { timeout: 3000 });
    expect((await hearth(page)).glyphSheets.sort()).toEqual(["day", "night"]);
  });

  test("E20 under reduced motion no glyphs, at rest or after a tap", async ({ browser }) => {
    const context = await browser.newContext({ ...DESKTOP, reducedMotion: "reduce" });
    const page = await context.newPage();
    await openHearth(page);
    await page.waitForTimeout(800);
    expect((await hearth(page)).embers).toBe(0);
    await tapStage(page);
    const h = await hearth(page);
    expect(h.embers).toBe(0);
    expect(h.layer).toEqual(h.box);
    await context.close();
  });
});
