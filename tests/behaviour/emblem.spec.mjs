// The home emblem: a sun of colour bands round a dial, the pyramid with its eye
// at the centre, orbits that turn against each other, and a seven-point star
// drawn at the back that the stop reveals.
// E1 its parts; E2 the dial ticks counter-clockwise in 60 eased steps a minute
// and neighbouring orbits turn against each other, the beads with theirs;
// E3 tapping the eye stops it in the symmetric pose, hollows the dial, flips
// the pyramid, draws the star and says the secret, and a second tap resumes
// from where it stands; E4 the ground picker switches the hero between Black
// sun and Black opening, remembers it, works from the keyboard, without
// storage and without scripts; E5 under reduced motion nothing turns but the
// stop still works, and going again undoes it; E6 the eye beams only on hover or focus where there is a
// pointer, now and then on a touch screen; E7 a star names its page in a caption and does not navigate.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open } from "../helpers/behaviour.mjs";

const ANGLE_TOL = 1.5; // degrees: positions read from boxes on a 390 px emblem
const GLIDE_MS = 2000; // the stop's 1.6 s glide and fade, and a margin
const STOP_BODY = { embers: 240, philo: 0, intersect: 120, star: 180 };
const STOP_DOTS = { 66: [60, 180, 300], 78.4: [90, 270], 84: [150, 210], 96.4: [0, 30, 330] };
const PLYWOOD = "rgb(230, 216, 192)";
const INK = "rgb(20, 19, 18)";
const BONE = "rgb(232, 220, 198)";

const norm = (a) => ((a % 360) + 360) % 360;
const gap = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

// Angles clockwise from up, round the emblem's centre, of the beads and the star dots.
const poses = (page) =>
  page.evaluate(() => {
    const o = document.querySelector(".orrery").getBoundingClientRect();
    const cx = o.left + o.width / 2, cy = o.top + o.height / 2;
    const at = (el) => {
      const r = el.getBoundingClientRect();
      const a = (Math.atan2(r.left + r.width / 2 - cx, -(r.top + r.height / 2 - cy)) * 180) / Math.PI;
      return ((a % 360) + 360) % 360;
    };
    const beads = Object.fromEntries([...document.querySelectorAll(".orrery .bead")].map((b) => [b.dataset.body, at(b)]));
    const dots = [...document.querySelectorAll(".orrery .st")].map((s) => ({ orbit: s.dataset.orbit, a: at(s) }));
    return { beads, dots };
  });

// The angle a layer is turned by: its rotate property and its transform together.
const turnOf = (page, sel) =>
  page.evaluate((s) => {
    const cs = getComputedStyle(document.querySelector(s));
    const r = cs.rotate === "none" ? 0 : parseFloat(cs.rotate);
    const m = cs.transform.match(/matrix\(([^)]+)\)/);
    const t = m ? (Math.atan2(+m[1].split(",")[1], +m[1].split(",")[0]) * 180) / Math.PI : 0;
    return r + t;
  }, sel);

const opacity = (page, sel) => page.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).opacity), sel);
const ground = (page) =>
  page.evaluate(() => ({
    plate: getComputedStyle(document.querySelector(".threshold"), "::before").backgroundColor,
    dial: getComputedStyle(document.querySelector(".orrery .e-dial circle")).fill,
  }));

function expectStopPose(p) {
  for (const [body, a] of Object.entries(STOP_BODY)) expect(gap(p.beads[body], a), `${body} at ${a}`).toBeLessThanOrEqual(ANGLE_TOL);
  for (const [orbit, want] of Object.entries(STOP_DOTS)) {
    const got = p.dots.filter((d) => d.orbit === orbit).map((d) => norm(Math.round(d.a)) % 360).sort((x, y) => x - y);
    expect(got.length, `dots on orbit ${orbit}`).toBe(want.length);
    got.forEach((a, i) => expect(gap(a, want[i]), `orbit ${orbit} dot ${i}`).toBeLessThanOrEqual(ANGLE_TOL));
  }
}

test("E1 the emblem: dial, 60 marks with a north, the pyramid with its eye, the star at the back", async ({ page }) => {
  await open(page);
  const s = await page.evaluate(() => {
    const o = document.querySelector(".orrery");
    const marks = o.querySelector(".e-marks path").getAttribute("d").match(/M/g).length;
    return {
      dial: !!o.querySelector(".e-dial circle"),
      marks,
      north: o.querySelectorAll(".e-north path").length,
      faces: o.querySelectorAll(".e-tet.run path:not([fill='none'])").length,
      eye: o.querySelectorAll(".e-tet.run .eye").length,
      back: o.firstElementChild.classList.contains("e-star"),
      edges: o.querySelectorAll(".e-star .he").length,
      beads: o.querySelectorAll(".bead[data-body]").length,
      stars: o.querySelectorAll(".st[aria-label]").length,
      stop: o.querySelector("button.e-stop")?.getAttribute("aria-pressed"),
    };
  });
  expect(s.dial, "the dial").toBe(true);
  expect(s.marks + s.north, "60 marks, the north among them").toBe(60);
  expect(s.north, "one north").toBe(1);
  expect(s.faces, "three faces").toBe(3);
  expect(s.eye, "one eye").toBe(1);
  expect(s.back, "the star is the back layer").toBe(true);
  expect(s.edges, "seven edges").toBe(7);
  expect(s.beads, "four beads").toBe(4);
  expect(s.stars, "ten star dots").toBe(10);
  expect(s.stop, "the eye is a toggle button").toBe("false");
});

test("E2 the dial ticks counter-clockwise, one eased step a second; neighbouring orbits turn against each other", async ({ page, freeze }) => {
  await open(page);
  // second 10 holds at -60 until its move starts
  await freeze(page, 10_400);
  expect(norm(await turnOf(page, ".orrery .e-tick"))).toBeCloseTo(300, 1);
  // the last second holds at -354
  await freeze(page, 59_400);
  expect(norm(await turnOf(page, ".orrery .e-tick"))).toBeCloseTo(6, 1);
  // after ten seconds each layer has turned 3600 / period degrees, in its direction
  await freeze(page, 10_000);
  const turned = { ring: [70, 1], bands: [95, -1], o66: [120, -1], o78: [170, 1], o84: [230, -1], o96: [300, 1] };
  for (const [k, [p, d]] of Object.entries(turned)) {
    expect(gap(await turnOf(page, `.orrery .e-${k}`), (d * 3600) / p), `${k} turns ${d > 0 ? "clockwise" : "counter-clockwise"}`).toBeLessThanOrEqual(0.5);
  }
  // the beads ride their orbits, the same way round
  const { beads } = await poses(page);
  const want = { embers: 205 - 3600 / 120, philo: 330 + 3600 / 170, intersect: 80 - 3600 / 230, star: 15 + 3600 / 300 };
  for (const [b, a] of Object.entries(want)) expect(gap(beads[b], a), `${b} bead`).toBeLessThanOrEqual(ANGLE_TOL);
});

for (const vp of VIEWPORTS) {
  test(`E3 the eye stops the machine in its symmetric pose and starts it again at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);
    const stop = page.locator(".orrery .e-stop");
    await stop.click();
    await page.waitForTimeout(GLIDE_MS);
    await expect(stop).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".threshold")).toHaveClass(/is-stopped/);
    expectStopPose(await poses(page));
    expect(await opacity(page, ".orrery .e-dial"), "the dial is transparent").toBe(0);
    for (const f of await page.locator(".orrery .e-fade").all()) expect(parseFloat(await f.evaluate((e) => getComputedStyle(e).opacity)), "marks and sunburst fade").toBe(0);
    expect(await opacity(page, ".orrery .e-north"), "the north stays").toBe(1);
    expect(await opacity(page, ".orrery .e-star"), "the star shows").toBe(1);
    expect(await opacity(page, ".orrery .e-tet.run"), "the running pyramid hands over").toBe(0);
    expect(await opacity(page, ".orrery .e-tet.stop"), "to the stopped one").toBe(1);
    expect(norm(await turnOf(page, ".orrery .e-tet.stop")), "flipped").toBeCloseTo(180, 1);
    const secret = await page.evaluate(() => {
      const s = document.querySelector(".turn .secret"), cs = getComputedStyle(s);
      return { op: parseFloat(cs.opacity), vis: cs.visibility, text: s.textContent.trim() };
    });
    expect(secret.op, "the secret line shows").toBe(1);
    expect(secret.vis).toBe("visible");
    expect(secret.text).toContain("next Tuesday");

    // again: it carries on from where it stands, and everything comes back
    await stop.click();
    const just = await poses(page);
    for (const [body, a] of Object.entries(STOP_BODY)) expect(gap(just.beads[body], a), `${body} resumes from its pose`).toBeLessThanOrEqual(2 * ANGLE_TOL);
    await page.waitForTimeout(GLIDE_MS);
    await expect(stop).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".threshold")).not.toHaveClass(/is-stopped/);
    expect(await opacity(page, ".orrery .e-dial")).toBe(1);
    expect(await opacity(page, ".orrery .e-star")).toBe(0);
    expect(await opacity(page, ".orrery .e-tet.run")).toBe(1);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector(".turn .secret")).visibility)).toBe("hidden");
    const running = await page.evaluate(() =>
      document.querySelector(".orrery").getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation && a.playState === "running").map((a) => a.animationName)
    );
    expect(running, "the beads orbit again").toContain("orbit");
    expect(running.length, "beads, orbits, ring, bands and the tick all run").toBeGreaterThanOrEqual(4 + 6 + 2);
  });
}

test.describe("E4 the ground picker", () => {
  test("switches the hero and the dial, and remembers the choice", async ({ page }) => {
    await open(page);
    expect(await page.locator(".e-pick input[type=radio]").count()).toBe(2);
    await expect(page.locator(".e-pick input[value=sun]")).toBeChecked();
    expect(await ground(page)).toEqual({ plate: PLYWOOD, dial: INK });
    await page.locator(".e-pick input[value=opening]").check();
    expect(await ground(page)).toEqual({ plate: INK, dial: BONE });
    expect(await page.evaluate(() => localStorage.getItem("nts:ground"))).toBe("opening");
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".e-pick input[value=opening]")).toBeChecked();
    expect(await ground(page)).toEqual({ plate: INK, dial: BONE });
  });

  test("works from the keyboard", async ({ page }) => {
    await open(page);
    await page.locator(".e-pick input[value=sun]").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".e-pick input[value=opening]")).toBeChecked();
    await expect(page.locator(".e-pick input[value=opening]")).toBeFocused();
    expect((await ground(page)).plate).toBe(INK);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".e-pick input[value=sun]")).toBeChecked();
    expect((await ground(page)).plate).toBe(PLYWOOD);
  });

  test("still works when storage throws", async ({ page, watch }) => {
    await page.addInitScript(() => {
      const no = () => { throw new DOMException("denied", "SecurityError"); };
      Storage.prototype.getItem = no;
      Storage.prototype.setItem = no;
    });
    await open(page);
    expect((await ground(page)).plate).toBe(PLYWOOD);
    await page.locator(".e-pick input[value=opening]").check();
    expect((await ground(page)).plate).toBe(INK);
    expect(watch.errors).toEqual([]);
  });

  test.describe("without scripts", () => {
    test.use({ javaScriptEnabled: false });
    test("starts on Black sun and still switches", async ({ page }) => {
      await page.goto(process.env.NTS_BASE + "/");
      expect(await ground(page)).toEqual({ plate: PLYWOOD, dial: INK });
      await page.locator(".e-pick input[value=opening]").check();
      expect(await ground(page)).toEqual({ plate: INK, dial: BONE });
      await page.goto(process.env.NTS_BASE + "/");
      expect((await ground(page)).plate, "nothing remembered without scripts").toBe(PLYWOOD);
    });
  });
});

test("E5 under reduced motion nothing turns, and the stop still works", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const running = () =>
    page.evaluate(() =>
      document.querySelector(".orrery").getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation && a.playState === "running").map((a) => a.animationName)
    );
  expect(await running(), "no animation in the emblem").toEqual([]);
  const placed = () =>
    page.evaluate(() => [...document.querySelectorAll(".orrery :is(.e-pv, .pivot > .bead, .e-ring, .e-bands, .e-orbit, .e-tick)")].map((d) => getComputedStyle(d).transform));
  const start = await placed();
  await page.locator(".orrery .e-stop").click();
  // the dial still fades, over the same 1.6 s
  await page.waitForTimeout(400);
  const mid = await opacity(page, ".orrery .e-dial");
  expect(mid, "fading, not cut").toBeGreaterThan(0.05);
  expect(mid).toBeLessThan(0.98);
  await page.waitForTimeout(GLIDE_MS);
  await expect(page.locator(".orrery .e-stop")).toHaveAttribute("aria-pressed", "true");
  expectStopPose(await poses(page));
  expect(await opacity(page, ".orrery .e-dial")).toBe(0);
  expect(await opacity(page, ".orrery .e-star")).toBe(1);
  expect(await opacity(page, ".orrery .e-tet.up"), "the pyramid does not turn").toBe(0);
  expect(await opacity(page, ".orrery .e-tet.down"), "it hands over to one drawn upside down").toBe(1);
  expect(await running(), "still nothing turns").toEqual([]);
  // going again undoes the stop: every part is back where it was drawn
  await page.locator(".orrery .e-stop").click();
  await page.waitForTimeout(GLIDE_MS);
  expect(await placed()).toEqual(start);
});

test.describe("E6 the eye's beam", () => {
  test("with a pointer it beams only on hover", async ({ page }) => {
    await open(page);
    const beams = () =>
      page.evaluate(() =>
        [...document.querySelectorAll(".orrery .e-beam")].flatMap((b) => b.getAnimations()).filter((a) => a.playState === "running").length
      );
    await page.mouse.move(1, 1);
    expect(await beams(), "no beam at rest").toBe(0);
    await page.locator(".orrery .e-stop").hover();
    expect(await beams(), "beams on hover").toBeGreaterThan(0);
  });

  test.describe("on a touch screen", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    test("it beams now and then by itself", async ({ page }) => {
      await open(page);
      const names = await page.evaluate(() =>
        [...document.querySelectorAll(".orrery .e-beam")].flatMap((b) => b.getAnimations()).map((a) => a.animationName)
      );
      expect(names).toContain("e-beam-rare");
    });
  });
});

test("E7 a star names its page in a caption and does not navigate", async ({ page, freeze }) => {
  await open(page);
  await freeze(page, 0);
  const url = page.url();
  const dot = page.locator('.orrery .st[data-to="INTERSECT"]');
  await dot.click();
  const cap = page.locator(".e-cap");
  await expect(cap).toContainText("INTERSECT");
  await expect(cap).toContainText("proposal");
  expect(page.url()).toBe(url);
});
