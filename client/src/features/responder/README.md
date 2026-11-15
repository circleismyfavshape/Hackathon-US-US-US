# D3 browser regression — Khaled

The active interfaces are the unified `/citizen`, `/responder`, `/recovery`, and `/phone/responder` routes in `client/src/flare/`. The original `ResponderPage.tsx` and sample adapter in this folder are retained legacy implementation; they are no longer routed by `App.tsx`.

`responder.browser.test.mjs` tests the active unified UI against one shared backend. It covers:

- The real citizen form: area/location buttons, help-type toggles, people stepper, textarea and Send SOS. The exact generated request must appear in the responder queue; assignment and resolution must update the citizen tab without reload. Tracking must survive reload. Simulation wording is checked before and after submission.
- Queue filters, return-to-pending, persisted assignment, failed writes, polling loss and recovery.
- Every allocated and unmet resource quantity for every centre in all four live recovery strategies, compared with the API response. Remaining stock must be visible and comparisons must leave inventory unchanged.
- A failed optimized comparison remains visible while other strategies work. The optional AI summary hides on a mocked 503, without requiring an API key or an external call.
- A 390px responder layout and real pointer interaction inside `/phone/responder`.

The phone frame uses CSS zoom. The test translates iframe viewport coordinates for a real mouse click and checks that neither the inner control nor the outer iframe is obstructed. It does not force clicks or invoke DOM click handlers.

## Run from the repository root

Use a dedicated local server. These tests create fictional requests and change their status, so do not point them at the presentation server.

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
npm.cmd install --prefix .board/browser-tools --no-save --no-package-lock playwright
node .board/browser-tools/node_modules/playwright/cli.js install chromium
$env:PORT = '8795'
npm.cmd run start -w server
```

Keep that server running. In another PowerShell terminal:

```powershell
$env:FLARE_TEST_URL = 'http://localhost:8795'
./node_modules/.bin/tsx.cmd --test client/src/features/responder/responder.browser.test.mjs
```

On Bash use `npm` and `node_modules/.bin/tsx`; set variables as `PORT=8795 npm run start -w server` and `FLARE_TEST_URL=http://localhost:8795 node_modules/.bin/tsx --test client/src/features/responder/responder.browser.test.mjs`.

`FLARE_BROWSER_TOOLS` overrides the isolated Playwright installation directory (default `.board/browser-tools`). Test screenshots are written to ignored `.board/unified-*.png`. Tooling does not change project dependencies or the root lockfile.

The four legacy adapter fixture tests remain separately runnable:

```powershell
./node_modules/.bin/tsx.cmd --test client/src/features/responder/responderApi.test.mjs
```

Those verify sample session isolation and recorded allocation conservation; they do not claim the active unified UI supports sample mode.
