# Tests and publishing

How the suites are run and what they hold, then how `site` is published. How
the site itself is built is in the root [INTERNALS.md](../INTERNALS.md).

## Checks before a change lands

`npm ci` once per checkout. Tiers are tags in test titles
(`playwright.config.mjs`); each spec file belongs to one project, and each
runs against a headless Chromium (`$CHROMIUM`) and an offline copy of the
fonts.

- `npm test`: the static and fast tiers, everything but `@slow` and `@perf`.
  About 2 minutes.
- `npm run test:publish`: all of it, adding the `@slow` sweeps and the `@perf`
  guards (frame pacing and paint counts against `tests/fixtures/perf-baselines.json`).
  About 7 minutes.
- `npm run test:perf`: the `@perf` guards alone, without their setup project.

`tests/static/lint.spec.mjs` (N1 to N6) lints `site/`: CSS transitions and
keyframes animate only transform, opacity and custom properties (the few
paint-property exceptions are listed in the spec with their reasons),
figure captions end without a period, every script parses, every line of
the home emblem and of the beads takes a `--line-*` token (N4; the colour
bands are fills drawn as wide strokes, so they are left out), and the
lines drawn as geometry are their tokens: every band gap is `--line-keyline`,
every mark `--line-tick*` or `--line-bezel-5` wide (N5). Every emblem
`--line-*` token in eu is a `var()` of one of the three `--weight-*`
values, except a short listed set with reasons (the seam, the ring's dots)
(N6).

The npm scripts go through `tools/run-suite.mjs`. Playwright uses 4 workers
(`--workers` overrides). The timing tests fail on a loaded machine: run one
suite at a time.

The tests cover: phone widths 320, 360 and 390 with no
horizontal overflow, and a clean console with no 404s (the page walk in
`tests/static`); the bleed-in sequence on arrival, scroll and back
(`tests/transitions`); the orb morph between pages (`tests/transitions`);
hero, figure and card geometry (`tests/layout`). By hand: the
contrast audit over every text node (all AA, nothing under 11px, settled
on every page), and looking at screenshots from the preview
(the site served from the checkout).

Tests that open a fresh browser context use `coldPage`
(`tests/helpers/cold.mjs`); the font cache and the external-request block
come from one installer in `tests/helpers/fixtures.mjs`.

## Publishing

`site/` is published as the `site` branch, which GitHub Pages serves:
`git subtree split --prefix=site` from the branch being published gives a
commit that fast-forwards `site`. `tools/publish.sh` does the split, the
fast-forward push and the live check; it runs no test suite of its own, so the
suite (`npm run test:publish`) is run on the commit beforehand. The live check
(`--live-only`, also run after the push) passes once GitHub's latest Pages
build is `built` for the commit `origin/site` points at and every page answers
200.

`tools/publish.sh` is the only way `site` moves, fast-forward only, never with
`--force`. The branch it splits is `main`; `NTS_BRANCH` overrides it.
`--dry-run` prints the split SHA without pushing, and `git diff origin/site
<split sha>` (after `git fetch origin site`) is what a publish would change.
An unchanged `site/` exits 0 with "nothing to publish". The split goes through
a temporary local branch `site-publish`, deleted at the start and end of each
run, so that name is not used for anything else.

The script refuses a dirty working branch, the working branch (`main` or
`NTS_BRANCH`) not checked out in any worktree, that branch moving during the
checks, `site` checked out in a worktree, a diverged `site` and a failed sync
check. `site` is never edited directly; fix the cause on the working branch.

The post-push poll retries 10 times, 30 s apart, because the Pages build can
lag; `--live-only` is one pass, so rerun it before a timeout counts as failed.
The domain may not resolve on a dev host: the script pins the address; any
other live curl needs `--resolve nexttuesday.art:443:185.199.108.153`.
