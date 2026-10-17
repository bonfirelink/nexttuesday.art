// L8. A phone held sideways shows the first screen as on desktop: the page's
// title and its whole figure (the home's emblem with its outer orbit and the
// bodies on it, each world's square and trace ring, the events orrery) are in
// view under the header, the figure beside the words, and nothing scrolls
// sideways. The home's orbit matching the worlds' ring is S1 (sky.spec).
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";

// Boxes laid out by CSS from one formula agree to a rounding error.
const TOL = 1;
const ORBIT_R = 96.4 / 202; // the outer orbit's centreline, in emblem widths

// The smallest phone held sideways, two common ones and the widest.
const SIDEWAYS = [[568, 320], [667, 375], [844, 390], [932, 430]];
const PAGES = [
  { path: "/", words: ".intro", figure: "orbit" },
  { path: "/embers/", words: ".hero-text", figure: ".hero .entity" },
  { path: "/not-not-philo/", words: ".hero-text", figure: ".hero .entity" },
  { path: "/intersect/", words: ".hero-text", figure: ".hero .entity" },
  { path: "/events/", words: ".hero-text", figure: ".events-hero .mini-orrery" },
];

// The boxes the test compares, at the top of the page, in viewport px.
const layout = (page, p) =>
  page.evaluate(([p, k]) => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; };
    let figure;
    if (p.figure === "orbit") {
      const o = document.querySelector(".orrery").getBoundingClientRect();
      const cx = o.left + o.width / 2, cy = o.top + o.height / 2, r = o.width * k;
      figure = { left: cx - r, right: cx + r, top: cy - r, bottom: cy + r, w: 2 * r, h: 2 * r };
    } else figure = box(document.querySelector(p.figure));
    const ring = document.querySelector(".hero .trace-ring");
    return {
      header: box(document.querySelector(".nts-header")), title: box(document.querySelector("h1")),
      words: box(document.querySelector(p.words)), figure, ring: ring && box(ring),
      bodies: [...document.querySelectorAll(".orrery .bead")].map((b) => ({ body: b.dataset.body, ...box(b) })),
      vw: innerWidth, vh: innerHeight, scrollWidth: document.documentElement.scrollWidth,
    };
  }, [p, ORBIT_R]);

const inView = (b, l) => b.top >= l.header.bottom - TOL && b.bottom <= l.vh + TOL && b.left >= -TOL && b.right <= l.vw + TOL;

test.use({ reducedMotion: "reduce", isMobile: true, hasTouch: true });

for (const [width, height] of SIDEWAYS) {
  test.describe(`at ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("L8 the title and the whole figure share the first screen, side by side", async ({ page }) => {
      for (const p of PAGES) {
        await open(page, p.path);
        const l = await layout(page, p);
        expect(inView(l.title, l), `${p.path} the title in the first screen, under the header`).toBe(true);
        expect(inView(l.figure, l), `${p.path} the whole figure in the first screen, under the header`).toBe(true);
        expect(l.figure.left, `${p.path} the figure beside the words, on their right`).toBeGreaterThanOrEqual(l.words.right - TOL);
        if (l.ring) {
          expect(Math.abs(l.figure.w - l.figure.h), `${p.path} the entity is square`).toBeLessThanOrEqual(TOL);
          expect(inView(l.ring, l), `${p.path} the trace ring in the first screen`).toBe(true);
        }
        for (const b of l.bodies) expect(inView(b, l), `${p.path} the ${b.body} body in the first screen`).toBe(true);
        expect(l.scrollWidth, `${p.path} nothing scrolls sideways`).toBeLessThanOrEqual(l.vw);
      }
    });
  });
}

// The boundary: a short desktop window (500 high) is not a phone held sideways. It keeps the
// desktop arrangement, the hero a screen tall under the header, its entity not the --stage square.
test.describe("at 1024x500", () => {
  test.use({ viewport: { width: 1024, height: 500 }, isMobile: false, hasTouch: false });

  test("L8b a short desktop window keeps the desktop arrangement", async ({ page }) => {
    await open(page, "/not-not-philo/");
    const d = await page.evaluate(() => ({
      stage: getComputedStyle(document.documentElement).getPropertyValue("--stage").trim(),
      hero: document.querySelector(".hero").getBoundingClientRect().height,
      bar: document.querySelector(".nts-header").getBoundingClientRect().height,
      vh: innerHeight,
    }));
    expect(d.stage, "the mode's --stage is not set").toBe("");
    expect(d.hero, "the hero is a screen tall under the header").toBeGreaterThanOrEqual(d.vh - d.bar - TOL);
  });
});
