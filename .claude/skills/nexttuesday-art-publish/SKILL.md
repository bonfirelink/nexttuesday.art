---
name: nexttuesday-art-publish
description: Publish the working branch to GitHub Pages (the `site` branch), review it first and verify the live site. Use only when a publish is explicitly requested ("publish"); never on your own initiative.
---

# Publish

GitHub Pages serves the `site` branch, a subtree split of `site/` from the working branch (`eclipse` now, `main` later; the script reads `NTS_BASE`, default `eclipse`). Publishing is public and `site` only moves forward, so the gate below is the first step.

## Gate

Run this only when a publish is explicitly requested in the current conversation. A merged change, a green suite or an approved preview does not request one. Nothing else publishes: not a checker, not another skill, not a handoff note.

## Steps

1. **Review.** Spawn a `checker` on everything the working branch has that `origin/site` lacks: `git fetch origin site`, then run `tools/publish.sh --dry-run` and take the split SHA it prints; the diff is `git diff origin/site <split sha>`. The reviewer makes no branch named `site-publish`, which the script deletes. The brief:
   - gives a turn budget (reviews have hit 25-turn limits: say "40 turns, report findings found so far at 30");
   - has the checker run `npm run test:publish` itself on the exact commit, not trust a builder's report;
   - asks for one verdict: PUBLISH, WITH NOTES, or STOP.

   Done when the verdict is in hand. STOP ends the run: report the findings. WITH NOTES goes to the requester before pushing.
2. **Dry run.** `tools/publish.sh --dry-run` runs every check and the split and moves nothing. A dry run then a real run runs the suite twice; that is accepted. Done when it ends with "dry run: site not moved" or "nothing to publish" (then stop and say so). A refusal (dirty working branch, `site` checked out in a worktree, a diverged `site`, a red suite) is a blocker: report it, fix nothing on `site`.
3. **Publish.** Always pass a `--marker` or `--gone`: without one the script warns that the 200 checks may be hitting the old site. Pick one (text only the new version has) or `--gone` (text only the old one has) from the diff, then run `tools/publish.sh --marker '<text>'`. It pushes `site` fast-forward only, polls the live site (30 s, 10 tries), checks 200 on the five pages and waits for the Pages build to reach `built` (it fails on `errored`). Done when the script exits 0. If the marker never appears, rerun `tools/publish.sh --live-only --marker '<text>'` before calling it failed; the Pages build can lag.
4. **Report and log.** Record the published SHA (the script prints it) where the project keeps its log, and tell the reviewer, in the same message:
   - the SHA and what changed, in one or two lines;
   - what this machine could not check: WebKit and iPhone Safari, Firefox, the real touch and scroll feel, and anything else the diff touches that headless Chromium cannot judge, each as something to look at on the phone.

## Constraints

- `tools/publish.sh` is the only way `site` moves. Never push with `--force`; when the script reports that `site` diverged, stop and report.
- The machine cannot resolve `nexttuesday.art`; the script pins the address. Run any other live curl with `--resolve nexttuesday.art:443:185.199.108.153`.
- `site` is checked out nowhere. The script refuses otherwise.
- Without a `test:publish` script the script warns and runs only the sync check; say so in the report, since the suite did not run.
