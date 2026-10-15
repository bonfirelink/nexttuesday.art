// K2. The figure's fallback tones in philo.js (used before the host's custom properties
// are read) are the PHILO world's tones in philo.css.
import { test, expect } from "../helpers/fixtures.mjs";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../../site/_nts/worlds/${f}`, import.meta.url), "utf8");

test("K2 philo.js's fallback tones are philo.css's --penrose-* tokens", () => {
  const css = read("philo.css"), js = read("philo.js");
  const fallback = js.match(/let col = \{ top: "(#[0-9a-f]{6})", side: "(#[0-9a-f]{6})", dark: "(#[0-9a-f]{6})", ground: "(#[0-9a-f]{6})" \}/);
  expect(fallback, "philo.js's fallback col").toBeTruthy();
  const root = css.match(/--penrose-top: (#[0-9a-f]{6});\s*--penrose-side: (#[0-9a-f]{6});\s*--penrose-dark: (#[0-9a-f]{6});\s*--penrose-ground: (#[0-9a-f]{6});/);
  expect(root, "philo.css's :root tones").toBeTruthy();
  expect(fallback.slice(1)).toEqual(root.slice(1));
});
