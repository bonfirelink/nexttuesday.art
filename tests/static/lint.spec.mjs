// N1-N5. Source lint over site/: motion animates only what the compositor can run, figure
// captions carry no final period, every script parses, every line of the home emblem and
// of the beads takes its width from a --line-* token, and the band keylines are that token.
import { test, expect } from "../helpers/fixtures.mjs";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../site");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = walk(site);
const rel = (f) => path.relative(site, f).split(path.sep).join("/");
const norm = (s) => s.replace(/\s+/g, " ").trim();

// Walks CSS text and yields { selector, props: [[name, value]] } per declaration block; inside
// @keyframes the selector is "@keyframes <name>" and every frame's declarations land in it.
function* blocks(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack = [];
  let buf = "";
  const frames = new Map();
  for (const ch of css) {
    if (ch === "{") {
      stack.push(norm(buf));
      buf = "";
    } else if (ch === "}") {
      const sel = stack.pop();
      const inKeyframes = stack.some((s) => /^@(-\w+-)?keyframes/.test(s));
      if (buf.trim() && sel !== undefined) {
        const key = inKeyframes ? stack.find((s) => /^@(-\w+-)?keyframes/.test(s)) : sel;
        const props = buf.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
          const i = d.indexOf(":");
          return [d.slice(0, i).trim(), d.slice(i + 1).replace(/\s*!important\s*$/, "").trim()];
        });
        if (!frames.has(key)) frames.set(key, []);
        frames.get(key).push(...props.filter(([n]) => n));
      }
      buf = "";
    } else buf += ch;
  }
  for (const [selector, props] of frames) yield { selector, props };
}

// Top-level comma split (a comma inside parentheses belongs to the value).
const split = (v) => {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of v) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
};

// `visibility` is allowed only in a declaration that also animates opacity: it then flips at the
// end of a 0s step beside the fade. Alone it is a discrete property that can hide a layout change.
const OK = (p, list) =>
  /^(transform|opacity|translate|scale|rotate|none)$/.test(p) || p.startsWith("--") ||
  (p === "visibility" && list.includes("opacity"));

// Top-level whitespace split (whitespace inside parentheses belongs to the token).
const tokens = (s) => {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
};
const NOT_PROPERTY = /^([+-]?[\d.]+m?s|ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|normal|allow-discrete)$/i;
const propsOf = (name, value) => {
  if (/transition-property$/.test(name)) return split(value);
  // shorthand: in each comma item the property is the first token that is not a time, an
  // easing keyword or a function (steps(), cubic-bezier(), var())
  return split(value).map((item) => tokens(item).find((t) => !NOT_PROPERTY.test(t) && !t.includes("("))).filter(Boolean);
};

// Transitions and keyframes that animate a paint property, each with why it is acceptable.
// A selector is matched as written in the stylesheet (whitespace collapsed); an entry that no
// longer matches fails N1, so this list stays in step with the CSS.
const NTS = "_nts/nts.css", ORRERY = "_nts/orrery.css";
const BLEED = 'html[data-bleed-state="in"] body > :not(main, footer, .nts-night)';
const ALLOW = [
  [NTS, "a", ["color", "text-decoration-color"], "a link's hover tint: a small text colour change"],
  [NTS, ".nts-header", ["border-color"], "the header's bottom rule appears once the page scrolls: a 1px line"],
  [NTS, ".nts-nav a", ["color"], "a nav link's current and hover tint: a small text colour change"],
  [NTS, ".lift", ["border-color", "background-color"], "the lifted card's border and ground take the hover tint beside its transform"],
  [NTS, ".js [data-nts-draw].is-in .nts-sigil use, .js .nts-sigil[data-nts-draw].is-in use, .js [data-nts-draw].is-in .drawn, .js [data-nts-draw].is-in .drawn *", ["stroke-dashoffset"], "the draw-in of a line figure: a stroke being drawn has no transform equivalent"],
  [NTS, BLEED, ["color", "background-color", "border-color", "box-shadow", "text-shadow", "fill", "stroke"], "the parts outside the hero crossfade to the new world's palette once the bleed disc covers them"],
  [ORRERY, ".orrery .eye", ["fill"], "the stop button's eye lights to bone on hover: one small fill"],
  [ORRERY, "@keyframes bloom", ["clip-path"], "a world's ground blooms out from the body as it scrolls into view (scroll-driven, so it never takes the scroll)"],
];
const allowed = new Set(ALLOW.flatMap(([f, sel, ps]) => ps.map((p) => `${f} | ${sel} | ${p}`)));

const used = new Set();
function offences() {
  const bad = new Set();
  for (const f of files.filter((f) => f.endsWith(".css"))) {
    const css = readFileSync(f, "utf8");
    for (const { selector, props } of blocks(css)) {
      for (const [name, value] of props) {
        let list = [];
        if (selector.startsWith("@") && /keyframes/.test(selector)) {
          if (/^(animation-|--)/.test(name)) continue;
          list = [name];
        } else if (/^(-\w+-)?transition(-property)?$/.test(name)) list = propsOf(name, value);
        for (const p of list) {
          if (OK(p, list)) continue;
          const key = `${rel(f)} | ${selector} | ${p}`;
          if (allowed.has(key)) used.add(key);
          else bad.add(key);
        }
      }
    }
  }
  return [...bad];
}

test("N1 transitions and keyframes animate only transform, opacity and custom properties (CSS files only: no inline styles or script animation)", () => {
  const bad = offences();
  expect(bad, "a non-compositor property is animated; use transform/opacity, or add it to ALLOW with its reason").toEqual([]);
  const stale = [...allowed].filter((k) => !used.has(k));
  expect(stale, "ALLOW entries that no longer match the stylesheets").toEqual([]);
});

// The label's own "fig. 1." keeps its period; the caption after it ends without one.
test("N2 figure captions end without a period", () => {
  const caps = [];
  for (const f of files.filter((f) => f.endsWith(".html"))) {
    for (const m of readFileSync(f, "utf8").matchAll(/<p\b[^>]*class="[^"]*\bfig\b[^"]*"[^>]*>([\s\S]*?)<\/p>/g)) {
      caps.push({ f: rel(f), text: m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() });
    }
  }
  expect(caps.length, "figure captions found").toBeGreaterThan(0);
  for (const { f, text } of caps) {
    const body = text.replace(/^fig\. \d+\.\s*/, "");
    expect(body, `${f}: caption after the label`).not.toBe("");
    expect(body.endsWith("."), `${f}: "${text}" ends with a period`).toBe(false);
  }
});

test("N3 every script under site/ parses", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lint-"));
  try {
    for (const f of files.filter((f) => /\.m?js$/.test(f))) {
      const src = readFileSync(f, "utf8");
      if (/^\s*(import|export)\s/m.test(src) || f.endsWith(".mjs")) {
        const tmp = path.join(dir, "m.mjs");
        writeFileSync(tmp, src);
        const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
        expect(r.status, `${rel(f)}: ${r.stderr}`).toBe(0);
      } else {
        let err = "";
        try { new vm.Script(src, { filename: rel(f) }); } catch (e) { err = String(e); }
        expect(err, `${rel(f)} does not parse`).toBe("");
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// N4's scope, the lines of the home emblem and of the beads: their markup (the emblem parts,
// the sigil sprite, and every page's nts:sprite and nts:emblem regions sync copies them
// into); every stroke-width in nts.css and orrery.css; the borders and gradient rings in
// LINE_RULES; and any world kit's stroke-width on the emblem or a sigil (.orrery, .nts-sigil).
// The worlds' own figures are not in it.
const NTS_CSS = readFileSync(path.join(site, NTS), "utf8");
const LINE_TOKENS = new Set([...NTS_CSS.matchAll(/(--line-[\w-]+)\s*:/g)].map((m) => m[1]));
const LINE_MARKUP = ["_nts/sigils.svg", "_nts/parts/emblem-core.html", "_nts/parts/emblem-orbits.html"];
const REGIONS = /<!-- nts:(sprite|emblem)\b[^>]*-->([\s\S]*?)<!-- \/nts:\1 -->/g;
// the ink ring and the colour bands are fills drawn as wide strokes, not lines (N5 holds their keylines)
const BANDS = /<svg class="e-ly (e-key|e-bands)"[\s\S]*?<\/svg>/g;
// [file, selector, property]: the CSS lines that are not strokes (a border, a gradient's ring)
const LINE_RULES = [
  [ORRERY, ".orrery .e-pulse", "border"],
  [ORRERY, ".orrery .bead::after", "border"],
  [ORRERY, ".bead-face", "background"],
  [ORRERY, ".bead-face::after", "background"],
];
const usesToken = (v) => {
  const refs = [...v.matchAll(/var\((--line-[\w-]+)\)/g)].map((m) => m[1]);
  return refs.length > 0 && refs.every((r) => LINE_TOKENS.has(r));
};

test("N4 every line of the home emblem and of the beads takes its width from a --line-* token in nts.css", () => {
  const bad = [];
  const sources = LINE_MARKUP.map((f) => [f, readFileSync(path.join(site, f), "utf8")]);
  for (const f of files.filter((f) => f.endsWith(".html"))) {
    for (const m of readFileSync(f, "utf8").matchAll(REGIONS)) sources.push([`${rel(f)} (nts:${m[1]})`, m[2]]);
  }
  for (const [where, text] of sources.map(([w, t]) => [w, t.replace(BANDS, "")])) {
    for (const m of text.matchAll(/\sstroke-width="([^"]*)"/g)) bad.push(`${where}: stroke-width="${m[1]}"`);
    for (const m of text.matchAll(/stroke-width\s*:\s*([^;"]+)/g)) if (!usesToken(m[1])) bad.push(`${where}: stroke-width:${m[1]}`);
  }
  for (const f of [NTS, ORRERY]) {
    for (const { selector, props } of blocks(readFileSync(path.join(site, f), "utf8"))) {
      for (const [name, value] of props) {
        if (name === "stroke-width" && !usesToken(value)) bad.push(`${f} | ${selector} | stroke-width: ${value}`);
      }
    }
  }
  for (const f of files.filter((f) => /\/_nts\/worlds\/[^/]+\.css$/.test(f))) {
    for (const { selector, props } of blocks(readFileSync(f, "utf8"))) {
      if (!/\.orrery|\.nts-sigil/.test(selector)) continue;
      for (const [name, value] of props) {
        if (name === "stroke-width" && !usesToken(value)) bad.push(`${rel(f)} | ${selector} | stroke-width: ${value}`);
      }
    }
  }
  for (const [f, sel, prop] of LINE_RULES) {
    const found = [...blocks(readFileSync(path.join(site, f), "utf8"))].filter((b) => split(b.selector).includes(sel)).flatMap((b) => b.props).filter(([n]) => n === prop);
    expect(found.length, `${f} | ${sel} | ${prop} not found`).toBeGreaterThan(0);
    for (const [, value] of found) if (!usesToken(value)) bad.push(`${f} | ${sel} | ${prop}: ${value}`);
  }
  expect(bad, "raw line widths (name the line in nts.css's Tokens, then use the token)").toEqual([]);
});

test("N5 the lines drawn as geometry are their tokens: the bands spaced by --line-keyline, the marks --line-tick* and --line-bezel-5 wide", () => {
  const token = (name) => Number(NTS_CSS.match(new RegExp(`^\\s*--${name}:\\s*([\\d.]+)\\s*;`, "m"))?.[1]);
  const keyline = token("line-keyline");
  expect(keyline, "--line-keyline in nts.css").toBeGreaterThan(0);
  const core = readFileSync(path.join(site, "_nts/parts/emblem-core.html"), "utf8");
  const layer = (cls) => core.match(new RegExp(`<svg class="e-ly ${cls}[" ][\\s\\S]*?</svg>`))?.[0] ?? "";
  // [inner, outer] edge of each stroked ring in a layer
  const rings = (cls) => [...layer(cls).matchAll(/<circle r="([\d.]+)"[^>]*?stroke-width="([\d.]+)"/g)].map((m) => [Number(m[1]) - Number(m[2]) / 2, Number(m[1]) + Number(m[2]) / 2]);
  const [key] = rings("e-key"), bands = rings("e-bands");
  expect(bands.length, "the three bands").toBe(3);
  // the ink ring runs from the dial's edge to the rim; a keyline before, between and after the bands
  const edges = [key[0], ...bands.flat(), key[1]];
  for (let i = 0; i < edges.length; i += 2) expect(edges[i + 1] - edges[i], `keyline ${i / 2 + 1}`).toBeCloseTo(keyline, 2);
  // a mark is a quad M a L b L c L d Z: its width is a to d
  const widths = (cls) => [...layer(cls).matchAll(/M(-?[\d.]+) (-?[\d.]+)L[^L]+L[^L]+L(-?[\d.]+) (-?[\d.]+)Z/g)].map((m) => Math.hypot(m[1] - m[3], m[2] - m[4]));
  for (const [cls, names] of [["e-marks", ["line-tick", "line-tick-5", "line-tick-15"]], ["e-bands", ["line-tick", "line-bezel-5"]]]) {
    const want = names.map(token), got = widths(cls);
    expect(got.length, `${cls} marks`).toBeGreaterThan(0);
    for (const [i, w] of want.entries()) expect(w, `--${names[i]}`).toBeGreaterThan(0);
    expect(got.filter((w) => !want.some((t) => Math.abs(w - t) < 0.02)).map((w) => w.toFixed(3)), `${cls}: marks of no token's width`).toEqual([]);
    for (const [i, t] of want.entries()) expect(got.some((w) => Math.abs(w - t) < 0.02), `${cls}: a mark --${names[i]} wide`).toBe(true);
  }
});
