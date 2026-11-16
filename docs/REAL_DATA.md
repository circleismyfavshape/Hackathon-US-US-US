# What is real and what is simulated

## Real

| What | Source | How it is used |
|---|---|---|
| Weather warnings | MET Malaysia, through `https://api.data.gov.my/weather/warning/` (no key, free) | Fetched on the server (`server/src/live/met.ts`), shown in **News** under "Official weather warnings", each with its issue time, labelled *Official*. New ones raise a notification. |
| Streets and buildings on the map | OpenStreetMap contributors, served by OpenFreeMap | The 3D basemap. |
| Place names | Real places in Bandar Sunway, Shah Alam, Subang Jaya and Klang | Demo locations and safe zones are named after them. |
| Walking routes | OpenStreetMap road network (ODbL), computed once with the OSRM foot profile and stored in `contracts/demo-fixtures.json` | Drawn on the map with distance and walking time. |
| Phone numbers | 999, 991 (Civil Defence), NADMA 03-8064 2400 | Shown under "Who to contact". |

## Simulated

Every flood, every zone outline and damage level, every safe zone's status, every team, every scenario update and every request. Zones are illustrative shapes, not a measured flood footprint. A safe zone named after a real building does not mean that building is a relief centre.

## Rules the code keeps

- Real and simulated news are never mixed in one list, and each item says which it is.
- Real data never blocks the app. The MET fetch has a 4 second timeout. A good answer is cached for 2 minutes; after a failure the last good list is served and the failure is cached for 30 seconds, so a dead network does not slow every request.
- The official feed is on by default and can be turned off with `FLARE_LIVE_ALERTS=0`.
- Expired warnings and "No Advisory" rows are dropped. Warnings that name Selangor or the Klang Valley are listed first; warnings for other states are kept and marked "Other states", so the list is not empty on a quiet day for Selangor.
- A route follows real roads but does not know which of them are flooded. The app says so next to every route.
- Real GPS is opt-in, stays in the browser, and only selects the nearest demo place.

## Honest limits for a pitch

MET Malaysia's warnings are regional weather warnings (thunderstorms, continuous rain, strong winds). They are not a flood alert for a street. The claim that is true: *a simulated flood scenario with a real, live official weather-warning feed and real map data.*

## Sources checked and not used

- MET Malaysia forecast and Open-Meteo rain and river discharge: all work and need no key, but they add numbers a person in danger does not need.
- Overpass for real shelter locations: returned nothing usable in the time available, so safe zones stay simulated.
- None of these APIs send a CORS header, so they must be called from the server, not the browser.
