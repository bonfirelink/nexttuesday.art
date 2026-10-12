// The page's ASCII canvas overhang, read from intersect.css (one place): the share of the
// pre's width it reaches past the pre on each side, across (x) and down (y), and the
// canvas's size over the pre's.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../site/_nts/worlds/intersect.css", import.meta.url), "utf8");
const m = /pre\[data-nts-ascii\] > canvas \{ inset: -([\d.]+)% -([\d.]+)%; width: ([\d.]+)%; max-width: none; height: ([\d.]+)%; \}/.exec(css);
if (!m) throw new Error("intersect.css: the page's canvas overhang rule not found");
export const OVERHANG = { y: +m[1] / 100, x: +m[2] / 100, width: +m[3] / 100, height: +m[4] / 100 };
