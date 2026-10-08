// The home around the emblem speaks the colour code: every colour below is
// a palette token from nts.css section 1 (--pal-*, --code-*), asserted by
// token, and text and marks hold their contrast on their own ground.
// C1 the header's sigil, links, hints, focus and selection; C2 the words band
// and the ledger's black plate (bone text, ochre dates, tags with code dots);
// C4 on the emblem's plate, in both grounds: the beads' focus ring; C5 the one
// favicon, the sigil on the ground, on every page.
import { test, expect } from "../helpers/fixtures.mjs";
import { open } from "../helpers/behaviour.mjs";
import { tokens, rgb, contrast, style, focusRing, composite } from "../helpers/palette.mjs";

test("C1 header sigil, links, hints, focus and selection take the palette's ink and voice", async ({ page }) => {
  await open(page);
  const t = await tokens(page);
  expect(await style(page, ".nts-home .nts-sigil", "color"), "header sigil").toBe(t["--pal-ink"]);
  expect(await style(page, ".tuesdays .sect-head .nts-sigil", "color"), "Tuesdays sigil").toBe(t["--pal-ink"]);
  for (const sel of ["#words .contact a", ".nts-footer .cols a"]) {
    expect(await style(page, sel, "color"), `${sel} colour`).toBe(t["--pal-ink"]);
    expect(await style(page, sel, "textDecorationLine"), `${sel} underlined`).toContain("underline");
  }
  for (const sel of [".tuesdays .cta", ".tuesdays details.reveal summary"]) {
    expect(await style(page, sel, "color"), `${sel}: the voice`).toBe(t["--pal-voice"]);
    expect(contrast(t["--pal-voice"], t["--pal-beige"]), `${sel} on the beige`).toBeGreaterThanOrEqual(4.5);
  }
  expect(await style(page, "body", "backgroundColor"), "the page's ground").toBe(t["--pal-beige"]);
  expect(await style(page, ".tuesdays p", "backgroundColor", "::selection"), "selection").toBe(t["--pal-ink"]);
  expect(await style(page, ".tuesdays p", "color", "::selection"), "selected text").toBe(t["--pal-bone"]);
  expect(await focusRing(page, ".tuesdays details.reveal summary"), "focus ring").toBe(t["--pal-ink"]);
  expect(contrast(t["--pal-ink"], t["--pal-beige"])).toBeGreaterThanOrEqual(3);
});

test("C2 the words band is a plywood plate; the ledger a black one, bone text, ochre dates, tags with code dots", async ({ page }) => {
  await open(page);
  const t = await tokens(page);
  expect(await style(page, "#words .ecl-in", "backgroundColor"), "words plate").toBe(t["--pal-plywood"]);
  expect(await style(page, "#words h2", "color"), "words text").toBe(t["--pal-ink"]);
  expect(await style(page, "#words p", "backgroundColor", "::selection"), "words selection").toBe(t["--pal-ink"]);

  const L = "#yet-to-come";
  const plate = await style(page, `${L} .ecl-in`, "backgroundColor");
  expect(plate, "ledger plate").toBe(t["--pal-ink"]);
  expect(await style(page, `${L} h2`, "color"), "heading").toBe(t["--pal-bone"]);
  expect(await style(page, `${L} .ledger .what`, "color"), "titles").toBe(t["--pal-bone"]);
  expect(await style(page, `${L} .ledger .where`, "color"), "places").toBe(t["--pal-bone-muted"]);
  expect(await style(page, `${L} .ledger li.upcoming .when`, "color"), "upcoming dates").toBe(t["--code-events"]);
  expect(await style(page, `${L} .sect-head .nts-sigil`, "color"), "the heading's star").toBe(t["--code-events"]);
  expect(await style(page, `${L} .ecl-ring`, "color"), "the ring's star").toBe(t["--code-events"]);
  expect(await style(page, `${L} .after .go`, "color"), "the way to the events").toBe(t["--pal-bone"]);
  expect(await style(page, `${L} p`, "backgroundColor", "::selection"), "ledger selection").toBe(t["--pal-bone"]);
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
  expect(await focusRing(page, `${L} .after .go`), "focus ring on the black").toBe(t["--pal-bone"]);
});


for (const ground of ["sun", "opening"]) {
  test(`C4 on the ${ground === "sun" ? "Black sun" : "Black opening"}: the beads' focus ring takes the plate's ink`, async ({ page }) => {
    await open(page);
    if (ground === "opening") await page.click('.e-pick input[value="opening"]');
    const t = await tokens(page);
    const plate = ground === "sun" ? t["--pal-plywood"] : t["--pal-ink"];
    expect(await style(page, ".threshold", "backgroundColor", "::before")).toContain(rgb(plate).slice(0, 3).join(", "));
    const ink = ground === "sun" ? t["--pal-ink"] : t["--pal-bone"];
    expect(await focusRing(page, '.bead[data-body="philo"]', '.bead[data-body="philo"] .face'), "bead focus ring").toBe(ink);
    expect(contrast(ink, plate), "focus ring on the plate").toBeGreaterThanOrEqual(3);
  });
}

test("C5 one favicon on every page: the sigil in ink on the beige", async ({ page, request }) => {
  await open(page);
  const t = await tokens(page);
  const hex = (s) => "#" + rgb(s).slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
  const icons = [];
  for (const p of ["/", "/embers/", "/not-not-philo/", "/intersect/", "/events/"]) {
    const html = await (await request.get(process.env.NTS_BASE + p)).text();
    icons.push(decodeURIComponent(html.match(/<link rel="icon" href="([^"]+)"/)[1]));
  }
  expect(new Set(icons).size, "the same favicon everywhere").toBe(1);
  const svg = icons[0];
  expect(svg.match(/<rect[^>]*fill='(#[0-9a-f]{6})'/i)[1].toLowerCase(), "its ground").toBe(hex(t["--pal-beige"]));
  expect(svg.match(/stroke='(#[0-9a-f]{6})'/i)[1].toLowerCase(), "its sigil").toBe(hex(t["--pal-ink"]));
});
