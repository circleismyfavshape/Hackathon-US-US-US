# Review and verification record

Reviewed 16 November 2026 on Windows, using Node.js 24.16.0 and Playwright 1.65.1 with Chromium.

## Results

| Check                                             | Result                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm test`                                        | 84 tests passed across 11 suites                                        |
| `npm run build`                                   | Production client build and server typecheck passed                     |
| `npm run typecheck`                               | Both workspaces passed with the final dependencies                      |
| `npm run format:check`                            | Passed                                                                  |
| `node tools/e2e.mjs` against the built app        | All 21 browser steps passed, including an older scenario response       |
| Same browser checks against Vite development mode | All 21 steps passed, including the StrictMode dispatch retry regression |
| Client configuration with TypeScript 6.0.3        | Passed without the deprecated `baseUrl` option                          |
| `npm audit`                                       | Zero known vulnerabilities reported for the installed dependency tree   |
| Live MET API probe                                | HTTP 200; the current response parsed into sourced official warnings    |
| Documentation review                              | Local document and image links resolved; screenshots inspected          |

The production walkthrough generated `docs/screenshots/01` through `12`. Additional local verification images were kept outside the tracked documentation.

## Problems corrected

The Vercel hosting update also passed all 21 browser steps against both a local hosted adapter with real Redis and the public deployment. Six additional tests cover state across function instances, overlapping submissions, reset, failed storage writes, event parsing and preview isolation. Cloud builds passed after configuring ES modules and the root TypeScript settings. The hosted walkthrough used a five-second live-update deadline for network latency; local checks retain one second. Screenshots were inspected and kept outside the repository. See [DEPLOYMENT.md](DEPLOYMENT.md).

- Restored both views when an older running server omits optional map layers. Scenario responses now validate their required fields and default missing operational layers to empty lists.
- Removed the deprecated TypeScript `baseUrl` setting and selected the workspace compiler for VS Code. Vite also resolves a single React installation across both workspaces.
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

The browser suite covers both sides of a request, assignment failure and retry, original request location, all-area map layers, keyboard popups, feature notes, forty role/device changes, phone layouts, an initial API failure, the blank-basemap fallback and both views with a legacy scenario response.

These checks establish the behaviour of the local prototype. They do not validate real flood conditions, relief availability, agency announcements or evacuation access. Browser runs used the simulated feed for repeatability; the separate live probe checked the weather adapter against the current public API.

## Remaining limits

The map renderer remains a large separate bundle; Vite emits its existing chunk-size warning. Firefox and Safari were not tested in this review. A dependency audit only covers published advisories available at the time of the check. The operational boundaries in [REAL_DATA.md](REAL_DATA.md) still apply.
