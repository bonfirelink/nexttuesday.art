---
name: nexttuesday-art-perf
description: Measure smoothness of nexttuesday.art. Use when the site is laggy, stutters or feels janky, or a change touches scroll or animation; runs the perf guards and compares frame pacing before and after under CPU throttle.
---

# Measure smoothness

Output is numbers for the working branch (`eclipse` today, `main` later) against the change, never adjectives. The principle under every verdict: motion runs on the compositor (transform, opacity) and nothing reads layout per frame.

## Steps

1. **Guards.** `npm run test:perf` in the change's worktree (needs `npm ci` once, inside the dev shell for `$CHROMIUM`). Done when it prints pass/fail for P1-P3 at both viewports. A failure names the count that moved; read the attached `p1.json`, `p2.json`, `p3.json` (HTML report: `npx playwright show-report`; failures also under `test-results/`; `PERF_LOG=1` prints P2's per-run paint hits), then go to step 2 with the failing page.
2. **Bench.** Both previews must answer 200 (`devshell status`; `devshell down` then `devshell up` revives one that exited). From the change's worktree:
   ```
   node tools/bench.mjs before=<working-branch preview url> after=<this worktree's preview url> runs=3
   ```
   `paths=/,/embers/` narrows the pages (default: home and the three worlds); `views=phone` or `views=desktop` narrows the viewports; `throttle=4` is the CPU slowdown; `--json` for machine output; `--trace` writes one Chrome trace per run into a fresh temp directory (`--trace=<absolute dir>` to choose; keep it outside the repo). Narrow with `paths=` and `views=` first: a full run is 48 traces. Done when every path x view row exists for both labels with 2+ runs. The bench scrolls top to bottom at a fixed speed and reports medians.
3. **Read the table.**
   - `p50`/`p95` are rAF intervals in ms; 16.7 is 60 fps. `long` counts frames over 50 ms.
   - `paints/f` and `layouts/f` are main-thread counts per frame. Motion on the compositor shows near 0 for both. A change that adds layouts per frame, or paints per frame on a page that had none, is a regression whatever the intervals say.
   - `busyMs`/`busy%` is main-thread time. Headless Chromium barely moves it when the work already sits on the compositor, so a flat busy% does not clear a change: confirm with paints/layouts per frame and a trace.
   - Two runs of identical code differ by noise; rerun with `runs=5` before calling a gap real. Take a gap seriously when it shows in p95 or long frames on more than one path.
4. **Trace when counts do not explain it.** Rerun the affected path with `--trace`, open the file in Perfetto (ui.perfetto.dev) or `chrome://tracing`, and look at the renderer main thread (Paint, Layout, Recalculate Style, script) and the compositor thread. Name the element or script behind the cost. For paint attribution by element, `trace()` in `tests/helpers/trace.mjs` takes CSS selectors and returns paints per selector.
5. **Report.** The before/after rows for each path and view that changed, the guards' result, and the trace finding if any. A claim names its number: "home phone p95 66.7 to 33.3 ms, long frames 16 to 2".

## Limits

Absolute p50/p95 are inflated by tracing and throttle: compare before against after, never against a target. The live site does not resolve on this machine, so it cannot be a label URL. Real iPhone and Android GPUs, Safari and Firefox cannot be measured here; throttled desktop Chromium stands in for a slow phone. State that in the report and list the pages to scroll on a phone.
