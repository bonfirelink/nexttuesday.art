// L7. Each world presents its initiative in three lines: the name, what it is, the punchline.
import { test, expect } from "../helpers/fixtures.mjs";
import { openPage } from "../helpers/geometry.mjs";

test.use({ reducedMotion: "reduce" });

const WORLDS = [
  { path: "/embers/", sel: ".embers-label", label: "Nightlife series · Next Tuesday Society", incant: "The floor ain't gonna dance itself" },
  { path: "/not-not-philo/", sel: ".label", label: "Discussion series · Next Tuesday Society", incant: "On everything, nothing and anything in between" },
  { path: "/intersect/", sel: ".label", label: "Assembly series · Next Tuesday Society", incant: "An ancient tradition, a crossroads of sorts" },
];

const SHORT = { "/embers/": "Nightlife series · NTS", "/not-not-philo/": "Discussion series · NTS", "/intersect/": "Assembly series · NTS" };

for (const w of WORLDS) {
  test(`L7 ${w.path} hero reads name, what it is, punchline`, async ({ page }) => {
    await openPage(page, w.path);
    const lines = await page.evaluate((labelSel) => {
      // the visible text of a label, as authored (CSS may upper-case it)
      const visible = (el) => [...el.querySelectorAll(".label-long, .label-short")].filter((s) => s.getClientRects().length).map((s) => s.textContent).join("").trim();
      const box = document.querySelector(".hero-text");
      const h1 = box.querySelector("h1");
      const label = box.querySelector(labelSel);
      const incant = box.querySelector(".incant");
      const top = (el) => el.getBoundingClientRect().top;
      return {
        order: [h1, label, incant].map(top),
        label: visible(label),
        incant: incant.textContent.trim(),
        extra: [...box.children].map((c) => c.tagName),
      };
    }, w.sel);
    const [a, b, c] = lines.order;
    expect(a, "name above the label").toBeLessThan(b);
    expect(b, "label above the punchline").toBeLessThan(c);
    expect(lines.label).toBe(w.label);
    expect(lines.incant).toBe(w.incant);
    expect(lines.extra, "three lines and nothing else").toHaveLength(3);
  });

  for (const width of [320, 390, 1024, 1440]) {
    test(`L7 ${w.path} hero lines are one line each, in a band as wide as the title, at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openPage(page, w.path);
      const m = await page.evaluate((labelSel) => {
        const visible = (el) => [...el.querySelectorAll(".label-long, .label-short")].filter((s) => s.getClientRects().length).map((s) => s.textContent).join("").trim();
        const box = document.querySelector(".hero-text");
        const h1 = box.querySelector("h1");
        const label = box.querySelector(labelSel);
        const incant = box.querySelector(".incant");
        const bx = box.getBoundingClientRect();
        const lineCount = (el) => {
          const cs = getComputedStyle(el);
          const inner = el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          return inner / parseFloat(cs.lineHeight);
        };
        const textRight = (el) => { const r = document.createRange(); r.selectNodeContents(el); return Math.max(...[...r.getClientRects()].map((x) => x.right)); };
        const lcs = getComputedStyle(label);
        const shown = [...label.querySelectorAll(".label-long, .label-short")].find((x) => x.getClientRects().length);
        const lr = label.getBoundingClientRect();
        const sr = document.createRange(); sr.selectNodeContents(shown);
        const swatch = document.createElement("i"); swatch.style.background = "var(--embers-fire)"; document.body.append(swatch);
        const fire = getComputedStyle(swatch).backgroundColor; swatch.remove();
        const word = document.querySelector('h1 [data-nts-copy="intersect.title"]');
        const wr = word && word.getBoundingClientRect();
        return {
          lines: [h1, label, incant].map(lineCount),
          over: [h1, label, incant].map((el) => textRight(el) - bx.right),
          bandRight: label.getBoundingClientRect().right - h1.getBoundingClientRect().right,
          labelLeft: label.getBoundingClientRect().left, incantLeft: incant.getBoundingClientRect().left, wordLeft: wr && wr.left,
          text: visible(label),
          // the label text ends at the band right edge less its padding, give or take the letter-spacing after the last glyph
          slack: lr.right - parseFloat(lcs.paddingRight) - textRight(shown),
          spacing: parseFloat(lcs.letterSpacing) || 0,
          fromLeft: sr.getClientRects()[0].left - (lr.left + parseFloat(lcs.paddingLeft)),
          fire,
          bg: getComputedStyle(label).backgroundColor,
          // the label switch is the container query at 30rem in pages.css
          narrow: box.clientWidth < 30 * parseFloat(getComputedStyle(document.documentElement).fontSize),
        };
      }, w.sel);
      for (const n of m.lines) expect(n, "one line").toBeLessThan(1.5);
      for (const o of m.over) expect(o, "inside .hero-text").toBeLessThanOrEqual(1);
      expect(Math.abs(m.bandRight), "band right edge vs title's").toBeLessThanOrEqual(1);
      if (m.narrow) {
        expect(Math.abs(m.fromLeft), "the short label starts at the band's left padding").toBeLessThanOrEqual(1.5);
      } else {
        expect(m.slack, "the long label reaches the right of its band (justified)").toBeLessThanOrEqual(m.spacing + 1.5);
        expect(m.slack).toBeGreaterThanOrEqual(-1);
      }
      expect(m.text).toBe(m.narrow ? SHORT[w.path] : w.label);
      if (width <= 390) expect(m.narrow, "a phone gets the short label").toBe(true);
      if (width === 1440) expect(m.narrow).toBe(false);
      if (w.path === "/intersect/") {
        expect(Math.abs(m.labelLeft - m.wordLeft), "label starts under the I").toBeLessThanOrEqual(1);
        expect(Math.abs(m.incantLeft - m.wordLeft), "punchline starts under the I").toBeLessThanOrEqual(1);
      }
      if (w.path === "/embers/") expect(m.bg).toBe(m.fire);
    });
  }
}

test("L7 the home cards put the body before the lede", async ({ page }) => {
  await openPage(page, "/");
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll(".world .prose")].map((p) => {
      const lede = p.querySelector(".lede");
      const body = p.querySelector("p:not(.lede)");
      return { id: p.closest(".world").id, lede: lede?.textContent.trim(), before: lede && body ? !!(body.compareDocumentPosition(lede) & Node.DOCUMENT_POSITION_FOLLOWING) : false };
    })
  );
  const worlds = cards.filter((c) => ["embers", "not-not-philo", "field"].includes(c.id));
  expect(worlds.map((c) => c.id)).toEqual(["embers", "not-not-philo", "field"]);
  for (const c of worlds) expect(c.before, `${c.id}: body precedes lede`).toBe(true);
  expect(worlds.map((c) => c.lede)).toEqual([
    "The floor ain't gonna dance itself",
    "On everything, nothing and anything in between",
    "An ancient tradition, a crossroads of sorts",
  ]);
});
