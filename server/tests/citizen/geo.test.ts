// OWNER: D1. Lives here so `npm test` runs it (client has no test runner).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fixtures from '../../../contracts/demo-fixtures.json' with { type: 'json' };
import type { Incident, Ring } from '../../../contracts/types.ts';
import { boundsOf, bucketByLocation, countByStatus, nearest, pointInRing, zoneAt, zonesGeoJson } from '../../../client/src/features/citizen/geo.ts';

const incident = fixtures.incidents[0] as Incident;
const loc = (id: string) => fixtures.demoLocations.find((l) => l.id === id)!;

describe('zoneAt against the fixture', () => {
  test('L1 is in the high zone', () => assert.equal(zoneAt(loc('L1').location, incident.zones), 'high'));
  test('L2 is only in the moderate zone', () => assert.equal(zoneAt(loc('L2').location, incident.zones), 'moderate'));
  test('L3 is outside all depicted zones', () => assert.equal(zoneAt(loc('L3').location, incident.zones), 'none'));
});

describe('pointInRing', () => {
  const square: Ring = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
  test('uses [lng, lat] order', () => {
    assert.equal(pointInRing({ lat: 1, lng: 1 }, square), true);
    assert.equal(pointInRing({ lat: 1, lng: 3 }, square), false);
    assert.equal(pointInRing({ lat: 3, lng: 1 }, square), false);
  });
  test('concave ring excludes the notch', () => {
    const u: Ring = [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]];
    assert.equal(pointInRing({ lat: 2, lng: 1.5 }, u), false);
    assert.equal(pointInRing({ lat: 2, lng: 0.5 }, u), true);
  });
});

describe('nearest', () => {
  test('snaps a raw GPS fix to the closest demo location', () => {
    assert.equal(nearest({ lat: 3.0731, lng: 101.5201 }, fixtures.demoLocations).id, 'L1');
    assert.equal(nearest({ lat: 1.35, lng: 103.82 }, fixtures.demoLocations).id, 'L3');
  });
});

describe('map helpers', () => {
  test('boundsOf encloses every point as [[minLng, minLat], [maxLng, maxLat]]', () => {
    const pts = [...fixtures.shelters.map((s) => s.location), ...fixtures.demoLocations.map((l) => l.location)];
    const [[w, s], [e, n]] = boundsOf(pts);
    assert.ok(w < e && s < n);
    for (const p of pts) assert.ok(p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n);
  });
  test('zonesGeoJson keeps level, label and the [lng, lat] ring', () => {
    const fc = zonesGeoJson(incident.zones);
    assert.equal(fc.features.length, incident.zones.length);
    assert.deepEqual(fc.features[0].properties, { level: incident.zones[0].level, label: incident.zones[0].label });
    assert.deepEqual(fc.features[0].geometry.coordinates[0], incident.zones[0].coordinates);
  });
});

describe('live request helpers', () => {
  const reqs = [
    { id: 'a', status: 'pending' as const, location: loc('L1').location },
    { id: 'b', status: 'assigned' as const, location: loc('L1').location },
    { id: 'c', status: 'resolved' as const, location: { lat: 3.0731, lng: 101.5201 } },
    { id: 'd', status: 'pending' as const, location: loc('L3').location },
  ];
  test('bucketByLocation groups by nearest demo point and keeps empty spots', () => {
    const b = bucketByLocation(reqs, fixtures.demoLocations);
    assert.deepEqual(b.get('L1')!.map((r) => r.id), ['a', 'b', 'c']);
    assert.deepEqual(b.get('L3')!.map((r) => r.id), ['d']);
    assert.deepEqual(b.get('L2'), []);
  });
  test('countByStatus counts every status, zero included', () => {
    assert.deepEqual(countByStatus(reqs), { pending: 2, assigned: 1, resolved: 1 });
    assert.deepEqual(countByStatus([]), { pending: 0, assigned: 0, resolved: 0 });
  });
});
