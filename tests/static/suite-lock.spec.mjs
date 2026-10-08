import { test, expect } from "../helpers/fixtures.mjs";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const wrapper = path.join(root, "tools/run-suite.mjs");

// A stand-in for the suite: records when it started and ended.
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nts-lock-"));
  const fixture = path.join(dir, "fixture.mjs");
  fs.writeFileSync(
    fixture,
    `import fs from "node:fs";
const out = process.argv[2];
fs.writeFileSync(out + ".start", String(Date.now()));
await new Promise((r) => setTimeout(r, 700));
fs.writeFileSync(out + ".end", String(Date.now()));`
  );
  return { dir, fixture, lock: path.join(dir, "suite.lock") };
}

function run({ dir, fixture, lock }, name) {
  const out = path.join(dir, name);
  const child = spawn(process.execPath, [wrapper], {
    env: {
      ...process.env,
      NTS_SUITE_LOCK_FILE: lock,
      NTS_SUITE_CMD: `"${process.execPath}" "${fixture}" "${out}"`,
    },
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const done = new Promise((resolve) => child.on("close", (code) => resolve({ code, output, out })));
  return { child, done };
}

const stamp = (f) => Number(fs.readFileSync(f, "utf8"));

test("Q1: two wrapper runs never overlap, and the second says it waits", async () => {
  const s = setup();
  const a = run(s, "a");
  await new Promise((r) => setTimeout(r, 250));
  const b = run(s, "b");
  const [ra, rb] = await Promise.all([a.done, b.done]);
  expect([ra.code, rb.code]).toEqual([0, 0]);
  expect(ra.output).not.toMatch(/waiting for another suite run/);
  expect(rb.output).toMatch(/waiting for another suite run \(pid \d+, worktree .+, since .+\)/);
  expect(stamp(rb.out + ".start")).toBeGreaterThanOrEqual(stamp(ra.out + ".end"));
});

test("Q2: a lock held by a dead pid is taken over", async () => {
  const s = setup();
  const dead = spawn(process.execPath, ["-e", ""]);
  await new Promise((r) => dead.on("close", r));
  fs.writeFileSync(s.lock, JSON.stringify({ pid: dead.pid, worktree: "gone", since: new Date().toISOString() }));
  const r = await run(s, "c").done;
  expect(r.code).toBe(0);
  expect(r.output).not.toMatch(/waiting/);
  expect(fs.existsSync(s.lock)).toBe(false);
});

test("Q3: the lock is released when the run is interrupted", async () => {
  const s = setup();
  const a = run(s, "d");
  await new Promise((r) => setTimeout(r, 300));
  a.child.kill("SIGINT");
  await a.done;
  expect(fs.existsSync(s.lock)).toBe(false);
});
