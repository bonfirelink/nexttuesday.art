// The NTS chrome beyond the home speaks the same colour code: /events/, and
// a world page in the NTS state it opens in when reached from the home
// (nts.css section 11), until the world bleeds in. Every colour asserted by
// token, with its contrast; and no page shows the legacy NTS palette.
// S1 /events/: ground, header, the small orrery as a black sun, the ledger
// as the home's black plate (bone text, ochre dates, tags with code dots);
// S2 each world on arrival from the home: header and hero in the home's set;
// S3 no legacy NTS colour on any page, at rest and on arrival.
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";
import { tokens, contrast, style, focusRing, composite, legacyColours, resolve } from "../helpers/palette.mjs";

const LINE = "color-mix(in srgb, var(--pal-ink) 18%, transparent)";
const LINE_STRONG = "color-mix(in srgb, var(--pal-ink) 42%, transparent)";
const WORLDS = ["/embers/", "/not-not-philo/", "/intersect/"];

// Open a world page as if from the home: the flag the home's links set.
async function arrive(page, path) {
  await page.addInitScript(() => { try { sessionStorage.setItem("nts:from", "home"); } catch {} });
  await open(page, path);
}

test("S1 /events/ takes the home's set: the small orrery a black sun, the ledger a black plate", async ({ page }) => {
  await open(page, "/events/");
  const t = await tokens(page);
  const m = await resolve(page, [LINE, LINE_STRONG]);
  expect(await style(page, "body", "backgroundColor"), "ground").toBe(t["--pal-beige"]);
  expect(await style(page, "body", "color"), "text").toBe(t["--pal-ink"]);
  expect(await style(page, "html", "scrollbarColor"), "scrollbar").toBe(`${m[LINE_STRONG]} ${t["--pal-beige"]}`);
  expect(await style(page, ".nts-home .nts-sigil", "color"), "header sigil").toBe(t["--pal-ink"]);
  expect(await style(page, ".nts-nav a[aria-current] span", "backgroundColor", "::after"), "current page's bar").toBe(t["--pal-ink"]);
  expect(await style(page, ".nts-nav a[aria-current] .nts-sigil", "color"), "current page's sigil").toBe(t["--pal-ink"]);
  expect(await style(page, ".hero p", "backgroundColor", "::selection"), "selection").toBe(t["--pal-ink"]);
  expect(await style(page, ".hero p", "color", "::selection"), "selected text").toBe(t["--pal-bone"]);
  expect(await style(page, ".nts-footer .cols a", "color"), "footer link").toBe(t["--pal-ink"]);
  expect(await style(page, ".events-key", "color"), "key text").toBe(t["--pal-muted"]);
  expect(contrast(t["--pal-muted"], t["--pal-beige"]), "key on the beige").toBeGreaterThanOrEqual(4.5);

  // the small orrery: a black sun with a bone sigil, ink rings
  expect(await style(page, ".mini-orrery .sun-disc", "backgroundColor"), "sun").toBe(t["--pal-ink"]);
  expect(await style(page, ".mini-orrery > .nts-sigil", "color"), "sun's sigil").toBe(t["--pal-bone"]);
  expect(contrast(t["--pal-bone"], t["--pal-ink"]), "sigil on the sun").toBeGreaterThanOrEqual(3);
  expect(await style(page, ".mini-ring", "borderTopColor"), "rings").toBe(m[LINE]);

  // the ledger: the home's black plate
  const L = ".events-ap";
  const plate = await style(page, `${L} .ecl-in`, "backgroundColor");
  expect(plate, "ledger plate").toBe(t["--pal-ink"]);
  expect(await style(page, `${L} .ecl-ring`, "color"), "the ring's star").toBe(t["--code-events"]);
  expect(await style(page, `${L} .ledger-group > h2`, "color"), "group heading").toBe(t["--pal-bone"]);
  expect(await style(page, `${L} .ledger .what`, "color"), "titles").toBe(t["--pal-bone"]);
  expect(await style(page, `${L} .ledger .where`, "color"), "places").toBe(t["--pal-bone-muted"]);
  expect(await style(page, `${L} #past .ledger .when`, "color"), "past dates").toBe(t["--pal-bone-muted"]);
  expect(await style(page, `${L} .ledger li.upcoming .when`, "color"), "upcoming dates").toBe(t["--code-events"]);
  expect(await style(page, `${L} .ledger p`, "backgroundColor", "::selection"), "ledger selection").toBe(t["--pal-bone"]);
  for (const [k, need] of [["--pal-bone", 4.5], ["--pal-bone-muted", 4.5], ["--code-events", 4.5]]) {
    expect(contrast(t[k], plate), `${k} on the ledger`).toBeGreaterThanOrEqual(need);
  }
  const sigils = await page.$$eval(`${L} .ledger .nts-sigil`, (els) => els.map((e) => getComputedStyle(e).color));
  expect(sigils.length).toBeGreaterThan(0);
  for (const c of sigils) expect(c, "row sigils").toBe(t["--pal-bone"]);
  const CODE = { nts: "--code-events", embers: "--code-embers", philo: "--code-philo", intersect: "--code-intersect" };
  const tags = await page.$$eval(`${L} .ledger li`, (lis) =>
    lis.map((li) => {
      const k = li.querySelector(".kind");
      return { of: li.dataset.of, fg: getComputedStyle(k).color, bg: getComputedStyle(k).backgroundColor, dot: getComputedStyle(k, "::before").backgroundColor };
    }));
  expect(tags.length).toBeGreaterThan(0);
  for (const g of tags) {
    expect(g.dot, `${g.of} tag's dot`).toBe(t[CODE[g.of]]);
    expect(g.fg, `${g.of} tag's label`).toBe(t["--pal-bone"]);
    const chip = composite(g.bg, plate);
    expect(contrast(g.fg, chip), `${g.of} label on its tag`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(g.dot, chip), `${g.of} dot on its tag`).toBeGreaterThanOrEqual(3);
  }
  expect(await focusRing(page, `${L} .ledger .what a`), "focus ring on the black").toBe(t["--pal-bone"]);
});

for (const path of WORLDS) {
  test(`S2 ${path} on arrival from the home opens in the home's set`, async ({ page }) => {
    await arrive(page, path);
    expect(await page.evaluate(() => document.documentElement.dataset.bleedState), "arrival state").toMatch(/^(before|in)$/);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    const t = await tokens(page);
    const m = await resolve(page, [LINE, "color-mix(in srgb, var(--pal-beige) 86%, transparent)"]);
    expect(await style(page, ".nts-header", "backgroundColor"), "header").toBe(m["color-mix(in srgb, var(--pal-beige) 86%, transparent)"]);
    expect(await style(page, ".nts-header", "color"), "header text").toBe(t["--pal-ink"]);
    expect(await style(page, ".nts-home .nts-sigil", "color"), "header sigil").toBe(t["--pal-ink"]);
    expect(await style(page, ".nts-nav a[aria-current] span", "backgroundColor", "::after"), "current page's bar").toBe(t["--pal-ink"]);
    expect(await style(page, "main .hero", "backgroundColor"), "hero ground").toBe(t["--pal-beige"]);
    expect(await style(page, "main .hero h1", "color"), "hero title").toBe(t["--pal-ink"]);
    expect(await style(page, "main .hero p", "backgroundColor", "::selection"), "selection").toBe(t["--pal-ink"]);
    expect(contrast(t["--pal-ink"], t["--pal-beige"]), "ink on the beige").toBeGreaterThanOrEqual(4.5);
    if (path === "/not-not-philo/") {
      const v = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector("main .hero .nts-penrose"));
        const probe = document.createElement("i"); probe.style.transition = "none"; document.body.appendChild(probe);
        const out = {};
        for (const k of ["--penrose-ink", "--penrose-cut", "--penrose-ground"]) { probe.style.color = cs.getPropertyValue(k); out[k] = getComputedStyle(probe).color; }
        probe.remove();
        return out;
      });
      expect(v["--penrose-ink"], "the figure's ink").toBe(t["--pal-ink"]);
      expect(v["--penrose-cut"], "the figure's cut").toBe(t["--pal-voice"]);
      expect(v["--penrose-ground"], "the figure's ground").toBe(t["--pal-beige"]);
    }
  });
}

test("S3 no page shows the legacy NTS palette, at rest or on arrival from the home", async ({ page }) => {
  const found = [];
  for (const p of ["/", "/events/", ...WORLDS]) {
    await open(page, p);
    for (const f of await legacyColours(page)) found.push({ page: p, ...f });
  }
  for (const p of WORLDS) {
    await arrive(page, p);
    for (const f of await legacyColours(page, ".nts-bleed-old, html[data-bleed-state='before']")) found.push({ page: `${p} arriving`, ...f });
  }
  expect(found).toEqual([]);
});
