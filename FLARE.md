# FLARE

**From the first alert to the last unmet need.**

> Hackathon demonstration. All data is simulated. No emergency service receives anything sent here.

## What FLARE is, in one line

Alerts, requests for help and relief supplies usually live in separate systems. FLARE keeps them on one line, so a single request can be followed from the person who sent it to the supplies that still have to reach them.

## Three core ideas, three interfaces

| # | Interface | Route | The one thing it must prove |
|---|---|---|---|
| 01 | **Citizen** | `/citizen` | A live map of every flood area with a feed of sourced updates. Pick an area: it is highlighted, and the person can check their location, send a request, get a real ID back and watch its status change. |
| 02 | **First responder** | `/responder` | That same request (same ID) shows up in a live queue and on the map. Assigning a team or resolving it reaches the citizen within seconds. |
| 03 | **Recovery** | `/recovery` | When stock is short, four allocation strategies give different centres the shortfall. Every unit is shown; nothing is hidden in a total. |

`/` is the front door: one sentence of purpose and a link into each interface with a live figure.

Anything that does not serve one of those three proofs is out. That is the test for new work.

## What we questioned and changed (15 Nov, lead: Sajid)

The first build worked end to end, but it was three separate products: each page had its own layout, colours, fonts, header and wording, and Recovery was buried at the bottom of the responder page. A judge could not tell it was one system. So:

1. **One shell.** Every route renders the same header: logo, the three numbered interfaces, and the simulation label. The yellow banner is gone; the label lives in the header (and as a strip on phones), so it is still on every view.
2. **One visual system.** Paper and ink, hairline rules, mono labels for data. The logo orange is the only signal colour and always means "needs attention": a pending request, an unmet need, the high-impact zone. Amber means in progress, green means done. Nothing else is coloured.
3. **One map.** Citizen and responder use the same map component, zones, pins and legend. The citizen picks a location on it; the responder picks a request on it.
4. **Recovery is its own interface** at `/recovery`, not a panel. It leads with the gap ("280 units short"), then compares strategies by the share of each centre's request that is met.
5. **Same words everywhere.** Pending, Team assigned, Resolved. Request IDs are shown the same way on both sides.

Not changed: the backend, the API contract (v1.1), the allocation engine and all tests.

## Demo script (about 80 seconds, two browser tabs on one server)

1. `/` Read the headline. Point at the three numbered rows.
2. `/citizen` Click **L1** on the map (inside the high-impact zone). Choose *Trapped*, 3 people, type a line, **Send demo SOS**. Read out the ID.
3. `/responder` in the second tab. The same ID is at the top of the queue and pulsing on the map. **Assign demo team**.
4. Back to the citizen tab: it already says *Team assigned*. In the responder tab, **Mark resolved**; the citizen tab follows.
5. `/recovery` "280 units short. Who goes without?" Click through the four strategies: *Priority first* leaves Centre C with 7%; *Proportional* gives everyone about 65%.
6. Close: "One request, followed from alert to recovery."

Before the pitch: **Reset demo** (bottom of the responder detail panel) clears every request.

## Notifications and phone view

Both interfaces get live notifications. Citizen: new sourced updates ("New flood spotted near Bukit Raja · River gauge KL-11") and changes to their own request. Responder: each new request ("3 people stuck · Seksyen 13, near the stadium · send help"). Updates come from `GET /api/alerts`, released over time after the server starts or is reset.

**Phone view** (`/phone/citizen`, `/phone/responder`, or the button in the header) shows the same live page inside an iPhone frame. It scrolls, and notifications drop in at the top.

## Run (Node 20.19 or newer, npm)

```bash
npm install
npm start          # builds the client and serves everything on http://localhost:8787
npm run dev        # live reload: client on http://localhost:5173, API on :8787
npm test           # server and engine tests
npm run build      # client build and server typecheck
```

The map needs internet for street tiles. Offline it falls back to zones and pins on a blank canvas, and without WebGL the panels still work. `ANTHROPIC_API_KEY` is optional: with it, Recovery offers an AI summary of the engine's numbers; without it that button hides itself.

## Where things live

| Path | What |
|---|---|
| `client/src/flare/` | The whole front end: `flare.css` (design system), `ui.tsx` (shell and shared pieces), `FlareMap.tsx` (shared map), `Landing`, `Citizen`, `Responder`, `Recovery` |
| `client/src/App.tsx` | Routes only |
| `client/src/shared/` | Typed API client, logo |
| `client/src/features/citizen/geo.ts`, `zone.ts` | Geometry and zone wording, reused by the shared map |
| `client/src/components/ui/map.tsx` | mapcn map component |
| `contracts/` | API contract v1.1, shared types, seed data |
| `server/src/` | Single Hono server; `recovery/` is the allocation engine |

The earlier page code in `client/src/features/citizen/` and `client/src/features/responder/` is no longer routed. It stays in the repo until after the freeze so nothing is lost; remove it afterwards with its owners.

## Design rules (so new work stays consistent)

- Use the classes in `flare.css`. Do not add a new colour, font, radius or shadow.
- Orange is for attention only. If something is orange, a person should act on it.
- Labels are mono, uppercase, small. Body text is sentence case.
- Say what is simulated in plain words, once, where it matters. Never imply an area is safe or that a route is suggested.

## People

Sajid (`@69sxjid`) lead, backend, integration and the unified front end. Awais (`@Vais1`) map and geometry. Khaled (`@jeffyoh312`) responder workflows and QA. Ahmed (`@circleismyfavshape`) allocation engine and logo.

## Limits

Synthetic data only. No sign-in. Requests are held in memory and reset when the server restarts. Zones are illustrative, not a measured flood footprint. Shelters and teams are fictional.
