# FLARE API Contract — v1 FROZEN

**Owner:** D2 / `@69sxjid`. **Frozen:** 15 Nov 2026, ~11:30 MYT. Changes = one versioned D2 commit + a board post. Everyone else conforms.

- **Types (source of truth):** [`contracts/types.ts`](types.ts) — import with `import type { … } from '../../../contracts/types.ts'` (client code: use `client/src/shared/api.ts`, which re-exports them).
- **Seed data (source of truth):** [`contracts/demo-fixtures.json`](demo-fixtures.json). The server loads it at startup and on reset. Client mocks should import the same file.
- **Base URL:** same origin `/api`. Dev: Vite on `:5173` proxies to Hono on `:8787`. `npm start` serves everything on `:8787`.
- **Casing:** camelCase everywhere. **Coordinates:** REST `{lat,lng}`; GeoJSON rings `[lng,lat]`.
- **Errors:** `{ "error": string, "details"?: string[] }` with 400 (validation), 404 (unknown id/route), 409 (demo SOS cap of 500 reached), 501 (recovery engine not merged yet).

## Endpoints

| Method | Path | Request | 2xx response |
|---|---|---|---|
| GET | `/api/health` | — | `{ status:"ok", mode:"demo" }` |
| GET | `/api/incidents` | — | `Incident[]` (all `sourceType:"simulation"`) |
| GET | `/api/shelters` | — | `Shelter[]` (fictional, `status:"demo-listed"`, not verified open) |
| GET | `/api/demo/config` | — | `{ demoLocations, demoBounds, demoTeams }` (for the location picker and the assign dropdown) |
| POST | `/api/sos` | `SosCreate` | **201** `Sos` with generated `id` (`SOS-XXXXXXXX`), `status:"pending"`, `assignedTeam:null` |
| GET | `/api/sos` | — | `Sos[]` oldest first. **Demo responder only. Never public in a real system.** |
| GET | `/api/sos/:id` | — | `Sos` (citizen polls this every 2–3 s) |
| PATCH | `/api/sos/:id` | `{status:"assigned",assignedTeam}` \| `{status:"resolved"}` \| `{status:"pending"}` | `Sos` (updated). `resolved` keeps `assignedTeam`; `pending` clears it |
| GET | `/api/recovery` | — | `RecoverySnapshot` `{ centres[3], inventory }` |
| POST | `/api/recovery/compare` | `{ strategy: "priority-first"\|"proportional"\|"equal-share" }` | `ComparisonResult` (see below). **501 until D4's engine merges.** Never mutates inventory |
| POST | `/api/demo/reset` | — | `{ status:"reset", mode:"demo" }` reseeds and clears all SOS |

## SOS validation (server-enforced)

- `incidentId` must exist. `people` is an integer 1–50. `type` ∈ `trapped | medical-help | supplies | other`. `description` is 1–280 chars after trimming.
- `location` must be inside `demoBounds` (Shah Alam demo box).
- **Privacy (blueprint fix E1):** `locationMode:"manual-demo"` (default; a fixture point) is rounded to 3 dp. `"browser-opt-in"` is rounded to 2 dp (~1 km). **D1:** if you use browser geolocation, use it locally for the zone check and **snap to the nearest `demoLocations` point before POST**. Never send raw GPS. No names, phones or addresses in `description` (the UI should say so).

## ComparisonResult (D4 produces, D2 serves, D3 renders)

```ts
{
  strategy: Strategy,
  allocations: { centreId, allocated: {water,food,hygiene}, unmet: {water,food,hygiene} }[], // all 3 centres
  inventoryRemaining: {water,food,hygiene},
  totals: { requested, allocated, unmet },        // each {water,food,hygiene}
  explanation: string[],                          // template sentences built from the numbers, no LLM
  assumptions: string[],
  status: "demo-only"
}
```

Engine signature (D4, `server/src/recovery/index.ts`): `compareAllocations(snapshot: RecoverySnapshot, strategy: Strategy): ComparisonResult`. It is pure and deterministic, uses nonnegative integers, keeps `Σallocated ≤ inventory` and `allocated ≤ need` per resource, and must not mutate its input. The route already passes a `structuredClone`.
