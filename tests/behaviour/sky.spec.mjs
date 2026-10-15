// The home's sky on a phone and what hints at the beads.
// S1 on a phone the emblem's outer orbit is the world pages' trace ring, the
// same diameter and the same centre on screen, and the events star is never
// clipped;
// S3 the header is balanced: the destinations spread from the sigil to the
// gutter, the sigil-to-first gap like the gaps between them, one centre line;
// S4 no key under the emblem: the name is the next thing after it;
// S5 the four beads pulse now and then, with a pointer and on a touch screen,
// never two at once, the ring outside the face the morph names, and none
// runs while the machine is stopped; S6 under
// reduced motion they do not pulse. The eye's own beam is E6 (emblem.spec).
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";
import { BODIES as BEADS } from "../helpers/registry.mjs";

const TOL = 1; // px: how closely the orbit must match the trace ring
const ORBIT_R = 96.4 / 202; // the outer orbit's centreline, in emblem widths
const STAR_AT_3 = 62500; // ms: the events star turns 15deg -> 90deg (300 s a turn)
// Phones as the suite has them (portrait, 844 high), the widths where the world ring's caps start to
// bite (the entity's 30rem; 599 is the widest phone), and a short landscape phone (the 92svh cap).
const PHONES = [[360, 844], [375, 844], [390, 844], [430, 844], [520, 844], [540, 900], [599, 900], [568, 320]];

// The outer orbit's box, from the emblem's box (the orbit layer turns, so its own box is a turned square).
const orbitBox = (page) =>
  page.evaluate((k) => {
    const o = document.querySelector(".orrery").getBoundingClientRect();
    const cx = o.left + o.width / 2, cy = o.top + o.height / 2, r = o.width * k;
    return { cx, cy, r, left: cx - r, right: cx + r, top: cy - r, bottom: cy + r, vw: innerWidth };
  }, ORBIT_R);

for (const [width, height] of PHONES) {
  test.describe(`at ${width}x${height}`, () => {
    test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

    test("S1 the outer orbit is the world pages' trace ring, the star unclipped", async ({ page, freeze }) => {
      // the worlds whose entity is the square the ring is centred in; EMBERS' hearth is at most 70svh
      // high, so it is square (and its ring level with the others') only while 70svh holds the column
      const column = Math.min(width - 2 * Math.max(16, Math.min(48, width * 0.05)), 480);
      const worlds = ["/not-not-philo/", "/intersect/"];
      if (height * 0.7 >= column) worlds.push("/embers/");
      const rings = [];
      for (const world of worlds) {
        await open(page, world);
        rings.push(await page.evaluate(() => {
          const r = document.querySelector(".trace").getBoundingClientRect();
          return { world: location.pathname, d: r.width, cx: r.left + r.width / 2, cy: r.top + r.height / 2 + scrollY };
        }));
      }
      await open(page);
      await freeze(page, STAR_AT_3);
      const b = await orbitBox(page);
      const y = await page.evaluate(() => scrollY);
      for (const ring of rings) {
        expect(Math.abs(2 * b.r - ring.d), `diameter, against ${ring.world}`).toBeLessThanOrEqual(TOL);
        expect(Math.abs(b.cx - ring.cx), `centre x, against ${ring.world}`).toBeLessThanOrEqual(TOL);
        expect(Math.abs(b.cy + y - ring.cy), `centre y, against ${ring.world}`).toBeLessThanOrEqual(TOL);
      }
      // the star at three o'clock: every box that clips it holds its sigil whole
      const clipped = await page.evaluate(() => {
        const s = document.querySelector('.bead[data-body="star"] .nts-sigil').getBoundingClientRect();
        const out = [];
        if (s.right > innerWidth) out.push(`viewport by ${s.right - innerWidth}`);
        for (let el = s && document.querySelector('.bead[data-body="star"]'); el; el = el.parentElement) {
          if (getComputedStyle(el).overflowX === "visible") continue;
          const r = el.getBoundingClientRect();
          if (s.right > r.right + 0.5 || s.left < r.left - 0.5) out.push(`${el.className || el.tagName} by ${Math.round(s.right - r.right)}`);
        }
        return out;
      });
      expect(clipped, "boxes that clip the events star").toEqual([]);
    });

    test("S4 the name follows the emblem, with no key between", async ({ page }) => {
      await open(page);
      const next = await page.evaluate(() => {
        const sky = document.querySelector(".orrery");
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        walker.currentNode = sky;
        // the next element after the emblem, outside it, that shows text or takes focus
        let n = sky;
        while ((n = walker.nextNode())) {
          if (sky.contains(n)) continue;
          const r = n.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (n.matches("a, button, input") || (n.childElementCount === 0 && n.textContent.trim())) break;
        }
        return n && (n.closest("h1") ? "h1#" + n.closest("h1").id : n.outerHTML.slice(0, 80));
      });
      expect(next, "what comes after the emblem").toBe("h1#title");
      const b = await orbitBox(page);
      const h1 = await page.evaluate(() => document.querySelector("#title").getBoundingClientRect().top);
      expect(h1 - b.bottom, "from the outer orbit to the name").toBeLessThanOrEqual(56);
    });
  });
}

test.describe("S3 the header at 390", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("the destinations spread from the sigil to the gutter, on the sigil's centre line", async ({ page }) => {
    await open(page);
    const h = await page.evaluate(() => {
      const s = document.querySelector(".nts-home .nts-sigil").getBoundingClientRect();
      const labels = [...document.querySelectorAll(".nts-nav a span")].map((e) => e.getBoundingClientRect());
      return { s: { left: s.left, right: s.right, mid: (s.top + s.bottom) / 2 }, labels: labels.map((r) => ({ left: r.left, right: r.right, mid: (r.top + r.bottom) / 2 })), vw: innerWidth };
    });
    const gutter = h.s.left;
    expect(h.vw - h.labels.at(-1).right, "the last label ends on the gutter").toBeCloseTo(gutter, 0);
    const gaps = h.labels.slice(1).map((r, i) => r.left - h.labels[i].right);
    const first = h.labels[0].left - h.s.right;
    const mean = gaps.reduce((a, b) => a + b) / gaps.length;
    expect(first / mean, `sigil to first label ${first.toFixed(1)} vs ${mean.toFixed(1)} between labels`).toBeGreaterThan(0.75);
    expect(first / mean).toBeLessThan(1.5);
    for (const r of h.labels) expect(Math.abs(r.mid - h.s.mid), "on the sigil's centre line").toBeLessThanOrEqual(1);
  });
});

// The ring's pulse on each bead: its animation, timing and what it animates.
const pulses = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".orrery .bead")].map((b) => {
      const anims = b.getAnimations({ subtree: true }).filter((a) => a.animationName === "bead-pulse");
      const a = anims[0];
      const t = a && a.effect.getTiming();
      const kf = a ? a.effect.getKeyframes() : [];
      // the pulse shows from the start of each cycle until opacity is back to 0
      const shown = kf.filter((k) => k.offset > 0 && parseFloat(k.opacity) > 0).map((k) => k.offset);
      const end = kf.find((k) => k.offset > Math.max(0, ...shown) && parseFloat(k.opacity) === 0);
      return {
        body: b.dataset.body,
        count: anims.length,
        pseudo: a && a.effect.pseudoElement,
        target: a && a.effect.target === b,
        running: a && a.playState === "running",
        delay: t && t.delay,
        period: t && t.duration,
        shownFor: t && end ? end.offset * t.duration : null,
        props: [...new Set(kf.flatMap((k) => Object.keys(k).filter((p) => !["offset", "computedOffset", "easing", "composite"].includes(p))))].sort(),
        face: b.querySelector(".face").getAnimations().filter((x) => x.animationName === "bead-pulse").length,
        size: Math.round(b.getBoundingClientRect().width * 10) / 10,
      };
    })
  );

for (const [label, ctx] of [["with a pointer", { viewport: { width: 1440, height: 900 } }], ["on a touch screen", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  test.describe(`S5 the beads pulse ${label}`, () => {
    test.use(ctx);
    test("now and then, one at a time, the ring outside the face", async ({ page }) => {
      await open(page);
      const before = await page.evaluate(() => [...document.querySelectorAll(".orrery .bead")].map((b) => Math.round(b.getBoundingClientRect().width * 10) / 10));
      const p = await pulses(page);
      expect(p.map((x) => x.body).sort()).toEqual([...BEADS].sort());
      for (const x of p) {
        expect(x.count, `${x.body}: one pulse`).toBe(1);
        expect(x.running, `${x.body}: running`).toBe(true);
        expect(x.target && x.pseudo, `${x.body}: on the bead's ::after, which rides the orbit`).toBe("::after");
        expect(x.face, `${x.body}: nothing pulses inside the face the morph names`).toBe(0);
        expect(x.props, `${x.body}: compositor properties only`).toEqual(["opacity", "transform"]);
        expect(x.period, `${x.body}: rare`).toBeGreaterThanOrEqual(12000);
        expect(x.shownFor, `${x.body}: brief`).toBeLessThanOrEqual(2000);
      }
      expect(new Set(p.map((x) => x.period)).size, "one period for all").toBe(1);
      // never two at once: the starts, round the shared period, are further apart than a pulse lasts
      const period = p[0].period;
      const starts = p.map((x) => ((x.delay % period) + period) % period).sort((a, b) => a - b);
      const apart = starts.map((s, i) => (i ? s - starts[i - 1] : starts[0] + period - starts.at(-1)));
      for (const d of apart) expect(d, `starts ${starts.join(", ")} ms`).toBeGreaterThan(Math.max(...p.map((x) => x.shownFor)));
      expect(p.map((x) => x.size), "the beads keep their size").toEqual(before);
    });
  });
}

test("S5b the pulse rings stop with the machine and resume with it, keeping their stagger", async ({ page }) => {
  await open(page);
  const state = () => page.evaluate(() => [...document.querySelectorAll(".orrery .bead")].map((b) => {
    const a = b.getAnimations({ subtree: true }).find((x) => x.animationName === "bead-pulse");
    return a ? { body: b.dataset.body, state: a.playState, at: a.currentTime } : { body: b.dataset.body, state: "none" };
  }));
  const running = (xs) => xs.filter((x) => x.state === "running").length;
  // a paused animation keeps its time until the compositor applies the pause (its `ready`)
  const settled = () => page.evaluate(() => Promise.all([...document.querySelectorAll(".orrery .bead")].flatMap((b) => b.getAnimations({ subtree: true }).map((x) => x.ready))));
  expect(running(await state()), "running at first").toBe(4);
  await page.locator(".orrery .e-stop").click();
  await expect(page.locator(".threshold")).toHaveClass(/is-stopped/);
  await settled();
  const a = await state();
  expect(running(a), "none runs while stopped").toBe(0);
  await page.waitForTimeout(400);
  const b = await state();
  expect(b.map((x) => x.at), "and none advances").toEqual(a.map((x) => x.at));
  await page.locator(".orrery .e-stop").click();
  await expect(page.locator(".threshold")).not.toHaveClass(/is-stopped/);
  const c = await state();
  expect(running(c), "all run again").toBe(4);
  const gaps = (xs) => xs.map((x, i) => x.at - xs[0].at);
  expect(gaps(c).map((g) => Math.round(g / 100)), "same stagger as before").toEqual(gaps(a).map((g) => Math.round(g / 100)));
});

test.describe("S6 under reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("the beads do not pulse, and show no ring", async ({ page }) => {
    await open(page);
    const p = await pulses(page);
    expect(p.map((x) => x.count)).toEqual([0, 0, 0, 0]);
    const ring = await page.evaluate(() => [...document.querySelectorAll(".orrery .bead")].map((b) => {
      const cs = getComputedStyle(b, "::after");
      return cs.content === "none" || cs.display === "none" ? 0 : parseFloat(cs.opacity);
    }));
    expect(ring, "no ring shows").toEqual([0, 0, 0, 0]);
  });
});
