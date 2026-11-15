# FLARE responder and recovery UI — D3 / Khaled

Owned module: `client/src/features/responder/`. All data is fictional. This is a hackathon demonstration, not an emergency service; assignment controls never dispatch a real team.

## Open the workspace

Start the shared application using the root run commands in `FLARE.md`, then open `/responder`.

- `/responder` defaults to **Live demo API**. It uses the shared typed client in `client/src/shared/api.ts`, polls the SOS queue every 2.5 seconds, and persists assignment and resolution through the backend.
- `/responder?mode=sample` opens **Sample responses**. Each sample session has an isolated local queue and recorded recovery responses based on `contracts/demo-fixtures.json`. It makes no API calls and does not share updates with the citizen portal. Switching modes starts a fresh workspace session.
- A failed live request displays an error; the UI never switches to sample mode automatically. A failed queue refresh preserves the last successful snapshot and disables assignment actions until the connection recovers.

The screen includes the incident source and update time, pending/assigned/resolved counts, searchable and filterable SOS requests, approximate demo coordinates, demo-team assignment, and resolution. Recovery operations show three centres' needs, inventory, shortages, and all three allocation strategies side by side. The focus selector highlights one strategy for comparison. Each returned result includes allocated and unmet units, remaining stock, explanations, and assumptions.

## Contract boundary

The module consumes frozen v1 types and endpoints from `contracts/API_CONTRACT.md`. Shared files and the allocation engine belong to D2/D4. The client aggregates requested needs and shortages for display, but does not calculate allocation outputs. Live comparisons call the backend for `priority-first`, `proportional`, and `equal-share`; sample mode reads recorded response objects. Comparisons never commit stock or dispatch supplies. A missing engine (HTTP 501), partial failures, and mismatched strategy responses remain visible.

## Checks from the repository root

Install the shared dependencies with `npm install`, then run:

```bash
npm test
npm run build
node_modules/.bin/tsx --test client/src/features/responder/responderApi.test.mjs
```

`npm test` runs the root server tests. The module test verifies the shared live adapter, sample assignment lifecycle, isolation, and recorded comparison conservation. On Windows PowerShell, use `npm.cmd` and `./node_modules/.bin/tsx.cmd` if script execution policy blocks the `.ps1` wrappers.

## Isolated browser acceptance

Use a **dedicated server** for browser tests. They create fictional SOS records and perform real PATCH operations; do not point them at a teammate's active demo server. Browser tooling and screenshots stay in ignored `.board/`, without changing the shared package manifest or lockfile.

From the repository root:

```bash
npm install --prefix .board/browser-tools --no-save --no-package-lock playwright
node .board/browser-tools/node_modules/playwright/cli.js install chromium
npm run build
PORT=8793 npm run start -w server
```

Keep that server running. In a second terminal at the repository root:

```bash
node_modules/.bin/tsx --test client/src/features/responder/responder.browser.test.mjs
```

Windows PowerShell equivalents:

```powershell
npm.cmd install --prefix .board/browser-tools --no-save --no-package-lock playwright
node .board/browser-tools/node_modules/playwright/cli.js install chromium
npm.cmd run build
$env:PORT = '8793'
npm.cmd run start -w server
```

Then in a second PowerShell terminal:

```powershell
./node_modules/.bin/tsx.cmd --test client/src/features/responder/responder.browser.test.mjs
```

The browser suite defaults to `http://localhost:8793`; `FLARE_TEST_URL` can override it for another dedicated server. `FLARE_BROWSER_TOOLS` can override the isolated tooling directory. Tests cover sample mode with zero API calls, desktop/mobile overflow, live polling and persisted assignment/resolution, failed writes, stale queue handling, and partial/mismatched recovery responses. Screenshots are saved to `.board/responder-desktop.png` and `.board/responder-mobile.png`.

The integrated browser suite also opens both real portals, submits an SOS through D1's citizen form, selects that exact ID in the responder queue, assigns a demo team and marks it resolved. The citizen tab must observe both backend status changes without a reload. A separate live recovery check renders all three strategies and verifies the inventory stays unchanged. Evidence screenshots are `.board/citizen-roundtrip.png` and `.board/responder-live.png`.

Verified against integrated main `0d6b198` plus this module: 63 root server tests, 4 sample-adapter tests, 7 Chromium tests, and the production build pass. No shared contract or package dependency changes.
