# Working on FLARE

Khaled (@jeffyoh312) leads and currently maintains the project. He contributes across the client, server, integration, design and testing. The [README team table](README.md#team) records each member's main contributions.

## Workflow

1. Pick or create an issue describing the problem and expected behaviour.
2. Branch `<issue-number>-<short-description>` from freshly fetched `main`.
3. Keep related changes together in small commits. Stage only the files you changed.
4. Run the relevant checks and open a PR with `Closes #N`.
5. Fetch and rebase before pushing. Do not force-push a shared branch.
6. Merge after verification and update the pinned **Message Board** with the result, affected areas and any setup changes.

Board updates begin with a name, for example `[Khaled's update]`, and mention people by GitHub login. Use `@all` for a project-wide update. Keep messages short and practical. `tools/board read -n 5` reads recent posts; `tools/board post` also accepts a message on stdin.

## Code conventions

- Use descriptive names for application state and API values. Short mathematical indices are fine inside a small geometry calculation.
- Use braces for conditionals and loops. Put separate steps on separate lines.
- Use comments to explain a boundary, a tradeoff or a non-obvious decision. Avoid narrating each line.
- Keep shared types in `contracts/types.ts` and document contract changes in `contracts/API_CONTRACT.md`.
- Keep scenario listings and announcements clearly simulated. Preserve map and data attribution.
- Clean up effects, subscriptions and timers. Ignore stale responses when requests overlap or a view closes.
- Use `npm run format` before committing. Formatting and line endings are configured at the repository root.

## Verification

Run `npm test`, `npm run build` and `npm run format:check`. Run the [browser checks](docs/DEMO_RUNBOOK.md#browser-checks) for interaction, map or layout changes. Scenario edits must retain the geometry, route and relief-point invariants described in [SCENARIOS.md](docs/SCENARIOS.md).

New checks should cover a real behaviour or regression. Screenshots are taken from the running app by the browser walkthrough.
