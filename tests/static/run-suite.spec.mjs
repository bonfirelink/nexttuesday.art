import { test, expect } from "../helpers/fixtures.mjs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const wrapper = path.join(root, "tools/run-suite.mjs");

function run(cmd, args = []) {
  const child = spawn(process.execPath, [wrapper, ...args], {
    env: { ...process.env, NTS_SUITE_CMD: cmd },
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const done = new Promise((resolve) => child.on("close", (code) => resolve({ code, output })));
  return { child, done };
}

test("R1: NTS_SUITE_CMD runs with the wrapper's arguments", async () => {
  const r = await run(`"${process.execPath}" -e "console.log('args:' + process.argv.slice(1).join(','))"`, ["a", "b"]).done;
  expect(r.code).toBe(0);
  expect(r.output).toContain("args:a,b");
});

test("R2: the child's exit code is the wrapper's", async () => {
  const r = await run(`"${process.execPath}" -e "process.exit(3)"`).done;
  expect(r.code).toBe(3);
});

test("R3: an interrupt reaches the child", async () => {
  const a = run(`"${process.execPath}" -e "setTimeout(()=>{},60000)"`);
  await new Promise((r) => setTimeout(r, 400));
  a.child.kill("SIGINT");
  const r = await a.done;
  expect(r.code).not.toBe(0);
});
