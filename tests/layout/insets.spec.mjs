// L4. Home cards sit --ecl-inset from the edges (16 px on phones).
import { test, expect } from "../helpers/fixtures.mjs";
import { probeLength, openPage } from "../helpers/geometry.mjs";

// Both are CSS lengths read straight from the layout, with no rounding in between.
const EDGE_TOL = 0.5;
const PADDING_TOL = 0.5;

// Where each card's content column starts, measured from the card's left edge, in the approved
// state (inner padding unchanged by the gutters). The worlds and the bands differ at 1024.
const CONTENT_OFFSET = {
  360: { embers: 18, "not-not-philo": 18, field: 18, words: 18, "yet-to-come": 18 },
  390: { embers: 19.5, "not-not-philo": 19.5, field: 19.5, words: 19.5, "yet-to-come": 19.5 },
  430: { embers: 21.5, "not-not-philo": 21.5, field: 21.5, words: 21.5, "yet-to-come": 21.5 },
  1024: { embers: 78.72, "not-not-philo": 78.72, field: 78.72, words: 48, "yet-to-come": 48 },
  1440: { embers: 112, "not-not-philo": 112, field: 112, words: 112, "yet-to-come": 112 },
};

test.use({ reducedMotion: "reduce" });

const widths = [[360, ""], [390, ""], [430, ""], [1024, " @slow"], [1440, " @slow"]];
for (const [width, tag] of widths) {
  test(`L4 home cards sit ${width < 640 ? "16 px" : "--ecl-inset"} from the edges at ${width}${tag}`, async ({ page, freeze, settle }) => {
    await page.setViewportSize({ width, height: 844 });
    await openPage(page, "/");
    await freeze(page);
    await settle(page);
    const inset = await probeLength(page, "main", "var(--ecl-inset)");
    if (width < 640) expect(inset, "--ecl-inset on phones").toBeCloseTo(16, 1);
    else expect(inset, "--ecl-inset").toBeCloseTo(await probeLength(page, "main", "clamp(16px, 2.5vw, 2rem)"), 1);

    const cards = await page.evaluate(() =>
      [...document.querySelectorAll("main .ecl")].map((e) => {
        const r = e.getBoundingClientRect();
        const content = e.querySelector(":scope .ecl-in > .wrap") || e.querySelector(".ecl-in");
        return { id: e.id, left: r.left, right: document.documentElement.clientWidth - r.right, offset: content.getBoundingClientRect().left - r.left };
      })
    );
    expect(cards.map((c) => c.id), "home cards").toEqual(Object.keys(CONTENT_OFFSET[width]));
    for (const c of cards) {
      expect(Math.abs(c.left - inset), `#${c.id} left edge`).toBeLessThanOrEqual(EDGE_TOL);
      expect(Math.abs(c.right - inset), `#${c.id} right edge`).toBeLessThanOrEqual(EDGE_TOL);
      expect(Math.abs(c.offset - CONTENT_OFFSET[width][c.id]), `#${c.id} content offset`).toBeLessThanOrEqual(PADDING_TOL);
    }
  });
}
