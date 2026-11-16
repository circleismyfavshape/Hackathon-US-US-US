# FLARE walkthrough

This tour follows one citizen request through both sides of the application, then compares the other areas. Use fictional request details.

## Start the app

From the repository root, run `npm ci` and `npm start`. On Windows PowerShell, use `npm.cmd ci` and `npm.cmd start` if scripts are restricted. Open two tabs: `http://localhost:8787/` and `http://localhost:8787/responder`.

Press **Reset** in the viewer bar. This clears requests and restarts the update timeline. Weather and tiles need internet; guidance, stored routes and the local request flow do not depend on a live weather response.

## Follow one request

1. Tap the lock-screen **EMERGENCY FLOOD** alert. The citizen starts at Monash University in the severe illustrated zone.
2. Read the immediate steps, contacts and relief options. The note outside the phone explains this feature.
3. Open **Map**. Read the severity contours, labelled shelters and medical point, police/fire posts and closure segments. Tap a marker for details. Use **Map layers** to toggle operational context.
4. Open **News**. Area bulletins say **Simulated**. The separate official section shows live MET Malaysia warnings if available. Fictional agency bulletins arrive as the exercise progresses.
5. Open **Get help**, choose a need and number of people, and send a request. Additional details are optional. Note the request ID.
6. In the responder tab, select that ID. Choose a team and press **Send**. The citizen should show **Team on the way** without a reload.
7. Resolve the request. The citizen should show **Resolved**.
8. Change **Citizen is at** to Sunway Pyramid. The guide should switch to the outside-zone view. Change it back to Monash to raise the alert again.

## Compare the other areas

Select Jalan Mewah in Shah Alam, USJ 9 in Subang Jaya and Bukit Raja western approach in Klang. Each has severe, high and moderate example locations, an outside-zone location, two relief points, a medical point and operational context. [SCENARIOS.md](SCENARIOS.md) lists the location IDs and timeline.

The screenshot set includes the citizen flow, responder console and a desktop view of each additional area. The map's route line does not avoid floods or illustrated closures; marker details and route text state this limit.

## Browser checks

Playwright is a pinned development dependency. Install Chromium once:

```bash
npm ci
npx playwright install chromium
npm run build
```

On PowerShell, use `npx.cmd playwright install chromium`.

Start a dedicated server in one terminal:

```bash
PORT=8793 FLARE_LIVE_ALERTS=0 npm start -w server
```

In PowerShell:

```powershell
$env:PORT = '8793'
$env:FLARE_LIVE_ALERTS = '0'
npm.cmd start -w server
```

In another terminal, from the repository root:

```bash
npm run e2e
```

Use `npm.cmd run e2e` on PowerShell. The script resets the test server before and after the run, exercises the full flow, and updates `docs/screenshots`. `FLARE_TEST_URL` selects another server. `FLARE_SCREENSHOTS_DIR` redirects images to another folder for a local verification run.

The checks include dispatch failure and retry, all-area map layers, keyboard popups, feature notes, repeated role/device switches, mobile overflow, an initial connection failure and the blank-basemap fallback. They do not place real emergency calls.

## Troubleshooting

| Symptom              | Action                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| API connection error | Start the server and use the matching port; retry from the error state.                                             |
| Basemap unavailable  | Scenario layers should remain on a blank background. Guidance and requests still work.                              |
| No official warnings | There may be none in force, or the feed may be unavailable. Do not describe scenario bulletins as official reports. |
| Old requests         | Reset the scenario.                                                                                                 |
| Slow walking path    | The road network can require a detour. It does not establish safe evacuation access.                                |
| Port already in use  | Stop the previous local server or choose a different `PORT`; adjust `FLARE_TEST_URL` when testing.                  |
