import { test, expect } from "../helpers/fixtures.mjs";
import {
  WORLDS, groundLuma, rowLuma, recordBleed, clickWorldLink, bleedState, scrollToY, bleedProgress,
  BLEED_FIRE_AT, BLEED_MS, fireBleed, holdBleed, settleBleed,
} from "../helpers/transitions.mjs";

// How far into its run a frozen disc is shot: well open, not yet the whole page.
const HELD = 0.35;

const arrive = async (page, world, how) => {
  await page.addInitScript(recordBleed);
  if (how === "click") {
    await page.goto(process.env.NTS_BASE + "/", { waitUntil: "load" });
    await clickWorldLink(page, world);
  } else {
    await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch (e) {} });
    await page.goto(`${process.env.NTS_BASE}/${world}/`, { waitUntil: "load" });
  }
  // The copy is made at DOMContentLoaded; its `start` event says it exists.
  await expect.poll(() => page.evaluate(() => window.__bleed.events.includes("start"))).toBe(true);
};

// Waits until the finite time-based animations and transitions have finished
// (the grain's fade, class-toggle transitions), then two frames for the paint.
// The disc's own animation is held when a test looks at it, and the site's
// loops never end: neither is waited for. A frame first, so a transition started by
// the last style change exists; it repeats, as a finished one may start another.
const animationsSettled = (page, timeout = 5000) =>
  page.evaluate(async (timeout) => {
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const running = () => document.getAnimations().filter((a) =>
      a.playState === "running" && a.timeline instanceof DocumentTimeline && a.effect.getComputedTiming().endTime !== Infinity);
    const t0 = performance.now();
    await frame();
    for (let list = running(); list.length; list = running()) {
      if (performance.now() - t0 > timeout) throw new Error("animations still running after " + timeout + " ms: " + list.map((a) => a.animationName || a.transitionProperty).join(","));
      await Promise.race([Promise.all(list.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 100))]);
      await frame();
    }
    await frame(); await frame();
  }, timeout);

function bleedTests(label, viewport, deviceScaleFactor, tag) {
  test.describe(label, () => {
    test.use({ viewport, deviceScaleFactor });
    WORLDS.forEach((world, i) => {
      // One run per world arrives by the real click on the home page.
      const how = label.startsWith("390") ? "click" : "flag";
      test(`T3 the ${world} bleed-in waits for the scroll, then runs by itself and settles, ${label} ${how} ${tag}`.trim(), async ({ page }) => {
        await arrive(page, world, how);

        const dcl = await page.evaluate(() => window.__bleed.dcl);
        expect(dcl.state, "state at DOMContentLoaded").toBe("before");
        expect(dcl.night, "no copy yet at DOMContentLoaded").toBe(false);
        expect(await bleedState(page)).toBe("in");

        // While the copy exists: no view-transition-name in it, and the twin's
        // ASCII font size is the original's.
        const copy = await page.evaluate(() => {
          const night = document.querySelector(".nts-night");
          const named = night
            ? [night, ...night.querySelectorAll("*")].filter((e) => getComputedStyle(e).viewTransitionName !== "none").map((e) => e.className)
            : null;
          const pre = document.querySelector("main .hero pre[data-nts-ascii]");
          const twin = pre && window.NTS.bleed.twin(pre);
          return { night: !!night, named, ascii: pre ? [getComputedStyle(pre).fontSize, twin && getComputedStyle(twin).fontSize] : null };
        });
        expect(copy.night).toBe(true);
        expect(copy.named, "elements in the copy with a view-transition-name").toEqual([]);
        if (world === "intersect") {
          expect(copy.ascii, "INTERSECT has its ASCII figure").not.toBeNull();
          expect(copy.ascii[1], "twin font size").toBe(copy.ascii[0]);
        }

        // Before the trigger nothing moves: a nudge under the threshold fires nothing.
        expect(await bleedProgress(page)).toBe(0);
        await scrollToY(page, BLEED_FIRE_AT - 1);
        expect(await bleedProgress(page), "progress one px under the threshold").toBe(0);
        expect(await bleedState(page), "state one px under the threshold").toBe("in");
        expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.(".nts-night")).length), "disc animations after a small nudge").toBe(0);

        // Past it: one animation pair on the document timeline, transform only.
        await scrollToY(page, BLEED_FIRE_AT);
        const run = await page.evaluate(() => {
          const els = [document.querySelector(".nts-night-disc"), document.querySelector(".nts-night-in")];
          const anims = els.map((e) => e.getAnimations());
          return anims.map((l) => l.map((a) => ({
            doc: a.timeline instanceof DocumentTimeline,
            duration: a.effect.getTiming().duration,
            props: [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((n) => !["offset", "easing", "composite", "computedOffset"].includes(n))))],
          })));
        });
        expect(run.map((l) => l.length), "one animation on the disc, one on the copy").toEqual([1, 1]);
        for (const [a] of run) {
          expect(a.doc, "document timeline").toBe(true);
          expect(a.duration).toBe(BLEED_MS);
          expect(a.props, "properties animated").toEqual(["transform"]);
        }
        await expect.poll(() => bleedProgress(page), "progress rises once fired").toBeGreaterThan(0);

        // Scrolling back to the top mid-run does not reverse or stop it.
        const back = await page.evaluate(async () => {
          const time = () => document.querySelector(".nts-night-disc")?.getAnimations()[0]?.currentTime ?? null;
          const t1 = time();
          scrollTo({ top: 0, behavior: "instant" });
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          return { t1, t2: time(), state: document.documentElement.getAttribute("data-bleed-state") };
        });
        expect(back.t1, "mid-run").not.toBeNull();
        // a run that ended in the meantime has gone on, not back
        if (back.t2 !== null) expect(back.t2, "the animation keeps going after a scroll back").toBeGreaterThan(back.t1);
        else expect(back.state, "settled, not closed").toBe("world");

        // With no further scroll it runs to the end and settles.
        await expect.poll(() => bleedState(page), { message: "the state settles", timeout: BLEED_MS + 3000 }).toBe("world");
        await expect.poll(() => page.evaluate(() => window.__bleed.events)).toEqual(["start", "end"]);

        expect(await bleedProgress(page), "progress once settled").toBe(1);
        await scrollToY(page, 0);
        expect(await bleedState(page), "world stays world at the top").toBe("world");
        const after = await page.evaluate(() => {
          return {
            night: document.querySelectorAll(".nts-night").length,
            old: document.querySelectorAll(".nts-bleed-old").length,
            styles: window.__heroStyles(),
            events: window.__bleed.events,
          };
        });
        expect(after.night, ".nts-night left behind").toBe(0);
        expect(after.old, ".nts-bleed-old left behind").toBe(0);
        expect(after.styles, "hero style attributes as before the bleed").toEqual(dcl.styles);
        expect(after.events).toEqual(["start", "end"]);
      });
    });
  });
}

bleedTests("390 scale 1", { width: 390, height: 844 }, 1, "");
bleedTests("1440 scale 1", { width: 1440, height: 900 }, 1, "");
bleedTests("390 scale 2", { width: 390, height: 844 }, 2, "@slow");

// At full scale the disc's circle holds the four corners of what is in view of
// the layer: the viewport's top to the lower of its bottom and the layer's foot.
for (const [label, viewport] of [["390x844", { width: 390, height: 844 }], ["1440x900", { width: 1440, height: 900 }]]) {
  test.describe(`bleed disc cover ${label}`, () => {
    test.use({ viewport, deviceScaleFactor: 1 });
    for (const world of WORLDS) {
      test(`T3 the ${world} disc at full scale covers everything in view, ${label}`, async ({ page }) => {
        await arrive(page, world, "flag");
        await holdBleed(page, 1);
        const r = await page.evaluate(() => {
          const disc = document.querySelector(".nts-night-disc").getBoundingClientRect(), layer = document.querySelector(".nts-night").getBoundingClientRect();
          const cx = disc.left + disc.width / 2, cy = disc.top + disc.height / 2, R = disc.width / 2;
          const top = Math.max(0, layer.top), bottom = Math.min(innerHeight, layer.bottom), right = layer.right;
          return { R, far: Math.max(...[[0, top], [right, top], [0, bottom], [right, bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy))) };
        });
        expect(r.far, `the farthest corner of the view from the disc's centre vs its radius ${r.R}`).toBeLessThanOrEqual(r.R);
      });
    }
  });
}

// A page that loads already past the threshold fires at once.
test.describe("bleed on a page that loads scrolled", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const world of WORLDS) {
    test(`T3 the ${world} bleed fires at once on a page that loads past the threshold`, async ({ page }) => {
      await page.addInitScript(() => {
        // before nts.js's own DOMContentLoaded listener, which is added later
        document.addEventListener("DOMContentLoaded", () => scrollTo({ top: 300, behavior: "instant" }));
        // that scroll's event must not reach the bleed: only its own check at the end of cross() can fire it
        addEventListener("scroll", (e) => e.stopImmediatePropagation(), true);
      });
      await arrive(page, world, "flag");
      expect(await page.evaluate(() => scrollY), "the page loaded scrolled").toBeGreaterThan(20);
      await expect.poll(() => page.evaluate(() => document.querySelector(".nts-night-disc")?.getAnimations().length ?? -1), "a disc animation without any scroll").toBe(1);
    });
  }
});

test.describe("no bleed on a direct landing or a reload", () => {
  for (const world of WORLDS) {
    test(`T3 ${world}: landing directly and reloading give world`, async ({ page }) => {
      await page.addInitScript(recordBleed);
      await page.goto(`${process.env.NTS_BASE}/${world}/`, { waitUntil: "load" });
      for (const step of ["landing", "reload"]) {
        if (step === "reload") await page.reload({ waitUntil: "load" });
        const dcl = await page.evaluate(() => window.__bleed.dcl);
        expect(dcl.state, `${step}: state at DOMContentLoaded`).toBe("world");
        expect(dcl.night, `${step}: no copy`).toBe(false);
        expect(await page.locator(".nts-night").count()).toBe(0);
      }
    });
  }
});

// The dark the visitor sees while the disc opens (inside the disc over the
// hero, and on the ground below the hero) is the settled world's ground:
// the same colour and the same texture (INTERSECT's grain), not a flatter or
// lighter one that switches later. Median luminance, in 0..255.
const GROUND_TOLERANCE = 2;

for (const [label, viewport] of [["1000x560", { width: 1000, height: 560 }], ["390x844", { width: 390, height: 844 }]]) {
  test.describe(`bleed ground ${label}`, () => {
    test.use({ viewport, deviceScaleFactor: 1 });
    for (const world of WORLDS) {
      test(`T3 the ${world} bleed shows the settled ground in the disc and below the hero, ${label}`, async ({ page }) => {
        await arrive(page, world, "flag");
        await animationsSettled(page); // the grain's own fade, if any
        // The section's own text and figures are not the ground: the median skips them.
        const measure = () => page.evaluate(() => {
          const hero = document.querySelector("main .hero").getBoundingClientRect();
          const disc = document.querySelector(".nts-night-disc");
          const d = disc && disc.getBoundingClientRect();
          return {
            heroBottom: hero.bottom,
            gutter: document.querySelector("main .hero .hero-text").getBoundingClientRect().left - 2, // 2px short of the text column, clear of its edge
            disc: d && { cx: d.left + d.width / 2, cy: d.top + d.height / 2, r: d.width / 2 },
          };
        });
        const regions = (m) => [
          // Stacked (below the hero's two-column breakpoint, 900px in pages.css), the figure and the hero text fill most of the disc, so the sample is the strip left of the text column: the ground and its rings.
          // Side by side, the disc is mostly ground and the whole width is sampled.
          { x: 0, y: 60, w: viewport.width < 900 ? m.gutter : viewport.width, h: Math.max(0, m.heroBottom - 60), disc: m.disc && { cx: m.disc.cx, cy: m.disc.cy, r: m.disc.r - 4 } },
          { x: 0, y: m.heroBottom + 4, w: viewport.width, h: Math.max(0, viewport.height - m.heroBottom - 4) },
        ];
        await holdBleed(page, HELD);
        expect(await bleedState(page)).toBe("in");
        const m = await measure();
        const during = await groundLuma(page, regions(m));
        // Settle, at the same scroll: the same view in the world.
        await settleBleed(page);
        await animationsSettled(page);
        const after = await groundLuma(page, regions(m));
        expect(during[0], "ground sampled inside the disc over the hero").not.toBeNull();
        expect(after[0]).not.toBeNull();
        expect(Math.abs(during[0] - after[0]), `disc ground ${during[0]} vs settled ${after[0]}`).toBeLessThanOrEqual(GROUND_TOLERANCE);
        if (during[1] !== null && after[1] !== null) {
          expect(Math.abs(during[1] - after[1]), `ground below the hero ${during[1]} vs settled ${after[1]}`).toBeLessThanOrEqual(GROUND_TOLERANCE);
        }
      });
    }
  });
}

// The hero's foot is seamless: no row across the boundary between the disc
// (the hero's night copy) and the section below differs from the ground
// beside it, at state `in` and settled, on a width where the disc layer lands off the device pixel grid.
const SEAM_TOLERANCE = 2;
const SEAM_SCALES = [2, 3];

for (const scale of SEAM_SCALES) {
  test.describe(`bleed seam scale ${scale}`, () => {
    test.use({ viewport: { width: 1117, height: 700 }, deviceScaleFactor: scale });
    for (const world of WORLDS) {
      test(`T3 the ${world} bleed has no seam at the hero's foot, scale ${scale}`, async ({ page }) => {
        await arrive(page, world, "flag");
        await animationsSettled(page);
        const rows = async () => {
          const foot = await page.evaluate(() => document.querySelector("main .hero").getBoundingClientRect().bottom);
          const dev = Math.round(foot * scale), band = 10 * scale;
          // the columns where the disc covers the hero's foot: the right fifth
          const r = await rowLuma(page, Math.round(800 * scale), Math.round(980 * scale), dev - band, dev + band);
          const ref = [...r.slice(0, 4), ...r.slice(-4)].sort((a, b) => a - b)[4];
          return { ref, worst: Math.max(...r.map((v) => Math.abs(v - ref))), r };
        };
        await holdBleed(page, HELD);
        expect(await bleedState(page)).toBe("in");
        const during = await rows();
        expect(during.worst, `in: ground ${during.ref}, rows ${during.r.join(",")}`).toBeLessThanOrEqual(SEAM_TOLERANCE);
        await settleBleed(page);
        await animationsSettled(page);
        const after = await rows();
        expect(after.worst, `world: ground ${after.ref}, rows ${after.r.join(",")}`).toBeLessThanOrEqual(SEAM_TOLERANCE);
      });
    }
  });
}

// Hopping from one world page to another: the next world opens beige only
// while this one's bleed has not settled.
test.describe("world to world hop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const hop = async (page, settle) => {
    await page.goto(process.env.NTS_BASE + "/", { waitUntil: "load" });
    await clickWorldLink(page, "embers");
    await expect.poll(() => bleedState(page)).toBe("in");
    if (settle) await settleBleed(page);
    await page.locator('a[href="/not-not-philo/"]:visible').first().click();
    await page.waitForURL("**/not-not-philo/");
    return page.evaluate(() => document.documentElement.getAttribute("data-bleed-state"));
  };
  test("T3 a world entered from the events page starts beige", async ({ page }) => {
    await page.goto(process.env.NTS_BASE + "/events/", { waitUntil: "load" });
    await page.locator('a[href="/embers/"]:visible').first().click();
    await page.waitForURL("**/embers/");
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-bleed-state"))).not.toBe("world");
  });
  test("T3 a world hopped to from an unsettled world starts beige", async ({ page }) => {
    // nts.js moves before to in on load: either means beige
    expect(await hop(page, false)).not.toBe("world");
  });
  test("T3 a world hopped to from a settled world starts in its own colours", async ({ page }) => {
    expect(await hop(page, true)).toBe("world");
  });
});

// A link inside a block already in the destination world's colours opens that
// world directly; any other link from the home keeps the beige.
test.describe("links from a panel in the world's own colours", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const arrive = async (page, sel, slug) => {
    await page.goto(process.env.NTS_BASE + "/", { waitUntil: "load" });
    // el.click(): the dial's beads orbit and the panels' orbs move, so a
    // coordinate click is unstable; this still fires a click
    // event and the link's default navigation
    await page.locator(sel).first().evaluate((el) => el.click());
    await page.waitForURL("**/" + slug + "/");
    return page.evaluate(() => document.documentElement.getAttribute("data-bleed-state"));
  };
  test("T3 the EMBERS panel's go link opens EMBERS in its colours", async ({ page }) => {
    expect(await arrive(page, "section#embers a.go", "embers")).toBe("world");
  });
  test("T3 the philo panel's orb opens NOT NOT PHILO in its colours", async ({ page }) => {
    expect(await arrive(page, 'section[data-world="philo"] a.orb', "not-not-philo")).toBe("world");
  });
  test("T3 a dial bead from the home still opens beige", async ({ page }) => {
    expect(await arrive(page, 'a.bead[href="/embers/"]', "embers")).not.toBe("world");
  });
  test("T3 a nav link from the home still opens beige", async ({ page }) => {
    expect(await arrive(page, 'header a[href="/intersect/"]:visible', "intersect")).not.toBe("world");
  });
});

// NTS.world (nts-head.js) is the one list of world paths; the pages that run
// the bleed are exactly its entries but the events page.
test("T3 the world list is the set of bleed pages", async () => {
  const { readdirSync, readFileSync, existsSync } = await import("node:fs");
  const dirs = readdirSync("site", { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const bleed = dirs.filter((n) => existsSync(`site/${n}/index.html`) && /data-bleed="scroll"/.test(readFileSync(`site/${n}/index.html`, "utf8"))).sort();
  const head = readFileSync("site/_nts/nts-head.js", "utf8");
  const listed = /\(([a-z|-]*\|events)\)/.exec(head)[1].split("|").filter((n) => n !== "events").sort();
  expect(listed).toEqual(bleed);
});
