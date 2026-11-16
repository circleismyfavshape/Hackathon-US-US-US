// Geometry and scenario integrity. Lives here so `npm test` runs it (the client has no test runner).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Ring } from '../../../contracts/types.ts';
import {
  boundsOf,
  bucketByLocation,
  countByStatus,
  dangerAt,
  distanceM,
  metres,
  nearest,
  pointInRing,
  zoneAt,
  zonesGeoJson,
} from '../../../client/src/features/citizen/geo.ts';
import { loadFixtures } from '../../src/seed/index.ts';

const fx = loadFixtures();
const loc = (id: string) => fx.demoLocations.find((l) => l.id === id)!;
const incident = (id: string) => fx.incidents.find((i) => i.id === id)!;

describe('danger check against the Sunway–Monash scenario', () => {
  const sunway = incident('INC-DEMO-004');
  test('Monash University is in the severe zone', () =>
    assert.equal(zoneAt(loc('L7').location, sunway.zones), 'severe'));
  test('South Quay is in the high zone', () =>
    assert.equal(zoneAt(loc('L9').location, sunway.zones), 'high'));
  test('Sun-U Residence is in the moderate zone', () =>
    assert.equal(zoneAt(loc('L8').location, sunway.zones), 'moderate'));
  test('Sunway Pyramid is outside every marked zone', () =>
    assert.equal(zoneAt(loc('L10').location, sunway.zones), 'none'));

  test('dangerAt finds the incident, the worst level and the zone', () => {
    const d = dangerAt(loc('L7').location, fx.incidents);
    assert.equal(d?.incident.id, 'INC-DEMO-004');
    assert.equal(d?.level, 'severe');
    assert.equal(d?.zone.depth, 'Water above 1 m');
    assert.equal(dangerAt(loc('L10').location, fx.incidents), null);
    assert.equal(dangerAt(loc('L1').location, fx.incidents)?.incident.id, 'INC-DEMO-001');
  });
});

describe('scenario integrity', () => {
  test('the default location exists and is in danger, so the lock-screen alert is true', () => {
    const d = dangerAt(loc(fx.defaultLocationId).location, fx.incidents);
    assert.ok(d, 'default location must be inside a marked zone');
  });

  test('every safe zone is outside every marked zone', () => {
    for (const s of fx.shelters) {
      assert.equal(
        dangerAt(s.location, fx.incidents),
        null,
        `${s.id} ${s.name} is inside a flood zone`,
      );
    }
  });

  test('every demo location and safe zone belongs to a known incident and sits inside the demo bounds', () => {
    const ids = new Set(fx.incidents.map((i) => i.id));
    const b = fx.demoBounds;
    for (const p of [...fx.demoLocations, ...fx.shelters]) {
      assert.ok(ids.has(p.incidentId), p.id);
      assert.ok(
        p.location.lat > b.minLat &&
          p.location.lat < b.maxLat &&
          p.location.lng > b.minLng &&
          p.location.lng < b.maxLng,
        p.id,
      );
    }
  });

  test('every location in danger has a route to each safe zone of its incident', () => {
    for (const l of fx.demoLocations) {
      if (!dangerAt(l.location, fx.incidents)) {
        continue;
      }
      for (const s of fx.shelters.filter((x) => x.incidentId === l.incidentId)) {
        assert.ok(
          fx.routes.some((r) => r.fromLocationId === l.id && r.shelterId === s.id),
          `no route ${l.id} -> ${s.id}`,
        );
      }
    }
  });

  test('routes start near their location, end near their safe zone and are at least as long as the straight line', () => {
    for (const r of fx.routes) {
      const from = loc(r.fromLocationId).location;
      const to = fx.shelters.find((s) => s.id === r.shelterId)!.location;
      const [aLng, aLat] = r.coordinates[0];
      const [bLng, bLat] = r.coordinates[r.coordinates.length - 1];
      assert.ok(r.coordinates.length >= 2, r.id);
      assert.ok(
        distanceM(from, { lat: aLat, lng: aLng }) < 400,
        `${r.id} starts far from ${r.fromLocationId}`,
      );
      assert.ok(
        distanceM(to, { lat: bLat, lng: bLng }) < 400,
        `${r.id} ends far from ${r.shelterId}`,
      );
      assert.ok(r.distanceM >= distanceM(from, to) * 0.9 && r.minutes >= 1, r.id);
    }
  });

  test('zone rings are closed, and every level has actions', () => {
    for (const i of fx.incidents) {
      for (const z of i.zones) {
        assert.deepEqual(z.coordinates[0], z.coordinates[z.coordinates.length - 1], z.id);
        assert.ok(fx.actions[z.level].length >= 3 && z.depth && z.label, z.id);
      }
    }
  });

  test('alert seed is ordered by release time and refers to known incidents', () => {
    const ids = new Set(fx.incidents.map((i) => i.id));
    const times = fx.alerts.map((a) => a.afterSeconds);
    assert.deepEqual(
      [...times].sort((a, b) => a - b),
      times,
    );
    assert.ok(fx.alerts.every((a) => ids.has(a.incidentId) && a.title && a.text));
  });
});

describe('pointInRing', () => {
  const square: Ring = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [0, 0],
  ];
  test('uses [lng, lat] order', () => {
    assert.equal(pointInRing({ lat: 1, lng: 1 }, square), true);
    assert.equal(pointInRing({ lat: 1, lng: 3 }, square), false);
    assert.equal(pointInRing({ lat: 3, lng: 1 }, square), false);
  });
  test('concave ring excludes the notch', () => {
    const u: Ring = [
      [0, 0],
      [3, 0],
      [3, 3],
      [2, 3],
      [2, 1],
      [1, 1],
      [1, 3],
      [0, 3],
      [0, 0],
    ];
    assert.equal(pointInRing({ lat: 2, lng: 1.5 }, u), false);
    assert.equal(pointInRing({ lat: 2, lng: 0.5 }, u), true);
  });
});

describe('helpers', () => {
  test('distanceM is about 111 km per degree of latitude', () => {
    assert.ok(Math.abs(distanceM({ lat: 3, lng: 101 }, { lat: 4, lng: 101 }) - 111_195) < 200);
    assert.equal(distanceM({ lat: 3, lng: 101 }, { lat: 3, lng: 101 }), 0);
  });
  test('metres formats short and long distances', () => {
    assert.equal(metres(415), '420 m');
    assert.equal(metres(1588), '1.6 km');
  });
  test('nearest picks the closest item', () => {
    assert.equal(nearest(loc('L7').location, fx.demoLocations).id, 'L7');
    assert.equal(nearest({ lat: 3.0726, lng: 101.6067 }, fx.demoLocations).id, 'L10');
  });
  test('boundsOf is [[minLng, minLat], [maxLng, maxLat]]', () => {
    assert.deepEqual(
      boundsOf([
        { lat: 1, lng: 5 },
        { lat: 3, lng: 2 },
      ]),
      [
        [2, 1],
        [5, 3],
      ],
    );
  });
  test('zonesGeoJson draws the worst level last, with its depth', () => {
    const g = zonesGeoJson(incident('INC-DEMO-004').zones);
    assert.deepEqual(
      g.features.map((f) => f.properties.level),
      ['moderate', 'high', 'severe'],
    );
    assert.equal(g.features[2].properties.depth, 'Water above 1 m');
    assert.equal(g.features[0].geometry.type, 'Polygon');
  });
  test('bucketByLocation groups by nearest demo point and keeps empty buckets', () => {
    const items = [
      { location: loc('L7').location },
      { location: loc('L7').location },
      { location: loc('L1').location },
    ];
    const b = bucketByLocation(items, fx.demoLocations);
    assert.equal(b.get('L7')!.length, 2);
    assert.equal(b.get('L1')!.length, 1);
    assert.equal(b.get('L4')!.length, 0);
    assert.equal(bucketByLocation(items, []).size, 0);
  });
  test('countByStatus', () => {
    assert.deepEqual(
      countByStatus([{ status: 'pending' }, { status: 'pending' }, { status: 'resolved' }]),
      { pending: 2, assigned: 0, resolved: 1 },
    );
  });
});
