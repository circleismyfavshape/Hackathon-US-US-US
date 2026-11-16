# FLARE API contract, v2.1

Version contract changes together with [`types.ts`](types.ts).

- **Types (source of truth):** [`contracts/types.ts`](types.ts). Client code imports them through `client/src/shared/api.ts`, which also holds the typed client.
- **Scenario data (source of truth):** [`contracts/demo-fixtures.json`](demo-fixtures.json). The server loads it at startup and on reset.
- **Base URL:** same origin, `/api`. Dev: Vite on `:5173` proxies to the server on `:8787`. `npm start` serves everything on `:8787`.
- **Casing:** camelCase everywhere. **Coordinates:** REST uses `{lat,lng}`; GeoJSON rings and routes use `[lng,lat]`.
- **Errors:** `{ "error": string, "details"?: string[] }` with 400 (validation), 404 (unknown id or route), 409 (demo cap of 500 requests reached), 500.

## Endpoints

| Method | Path              | Request                                                                             | 2xx response                                                                                                                                                       |
| ------ | ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/health`     |                                                                                     | `{ status:"ok", mode:"demo" }`                                                                                                                                     |
| GET    | `/api/scenario`   |                                                                                     | `Scenario`: `incidents`, `shelters`, `demoLocations`, `routes`, `mapPoints`, `roadClosures`, `actions`, `contacts`, `defaultLocationId`, `demoBounds`, `demoTeams` |
| GET    | `/api/alerts`     |                                                                                     | `Alert[]`: official warnings first, then simulated updates, newest first within each                                                                               |
| GET    | `/api/events`     |                                                                                     | Server-sent events (see below)                                                                                                                                     |
| POST   | `/api/sos`        | `SosCreate`                                                                         | **201** `Sos` with generated `id` (`SOS-XXXXXXXX`), `status:"pending"`, `assignedTeam:null`                                                                        |
| GET    | `/api/sos`        |                                                                                     | `Sos[]`, oldest first. **Demo responder only. Never public in a real system.**                                                                                     |
| GET    | `/api/sos/:id`    |                                                                                     | `Sos`                                                                                                                                                              |
| PATCH  | `/api/sos/:id`    | `{status:"assigned",assignedTeam}` \| `{status:"resolved"}` \| `{status:"pending"}` | `Sos`. `resolved` keeps `assignedTeam`; `pending` clears it                                                                                                        |
| POST   | `/api/demo/reset` |                                                                                     | `{ status:"reset", mode:"demo" }`. Reloads the scenario and clears all requests                                                                                    |

`GET /api/incidents`, `GET /api/shelters` and `GET /api/demo/config` still answer with the matching parts of the scenario.

## Live events

`GET /api/events` is a `text/event-stream`. Clients open one stream per page and refetch when told to.

| Event    | Data                   | Meaning                                                                                                              |
| -------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ready`  | `{}`                   | The stream is open. Sent on every connect, so a client that reconnects should refetch everything.                    |
| `change` | `{ "type": "sos" }`    | A request was created or updated. Refetch `/api/sos` or `/api/sos/:id`.                                              |
| `change` | `{ "type": "alerts" }` | The feed changed: a simulated update was released, or an official warning arrived or expired. Refetch `/api/alerts`. |
| `change` | `{ "type": "reset" }`  | The demo was reset. Refetch everything, including `/api/scenario`.                                                   |
| `ping`   | `{}`                   | Sent every 20 s of silence to keep the stream open.                                                                  |

If the stream cannot be opened, clients fall back to polling every 3 s.

## Scenario

- **Incident**: `id`, `title`, `area`, `severity` (`severe | high | moderate | low`), `summary`, `location`, `zones`, source fields, `updatedAt` (resolved at load time, so it always reads as recent).
- **Zone**: `level` (`severe | high | moderate`, the damage level), `label`, `depth` (plain words, for example "Water above 1 m"), `coordinates` (a closed ring).
- **Shelter** (a safe zone): `kind` (`relief | medical`), `name`, `note`, `location`. Every safe zone is outside every zone.
- **Route**: a walking path on the road network from one `demoLocation` to one shelter: `distanceM`, `minutes`, `coordinates`. Every demo location inside a zone has a route to each safe zone of its incident. A route does not know which roads are flooded.
- **Actions**: what to do, per zone level. **Contacts**: who to call.
- **demoProfile**: the fictional `CitizenProfile` the demo phone starts from.
- **MapPoint**: `id`, `incidentId`, `kind` (`police | fire | roadblock | aid`), `name`, `note`, `location`, `sourceType:"simulation"`. These are illustrated operational posts, not verified stations or shelters.
- **RoadClosure**: `id`, `incidentId`, `name`, `reason`, `coordinates` (a line in `[lng,lat]` order), `sourceType:"simulation"`. Routes do not avoid these segments.

`server/tests/citizen/geo.test.ts` checks all of the above against the fixture, so a scenario edit that breaks one fails `npm test`.

## Requests (SOS)

- `incidentId` must exist. `people` is an integer 1 to 50. `type` is one of `trapped | medical-help | supplies | other`.
- `description` is optional, at most 280 characters, and is trimmed. A person in danger can send a request without typing.
- `location` must be inside `demoBounds`.
- `profile` is optional. Absent or `null` means the sender did not share one, and the stored request has `profile: null`. When present it is a `CitizenProfile`: `name` (1 to 60 characters), `age` (integer 1 to 120), and the text fields `idNumber` (24), `phone` (24), `bloodType` (8), `medical` (200), `appearance` (200), `languages` (80) and `emergencyContact` (120), each of which may be empty. Every field is required to be present, text is trimmed, and unknown fields are dropped. An invalid profile rejects the whole request with 400.
- **Privacy:** `locationMode:"manual-demo"` (a demo place) is rounded to 3 decimal places. `"browser-opt-in"` is rounded to 2 (about 1 km). The client only ever sends a demo place: real GPS picks the nearest one in the browser and goes no further.

## Alerts

`Alert` = `{ id, incidentId | null, kind, title, text, source, sourceType, at, validTo | null, local, url | null }`.

- `sourceType:"official"`: a real MET Malaysia weather warning, fetched on the server from `api.data.gov.my` (no key). `local` is true when it names Selangor or the Klang Valley; local warnings come first. Expired warnings and "No Advisory" rows are dropped. Cached for 2 minutes; on failure the last good list is served. Off with `FLARE_LIVE_ALERTS=0`.
- `sourceType:"simulation"`: part of the scenario, released over time after start or reset.

Agency and ministry bulletins are exercise content and always remain simulated. Scenario contours and closure state are fixed; a bulletin does not alter the geometry. Cached official warnings are checked against `validTo` on every read, including during feed failures.

Clients must show which is which.

## Version history

- **v2.2** (17 Nov 2026): added `CitizenProfile`, scenario `demoProfile`, and the optional `profile` on a request, returned with it to the responder. Additive: requests without a profile are unchanged.
- **v2.1** (16 Nov 2026): added scenario `mapPoints` and `roadClosures`, expanded four-area fixtures and announcement timeline. Corrected Civil Defence guidance to the integrated 999 number. Cached weather warnings now expire at their validity boundary.
- **v2.0** (16 Nov 2026): app-first redesign. Added `/api/scenario`, `/api/events`, zone level `severe`, zone `depth`, incident `area` and `summary`, shelter `kind` and `note`, routes, actions, contacts, alert `title`, `sourceType`, `validTo`, `local`, `url`. `description` became optional. **Removed** the recovery feature: `/api/recovery`, `/api/recovery/compare`, `/api/recovery/explain` and their types.
- **v1.2**: `/api/alerts`. **v1.1**: experimental recovery endpoints (removed in v2.0). **v1.0**: first shared contract.
