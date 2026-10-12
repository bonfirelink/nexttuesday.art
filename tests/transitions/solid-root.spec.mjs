import { test, expect } from "../helpers/fixtures.mjs";
import { coldPage } from "../helpers/cold.mjs";
import { WORLDS, clickWorldLink, clickHomeLink, followLink } from "../helpers/transitions.mjs";

// The root's old and new snapshots must never both be see-through: what is
// behind them (Safari paints a dark backdrop) would wash the screen grey. The
// old snapshot stays opaque for the whole transition; the new one may fade in on it.
// Whether the new snapshot is animated is not asserted: the animations exist
// only while the transition runs, and `ready` can resolve after they are gone on
// a slow machine, so an empty list says nothing. What is asserted holds either way.

// Init script: at the reveal, the opacity keyframes of each root pseudo-element
// animation, and the old snapshot's computed opacity over the first frames.
function recordRoot() {
  window.__root = null;
  addEventListener("pagereveal", (e) => {
    if (!e.viewTransition) return;
    e.viewTransition.ready.then(async () => {
      const d = document.documentElement;
      const kf = (pe) => d.getAnimations({ subtree: true })
        .filter((a) => a.effect && a.effect.pseudoElement === pe)
        .map((a) => a.effect.getKeyframes().map((k) => k.opacity).filter((o) => o != null).map(Number));
      const oldOpacity = [];
      for (let i = 0; i < 12; i++) {
        oldOpacity.push(Number(getComputedStyle(d, "::view-transition-old(root)").opacity));
        await new Promise((r) => requestAnimationFrame(r));
      }
      window.__root = { old: kf("::view-transition-old(root)"), new: kf("::view-transition-new(root)"), oldOpacity };
    });
  });
}

const FLOWS = [
  ["home to world", (p, w) => p.goto(process.env.NTS_BASE + "/").then(() => clickWorldLink(p, w))],
  ["world to home", (p, w) => p.goto(`${process.env.NTS_BASE}/${w}/`).then(() => clickHomeLink(p))],
  ["world to world", (p, w) => p.goto(`${process.env.NTS_BASE}/${w}/`).then(() => followLink(p, `/${WORLDS.find((x) => x !== w)}/`))],
];

for (const [label, go] of FLOWS) {
  test(`T7 ${label}: the old root snapshot stays opaque, any new-root fade ends opaque`, async ({ browser }) => {
    const { page, close } = await coldPage(browser, { viewport: { width: 390, height: 844 } });
    try {
      await page.addInitScript(recordRoot);
      await go(page, WORLDS[0]);
      await page.waitForFunction(() => window.__root);
      const r = await page.evaluate(() => window.__root);
      for (const ks of r.old) expect(Math.min(...ks), "no old-root keyframe below 1").toBe(1);
      expect(Math.min(...r.oldOpacity), "old root snapshot opacity at every frame").toBe(1);
      for (const ks of r.new) if (ks.length) expect(ks[ks.length - 1], "a new-root fade ends opaque").toBe(1);
    } finally { await close(); }
  });
}
