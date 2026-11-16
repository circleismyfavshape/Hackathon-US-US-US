# Architecture and maintenance

FLARE is a React client and a Hono API, joined by shared TypeScript types and one scenario fixture. Local development uses one Node process. The Vercel deployment shares requests through Redis. Neither mode integrates with external dispatch services.

The API client checks the core scenario response before rendering. Operational map fields added in v2.1 default to empty arrays when an older API process is still running, so either main view remains usable during an update. Restart the server to load the current scenario and its newer layers.

## Follow a request

1. `Citizen.tsx` sends a `SosCreate` through `shared/api.ts`. Optional note text is normalised by server validation.
2. `server/src/routes/validate.ts` checks fields, bounds and coordinate precision.
3. `DemoStore.createSos` creates the ID and timestamps, stores the request and emits a change event.
4. The SSE route in `server/src/app.ts` forwards the event to connected clients.
5. Hooks in `flare/data.ts` refetch the queue or feed. The citizen's request hook refreshes its specific record.
6. A responder patches the status through the same API, repeating the notification cycle.

The store caps requests at 500. Local requests clear on process restart or reset. Hosted requests survive function restarts and clear when the shared scenario is reset. Authentication is future work.

## Source map

| File                               | Responsibility                                                          |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `client/src/App.tsx`               | Route selection and top-level error boundary                            |
| `flare/Citizen.tsx`                | Guide, map, news and help workflows                                     |
| `flare/Responder.tsx`              | Queue filters, request detail and dispatch actions                      |
| `flare/data.ts`                    | Shared loading, live refresh, scenario location and route choices       |
| `flare/FlareMap.tsx`               | Flood geometry, camera, relief pins, route rendering and layer controls |
| `flare/ScenarioLayers.tsx`         | Service popups and illustrated closure segments                         |
| `flare/Phone.tsx`, `phoneNotes.ts` | Phone frame and feature-aware viewer notes                              |
| `flare/ui.tsx`, `theme.css`        | Viewer controls, notifications, states and shared styles                |
| `features/citizen/geo.ts`          | Pure point-in-polygon, distance and grouping helpers                    |
| `server/src/live/met.ts`           | Warning parsing, caching, expiry and network failure handling           |
| `server/src/seed/index.ts`         | Deep fixture loading and relative incident times                        |

## Lifecycles and failure paths

The event stream is a refresh signal, not a copy of the database. Reconnecting triggers a refetch; slow polling remains available if the stream is unavailable. A request sequence prevents a slower response from replacing a newer one. Cleanup invalidates outstanding results and stops timers from scheduling another poll after unmount.

React StrictMode repeats effect setup and cleanup during development. Liveness flags must be restored in setup, not only initialised when the component is created. The responder detail panel follows this rule so buttons recover after both success and failure.

The SSE handler releases its store listener when the browser disconnects or a write fails. Notification timers are cleared when their view closes.

Weather caching checks validity on each read. A fetch failure can preserve a still-valid bulletin, but cannot revive an expired one. The guide and requests do not depend on a weather response.

## Phone notes

The citizen or responder iframe reports only a feature identifier with `postMessage`. The parent verifies the exact iframe window and same origin before accepting it. No location or rescue details are transmitted in this message. The note remains outside the product screen.

## Changing the scenario

Edit `contracts/demo-fixtures.json`, then run the tests. If coordinates move, rebuild routes using `node tools/update-routes.mjs --all` and format the result. The route script makes sequential requests to the public OSRM walking service and writes only after all requests succeed.

The fixture is checked for valid incident references, closed contours, representative danger levels, relief points outside zones, routes near their endpoints and explicitly simulated operations. See [SCENARIOS.md](SCENARIOS.md).

## Deployment boundary

`npm start` builds the client and serves it with the API. The client build is resolved relative to the server module; assets are served from `client/dist`. Vite is only needed for development. `PORT` changes the production server port; the development proxy defaults to `8787`.

On Vercel, `api/index.ts` adapts Node requests to `server/src/hosting/app.ts`. Each request reads the shared snapshot, runs the same local validation and API handlers, then commits successful mutations with an atomic comparison. A conflicting mutation retries against the latest state. Redis pub/sub relays changes to browser streams across function instances. Preview state is separate from production. See [DEPLOYMENT.md](DEPLOYMENT.md) for configuration and free-tier limits.

Before any operational deployment, requests also need authentication, access controls, retention policies and validated incident data.
