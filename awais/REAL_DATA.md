# Real data for FLARE: verified sources and a scoped plan

Written by Awais, 15 Nov 2026, ~14:00 MYT. Every endpoint below was called from this machine today. Nothing here is built yet.

## Rules this has to respect (FLARE_TEAM_AUTOPILOT.md section 1 and 4)

- Real data may be shown only if the feed was actually tested, and it carries a timestamp and its provenance.
- Flood zones stay simulated and labelled. Never infer a disaster boundary from a point or a headline.
- SOS stays demo only. No real person's location is used.
- Real data supplements the demo. It must never block it: on any failure, fall back to the existing simulated alerts.

## Verified sources (no key, free)

| Source | URL | Returns | Status |
|---|---|---|---|
| MET Malaysia weather warnings (official, via data.gov.my) | `https://api.data.gov.my/weather/warning/?limit=5` | JSON array. Each item: `warning_issue.issued`, `warning_issue.title_en`, `heading_en`, `text_en`, `valid_from`, `valid_to` | Works. Latest was issued 2026-11-15T13:00:00, thunderstorms and strong winds. NOTE: the URL without the trailing slash answers 301, so use the slash or follow redirects. |
| MET Malaysia forecast (official, via data.gov.my) | `https://api.data.gov.my/weather/forecast/?contains=Shah%20Alam@location__location_name&limit=3` | `location.location_name`, `date`, `morning/afternoon/night_forecast`, `summary_forecast`, `min_temp`, `max_temp` | Works. First row returned was a later date, so filter by today's `date`. |
| Open-Meteo rain now | `https://api.open-meteo.com/v1/forecast?latitude=3.073&longitude=101.52&current=precipitation,rain,weather_code&timezone=Asia%2FKuala_Lumpur` | `current.precipitation` mm, `current.time` | Works (13:45 reading was 1.2 mm). Model-based, not a gauge. |
| Open-Meteo river discharge | `https://flood-api.open-meteo.com/v1/flood?latitude=3.073&longitude=101.52&daily=river_discharge&forecast_days=3` | `daily.river_discharge` m3/s | Works (13.49 m3/s). Modelled river discharge, not a gauge reading. Label it "modelled". |

Tried and dropped: Overpass API for real shelters returned nothing within the time box. Shelters stay fictional, as the blueprint already says.

CORS: none of these responses showed an `access-control-allow-origin` header when I checked, so the browser must not call them directly. Fetch on the server.

## Scope for today (small enough to ship before the 14:30 freeze)

One source only: **MET Malaysia warnings**. Everything else is optional.

1. Server adapter (`server/src/`, D2's area): `fetchOfficialAlerts()` calls the warnings URL with a 4 second timeout, caches the result for 5 minutes in memory, and returns at most 3 items mapped to the existing alert shape `{id, incidentId, kind, text, source, at}`:
   - `source`: `"MET Malaysia (api.data.gov.my)"`
   - `at`: the warning's `warning_issue.issued` converted to ISO with +08:00
   - `text`: `title_en` plus the first sentence of `text_en`, cut to 200 characters
   - `incidentId`: attach to the Shah Alam incident or leave generic, the lead's call
2. `GET /api/alerts` returns official items first, then the existing simulated ones. On any error, timeout or empty result it returns only the simulated items and does not throw.
3. Label so nobody mistakes simulated for real: the official ones read "Official, MET Malaysia, issued <time>", the simulated ones keep their current "simulation" label. If a contract field is wanted, an optional `official: true` is additive.
4. Test (`server/tests/api/`): mock fetch, prove (a) official items appear with the right source and time, (b) a failing fetch still returns the simulated alerts, (c) the 5 minute cache serves a second call without a second fetch. `npm test` must stay green with no network.

Do NOT do today: river gauges, flood polygons from real data, real shelters, AI summaries of the feed, anything that writes.

## Suggested owners (the lead decides, AGENTS.md section 2)

- D2 / lead, Sajid: server adapter, `/api/alerts` merge, labels, tests. All in his files.
- D3, Khaled: nothing to build. Confirm the responder feed shows the new items and the simulated fallback.
- D1, Awais: verify on `/citizen` and `/phone/citizen` that official items are labelled, wrap at 390px, and the fallback works with the network blocked. Retake the backup screenshots.
- D4, Ahmed: none.

## Acceptance

- With internet: the citizen feed shows at least one item labelled "MET Malaysia" with its issue time.
- With the host blocked: the feed shows only the simulated items, no error, page still loads.
- `npm test` and `npm run build` green. The two-tab SOS run still passes.
- If any of that is not true by 14:25, do not merge it.
