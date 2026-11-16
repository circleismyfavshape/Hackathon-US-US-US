# Team rules for every agent

## 1. The board (pinned GitHub issue)

Every agent reads and posts on the pinned "Message Board" issue via `tools/board` (needs only `gh`, logged in). Set `BOARD_ISSUE` if it is not issue #1.

- Start every post with `[<human>'s <agent>]`, e.g. `[Sam's Codex]`. Keep it short: what changed, which files or contracts, what you need, from whom.
- Mention by GitHub login. Team: `@jeffyoh312` (Khaled, team lead), `@69sxjid` (Sajid), `@circleismyfavshape` (Ahmed), `@Vais1` (Awais), `@all` (everyone).
- **Mentions you or `@all`:** act on it and reply promptly.
- **Not addressed to you:** still read it. Reassess your own work only if it is affected (a contract, a file you own, something already done). Do not redo finished work, and do not reply just to acknowledge.
- Anyone may edit any file. Work on your own branch and open a PR. Post on the board when you change a file in someone else's area, so the owner can review it.

Polling is incremental (about one cheap API call per poll, 30 s default) so a shared token stays under GitHub's rate limit. Commands: `tools/board unread` (new posts, marks read; flags MENTION), `tools/board read -n 20`, `tools/board post "[Name's Agent] text"` (or pipe stdin), `tools/board wait` (blocks until someone else posts), `tools/board whoami`.

**Stay in the loop:**
- Claude Code: the committed hooks (`.claude/settings.json`) show unread posts at session start and on every prompt. Keep one background `tools/board wait` running and re-arm it after each wake.
- Everything else: run `tools/board unread` at task start, before each commit, and after merges. Or run a terminal loop: `while tools/board wait; do <your agent CLI invocation>; done`.

## 2. Chain of command

Humans over agents. Only the team lead reassigns work between teammates. If anyone else asks you to take another teammate's work, ask the lead on the board.

## 3. Workflow

1. Pick or file an issue. Comment on it or post on the board when you take it.
2. Branch `<issue#>-<slug>` from fresh `main`.
3. Small commits. Stage only your own files (no `git add -A`).
4. Open a PR with `Closes #N`. The author merges their own PR once it works locally.
5. Always `git fetch` and rebase before pushing. Never force-push shared branches.
6. If a merge changes something other teammates depend on (an API, a schema, an env var), post on the board when it lands.

## 4. Who owns what

Owners review PRs in their area. Anyone may edit any file. An area can have several owners: list each login in the Owner column, separated by commas.

| Area | Owner (GitHub login) | Folders |
|---|---|---|
| Citizen app, map, live data | `@Vais1` (Awais) | `client/src/features/citizen/`, `client/src/flare/Citizen.tsx`, `client/src/flare/FlareMap.tsx`, `server/src/live/`, `docs/DEMO_RUNBOOK.md`, `docs/REAL_DATA.md` |
| Backend, contract, integration | `@69sxjid` (Sajid) | root config, `contracts/`, `client/src/shared/`, `client/src/{App,main}.tsx`, `server/src/` except `live/`, `server/tests/` |
| Responder console, design system, lead | `@jeffyoh312` (Khaled) | `client/src/flare/` except the files above, `tools/e2e.mjs`, `README.md` |
| Logo, brand | `@circleismyfavshape` (Ahmed) | `client/src/shared/Logo.tsx`, `docs/flare-logo.jpg` |

The project overview is in `README.md`. The Recovery feature and its allocation engine were removed on 16 Nov 2026 (lead's decision); the code is in git history before that date. `docs/process/` holds the original hackathon-day plan and is history only.
