// Rects, centres and CSS-value probes, read in the page (CSS px, viewport coordinates).

/** The rect of the first match, with its centre; null when nothing matches. */
export function rectOf(page, selector, scope) {
  return page.evaluate(
    ([sel, scope]) => {
      const root = scope ? document.querySelector(scope) : document;
      const el = root && root.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    },
    [selector, scope ?? null]
  );
}

/** Distance between two centres, as [dx, dy] (b minus a). */
export function centreOffset(a, b) {
  return [b.cx - a.cx, b.cy - a.cy];
}

/**
 * A CSS length or expression resolved to px, in the context of `scopeSelector`
 * (so var(--ring) and percentages see that element's custom properties and
 * parent): a probe element is sized to it, read and removed.
 */
export function probeLength(page, scopeSelector, expression, property = "width") {
  return page.evaluate(
    ([sel, expr, prop]) => {
      const host = document.querySelector(sel);
      const p = document.createElement("div");
      p.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:0;${prop}:${expr}`;
      host.appendChild(p);
      const v = parseFloat(getComputedStyle(p)[prop]);
      p.remove();
      return v;
    },
    [scopeSelector, expression, property]
  );
}

/** Load a page, wait for its fonts and for each selector to exist and gain `.is-live` when `live` is set. */
export async function openPage(page, path, { live = [] } = {}) {
  await page.goto(process.env.NTS_BASE + path);
  await page.evaluate(() => document.fonts.ready);
  for (const sel of live) await page.waitForSelector(`${sel}.is-live`, { state: "attached" });
}
