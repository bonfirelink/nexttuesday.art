// O1 the orrery's bodies and the ring beads are one component (.disc);
// O2 every world defines the depth pair the discs, orbs and lifts read.
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
