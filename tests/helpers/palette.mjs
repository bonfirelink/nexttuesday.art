// Reading the palette in a page: the tokens of nts.css section 1 resolved
// to computed colours, computed styles, focus rings and WCAG contrast.

export const TOKENS = ["--pal-beige", "--pal-plywood", "--pal-ink", "--pal-bone", "--pal-bone-muted", "--pal-muted", "--pal-voice",
  "--code-embers", "--code-philo", "--code-intersect", "--code-events"];

// Each token resolved to the computed rgb() string a property would carry.
export const tokens = (page) =>
  page.evaluate((names) => {
    const probe = document.createElement("i");
    probe.style.transition = "none"; // body children crossfade during the bleed
    document.body.appendChild(probe);
    const out = {};
    for (const n of names) {
      probe.style.color = `var(${n})`;
      out[n] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  }, TOKENS);

// [r, g, b, a] of a computed colour: rgb()/rgba(), or color(srgb …), which color-mix() computes to.
export const rgb = (s) => {
  const n = s.replace(/^color\(srgb/, "").match(/[\d.]+/g).map(Number);
  return s.startsWith("color(srgb") ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n;
};
// WCAG contrast of two computed colours, the first composited on the second.
export function contrast(fg, bg) {
  const [r, g, b, a = 1] = rgb(fg), [R, G, B] = rgb(bg);
  const mix = [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
  const lum = (c) => {
    const [x, y, z] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * x + 0.7152 * y + 0.0722 * z;
  };
  const [l1, l2] = [lum(mix), lum([R, G, B])].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

export const style = (page, sel, prop, pseudo = null) =>
  page.evaluate(([s, p, ps]) => {
    const el = document.querySelector(s);
    if (!el) throw new Error(`no ${s}`);
    return getComputedStyle(el, ps)[p];
  }, [sel, prop, pseudo]);

// Keyboard-focus an element (so :focus-visible applies) and read its outline colour.
export async function focusRing(page, sel, ringSel = sel) {
  await page.keyboard.press("Tab");
  await page.evaluate((s) => document.querySelector(s).focus(), sel);
  return style(page, ringSel, "outlineColor");
}

// A translucent colour flattened onto its ground, as an rgb() string.
export function composite(c, ground) {
  const [r, g, b, a = 1] = rgb(c), [R, G, B] = rgb(ground);
  return `rgb(${Math.round(r * a + R * (1 - a))}, ${Math.round(g * a + G * (1 - a))}, ${Math.round(b * a + B * (1 - a))})`;
}

// The legacy NTS palette (coral, coral-ink and its deeper red, gold, cobalt,
// the violet ink and its soft ink and lines, paper-2), as 0-255 triplets.
export const LEGACY = ["240,74,58", "196,43,31", "180,38,27", "214,58,43", "245,179,27", "47,63,217", "207,203,242",
  "26,21,48", "91,85,119", "235,225,204"];

// Every colour the elements under `root` (and their ::before/::after) compute
// to, in the properties that paint, that is one of the LEGACY triplets:
// [{ el, prop, value }]. rgb()/rgba() and color(srgb …) both count.
export const legacyColours = (page, root = "html") =>
  page.evaluate(([sel, legacy]) => {
    const PROPS = ["color", "backgroundColor", "backgroundImage", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
      "outlineColor", "textDecorationColor", "fill", "stroke", "boxShadow", "textShadow", "caretColor", "scrollbarColor", "filter"];
    const triplets = (s) => (String(s).match(/rgba?\([^)]*\)|color\(srgb[^)]*\)/g) || []).map((c) => {
      const n = c.replace(/^color\(srgb/, "").match(/[\d.]+/g).map(Number);
      return (c.startsWith("color(") ? n.slice(0, 3).map((v) => Math.round(v * 255)) : n.slice(0, 3)).join(",");
    });
    const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList.length ? "." + [...el.classList].join(".") : "");
    const out = [];
    for (const r of document.querySelectorAll(sel)) {
      for (const el of [r, ...r.querySelectorAll("*")]) {
        for (const ps of [null, "::before", "::after"]) {
          const cs = getComputedStyle(el, ps);
          if (ps && cs.content === "none") continue;
          for (const p of PROPS) if (triplets(cs[p]).some((t) => legacy.includes(t))) out.push({ el: name(el) + (ps || ""), prop: p, value: cs[p] });
        }
      }
    }
    return out;
  }, [root, LEGACY]);

// Any CSS colour expressions resolved as computed colours, keyed as given.
export const resolve = (page, exprs) =>
  page.evaluate((list) => {
    const probe = document.createElement("i");
    probe.style.transition = "none"; // body children crossfade during the bleed
    document.body.appendChild(probe);
    const out = {};
    for (const x of list) { probe.style.color = x; out[x] = getComputedStyle(probe).color; }
    probe.remove();
    return out;
  }, exprs);
