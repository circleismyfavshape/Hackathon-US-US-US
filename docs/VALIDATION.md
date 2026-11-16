# Review and verification record

Reviewed 16 November 2026 on Windows, using Node.js 24.16.0 and Playwright 1.65.1 with Chromium.

## Results

| Check                                             | Result                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm test`                                        | 75 tests passed across 11 suites                                        |
| `npm run build`                                   | Production client build and server typecheck passed                     |
| `npm run typecheck`                               | Both workspaces passed with the final dependencies                      |
| `npm run format:check`                            | Passed                                                                  |
| `node tools/e2e.mjs` against the built app        | All 20 browser steps passed; repeated with the final server adapter     |
| Same browser checks against Vite development mode | All 20 steps passed, including the StrictMode dispatch retry regression |
| `npm audit`                                       | Zero known vulnerabilities reported for the installed dependency tree   |
| Live MET API probe                                | HTTP 200; the current response parsed into sourced official warnings    |
| Documentation review                              | Local document and image links resolved; screenshots inspected          |
| `bash -n tools/board`                             | Passed                                                                  |

The production walkthrough generated `docs/screenshots/01` through `12`. Additional local verification images were kept outside the tracked documentation.

## Problems corrected

- Restored responder liveness flags during each effect setup so development-mode cleanup cannot leave controls disabled.
- Discarded stale scenario and request responses, and stopped polling from rescheduling after a view closes.
- Cleared notification timers and released event-stream subscriptions on disconnect or write failure.
- Removed expired cached weather warnings, including during outages; malformed source responses preserve still-valid cached items.
- Included polygon edges and vertices in the danger check.
- Kept a rescue request's original place label when the simulated citizen moves.
- Disabled the landing alert until its scenario is ready and provided a retry state for load failures.
- Replaced the retired separate 991 listing with integrated 999 guidance, supported by [Civil Defence](https://www.civildefence.gov.my/perkhidmatan-kecemasan-999/).
- Updated `@hono/node-server` to 2.1.8 after dependency review. The initial finding was [GHSA-rmxm-3fg6-px4f](https://github.com/advisories/GHSA-rmxm-3fg6-px4f); the final version also incorporates later 2.1.x fixes.

## What the checks establish

The geometry suite verifies all four example levels per area, relief points outside every drawn zone, incident references, route endpoints and bounds. Operational markers and closure lines must be labelled simulated. API tests cover validation, status transitions, reset, event delivery and subscription cleanup. Weather tests inject the clock and HTTP responses to exercise expiry and failures.

The browser suite covers both sides of a request, assignment failure and retry, original request location, all-area map layers, keyboard popups, feature notes, forty role/device changes, phone layouts, an initial API failure and the blank-basemap fallback.

These checks establish the behaviour of the local prototype. They do not validate real flood conditions, relief availability, agency announcements or evacuation access. Browser runs used the simulated feed for repeatability; the separate live probe checked the weather adapter against the current public API.

## Remaining limits

The map renderer remains a large separate bundle; Vite emits its existing chunk-size warning. Firefox and Safari were not tested in this review. A dependency audit only covers published advisories available at the time of the check. The operational boundaries in [REAL_DATA.md](REAL_DATA.md) still apply.
