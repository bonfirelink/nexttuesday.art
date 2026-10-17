// N1-N3. Source lint over site/: motion animates only what the compositor can run, figure
// captions carry no final period, and every script parses.
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
