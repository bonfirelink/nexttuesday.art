// The header changes world with the page, and the current page's bar travels.
// T9 each page with a current nav link has one bar element, `.nts-mark`, under
//    that link's label, in the site's red on every page, and it alone is named
//    `nts-mark`; the label's own ::after (the hover bar) stays hidden on the
//    current link, hovered or not, so the header's image never holds a bar.
//    On the other links the hover bar grows from the label's centre.
// T10 a navigation between two pages is one motion, 520ms on the site's
//    ease-out: the new page fades in over the old one, which stays opaque, and
//    the header crosses with it on the same timing, its old image fading out
//    as the new one comes, so nothing of it shows through the new, see-through
//    bar and nothing is left to cut at the end. Between two pages with a
//    current link the bar stretches: at half time it spans both links, its
//    leading edge on the new one, then the trailing edge catches up; to or
//    from the home it fades. Without `setKeyframes` the bar slides, without error.
import { test, expect } from "../helpers/fixtures.mjs";
import { INITIATIVES } from "../helpers/registry.mjs";
import { clickHomeLink } from "../helpers/transitions.mjs";

const PAGES = INITIATIVES.map((i) => `/${i.slug}/`);

const markState = (page) =>
  page.evaluate(() => {
    const named = [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).viewTransitionName === "nts-mark");
    const cur = document.querySelector('.nts-nav a[aria-current="page"]');
    const mark = document.querySelector(".nts-mark");
    if (!cur) return { named: named.length, cur: false, mark: !!mark };
    const label = cur.querySelector("span"), r = mark && mark.getBoundingClientRect(), l = label.getBoundingClientRect();
    const probe = document.createElement("i");
    probe.style.color = "var(--embers-fire)";
    mark.parentElement.appendChild(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    const after = getComputedStyle(label, "::after");
    return {
      named: named.length, cur: true, isMark: named[0] === mark, inCurrent: cur.contains(mark),
      left: r.left - l.left, right: r.right - l.right, gap: r.top - l.bottom, height: r.height,
      bg: getComputedStyle(mark).backgroundColor, accent, opacity: Number(getComputedStyle(mark).opacity),
      after: after.content === "none" ? 0 : Number(after.opacity),
    };
  });

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`T9 the current page's bar at ${vp.width}px`, () => {
    test.use({ viewport: vp });
    test("home: no bar, nothing named nts-mark", async ({ page }) => {
      await page.goto(process.env.NTS_BASE + "/", { waitUntil: "load" });
      const s = await markState(page);
      expect(s).toEqual({ named: 0, cur: false, mark: false });
    });
    for (const p of PAGES) {
      test(`${p}: one bar under the current label, in the site's red, alone named`, async ({ page }) => {
        await page.goto(process.env.NTS_BASE + p, { waitUntil: "load" });
        const s = await markState(page);
        expect(s.named, "elements named nts-mark").toBe(1);
        expect(s.isMark && s.inCurrent, "the named one is the .nts-mark of the current link").toBe(true);
        expect(Math.abs(s.left), "bar starts with the label").toBeLessThan(0.5);
        expect(Math.abs(s.right), "bar ends with the label").toBeLessThan(0.5);
        expect(s.gap, "bar right under the label").toBeGreaterThanOrEqual(0);
        expect(s.gap, "bar right under the label").toBeLessThan(2);
        expect(s.height).toBe(2);
        expect(s.bg, "bar in the site's red, on every page").toBe(s.accent);
        expect(s.opacity).toBe(1);
        expect(s.after, "the label's own bar is hidden on the current link").toBe(0);
        await page.locator('.nts-nav a[aria-current="page"]').hover();
        await page.waitForTimeout(350);
        expect((await markState(page)).after, "hovered, too").toBe(0);
      });
    }
  });
}

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`T9 at ${vp.width}px: the hover bar of a link not current grows from its centre`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto(process.env.NTS_BASE + PAGES[0], { waitUntil: "load" });
    const link = page.locator('.nts-nav a:not([aria-current="page"])').first();
    const read = () => link.evaluate((a) => {
      const l = a.querySelector("span"), cs = getComputedStyle(l, "::after");
      return { transform: cs.transform, origin: parseFloat(cs.transformOrigin) - l.getBoundingClientRect().width / 2, opacity: Number(cs.opacity) };
    });
    const rest = await read();
    expect(rest.transform, "at rest: no width").toBe("matrix(0, 0, 0, 1, 0, 0)");
    expect(Math.abs(rest.origin), "it grows from the label's centre").toBeLessThan(0.5);
    expect(rest.opacity).toBe(0);
    await link.hover();
    await page.waitForTimeout(450);
    const on = await read();
    expect(on.transform, "hovered: full width").toBe("none");
    expect(on.opacity).toBe(0.5);
  });
}

// Init script: at `pageswap` the leaving page's bar box; on the new page, as
// soon as the page's own `ready` handlers have run (a task after `ready`: this
// script's handler comes first), the root, header and bar pseudo-elements'
// animations, read at once since the transition lasts only 520ms; and, once
// it is over, the new bar's live box, where the moving one must come to rest.
function recordCross() {
  addEventListener("pageswap", (e) => {
    if (!e.viewTransition) return;
    const m = document.querySelector(".nts-mark");
    const r = m && m.getBoundingClientRect();
    try { sessionStorage.setItem("t10:old", JSON.stringify(r ? { x: r.left, w: r.width } : null)); } catch (err) {}
  });
  window.__cross = null;
  addEventListener("pagereveal", (e) => {
    if (!e.viewTransition) { window.__cross = "no-vt"; return; }
    e.viewTransition.ready.then(async () => {
      const d = document.documentElement;
      const of = (pe) => d.getAnimations({ subtree: true }).filter((a) => a.effect && a.effect.pseudoElement === pe);
      const boxes = (k) => k.map((f) => ({ offset: f.computedOffset, transform: f.transform, width: parseFloat(f.width) }));
      // the UA's own move of the bar, before the page's handler changes it
      const ua = of("::view-transition-group(nts-mark)").map((a) => boxes(a.effect.getKeyframes()));
      await new Promise((r) => setTimeout(r, 0));
      const part = (pe) => {
        const cs = getComputedStyle(d, pe);
        const kfs = of(pe).map((a) => a.effect.getKeyframes());
        const ends = (prop) => kfs.filter((k) => k.some((f) => f[prop] != null)).map((k) => [k[0][prop], k[k.length - 1][prop]]);
        return { dur: cs.animationDuration.split(",")[0].trim(), ease: cs.animationTimingFunction.split(/,(?![^(]*\))/)[0].trim(),
          opacity: ends("opacity"), clip: ends("clipPath"), height: parseFloat(cs.height),
          frames: kfs.filter((k) => k.some((f) => f.transform != null)).map(boxes) };
      };
      let old = null;
      try { old = JSON.parse(sessionStorage.getItem("t10:old")); } catch (err) {}
      const seen = {
        root: part("::view-transition-new(root)"), rootOld: part("::view-transition-old(root)"),
        headerOld: part("::view-transition-old(nts-header)"), headerNew: part("::view-transition-new(nts-header)"),
        markGroup: { ...part("::view-transition-group(nts-mark)"), ua }, markOld: part("::view-transition-old(nts-mark)"), markNew: part("::view-transition-new(nts-mark)"),
        old,
      };
      // where the bar comes to rest: the live box once the transition is over
      await e.viewTransition.finished.catch(() => {});
      const m = document.querySelector(".nts-mark"), r = m && m.getBoundingClientRect();
      window.__cross = { ...seen, now: r ? { x: r.left, w: r.width } : null };
    }, (err) => { window.__cross = "skipped " + err; });
  });
}

// "matrix(1, 0, 0, 1, x, y)" to x
const tx = (m) => String(m).match(/-?[\d.]+/g).map(Number)[4];
const TIMING = { dur: "0.52s", ease: "cubic-bezier(0.16, 1, 0.3, 1)" };

const go = async (page, from, to, init = []) => {
  for (const s of init) await page.addInitScript(s);
  await page.addInitScript(recordCross);
  await page.goto(process.env.NTS_BASE + from, { waitUntil: "load" });
  await page.waitForTimeout(300);
  if (to === "/") await clickHomeLink(page);
  else {
    await page.locator(`.nts-nav a[href="${to}"]`).click();
    await page.waitForURL("**" + to);
  }
  await page.waitForFunction(() => window.__cross);
  return page.evaluate(() => window.__cross);
};

const timed = (c, part, label) => {
  expect(c[part].dur, `${label}: duration`).toBe(TIMING.dur);
  expect(c[part].ease, `${label}: easing`).toBe(TIMING.ease);
};

// The new page fades in over the old, opaque one; the header crosses with it.
const crossed = (c) => {
  for (const [p, label] of [["root", "new page"], ["headerNew", "new header"], ["headerOld", "old header"]]) timed(c, p, label);
  expect(c.root.opacity, "the new page fades in").toEqual([["0", "1"]]);
  expect(c.headerOld.opacity, "the old header fades out to nothing").toContainEqual(["1", "0"]);
  expect(c.headerNew.opacity, "the new header fades in to full").toContainEqual(["0", "1"]);
  expect(c.rootOld.opacity, "the old page stays as it is, opaque").toEqual([]);
  expect([c.root, c.rootOld, c.headerNew, c.headerOld].flatMap((x) => x.clip), "nothing clipped").toEqual([]);
};

// within a pixel: the UA's snapshot boxes and the live ones differ by a fraction
const near = (a, b, label) => expect(Math.abs(a - b), `${label}: ${a} vs ${b}`).toBeLessThan(1);

const stretched = (c) => {
  timed(c, "markGroup", "bar");
  expect(c.markGroup.frames.length, "the bar's group moves").toBe(1);
  const [k] = c.markGroup.frames, [u] = c.markGroup.ua;
  expect(u.length, "the UA's own move: the old bar's box, the new one's").toBe(2);
  near(tx(u[0].transform), c.old.x, "it starts on the old link");
  near(u[0].width, c.old.w, "with its width");
  // the end is implicit: the UA keeps it on the new bar's live box, so the bar
  // comes to rest where the page settles, even if that moves after the snapshot
  expect(k.map((f) => f.offset), "old bar, both links, then the new bar's live box").toEqual([0, 0.5]);
  expect(k[0].transform).toBe(u[0].transform);
  const x0 = tx(u[0].transform), x1 = tx(u[1].transform);
  const lo = Math.min(x0, x1), hi = Math.max(x0 + u[0].width, x1 + u[1].width);
  near(tx(k[1].transform), lo, "at half time it spans both links, from");
  near(k[1].width, hi - lo, "at half time it spans both links, width");
  expect(Math.abs(x1 - c.now.x), "the new box is the new link's, give or take the page settling").toBeLessThan(8);
  // the images fill the group's height: a stretched bar stays 2px, not scaled up
  near(c.markOld.height, 2, "old bar's image height");
  near(c.markNew.height, 2, "new bar's image height");
};

const HOPS = [...PAGES.slice(1).map((to, i) => [PAGES[i], to]), [PAGES[PAGES.length - 1], PAGES[0]]];

test.describe("T10 one motion: the page and header cross in step, the bar stretches", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const [from, to] of HOPS) {
    test(`${from} to ${to}`, async ({ page }) => {
      const c = await go(page, from, to);
      expect(typeof c, String(c)).toBe("object");
      crossed(c);
      stretched(c);
    });
  }
  test(`/ to ${PAGES[0]}: the bar fades in with the page`, async ({ page }) => {
    const c = await go(page, "/", PAGES[0]);
    expect(c.old, "the home has no bar").toBeNull();
    crossed(c);
    timed(c, "markNew", "bar's fade-in");
    expect(c.markNew.opacity, "the bar fades in").toContainEqual(["0", "1"]);
    expect(c.markGroup.frames, "nothing to move from").toEqual([]);
  });
  test(`${PAGES[0]} to /: the bar fades out with the page`, async ({ page }) => {
    const c = await go(page, PAGES[0], "/");
    expect(c.now, "the home has no bar").toBeNull();
    crossed(c);
    timed(c, "markOld", "bar's fade-out");
    expect(c.markOld.opacity, "the bar fades out").toContainEqual(["1", "0"]);
  });
  test("without setKeyframes the bar slides, the page still crosses, no error", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const c = await go(page, PAGES[0], PAGES[1], [() => { try { delete KeyframeEffect.prototype.setKeyframes; } catch (e) {} }]);
    crossed(c);
    timed(c, "markGroup", "bar");
    expect(c.markGroup.frames.map((k) => k.length), "the UA's two keyframes: a slide").toEqual([2]);
    expect(errors).toEqual([]);
  });
  test("without navigation.activation the bar still stretches, no error", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const hide = () => { try { Object.defineProperty(Navigation.prototype, "activation", { get: () => null, configurable: true }); } catch (e) {} };
    const c = await go(page, PAGES[0], PAGES[1], [hide]);
    crossed(c);
    stretched(c);
    expect(errors).toEqual([]);
  });
});
