# nexttuesday.art

Static site. GitHub Pages serves the `site` branch, a subtree split of `site/`
from the working branch (`main`). How the code fits:
[INTERNALS.md](INTERNALS.md).

## Skills

- `nexttuesday-art-preview-sheet`: before/after screenshot sheets of a visual change, for review on a phone.
- `nexttuesday-art-perf`: measuring smoothness (frame pacing, paints/layouts per frame) of a change, before vs after.

## Branches and worktrees

- Changes are made in worktrees under `.claude/worktrees/`. Other worktrees belong to other agents: use `git -C <path>`, never `cd`.
- `main` is the working branch; `site` is only moved by a publish, which is only done when explicitly requested.
- A branch and a tag may share a name (`round-*`): spell refs as `refs/heads/<n>` or `refs/tags/<n>` in `git log`, `rev-parse`, `checkout` and `push`; `git branch -d/-D` only ever sees branches.

## Tests

`npm test` is the quick suite (static and fast tiers); `npm run test:publish` adds the `@slow` sweeps, the `@visual` snapshots and the `@perf` guards (it runs every project), and is the suite a publish rests on. Never publish on a red suite; new behaviour gets a test first.

## Design principles

- Motion runs on the compositor only (transform, opacity); no per-frame layout reads.
- The three worlds (EMBERS, NOT NOT PHILO, INTERSECT) behave and look the same.
- A figure overshooting its circle reads as a portal: wanted.
- Scroll-linked motion that means nothing goes.
- The home emblem keeps its original size and position.

## Previews and checks

- Previews: `http://<name>.nexttuesday-art.localhost:18000/`, reached through the SSH tunnel from Brave or Chrome. Safari does not resolve `*.localhost`.
- WebKit cannot be tested on this machine: list what to check on an iPhone.
- A WebKit-only fix is checked on the live site from an iPhone (iOS 27 cannot reach `*.localhost` previews), so such a fix is published to be checked, only when a publish is requested.
- Live checks of nexttuesday.art need an address pin: see INTERNALS.md "Publishing".

## Agents

- Build and review briefs say "batch commands, commit WIP early": agents hit turn limits (about 40 build, 25 review). Resume with SendMessage.
- Comments say what and why, never who.
