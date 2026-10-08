// O1 the orrery's bodies and the ring beads are one component (.disc);
// O2 every world defines the depth pair the discs, orbs and lifts read;
// O3 the home's three orbs are one portal: opening one moves and fades its
// layers (transform, opacity) and nothing else, the same parts on every
// world, and the orb itself never rises; O4 under reduced motion the
// portal still opens, by fading alone; O5 at rest the window a world's
// figure shows through is as wide as it was before the lid: the lid rides a
// ring outside it; O6 at rest the figure is exactly as on a plain disc: no
// transform and no clip but the disc's own round edge, so a live figure
// costs no more to composite than before the lid.
import { test, expect } from "../helpers/fixtures.mjs";
import { VIEWPORTS, open } from "../helpers/behaviour.mjs";

// The resting window's diameter in CSS px per viewport width: the whole disc,
// as it was before the orbs had a lid. Measured inside the limb that rims it.
const RESTING_WINDOW = { 390: 239, 1440: 352 };
const WINDOW_TOL = 1; // px
const EDGE_DIFF = 30; // summed RGB difference from the bare ground that marks the limb
const LIMB_OUTSIDE = 1; // px the window's limb reaches past the window's edge
const GROUND_AT = 5; // px outside the window where the scan starts, on the bare ground before the orbit

const WORLDS = [
  { body: "embers", path: "/embers/" },
  { body: "philo", path: "/not-not-philo/" },
  { body: "intersect", path: "/intersect/" },
];

// The look of a disc: its face and frame exactly, its shadows by geometry
// (the cast's colour comes from the ground it rides, which differs).
const look = (sel) => (s) => {
  const el = document.querySelector(s);
  const cs = getComputedStyle(el), after = getComputedStyle(el, "::after");
  const shape = (v) => v.replace(/rgba?\([^)]*\)/g, "C");
  return {
    background: cs.backgroundColor, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
    radius: cs.borderTopLeftRadius, shadow: shape(cs.boxShadow), lip: cs.boxShadow.match(/rgba?\([^)]*\)/)[0],
    hover: shape(after.boxShadow), hoverLine: after.borderTopColor,
  };
};

for (const { body, path } of WORLDS) {
  test(`O1 the orrery's ${body} body and its ring bead wear the same disc`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/");
    const emblem = await page.evaluate(look(), `.bead[data-body="${body}"] .face`);
    await open(page, path);
    const ring = await page.evaluate(look(), ".trace-bead");
    expect(emblem).toEqual(ring);
  });
}

test("O2 every world and the NTS ground define --w-rim and --w-cast", async ({ page }) => {
  await open(page, "/");
  const tokens = await page.evaluate(() =>
    [document.body, ...document.querySelectorAll("section[data-world]")].map((el) => {
      const cs = getComputedStyle(el);
      return { world: el.dataset.world, rim: cs.getPropertyValue("--w-rim").trim(), cast: cs.getPropertyValue("--w-cast").trim() };
    })
  );
  expect(tokens.map((t) => t.world)).toEqual(["nts", "embers", "philo", "intersect"]);
  for (const t of tokens) {
    expect(t.rim, `${t.world} --w-rim`).not.toBe("");
    expect(t.cast, `${t.world} --w-cast`).not.toBe("");
  }
  // a dark ground carries its depth on the lip, so its rim is its own, not the paper's
  const nts = tokens[0];
  for (const t of tokens.filter((t) => t.world === "embers" || t.world === "intersect")) expect(t.rim).not.toBe(nts.rim);
});

// The transitions an orb's opening runs, by part: the orb, the fragment (the
// disc) and the figure in it, with the pseudo-element; caught as they start
// (transitionrun), so a slow machine can't miss a short one.
async function openOrb(page, body) {
  const orb = page.locator(`.orb[data-body="${body}"]`);
  await orb.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(800);
  const before = await orb.boundingBox();
  await page.evaluate((b) => {
    const el = document.querySelector(`.orb[data-body="${b}"]`);
    const part = (t) => (t === el ? "orb" : t.parentElement === el ? "fragment" : "figure");
    window.__runs = new Set();
    el.addEventListener("transitionrun", (e) => window.__runs.add(`${part(e.target)}${e.pseudoElement} ${e.propertyName}`));
  }, body);
  await orb.hover();
  await page.waitForTimeout(1000);
  return page.evaluate(([b, before]) => {
    const el = document.querySelector(`.orb[data-body="${b}"]`);
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { parts: [...window.__runs].sort(), transform: cs.transform, translate: cs.translate, dy: r.top - before.y, dx: r.left - before.x };
  }, [body, before]);
}

test("O3 the home's orbs open as one portal, by transform and opacity, without rising", async ({ page }) => {
  await open(page, "/");
  const opened = [];
  for (const { body } of WORLDS) {
    const o = await openOrb(page, body);
    expect(o.parts.length, `${body}: the opening runs`).toBeGreaterThan(0);
    for (const p of o.parts) expect(p, `${body}: compositor-only`).toMatch(/ (transform|opacity)$/);
    expect(o.transform, `${body}: the orb does not lift`).toBe("none");
    expect(o.translate, `${body}: the orb does not lift`).toBe("none");
    expect(Math.abs(o.dy) + Math.abs(o.dx), `${body}: the orb stays put`).toBeLessThan(0.5);
    opened.push(o.parts);
  }
  expect(opened[1]).toEqual(opened[0]);
  expect(opened[2]).toEqual(opened[0]);
});

test("O4 under reduced motion the portal opens by fading alone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/");
  for (const { body } of WORLDS) {
    const o = await openOrb(page, body);
    expect(o.parts.length, `${body}: the opening still shows`).toBeGreaterThan(0);
    for (const p of o.parts) expect(p, `${body}: no motion`).toMatch(/ opacity$/);
  }
});

for (const vp of VIEWPORTS) {
  test(`O5 at rest each orb's window is as wide as before the lid at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page, "/");
    await page.mouse.move(1, 1);
    for (const { body } of WORLDS) {
      const sel = `.orb[data-body="${body}"]`;
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), sel);
      await page.waitForTimeout(800);
      // one row of pixels through the centre, from the bare ground on each side
      const g = await page.evaluate(([s, out]) => {
        const o = document.querySelector(s).getBoundingClientRect();
        return { x: Math.floor(o.left) - out, w: Math.ceil(o.width) + 2 * out + 1, y: Math.round(o.top + o.height / 2) };
      }, [sel, GROUND_AT]);
      const png = await page.screenshot({ clip: { x: g.x, y: g.y, width: g.w, height: 1 }, scale: "css" });
      const width = await page.evaluate(async ([b64, diff, limb]) => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(bmp.width, 1), ctx = c.getContext("2d");
        ctx.drawImage(bmp, 0, 0);
        const px = ctx.getImageData(0, 0, bmp.width, 1).data;
        const at = (i) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
        const far = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > diff;
        const groundL = at(0), groundR = at(bmp.width - 1);
        let l = 0; while (l < bmp.width && !far(at(l), groundL)) l++;
        let r = bmp.width - 1; while (r > 0 && !far(at(r), groundR)) r--;
        return r - l + 1 - 2 * limb;
      }, [png.toString("base64"), EDGE_DIFF, LIMB_OUTSIDE]);
      expect(Math.abs(width - RESTING_WINDOW[vp.name]), `${body}: window ${width}px, before the lid ${RESTING_WINDOW[vp.name]}px`).toBeLessThanOrEqual(WINDOW_TOL);
    }
  });
}

test("O6 at rest the figure is neither transformed nor clipped beyond the disc's edge", async ({ page }) => {
  await open(page, "/");
  await page.mouse.move(1, 1);
  const parts = await page.evaluate(() =>
    [...document.querySelectorAll(".orb > [data-nts-fragment], .orb > [data-nts-fragment] *")].map((el) => {
      const cs = getComputedStyle(el);
      return { el: `${el.closest(".orb").dataset.body} ${el.tagName.toLowerCase()}`, transform: cs.transform, clip: cs.clipPath, mask: cs.maskImage };
    })
  );
  for (const p of parts) expect(p, p.el).toMatchObject({ transform: "none", clip: "none", mask: "none" });
});
