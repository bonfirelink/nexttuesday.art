---
name: nexttuesday-art-preview-sheet
description: Judge a visual change by eye with labelled BEFORE/AFTER sheets (the working branch's preview vs the change's): which shots to take, how to read them, what to measure. Use after any change that is judged by eye, and to compare two previews.
---

# Preview sheets

A sheet is one PNG per view: BEFORE | AFTER columns, a labelled row per page and position. BEFORE is the working branch's preview, AFTER the change's; both must answer.

## Choosing the shots

Every shot is a row, so take the fewest that show the change.

- Pages: every page the change can reach. The three worlds are `/embers/`, `/not-not-philo/`, `/intersect/`; `/` is the home.
- Both views by default (`--views phone` or `--views desktop` to narrow): narrow when the change is judged on one.
- Below the fold: scroll positions. Moving content: moments, labelled with their real elapsed time since load; add `--reduce` for a second run when the change involves motion. A detail too small for a sheet: `--clip`.
- One or two pages: one pair per sheet (`--per-page`). More pages: the combined `sheet-phone.png` / `sheet-desktop.png`, 1600 px wide at most, each cell reporting the page's horizontal overflow in px.

## By hand

```
node tools/shots.mjs --out <dir outside the repo> --before <working-branch preview> --after <change preview> --paths /,/embers/ [--views phone,desktop] [--scroll 0,800,50%] [--moments N] [--reduce] [--clip x,y,w,h]
node tools/sheet.mjs <dir> --title "<change>" [--per-page]
```

The header of `tools/shots.mjs` lists every option. Needs `$CHROMIUM`. Done when every shot line reads `no errors`. Console errors, 4xx responses and requests to an external host print as `ISSUES`: fix them, or report them with the sheet.

For a one-off script, import `launch` from `tools/browser.mjs` instead of calling `chromium.launch`. Compose images with the sheet tool or node.

## Reading them

- Look at each PNG: the labels are legible, the change is visible in AFTER and absent in BEFORE. Done when you can say what differs; when it is not visible, re-shoot narrower (`--paths`, `--clip`, `--scroll`).
- A picture does not settle size, spacing or radius: quote the real numbers (computed font size, bounding box, radius) from `page.evaluate` or the test you wrote, in the caption.
- Caption: one line, what to look at, then the suite's summary line (`npm test`).
- Headless Chromium is not an iPhone: say what needs a real device only when you can name it (see CLAUDE.md, Previews and checks).

## Single site

`--url <preview>` in place of `--before`/`--after` makes a sheet with one cell per shot, for a round of variants or a first look. Run it once per preview and name the output dirs apart.

## Boundaries

- `NTS_BASE` belongs to the test suite (the URL under test); `shots.mjs` sets it only inside its own process to let the font cache answer.
- Screens approved in review are kept outside the repo.
