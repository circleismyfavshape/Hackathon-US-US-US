# FLARE — From Disaster Response to Recovery

> **HACKATHON DEMO — simulated disaster data; not an emergency service.** No SOS reaches real responders.

One app, one Hono backend, two portals: **`/citizen`** (simulated Shah Alam flood, zones, shelters, SOS and live status) and **`/responder`** (SOS queue, assign/resolve, RecoveryGap allocation comparison).

- Blueprint: [FLARE_TEAM_AUTOPILOT.md](FLARE_TEAM_AUTOPILOT.md) (r1). History: [FLARE_CLAUDE_HANDOFF_AND_CHAT_HISTORY.md](FLARE_CLAUDE_HANDOFF_AND_CHAT_HISTORY.md)
- API contract (frozen v1): [contracts/API_CONTRACT.md](contracts/API_CONTRACT.md) · types: [contracts/types.ts](contracts/types.ts) · seed: [contracts/demo-fixtures.json](contracts/demo-fixtures.json)

## Run (Node ≥ 20.19, npm)

```bash
npm install
npm run dev        # client http://localhost:5173 (proxies /api) + API :8787
npm start          # build client, serve everything on http://localhost:8787 (use for the two-tab demo)
npm test           # server API + recovery tests
npm run build      # client build + server typecheck
```

## Who owns what

| Slot | Paths |
|---|---|
| D1 Citizen UI | `client/src/features/citizen/**` |
| D2 Backend + integration (`@69sxjid`) | root config, `contracts/**`, `client/src/{App,main}.tsx`, `client/src/shared/**`, `server/src/**` except `recovery/`, `server/tests/api/**` |
| D3 Responder UI | `client/src/features/responder/**` |
| D4 RecoveryGap engine | `server/src/recovery/**`, `server/tests/recovery/**` |

## Limitations

The data is synthetic. There's no auth, and the SOS store is in-memory (it resets on restart). The zones are illustrative, not measured, and shelters are fictional. It isn't connected to any emergency service.
