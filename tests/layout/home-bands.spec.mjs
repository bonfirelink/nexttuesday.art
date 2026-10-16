// The home's three world bands: the figure in PHILO's orb, the rings under it, and the
// title and tagline each band takes from its world's page.
import { test, expect } from "../helpers/fixtures.mjs";
import { inflateSync } from "node:zlib";
import { openPage } from "../helpers/geometry.mjs";

test.use({ reducedMotion: "reduce" });

const READ = () => {
  const px = parseFloat;
  return (el) => {
    const c = getComputedStyle(el);
    return { text: el.textContent.replace(/\s+/g, " ").trim(), family: c.fontFamily, weight: c.fontWeight, style: c.fontStyle, fvs: c.fontVariationSettings, transform: c.textTransform, ls: Math.round((px(c.letterSpacing) / px(c.fontSize) || 0) * 1000) / 1000, color: c.color };
  };
};

// [world, the band's title, the page's title]
const TITLES = [
  ["embers", "#h-embers", "#title"],
  ["philo", "#h-philo .philo-key", "#title .philo-key"],
  ["intersect", "#h-field", "#title"],
];
const PAGES = { embers: "/embers/", philo: "/not-not-philo/", intersect: "/intersect/" };
const read = (page, sel) => page.evaluate(`(${READ})()(document.querySelector(${JSON.stringify(sel)}))`);

for (const [world, bandSel, pageSel] of TITLES) {
  test(`B1 the ${world} band's title wears its page's wordmark`, async ({ page }) => {
    await openPage(page, "/");
    const band = await read(page, bandSel);
    await openPage(page, PAGES[world]);
    const hero = await read(page, pageSel);
    for (const k of ["family", "weight", "transform", "ls"]) expect(band[k], `${world} title ${k}`).toEqual(hero[k]);
    expect(band.text, `${world} title text`).toBe(hero.text);
  });
}

test("B2 the band titles keep their wordmark forms and accessible names", async ({ page }) => {
  await openPage(page, "/");
  // PHILO: NOT² PHILO, named NOT NOT PHILO, the section still labelled by it
  await expect(page.locator("#h-philo")).toHaveAttribute("aria-label", "NOT NOT PHILO");
  await expect(page.locator("#h-philo .philo-exp")).toHaveText("2");
  expect(await page.locator("#h-philo .philo-exp").getAttribute("aria-hidden")).toBe("true");
  await expect(page.locator("#not-not-philo")).toHaveAttribute("aria-labelledby", "h-philo");
  // INTERSECT: "> INTERSECT", the chevron in the page's mono fire
  await expect(page.locator("#h-field")).toHaveText(/^>\s*INTERSECT$/);
  // the chevron is decoration: the name reads INTERSECT, here and on the page
  expect(await page.locator("#h-field .x").getAttribute("aria-hidden")).toBe("true");
  const chevron = await page.evaluate(() => { const c = getComputedStyle(document.querySelector("#h-field .x")); return [c.fontFamily, c.color]; });
  await openPage(page, "/intersect/");
  expect(await page.locator("#title .x").getAttribute("aria-hidden")).toBe("true");
  expect(chevron).toEqual(await page.evaluate(() => { const c = getComputedStyle(document.querySelector("#title .x")); return [c.fontFamily, c.color]; }));
  // EMBERS: the Es are drawn as Ξ
  await openPage(page, "/");
  expect(await page.locator("#h-embers .xi").allTextContents()).toEqual(["E", "E"]);
});

// The tagline is the first paragraph after the title, the page's own copy and rules.
for (const world of ["embers", "philo", "intersect"]) {
  test(`B3 the ${world} band's tagline is its page's tagline, as styled there`, async ({ page }) => {
    const bandSel = { embers: "#h-embers", philo: "#h-philo", intersect: "#h-field" }[world] + " + p";
    await openPage(page, "/");
    const key = await page.locator(bandSel).getAttribute("data-nts-copy");
    const band = await read(page, bandSel);
    await openPage(page, PAGES[world]);
    expect(await page.locator(".hero .incant").first().getAttribute("data-nts-copy"), "copy key").toBe(key);
    const hero = await read(page, ".hero .incant");
    expect(band.text).toBe(hero.text);
    for (const k of ["family", "style", "weight", "fvs"]) expect(band[k], `${world} tagline ${k}`).toEqual(hero[k]);
    await openPage(page, "/");
    // and the band's own description and link follow it
    expect(await page.locator(bandSel + " + p").count(), "description after the tagline").toBe(1);
  });
}

// PHILO's loop overshoots its orb as EMBERS' and INTERSECT's figures do (their mean span runs
// 1.07 to 1.16 orb widths); the page's figure keeps its size.
// Guards REST.fragment (cubes.js): the size of the loop in the home orb.
test("B4 PHILO's home figure overshoots its orb; the page's figure is unchanged", async ({ page }) => {
  await openPage(page, "/");
  const r = await page.evaluate(() => {
    const B = NTS.cubes, W = document.querySelector(".orb[data-body=philo]").clientWidth;
    const sc = (W * B.REST.fragment) / (2 * B.REACH);
    const g = document.createElement("canvas").getContext("2d");
    const shown = B.paint(g, { top: "#fff", side: "#999", dark: "#555", ground: "#ccc" }, 0, 0, 0, 0, 0, sc);
    const xs = shown.flatMap((f) => f.poly.map((p) => p[0] * sc));
    return { ratio: (Math.max(...xs) - Math.min(...xs)) / W, page: B.REST.page };
  });
  expect(r.ratio, "figure width over orb width").toBeGreaterThan(1.05);
  expect(r.ratio).toBeLessThan(1.2);
  expect(r.page, "the page's rest size").toBe(0.952);
});

// The pixels of a PNG screenshot (8-bit RGB or RGBA, no interlace): row-major grey values.
function grey(png) {
  let o = 8, w = 0, h = 0, ch = 4; const idat = [];
  while (o < png.length) {
    const n = png.readUInt32BE(o), type = png.toString("ascii", o + 4, o + 8), d = png.subarray(o + 8, o + 8 + n);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ch = d[9] === 6 ? 4 : 3; }
    if (type === "IDAT") idat.push(d);
    o += 12 + n;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? row[i - ch] : 0, b = up[i], c = i >= ch ? up[i - ch] : 0;
      const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : (() => { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })();
      row[i] = (src[i] + p) & 255;
    }
  }
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (px[i * ch] + px[i * ch + 1] + px[i * ch + 2]) / 3;
  return { w, h, g };
}

test("B5 PHILO's orb shows the rings, centred on the figure", async ({ page }) => {
  await openPage(page, "/");
  const frag = page.locator("#not-not-philo [data-nts-fragment]");
  await frag.scrollIntoViewIfNeeded();
  // the canvas is centred on the host, where the figure's pivot is
  const off = await page.evaluate(() => {
    const f = document.querySelector("#not-not-philo [data-nts-fragment]"), c = f.querySelector("canvas");
    const fr = f.getBoundingClientRect(), cr = c.getBoundingClientRect();
    c.style.visibility = "hidden";
    document.querySelector("#not-not-philo [data-nts-fragment] .still").style.display = "none";
    return Math.abs(cr.x + cr.width / 2 - (fr.x + fr.width / 2)) + Math.abs(cr.y + cr.height / 2 - (fr.y + fr.height / 2));
  });
  expect(off, "canvas centre on the host's centre").toBeLessThan(0.5);
  // with the figure hidden, what is left is the plate: rings read in the pixels, whose weight
  // along the middle row and the middle column balances on the centre
  const { w, h, g } = grey(await frag.screenshot());
  expect(Math.min(...g), "ink of the rings in the pixels").toBeLessThan(Math.max(...g) - 8);
  const ground = [...g].sort((a, b) => a - b)[Math.floor(g.length / 2)];
  // inside the disc only: the orbit and the rim beyond it are not the plate
  const EDGE = 12;
  const weight = (at) => { let s = 0, m = 0; for (const [i, v] of at.slice(EDGE, at.length - EDGE)) { const d = Math.max(0, ground - v); s += d; m += d * i; } return m / s; };
  const row = weight(Array.from({ length: w }, (_, x) => [x + 0.5, g[Math.floor(h / 2) * w + x]]));
  const col = weight(Array.from({ length: h }, (_, y) => [y + 0.5, g[y * w + Math.floor(w / 2)]]));
  expect(Math.abs(row - w / 2), "rings' centre x vs host centre").toBeLessThan(1.5);
  expect(Math.abs(col - h / 2), "rings' centre y vs host centre").toBeLessThan(1.5);
});
