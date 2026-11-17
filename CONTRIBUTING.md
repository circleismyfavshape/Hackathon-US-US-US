# Development

Use the Node and npm versions described in the [README](README.md#run-locally). The client and server share one workspace installation; run commands from the repository root.

## Checks

```bash
npm test
npm run build
npm run format:check
```

Run the [browser checks](docs/DEMO_RUNBOOK.md#browser-checks) after changing interactions, map behaviour or layouts. Use `npm run format` to apply the shared code style.

## Editing the scenario

Keep shared types and the API contract together in `contracts/`. Scenario changes must preserve the [geometry and route invariants](docs/SCENARIOS.md#editing-checklist). Rebuild stored routes after moving coordinates.

Use descriptive names, braces for control flow, and comments explaining non-obvious decisions. Release subscriptions and timers when their views close, and ignore stale responses. Preserve map attribution and the distinction between live weather data and simulated operations.

Prefer explicit branches over nested ternaries. Keep each screen in its feature folder, and use small
named helpers for calculations or messages that would otherwise interrupt the component's flow.
Comments should explain constraints such as coordinate order, stale responses or atomic storage
writes; routine assignments do not need narration. Run Prettier instead of compressing code by hand.
