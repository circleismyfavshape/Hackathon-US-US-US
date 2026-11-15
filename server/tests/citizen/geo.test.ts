// OWNER: D1. Lives here so `npm test` runs it (client has no test runner).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fixtures from '../../../contracts/demo-fixtures.json' with { type: 'json' };
import type { Incident, Ring } from '../../../contracts/types.ts';
import { incidentPoints, nearest, pointInRing, projector, zoneAt } from '../../../client/src/features/citizen/geo.ts';

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

describe('projector', () => {
  test('keeps every point inside the box, north up', () => {
    const pts = incidentPoints(incident, [...fixtures.shelters.map((s) => s.location), ...fixtures.demoLocations.map((l) => l.location)]);
    const pr = projector(pts);
    for (const p of pts) {
      const [x, y] = pr.xy(p);
      assert.ok(x >= 0 && x <= pr.width && y >= 0 && y <= pr.height, `${JSON.stringify(p)} -> ${x},${y}`);
    }
    assert.ok(pr.xy({ lat: 3.09, lng: 101.52 })[1] < pr.xy({ lat: 3.07, lng: 101.52 })[1]);
  });
});
