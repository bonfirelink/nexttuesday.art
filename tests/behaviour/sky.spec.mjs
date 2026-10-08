// The home's sky on a phone and what hints at the beads.
// S1 the emblem keeps a margin: its outer orbit stays MARGIN px inside the
// screen's sides and below the header, and the events star is never clipped;
// S2 the ground picker in the plate's corner stays clear of the outer orbit;
// S3 the header is balanced: the destinations spread from the sigil to the
// gutter, the sigil-to-first gap like the gaps between them, one centre line;
// S4 no key under the emblem: the name is the next thing after it;
// S5 the four beads pulse now and then, with a pointer and on a touch screen,
// never two at once, the ring outside the face the morph names; S6 under
// reduced motion they do not pulse. The eye's own beam is E6 (emblem.spec).
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";

const MARGIN = 16; // px between the outer orbit and the screen's side, at least
const ORBIT_R = (96.4 + 0.55 / 2) / 202; // the outer orbit's outer edge, in emblem widths
const STAR_AT_3 = 62500; // ms: the events star turns 15deg -> 90deg (300 s a turn)
const PHONES = [360, 375, 390, 430];
const BEADS = ["embers", "philo", "intersect", "star"];

// The outer orbit's box, from the emblem's box (the orbit layer turns, so its own box is a turned square).
const orbitBox = (page) =>
  page.evaluate((k) => {
    const o = document.querySelector(".orrery").getBoundingClientRect();
    const cx = o.left + o.width / 2, cy = o.top + o.height / 2, r = o.width * k;
    return { cx, cy, r, left: cx - r, right: cx + r, top: cy - r, bottom: cy + r, vw: innerWidth };
  }, ORBIT_R);

for (const width of PHONES) {
  test.describe(`at ${width}`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

    test(`S1 the outer orbit sits at least ${MARGIN} px inside the screen and below the header, the star unclipped`, async ({ page, freeze }) => {
      await open(page);
      await freeze(page, STAR_AT_3);
      const b = await orbitBox(page);
      expect(b.left, "left margin").toBeGreaterThanOrEqual(MARGIN);
      expect(b.vw - b.right, "right margin").toBeGreaterThanOrEqual(MARGIN);
      const bar = await page.evaluate(() => document.querySelector(".nts-header").getBoundingClientRect().bottom);
      expect(b.top - bar, "gap under the header").toBeGreaterThanOrEqual(MARGIN);
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

    test("S2 the ground picker stays clear of the outer orbit", async ({ page }) => {
      await open(page);
      const b = await orbitBox(page);
      const near = await page.evaluate(({ cx, cy }) => {
        const p = document.querySelector(".e-pick").getBoundingClientRect();
        const x = Math.max(p.left, Math.min(cx, p.right)), y = Math.max(p.top, Math.min(cy, p.bottom));
        return Math.hypot(x - cx, y - cy);
      }, b);
      expect(near - b.r, "the picker's nearest corner outside the orbit").toBeGreaterThanOrEqual(8);
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
