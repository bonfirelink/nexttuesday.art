import { test, expect } from "../helpers/fixtures.mjs";
import { WORLDS, recordTransitions, arrivedTransition, clickWorldLink, followLink } from "../helpers/transitions.mjs";

// The orb morph was a race (the view transition's reveal ran before the page
// had named its entity), so each case repeats in a fresh context and asserts on
// every run. Fast: REPEATS per case; @slow: SLOW_REPEATS.
const REPEATS = 3;
const SLOW_REPEATS = 5;
const SIZES = [
  ["390", { width: 390, height: 844 }],
  ["1440", { width: 1440, height: 900 }],
];
// Every ordered pair of worlds.
const PAIRS = WORLDS.flatMap((a) => WORLDS.filter((b) => b !== a).map((b) => [a, b]));

async function homeToWorld(browser, viewport, world, base) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript(recordTransitions);
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await clickWorldLink(page, world);
  const vt = await arrivedTransition(page);
  await ctx.close();
  return vt;
}

async function worldToWorld(browser, viewport, from, to, base) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript(recordTransitions);
  await page.goto(`${base}/${from}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await followLink(page, `/${to}/`);
  const vt = await arrivedTransition(page);
  await ctx.close();
  return vt;
}

function t1(repeats, tag) {
  for (const [size, viewport] of SIZES) {
    for (const world of WORLDS) {
      test(`T1 home to ${world}: the orb morphs into the entity, ${size}, x${repeats} ${tag}`.trim(), async ({ browser }) => {
        test.setTimeout(30_000 * repeats);
        for (let i = 0; i < repeats; i++) {
          const vt = await homeToWorld(browser, viewport, world, process.env.NTS_BASE);
          expect(vt, `run ${i + 1}`).toMatchObject({ names: expect.arrayContaining(["::view-transition-old(orb)", "::view-transition-new(orb)"]) });
        }
      });
    }
  }
}

function t2(repeats, tag) {
  for (const [size, viewport] of SIZES) {
    for (const [from, to] of PAIRS) {
      test(`T2 ${from} to ${to}: a plain crossfade, ${size}, x${repeats} ${tag}`.trim(), async ({ browser }) => {
        test.setTimeout(30_000 * repeats);
        for (let i = 0; i < repeats; i++) {
          const vt = await worldToWorld(browser, viewport, from, to, process.env.NTS_BASE);
          expect(vt, `run ${i + 1}: a view transition ran`).toHaveProperty("names");
          expect(vt.names.filter((n) => /\(orb\)/.test(n)), `run ${i + 1}: orb pseudo-elements`).toEqual([]);
          expect(vt.names.some((n) => /\(root\)/.test(n)), `run ${i + 1}: root crossfade`).toBe(true);
          expect(vt.entity, `run ${i + 1}: the arrived entity's view-transition-name`).toBe("none");
        }
      });
    }
  }
}

test.describe("transitions", () => {
  t1(REPEATS, "");
  t2(1, "");
});
test.describe("transitions repeated", () => {
  t1(SLOW_REPEATS, "@slow");
  t2(SLOW_REPEATS, "@slow");
});
