// L3d. The committed stills are what tools/gen-stills.mjs bakes now: the live solid's start
// pose (POSE) at the live zoom, 52 columns on the page and in a fragment (the page's
// first row dropped, as gen-stills drops it for sync's newline).
import { readFileSync } from "node:fs";
import { test, expect } from "../helpers/fixtures.mjs";

const module = { exports: {} };
new Function("module", readFileSync(new URL("../../site/_nts/worlds/ascii.js", import.meta.url), "utf8"))(module);
const ascii = module.exports, fig = ascii.figure("tetra");
const part = (name) => readFileSync(new URL(`../../site/_nts/parts/${name}`, import.meta.url), "utf8");
const bake = (cols, span) => ascii.render(fig, cols, Math.round(cols * 0.6), 0.6, ascii.POSE, ascii.fit(fig, span));

test("L3d the page's still is the first live frame as baked now", () => {
  expect(part("still-intersect.txt")).toBe(bake(52, ascii.SPAN.hero).replace(/^[^\n]*\n/, ""));
});
test("L3d the fragment's still is its first live frame as baked now", () => {
  expect(part("still-intersect-sm.txt")).toBe(bake(52, ascii.SPAN.fragment));
});
