// Helpers for the view-transition and bleed-in tests.
export const WORLDS = ["embers", "not-not-philo", "intersect"];

// Init script: for each document, records what its `pagereveal` view transition
// painted once `ready` resolves. window.__vt is a list of
// { names: [pseudo-elements animating], entity: computed view-transition-name
// of `.hero .entity` once it exists }, "no-vt" or "skipped ..." (one entry per reveal).
export function recordTransitions() {
  window.__vt = [];
  addEventListener("pagereveal", (e) => {
    if (!e.viewTransition) { window.__vt.push("no-vt"); return; }
    const vt = e.viewTransition;
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
        window.__vt.push({ names: [...names], entity: ent ? getComputedStyle(ent).viewTransitionName : null });
      },
      (err) => window.__vt.push("skipped " + err)
    );
  });
}

// Init script: remembers what the bleed looked like at DOMContentLoaded (before
// nts.js, whose listener is added later) and every `nts:bleed` event.
export function recordBleed() {
  window.__bleed = { events: [], dcl: null };
  document.addEventListener("DOMContentLoaded", () => {
    const hero = document.querySelector("main .hero");
    window.__bleed.dcl = {
      state: document.documentElement.getAttribute("data-bleed-state"),
      night: !!document.querySelector(".nts-night"),
      styles: hero ? [hero, ...hero.querySelectorAll("*")].map((e) => e.getAttribute("style")) : [],
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
