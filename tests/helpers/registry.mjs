// The initiatives' registry (`initiatives` in site/_nts/content/site.json),
// for tests that walk every page, world or body: a new entry is covered by
// them without editing the tests.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const SITE = JSON.parse(readFileSync(path.join(root, "site/_nts/content/site.json"), "utf8"));
export const INITIATIVES = SITE.initiatives || [];
// the entries that are worlds (a kit, a window on the home), not NTS pages
export const WORLD_ENTRIES = INITIATIVES.filter((i) => i.world !== "nts");
// the bodies on the home's orrery, the world keys, the world pages' slugs
export const BODIES = INITIATIVES.map((i) => i.body);
export const WORLD_KEYS = WORLD_ENTRIES.map((i) => i.world);
export const WORLD_SLUGS = WORLD_ENTRIES.map((i) => i.slug);
