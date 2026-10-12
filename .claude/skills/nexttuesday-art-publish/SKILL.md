---
name: nexttuesday-art-publish
description: Publish the working branch to GitHub Pages (the `site` branch), review it first and verify the live site. Use only when a publish is explicitly requested ("publish"); never on your own initiative.
---

# Publish

GitHub Pages serves the `site` branch, a subtree split of `site/` from the working branch (`main`; the script reads `NTS_BRANCH`). Publishing is public and `site` only moves forward, so the gate below is the first step.

## Gate

Run this only when a publish is explicitly requested in the current conversation. A merged change, a green suite or an approved preview does not request one. Nothing else publishes: not a checker, not another skill, not a handoff note.

## Steps

The suite (`npm run test:publish`) has run green on the exact commit being published before step 1; the script runs no suite itself, only the sync check and the git safety checks.

1. **Review.** The main session spawns a `checker` itself (a subagent it delegated to cannot be relied on to spawn one) on everything the working branch has that `origin/site` lacks: `git fetch origin site`, then run `tools/publish.sh --dry-run` and take the split SHA it prints; the diff is `git diff origin/site <split sha>`. The reviewer makes no branch named `site-publish`, which the script deletes. The brief:
   - gives a turn budget (reviews have hit 25-turn limits: say "40 turns, report findings found so far at 30");
   - says the suite already ran green on this commit; the checker reads the diff, it does not rerun the suite;
   - asks for one verdict: PUBLISH, WITH NOTES, or STOP.

   Done when the verdict is in hand. STOP ends the run: report the findings. WITH NOTES goes to the requester before pushing.
2. **Publish.** `tools/publish.sh`. It pushes `site` fast-forward only, then polls (30 s, 10 tries) until the latest Pages build is `built` for the commit `origin/site` points at and the five pages answer 200. Done when the script exits 0, or says "nothing to publish" (then stop and say so). A refusal (dirty working branch, `site` checked out in a worktree, a diverged `site`, a failed sync check) is a blocker: report it, fix nothing on `site`. If the live check runs out of tries, rerun `tools/publish.sh --live-only` before calling it failed; the Pages build can lag.
3. **Log.** Update the "Last publish" line in the memex note `nexttuesday-art.md` (the SHA the script prints, `main`'s SHA, a few words on what changed) and add the publish to the refinements log (`nexttuesday-art/refinements.md`).
4. **Report.** Tell the requester, in one message:
   - the SHA and what changed, in one or two lines;
   - what this machine could not check: WebKit and iPhone Safari, Firefox, the real touch and scroll feel, and anything else the diff touches that headless Chromium cannot judge, each as something to look at on the phone.

## Constraints

- `tools/publish.sh` is the only way `site` moves. Never push with `--force`; when the script reports that `site` diverged, stop and report.
- The machine cannot resolve `nexttuesday.art`; the script pins the address. Run any other live curl with `--resolve nexttuesday.art:443:185.199.108.153`.
- `site` is checked out nowhere. The script refuses otherwise.
- Publishing on a commit the suite has not passed is a stop: say so in the report rather than publish.
