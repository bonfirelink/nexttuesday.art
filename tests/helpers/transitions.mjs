// Helpers for the view-transition and bleed-in tests.
export const WORLDS = ["embers", "not-not-philo", "intersect"];

// Init script: for each document, records what its `pagereveal` view transition
// painted once `ready` resolves. window.__vt is a list of
// { names: [pseudo-elements animating], entity: computed view-transition-name
// of `.hero .entity` once it exists, ready: document.readyState at the reveal },
// "no-vt" or "skipped ..." (one entry per reveal).
export function recordTransitions() {
  window.__vt = [];
  addEventListener("pagereveal", (e) => {
    if (!e.viewTransition) { window.__vt.push("no-vt"); return; }
    const vt = e.viewTransition;
    const ready = document.readyState;
    let finished = false;
    vt.finished.then(() => { finished = true; }, () => { finished = true; });
    vt.ready.then(
      async () => {
        const names = new Set(
          document.documentElement.getAnimations({ subtree: true })
            .map((a) => a.effect && a.effect.pseudoElement).filter(Boolean)
        );
        // The reveal can run before the hero is parsed: wait for the entity.
        let ent;
        while (!(ent = document.querySelector(".hero .entity")) && !finished) {
          await new Promise((r) => requestAnimationFrame(r));
        }
        window.__vt.push({ names: [...names], entity: ent ? getComputedStyle(ent).viewTransitionName : null, ready });
      },
      (err) => window.__vt.push("skipped " + err)
    );
  });
}

// Init script: remembers what the bleed looked like at DOMContentLoaded (before
// nts.js, whose listener is added later) and every `nts:bleed` event.
export function recordBleed() {
  // Figure canvases restyle themselves in the world's colours when the bleed
  // ends (INTERSECT's glow), so only the markup around them is compared.
  window.__heroStyles = () => {
    const hero = document.querySelector("main .hero");
    return hero ? [hero, ...hero.querySelectorAll("*:not(canvas)")].map((e) => e.getAttribute("style")) : [];
  };
  window.__bleed = { events: [], dcl: null };
  document.addEventListener("DOMContentLoaded", () => {
    const hero = document.querySelector("main .hero");
    window.__bleed.dcl = {
      state: document.documentElement.getAttribute("data-bleed-state"),
      night: !!document.querySelector(".nts-night"),
      styles: window.__heroStyles(),
    };
  });
  addEventListener("nts:bleed", (e) => window.__bleed.events.push(e.detail.phase));
}

// Waits for the arrived page's own reveal to be recorded and returns its entry.
export async function arrivedTransition(page) {
  await page.waitForFunction(() => window.__vt && window.__vt.length > 0);
  return page.evaluate(() => window.__vt[window.__vt.length - 1]);
}

// A real click on the first visible link to `/<world>/` on the home page.
export async function clickWorldLink(page, world) {
  await page.locator(`a[href="/${world}/"]:visible`).first().click();
  await page.waitForURL(`**/${world}/`);
}

// A real click on the header's link home, from a world page.
export async function clickHomeLink(page) {
  await page.locator('a.nts-home[href="/"]:visible').first().click();
  await page.waitForURL((u) => u.pathname === "/");
}

// Holds the parser of the next load of `url` for `ms` before the first `marker`
// in its HTML: a blocking script is inserted there and answered late. Until it
// is answered the browser may render what it has, as on a slow network that
// splits the response at that point.
export async function stallDocument(page, url, marker, ms) {
  const stall = new URL("/__stall.js", url).href;
  await page.route(stall, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.fulfill({ body: "", contentType: "text/javascript" });
  });
  await page.route(url, async (route) => {
    const res = await route.fetch();
    const html = await res.text();
    if (!html.includes(marker)) throw new Error(`stallDocument: no ${marker} in ${url}`);
    await route.fulfill({ response: res, body: html.replace(marker, `<script src="${stall}"></script>` + marker) });
  });
}

// A same-site navigation to `path` from a link that is not a world's own
// (worlds link to each other only through this kind of plain link).
export async function followLink(page, path) {
  await page.evaluate((p) => {
    const a = document.createElement("a");
    a.href = p;
    document.body.appendChild(a);
    a.click();
  }, path);
  await page.waitForURL("**" + path);
}

export const bleedState = (page) => page.evaluate(() => document.documentElement.getAttribute("data-bleed-state"));

// Scroll position (px) where the bleed completes, as nts.js works it out.
export const bleedEnd = (page) =>
  page.evaluate(() => {
    const r = document.querySelector("main .hero").getBoundingClientRect();
    return Math.max(r.top + scrollY + r.height / 2, innerHeight * 0.25);
  });

// Instant scroll (the page may set smooth scrolling) and two frames for observers.
export const scrollToY = (page, y) =>
  page.evaluate((y) => {
    scrollTo({ top: y, behavior: "instant" });
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, y);

export const bleedProgress = (page) => page.evaluate(() => window.NTS.bleed.progress());

// Median luminance (0..255) of the pixels of a viewport screenshot inside
// each region, `{ x, y, w, h, disc? }` in CSS px at scale 1; `disc: { cx, cy, r }`
// keeps only the pixels inside that circle. The median ignores the text and
// figures on the ground, so it reads the ground (colour and grain) alone.
export async function groundLuma(page, regions) {
  const png = (await page.screenshot()).toString("base64");
  const aux = await page.context().newPage();
  try {
    return await aux.evaluate(async ({ png, regions }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + png;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      return regions.map((r) => {
        const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
        const w = Math.min(c.width - x0, Math.floor(r.w)), h = Math.min(c.height - y0, Math.floor(r.h));
        if (w <= 0 || h <= 0) return null;
        const d = g.getImageData(x0, y0, w, h).data, hist = new Array(256).fill(0);
        let n = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (r.disc && Math.hypot(x0 + x - r.disc.cx, y0 + y - r.disc.cy) > r.disc.r) continue;
          const i = (y * w + x) * 4;
          hist[Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])]++; n++;
        }
        if (n < 500) return null;
        let acc = 0;
        for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n / 2) return v; }
      });
    }, { png, regions });
  } finally { await aux.close(); }
}

// Per-row median luminance (0..255) of a viewport screenshot, for the device
// rows y0..y1 over the device columns x0..x1 (screenshot pixels, any scale).
export async function rowLuma(page, x0, x1, y0, y1) {
  const png = (await page.screenshot()).toString("base64");
  const aux = await page.context().newPage();
  try {
    return await aux.evaluate(async ({ png, x0, x1, y0, y1 }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + png;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const out = [];
      for (let y = y0; y < y1; y++) {
        const d = g.getImageData(x0, y, x1 - x0, 1).data, v = [];
        for (let i = 0; i < d.length; i += 4) v.push(Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]));
        v.sort((a, b) => a - b);
        out.push(v[v.length >> 1]);
      }
      return out;
    }, { png, x0, x1, y0, y1 });
  } finally { await aux.close(); }
}
