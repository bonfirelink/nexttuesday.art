import { test, expect } from "../helpers/fixtures.mjs";
import { coldPage } from "../helpers/cold.mjs";
import { WORLDS, recordTransitions, arrivedTransition, clickWorldLink, clickHomeLink, followLink, stallDocument } from "../helpers/transitions.mjs";

// The orb morph was a race (the view transition's reveal ran before the page
// had named its entity), so each case repeats in a fresh context and asserts on
// every run. Fast: REPEATS per case; @slow: SLOW_REPEATS.
const REPEATS = 3;
const SLOW_REPEATS = 5;
const RUN_TIMEOUT_MS = 30_000; // one cold-context run, with a view transition, per repeat
const SIZES = [
  ["390", { width: 390, height: 844 }],
  ["1440", { width: 1440, height: 900 }],
];
// The deterministic cases hold the arriving page's parser at a point that the
// race used to lose at, long enough for the browser to render what it has.
const STALL_MS = 600;
const BOTH = ["::view-transition-old(orb)", "::view-transition-new(orb)"];
// Every ordered pair of worlds.
const PAIRS = WORLDS.flatMap((a) => WORLDS.filter((b) => b !== a).map((b) => [a, b]));

async function homeToWorld(browser, viewport, world, base, stall = null) {
  const { page, close } = await coldPage(browser, { viewport });
  try {
    await page.addInitScript(recordTransitions);
    await page.goto(base + "/", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    if (stall) await stallDocument(page, `${base}/${world}/`, stall, STALL_MS);
    await clickWorldLink(page, world);
    return await arrivedTransition(page);
  } finally {
    await close();
  }
}

async function worldToHome(browser, viewport, world, base, stall = null) {
  const { page, close } = await coldPage(browser, { viewport });
  try {
    await page.addInitScript(recordTransitions);
    await page.goto(`${base}/${world}/`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    if (stall) await stallDocument(page, base + "/", stall, STALL_MS);
    await clickHomeLink(page);
    return await arrivedTransition(page);
  } finally {
    await close();
  }
}

async function worldToWorld(browser, viewport, from, to, base) {
  const { page, close } = await coldPage(browser, { viewport });
  try {
    await page.addInitScript(recordTransitions);
    await page.goto(`${base}/${from}/`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await followLink(page, `/${to}/`);
    return await arrivedTransition(page);
  } finally {
    await close();
  }
}

function t1(repeats, tag) {
  for (const [size, viewport] of SIZES) {
    for (const world of WORLDS) {
      test(`T1 home to ${world}: the orb morphs into the entity, ${size}, x${repeats} ${tag}`.trim(), async ({ browser }) => {
        test.setTimeout(RUN_TIMEOUT_MS * repeats);
        for (let i = 0; i < repeats; i++) {
          const vt = await homeToWorld(browser, viewport, world, process.env.NTS_BASE);
          expect(vt, `run ${i + 1}`).toMatchObject({ names: expect.arrayContaining(BOTH) });
        }
      });
    }
  }
}

// The way back: the entity shrinks into the home's body for its world.
function t3(repeats, tag) {
  for (const [size, viewport] of SIZES) {
    for (const world of WORLDS) {
      test(`T3 ${world} to home: the entity morphs back into its body, ${size}, x${repeats} ${tag}`.trim(), async ({ browser }) => {
        test.setTimeout(RUN_TIMEOUT_MS * repeats);
        for (let i = 0; i < repeats; i++) {
          const vt = await worldToHome(browser, viewport, world, process.env.NTS_BASE);
          expect(vt, `run ${i + 1}`).toMatchObject({ names: expect.arrayContaining(BOTH) });
        }
      });
    }
  }
}

// T1 and T3 with the arriving page's parser held: what the race does on a
// slow or chunked response, every time.
const HOME_STALLS = [
  ["before the sky", '<div class="orrery">'],
  ["after the orbs", '<section class="band words'],
];
function held() {
  const [size, viewport] = SIZES[0];
  for (const world of WORLDS) {
    test(`T4 home to ${world}, its parser held before the entity: the orb morphs, ${size}`, async ({ browser }) => {
      test.setTimeout(RUN_TIMEOUT_MS);
      const vt = await homeToWorld(browser, viewport, world, process.env.NTS_BASE, '<div class="entity"');
      expect(vt).toMatchObject({ names: expect.arrayContaining(BOTH) });
    });
    for (const [where, marker] of HOME_STALLS) {
      test(`T5 ${world} to home, its parser held ${where}: the entity morphs back, ${size}`, async ({ browser }) => {
        test.setTimeout(RUN_TIMEOUT_MS);
        const vt = await worldToHome(browser, viewport, world, process.env.NTS_BASE, marker);
        expect(vt).toMatchObject({ names: expect.arrayContaining(BOTH) });
      });
    }
  }
}

function t2(repeats, tag) {
  for (const [size, viewport] of SIZES) {
    for (const [from, to] of PAIRS) {
      test(`T2 ${from} to ${to}: a plain crossfade, ${size}, x${repeats} ${tag}`.trim(), async ({ browser }) => {
        test.setTimeout(RUN_TIMEOUT_MS * repeats);
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

// The first frame is held (<link rel="expect" blocking="render">) until an
// element after everything the morph names on that page is parsed.
function t6() {
  const pages = [["/", ".bead .face, .orb"], ...[...WORLDS, "events"].map((w) => [`/${w}/`, ".hero .entity"])];
  for (const [path, named] of pages) {
    test(`T6 ${path}: the first frame waits for what the morph names`, async ({ page }) => {
      await page.goto(process.env.NTS_BASE + path);
      const r = await page.evaluate((named) => {
        const link = document.querySelector('head link[rel="expect"][blocking~="render"]');
        const target = link && document.getElementById(new URL(link.href).hash.slice(1));
        const els = [...document.querySelectorAll(named)];
        const after = (el) => !!(el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) && !el.contains(target);
        return { link: !!link, target: !!target, named: els.length, before: els.filter((el) => target && after(el)).length };
      }, named);
      expect(r.link && r.target && r.named > 0, JSON.stringify(r)).toBe(true);
      expect(r.before, "named elements parsed before the expected one").toBe(r.named);
    });
  }
}

test.describe("transitions", () => {
  t1(REPEATS, "");
  t2(1, "");
  t3(REPEATS, "");
  held();
  t6();
});
test.describe("transitions repeated", () => {
  t1(SLOW_REPEATS, "@slow");
  t3(SLOW_REPEATS, "@slow");
  t2(SLOW_REPEATS, "@slow");
});
