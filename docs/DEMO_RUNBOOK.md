# FLARE demo runbook (90 seconds)

Written by Awais, 15 Nov 2026. Every step below was run end to end on main at c4a14c6 (the merge of PR #46, after #39 and #43). Screenshots of each step are in `docs/screenshots/`.

## Before you walk on (2 minutes)

1. `git switch main && git pull && npm install && npm start` (builds the client, serves everything on http://localhost:8787).
2. Reset to a clean state: `curl -X POST http://localhost:8787/api/demo/reset` (or the Reset button in /responder). The responder queue should read 0 pending.
3. Open two browser tabs: **A** `http://localhost:8787/citizen` and **B** `http://localhost:8787/responder`. Put them side by side if you can.
4. **Internet is needed for the map tiles only** (CARTO basemap). Everything else is local. Without it the map still draws the zones and points on a blank canvas.

## The 90 seconds

| Time | Say | Do |
|---|---|---|
| 0:00 | "Disaster apps tell people what happened. The alert, the call for help and the relief stock are usually three separate worlds." | Show the landing page (01): a phone lock screen with an EMERGENCY FLOOD notification. Click the notification to open the citizen interface. |
| 0:10 | "A citizen sees three flood areas, with updates. This is a simulation, labelled on every screen." | Tab A: the overview with 3 areas and the updates feed (02). Click **Shah Alam**. |
| 0:20 | "They say where they are and what is happening." | Click **L1**, leave type as Trapped, press **More people** twice, type "Three people waiting upstairs, water rising" (03, 04). Press **Send SOS**. A real request ID appears, status Pending, with the line "Simulation: no emergency service receives this" (05). |
| 0:40 | "On the responder side that exact request is already in the queue." | Tab B: click the same ID in the queue (06). Press **Assign team** (07). |
| 0:50 | "And the citizen sees it change, with no reload." | Back to tab A: toast "Help is on the way", timeline moves to Team assigned (08). Optionally press **Mark resolved** in tab B and show Resolved in tab A (09). |
| 1:00 | "Then recovery: three centres need more than the store holds. 280 units short." | Open **Recovery** (10). Click **Proportional**, then **Optimized**. Point at who carries the shortfall. |
| 1:20 | "FLARE: from the first alert to the last unmet need." | Stop. |

## If a judge asks

- **Is this real data?** No. It is a labelled simulation: the incidents, zones, shelters and SOS requests are fictional, and no emergency service receives anything. Real deployment would need authoritative feeds, authenticated responders and verified shelter data.
- **Is there AI?** The numbers come from deterministic code. The optional "Summarise the trade-offs" button only explains the engine's numbers and hides itself when no key is set.
- **Why does Optimized show 56% under Proportional's 63% in the LOWEST column?** LOWEST is each centre's pooled share. The engine guarantees a minimum per resource, which is 55%: it ties Proportional and beats Equal share (43%) and Priority first (0%). (Ahmed's check, not a bug.)
- **Is the map live?** The dots and counts update every 2.5 seconds from our own backend. The base map is CARTO/OpenStreetMap tiles. The flood zones are illustrative, not measured.

## If something breaks

| Problem | Do this |
|---|---|
| Map tiles do not load | Carry on. The zones, pins and SOS still work on a blank canvas. |
| Map says it could not start (no WebGL) | Carry on. The location list and form still work. |
| Request does not appear in the responder queue | Reload tab B. The queue is the same backend. If still missing, reset and redo. |
| Page is stale or odd | Reload both tabs. State lives in the server, not the page. |
| Server restarted | State is reseeded (in memory by design). Reset and start again. |
| Everything is down | Show the screenshots in `docs/screenshots/` in order 01 to 12. |

## What is verified and what is not

Verified end to end on main: typecheck, build, npm test 81/81, and a real two-tab run (create, assign, resolve) with the citizen tab following each step, plus /recovery numbers against the engine (Ahmed), and the 390 px citizen view with no overflow.

Not verified: real browser GPS on a phone, a real touch device, a live AI summary (no key), a device with no WebGL, and the responder on a phone.

Known cosmetic issue: on the citizen overview the "Subang Jaya" chip is partly covered by a relief-centre icon. It does not affect the demo path.

Real public data (MET Malaysia warnings) is NOT in the demo. See `docs/REAL_DATA.md`. Do not claim live data unless it has been merged and tested.
