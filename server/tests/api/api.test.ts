import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { Sos } from '../../../contracts/types.ts';
import { createApp } from '../../src/app.ts';

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp();
});

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const validSos = {
  incidentId: 'INC-DEMO-001',
  people: 3,
  type: 'trapped',
  description: 'Three people waiting upstairs (demo)',
  location: { lat: 3.073, lng: 101.52 },
  locationMode: 'manual-demo',
};

describe('health + read-only data', () => {
  test('GET /api/health', async () => {
    const r = await app.request('/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { status: 'ok', mode: 'demo' });
  });

  test('incidents and shelters are labelled simulation', async () => {
    const inc = (await (await app.request('/api/incidents')).json()) as any[];
    assert.equal(inc.length, 3);
    assert.equal(inc[0].sourceType, 'simulation');
    assert.ok(inc[0].zones.length >= 1);
    const sh = (await (await app.request('/api/shelters')).json()) as any[];
    assert.ok(sh.length >= 1 && sh.every((s) => s.sourceType === 'simulation'));
  });

  test('GET /api/recovery returns 3 centres + inventory', async () => {
    const r = (await (await app.request('/api/recovery')).json()) as any;
    assert.equal(r.centres.length, 3);
    assert.deepEqual(r.inventory, { water: 220, food: 200, hygiene: 90 });
  });
});

describe('SOS lifecycle', () => {
  test('create -> get -> list -> assign -> resolve', async () => {
    const c = await app.request('/api/sos', json('POST', validSos));
    assert.equal(c.status, 201);
    const created = (await c.json()) as Sos;
    assert.match(created.id, /^SOS-[0-9A-F]{8}$/);
    assert.equal(created.status, 'pending');
    assert.equal(created.assignedTeam, null);

    const g = (await (await app.request(`/api/sos/${created.id}`)).json()) as Sos;
    assert.equal(g.id, created.id);

    const list = (await (await app.request('/api/sos')).json()) as Sos[];
    assert.deepEqual(list.map((s) => s.id), [created.id]);

    const a = await app.request(`/api/sos/${created.id}`, json('PATCH', { status: 'assigned', assignedTeam: 'Demo Rescue A' }));
    assert.equal(a.status, 200);
    const after = (await (await app.request(`/api/sos/${created.id}`)).json()) as Sos;
    assert.equal(after.status, 'assigned');
    assert.equal(after.assignedTeam, 'Demo Rescue A');

    await app.request(`/api/sos/${created.id}`, json('PATCH', { status: 'resolved' }));
    const done = (await (await app.request(`/api/sos/${created.id}`)).json()) as Sos;
    assert.equal(done.status, 'resolved');
    assert.equal(done.assignedTeam, 'Demo Rescue A');
  });

  test('ids are unique', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) ids.add(((await (await app.request('/api/sos', json('POST', validSos))).json()) as Sos).id);
    assert.equal(ids.size, 20);
  });

  test('browser-opt-in coordinates are coarsened to 2 dp', async () => {
    const r = await app.request('/api/sos', json('POST', { ...validSos, location: { lat: 3.07345, lng: 101.52178 }, locationMode: 'browser-opt-in' }));
    const s = (await r.json()) as Sos;
    assert.deepEqual(s.location, { lat: 3.07, lng: 101.52 });
  });

  for (const [name, patch] of [
    ['missing body', undefined],
    ['malformed json', '{nope'],
    ['negative people', { people: -1 }],
    ['zero people', { people: 0 }],
    ['fractional people', { people: 2.5 }],
    ['bad type', { type: 'pizza' }],
    ['empty description', { description: '   ' }],
    ['long description', { description: 'x'.repeat(281) }],
    ['unknown incident', { incidentId: 'NOPE' }],
    ['location outside demo area', { location: { lat: 51.5, lng: -0.12 } }],
    ['bad locationMode', { locationMode: 'gps' }],
  ] as const) {
    test(`rejects ${name}`, async () => {
      const body = patch === undefined ? '' : typeof patch === 'string' ? patch : { ...validSos, ...patch };
      const r = await app.request('/api/sos', json('POST', body));
      assert.equal(r.status, 400);
      assert.equal(((await r.json()) as any).error, 'invalid SOS');
    });
  }

  test('unknown id -> 404 for GET and PATCH', async () => {
    assert.equal((await app.request('/api/sos/SOS-NOPE')).status, 404);
    assert.equal((await app.request('/api/sos/SOS-NOPE', json('PATCH', { status: 'resolved' }))).status, 404);
  });

  test('invalid patch -> 400', async () => {
    const s = (await (await app.request('/api/sos', json('POST', validSos))).json()) as Sos;
    assert.equal((await app.request(`/api/sos/${s.id}`, json('PATCH', { status: 'assigned' }))).status, 400);
    assert.equal((await app.request(`/api/sos/${s.id}`, json('PATCH', { status: 'done' }))).status, 400);
  });

  test('demo reset clears SOS', async () => {
    await app.request('/api/sos', json('POST', validSos));
    await app.request('/api/demo/reset', { method: 'POST' });
    assert.deepEqual(await (await app.request('/api/sos')).json(), []);
  });
});

describe('recovery compare route', () => {
  test('rejects unknown strategy', async () => {
    assert.equal((await app.request('/api/recovery/compare', json('POST', { strategy: 'magic' }))).status, 400);
  });

  test('valid strategy reaches the engine (200 once D4 merges, 501 before)', async () => {
    const r = await app.request('/api/recovery/compare', json('POST', { strategy: 'priority-first' }));
    assert.ok(r.status === 200 || r.status === 501, `got ${r.status}`);
    // Stored inventory is never mutated by a comparison.
    const rec = (await (await app.request('/api/recovery')).json()) as any;
    assert.deepEqual(rec.inventory, { water: 220, food: 200, hygiene: 90 });
  });
});
