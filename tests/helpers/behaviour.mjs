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
  await page.evaluate((y) => { window.scrollTo({ top: y, behavior: "instant" }); }, y);
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

// The PHILO figure's tip cube, which a cube always fills at rest: centred, this share of the host's height down.
export const TIP_Y = 0.17;

// Records the yaw and pitch of every paint of the PHILO figure from now on in
// window.__paints; assumes one PHILO figure on the page (the module's paint(ctx, col, t, yaw, pitch, …)).
export const recordPaints = (page) => page.evaluate(() => {
  const B = window.NTS.cubes, paint = B.paint;
  window.__paints = [];
  if (!B.__wrapped) {
    B.__wrapped = true;
    B.paint = (...a) => { window.__paints.push({ yaw: a[3], pitch: a[4] }); return paint(...a); };
  }
});
export const paints = (page) => page.evaluate(() => window.__paints);

// The client point at the centre of place `place` (0 to 8, the top turn) of the PHILO page figure
// drawn at the pose (yaw, pitch) in rad, at rest.
export const figurePoint = (page, place, yaw = 0, pitch = 0) => page.evaluate(([place, yaw, pitch]) => {
  const host = document.querySelector(".nts-penrose"), r = host.querySelector("canvas").getBoundingClientRect(), B = window.NTS.cubes;
  const sc = (Math.min(host.clientWidth, host.clientHeight) * B.REST.page) / (2 * B.REACH);
  const L = B.frame(0.5, yaw, pitch, 0, 0, sc, { top: "#fff", side: "#888", dark: "#000", ground: "#fff" }).layers.at(-1);
  const hull = L.items.find((it) => it.c.h === place).hull;
  return [r.left + r.width / 2 + hull.reduce((s, p) => s + p[0], 0) / hull.length, r.top + r.height / 2 + hull.reduce((s, p) => s + p[1], 0) / hull.length];
}, [place, yaw, pitch]);
// The pose of the latest paint recorded by recordPaints, [yaw, pitch] in rad.
export const lastPose = async (page) => { const p = (await paints(page)).at(-1); return [p.yaw, p.pitch]; };
