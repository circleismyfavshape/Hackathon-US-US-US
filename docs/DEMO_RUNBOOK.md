# FLARE demo runbook (about two minutes)

Every step below is run automatically by `node tools/e2e.mjs`, which also retakes the screenshots in `docs/screenshots/`.

## Before you walk on

1. `git switch main && git pull && npm install && npm start`. This builds the client and serves everything on <http://localhost:8787>.
2. Open two browser tabs: **A** on `http://localhost:8787/` and **B** on `http://localhost:8787/responder`.
3. Press **Reset** in the top bar of either tab. The responder queue should be empty.
4. Internet is needed for the map's streets and buildings and for the official weather warnings. Without it the map still draws zones, pins and routes on a blank canvas, and the news shows the simulated updates only.

## The run

| Say | Do |
|---|---|
| "A flood app usually shows you a map of everything. If you are standing in rising water, you need three things: am I in danger, what do I do, where do I go." | Tab A: the lock screen (screenshot 01). |
| "FLARE knows where the phone is. It is inside a flood zone, so it alerts the person." | Tap the **EMERGENCY FLOOD** alert. |
| "It does not open a dashboard. It opens a guide: what to do now, call 999, and the nearest safe zone with a walking time." | The emergency guide (02). Scroll once to the safe zones. |
| "The map is 3D. Red, orange and amber are damage levels. Green is a safe zone, and that is the walking route on real roads." | Tap **Map** (03). Tap a different time pill to switch safe zone. |
| "News is separate and readable. Official warnings are live from MET Malaysia. Scenario updates are labelled simulated." | Tap **News** (04). |
| "If they cannot leave, they ask for help in three taps. No typing." | Tap **Get help**, pick *Trapped*, set people to 3, **Send request** (05). Read out the ID. |
| "The responder has it already." | Tab B: the same ID is in the queue and on the map (06). Click it, then **Send Rescue Team Alpha**. |
| "And the person knows help is coming, within a second." | Tab A: *Team on the way*, with a notification (07). |
| "This switch is outside the phone because it is not part of the app. It lets you move the person." | Tab A, top bar: set **Citizen is at** to *Sunway Pyramid*. The app goes calm (08). Set it back to *Monash University*: the alert returns. |

Close with: "FLARE tells you what to do next, and shows you that someone is coming."

## If something goes wrong

| Problem | Do this |
|---|---|
| The map is blank or slow | Carry on. The guide, safe zones and walking times do not need it. Say "the map needs the venue network". |
| The page says the server is not running | Restart `npm start`, reload the tab. |
| Old requests in the queue | Press **Reset**. |
| No official warnings in News | The MET Malaysia feed is unreachable or has nothing in force. The simulated updates still show. Do not claim live data on stage unless you can see an item labelled *Official*. |
| Everything is down | Show `docs/screenshots/` in order, 01 to 09. |

## Questions you may get

- **Is the flood real?** No. Floods, zones, safe zones and teams are simulated, and every screen says so. The weather warnings and the road network are real.
- **How does it know I am in danger?** It tests the location against each zone's outline, worst level first. In the demo the location is one of ten places you pick in the top bar; real GPS can choose the nearest of them and never leaves the browser.
- **Do the routes avoid flooded roads?** No, and the app says so. They are real walking routes computed in advance. Knowing which roads are passable needs live road data, which is the next step.
- **How fast are updates?** Under a second. The server pushes a message to every open page when anything changes.
