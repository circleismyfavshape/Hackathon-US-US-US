// Refresh stored walking paths after changing scenario places. No route requests run in the app.
// Usage: node tools/update-routes.mjs [--all]
// Missing routes are added by default. --all also rebuilds paths after coordinates change.
import { readFile, writeFile } from 'node:fs/promises';

const fixturePath = new URL('../contracts/demo-fixtures.json', import.meta.url);
const scenario = JSON.parse(await readFile(fixturePath, 'utf8'));
const rebuildAll = process.argv.includes('--all');
const endpoint = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/';
const routes = [];

for (const place of scenario.demoLocations) {
  for (const shelter of scenario.shelters.filter((item) => item.incidentId === place.incidentId)) {
    const existing = scenario.routes.find(
      (route) => route.fromLocationId === place.id && route.shelterId === shelter.id,
    );
    if (existing && !rebuildAll) {
      routes.push(existing);
      continue;
    }

    const from = `${place.location.lng},${place.location.lat}`;
    const to = `${shelter.location.lng},${shelter.location.lat}`;
    const response = await fetch(
      `${endpoint}${from};${to}?overview=simplified&geometries=geojson`,
      {
        signal: AbortSignal.timeout(20_000),
        headers: { 'user-agent': 'FLARE scenario route maintenance' },
      },
    );
    if (!response.ok) {
      throw new Error(`Route service returned ${response.status} for ${place.id} → ${shelter.id}`);
    }
    const result = await response.json();
    const route = result.routes?.[0];
    if (result.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
      throw new Error(`No walking path for ${place.id} → ${shelter.id}. Fixture was not written.`);
    }
    routes.push({
      id: `RT-${place.id}-${shelter.id}`,
      fromLocationId: place.id,
      shelterId: shelter.id,
      distanceM: Math.round(route.distance),
      minutes: Math.max(1, Math.ceil(route.duration / 60)),
      coordinates: route.geometry.coordinates,
    });
    console.log(`${place.id} → ${shelter.id}: ${Math.round(route.distance)} m`);
    // Respect the public routing service: sequential requests, at most one per second.
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
}

// Save only after every route succeeds, so an outage leaves the original fixture intact.
scenario.routes = routes;
await writeFile(fixturePath, `${JSON.stringify(scenario, null, 2)}\n`);
console.log(`Saved ${routes.length} walking routes. Run npm run format next.`);
