# nexttuesday.art

Static site. GitHub Pages serves the `site` branch, a subtree split of `site/`
from the working branch (`main`). How the code fits:
[INTERNALS.md](INTERNALS.md).

## Skills

- `nexttuesday-art-change-start`: starting any change (worktree, preview).
- `nexttuesday-art-change-merge`: landing an approved change on the working branch.
- `nexttuesday-art-preview-sheet`: before/after screenshot sheets of a visual change, for review on a phone.
- `nexttuesday-art-perf`: measuring smoothness (frame pacing, paints/layouts per frame) of a change, before vs after.
- `nexttuesday-art-publish`: publishing to `site`, only when a publish is explicitly requested.

## Branches and worktrees

- One change per worktree, one merge into the working branch at a time.
- Other worktrees belong to other agents: use `git -C <path>`, never `cd`.
- Merge only after the change is approved.
- Push `site` only when a publish is explicitly requested. `main` stays untouched until the final squash.
- A branch and a tag may share a name (`round-*`): spell refs as `refs/heads/<n>` or `refs/tags/<n>` in `git log`, `rev-parse`, `checkout` and `push`; `git branch -d/-D` only ever sees branches.

## Tests

Run `npm test` before asking for review and before merging; `npm run test:publish` before any publish; never publish on a red suite; new behaviour gets a test first.

## Design principles

- Motion runs on the compositor only (transform, opacity); no per-frame layout reads.
- The three worlds (EMBERS, NOT NOT PHILO, INTERSECT) behave and look the same.
- A figure overshooting its circle reads as a portal: wanted.
- Scroll-linked motion that means nothing goes.
- The home emblem keeps its original size and position.
- The compass hides only over the footer.

## Previews and checks

- Previews: `http://<name>.nexttuesday-art.localhost:18000/`, reached through the SSH tunnel from Brave or Chrome. Safari does not resolve `*.localhost`.
- WebKit cannot be tested on this machine: list what to check on an iPhone.
- This machine cannot resolve nexttuesday.art: `curl --resolve nexttuesday.art:443:185.199.108.153 https://nexttuesday.art/`.

## Agents

- Build and review briefs say "batch commands, commit WIP early": agents hit turn limits (about 40 build, 25 review). Resume with SendMessage; stop merge agents after their report.
- Comments say what and why, never who.
