// Helpers shared by the behaviour tests: opening a page, scrolling to a
// position and letting the observers run.
export const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];

export async function open(page, pathname = "/") {
  await page.goto(process.env.NTS_BASE + pathname);
  await page.evaluate(() => document.fonts.ready);
  // The figures mount after load; a page without fragments has none to wait for.
  await page.waitForFunction(() => {
    const f = [...document.querySelectorAll("[data-nts-fragment]")];
    return f.every((x) => x.classList.contains("is-live"));
  });
}

export async function scrollTo(page, settle, y) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await settle(page);
}

// Scroll so the element's top edge sits at `frac` of the viewport height.
export async function putTop(page, settle, selector, frac) {
  await page.evaluate(([s, f]) => {
    const el = document.querySelector(s);
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - innerHeight * f, behavior: "instant" });
  }, [selector, frac]);
  await settle(page);
}

// Parse a computed `scale` ("none" is 1).
export const scaleOf = (s) => (s === "none" ? 1 : parseFloat(s));
