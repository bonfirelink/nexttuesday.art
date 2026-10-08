---
name: nexttuesday-art-preview-sheet
description: Make labelled BEFORE/AFTER contact sheets of a visual change (working branch preview vs the change's preview) at phone and desktop sizes, ready for review on a phone. Use after any change that is judged by eye, and to compare two previews.
---

# Preview sheets

A sheet is one PNG per view: BEFORE | AFTER columns, a labelled row per page and position. The working branch is `main`; `NTS_BRANCH` names it. Its preview is `http://$NTS_BRANCH.nexttuesday-art.localhost:18000/` (`main` when unset); the change's preview is `devshell url` in its worktree. Both must be running (`devshell up`).

## Steps

1. **Choose the shots** from what the change touches. Every shot is a row, so take the fewest that show the change.
   - Pages: every page the change can reach, always including `/`; the three worlds are `/embers/`, `/not-not-philo/`, `/intersect/`.
   - Below the fold: scroll positions. Moving content: moments, labelled with their real elapsed time since load; add reduced motion for a second run when the change involves motion. A detail too small for a sheet: a clip.
   - Phone and desktop by default; narrow to one view when the change is confined to it.
   The script's header (`tools/shots.mjs`) lists every option.
2. **Shoot.** From the change's worktree, inside the dev shell (it exports `$CHROMIUM`):
   `node tools/shots.mjs --out <scratch dir> --before <working-branch preview> --after <change preview> --paths /,/embers/`
   The scratch dir is outside the repo (the session's or the profile's scratch). Done when every line reads `no errors`; console errors, 4xx responses or requests that left for an external host print as `ISSUES`: fix them or report them with the sheet.
3. **Compose.** When the change touches one or two pages, one BEFORE|AFTER pair per sheet: `node tools/sheet.mjs <scratch dir> --title "<change>" --per-page` writes `sheet-<view>-<page>.png`, each sent separately. For more pages, leave out `--per-page`: `sheet-phone.png` and `sheet-desktop.png` hold several pairs. A phone sheet is 1600 px wide at most, so it reads on a phone without zooming; each cell reports the page's horizontal overflow in px.
4. **Look.** Read each PNG: the labels are legible and the change is visible in AFTER and absent in BEFORE. Done when you can say what differs. Re-shoot narrower (`--paths`, `--clip`, `--scroll`) when it is not visible.
5. **Measure.** A picture alone does not settle size, spacing or radius: quote the real numbers (computed font size, bounding box, radius) from `page.evaluate` or the test you wrote, in the caption.
6. **Send.** One sheet per message, with a one-line caption: what to look at, then the suite's summary line (`npm test`). `SendUserFile` is the main session's tool; a subagent returns the sheet paths and the caption text to its caller.

## Single site

`--url <preview>` in place of `--before`/`--after` makes a sheet with one cell per shot, for a round of variants or a first look. Run it once per preview and name the output dirs apart.

## Boundaries

- Phone screenshots are headless Chromium: say what needs a real iPhone (WebKit, touch feel).
- `NTS_BASE` belongs to the test suite (the URL under test); `shots.mjs` sets it only inside its own process to let the font cache answer.
- Screens approved in review are kept outside the repo.
