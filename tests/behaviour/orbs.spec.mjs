// O1 the orrery's bodies and the ring beads are one component (.disc);
// O2 every world defines the depth pair the discs, orbs and lifts read;
// O3 the home's three orbs are one portal: opening one moves and fades its
// layers (transform, opacity) and nothing else, the same parts on every
// world, and the orb itself never rises; O4 under reduced motion the
// portal still opens, by fading alone.
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";

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
