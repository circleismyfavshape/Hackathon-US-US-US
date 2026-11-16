import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { Alert, Scenario, Sos } from '../../../contracts/types.ts';
import { createApp, watchFeed } from '../../src/app.ts';
import { DemoStore } from '../../src/store/store.ts';

let app: ReturnType<typeof createApp>;
let store: DemoStore;
beforeEach(() => {
  store = new DemoStore();
  app = createApp(store);
});

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const validSos = {
  incidentId: 'INC-DEMO-004',
  people: 3,
  type: 'trapped',
  description: 'Three people waiting upstairs (demo)',
  location: { lat: 3.0639, lng: 101.6008 },
  locationMode: 'manual-demo',
};

describe('health + read-only data', () => {
  test('GET /api/health', async () => {
    const r = await app.request('/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { status: 'ok', mode: 'demo' });
  });

  test('GET /api/scenario returns the whole scenario, labelled simulation, without the alert seed', async () => {
    const s = (await (await app.request('/api/scenario')).json()) as Scenario & {
      alerts?: unknown;
    };
    assert.equal(s.incidents.length, 4);
    assert.equal(s.incidents[0].area, 'Sunway–Monash');
    assert.ok(
      s.incidents.every(
        (i) =>
          i.sourceType === 'simulation' &&
          i.zones.length >= 1 &&
          !Number.isNaN(Date.parse(i.updatedAt)),
      ),
    );
    assert.ok(s.shelters.every((x) => x.sourceType === 'simulation' && x.status === 'demo-listed'));
    assert.ok(s.routes.length > 0 && s.contacts.length > 0 && s.demoTeams.length > 0);
    assert.equal(s.alerts, undefined);
  });

  test('incident times are recent, not a fixed date', async () => {
    const s = (await (await app.request('/api/scenario')).json()) as Scenario;
    for (const i of s.incidents) {
      assert.ok(Date.now() - Date.parse(i.updatedAt) < 60 * 60_000);
    }
  });

  test('older endpoints still answer', async () => {
    assert.equal(((await (await app.request('/api/incidents')).json()) as unknown[]).length, 4);
    assert.ok(((await (await app.request('/api/shelters')).json()) as unknown[]).length >= 4);
    const cfg = (await (await app.request('/api/demo/config')).json()) as {
      demoLocations: unknown[];
    };
    assert.ok(cfg.demoLocations.length >= 6);
  });

  test('the recovery feature is gone', async () => {
    assert.equal((await app.request('/api/recovery')).status, 404);
    assert.equal(
      (await app.request('/api/recovery/compare', json('POST', { strategy: 'proportional' })))
        .status,
      404,
    );
  });

  test('unknown API path is a JSON 404', async () => {
    const r = await app.request('/api/nope');
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), { error: 'not found' });
  });
});

describe('alerts feed', () => {
  test('simulated updates are released over time, newest first, each tagged simulation', async () => {
    const first = (await (await app.request('/api/alerts')).json()) as Alert[];
    assert.ok(first.length >= 1 && first.length < store.fixtures.alerts.length);
    assert.ok(first.every((a) => a.sourceType === 'simulation' && a.title && a.text && a.source));
    store.startedAt = Date.now() - 10 * 60_000;
    const later = (await (await app.request('/api/alerts')).json()) as Alert[];
    assert.equal(later.length, store.fixtures.alerts.length);
    assert.deepEqual(
      [...later].sort((a, b) => b.at.localeCompare(a.at)),
      later,
    );
  });

  test('official items come first and are tagged official', async () => {
    const official: Alert = {
      id: 'MET-1',
      incidentId: null,
      kind: 'weather',
      title: 'Thunderstorms Warning',
      text: 't',
      source: 'MET Malaysia',
      sourceType: 'official',
      at: new Date().toISOString(),
      validTo: null,
      local: true,
      url: null,
    };
    const live = createApp(store, async () => [official]);
    const out = (await (await live.request('/api/alerts')).json()) as Alert[];
    assert.equal(out[0].id, 'MET-1');
    assert.ok(out.slice(1).every((a) => a.sourceType === 'simulation'));
  });

  test('a failing official source leaves the simulated feed intact', async () => {
    const live = createApp(store, async () => {
      throw new Error('network down');
    });
    const r = await live.request('/api/alerts');
    assert.equal(r.status, 200);
    assert.ok(((await r.json()) as Alert[]).length >= 1);
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
    assert.deepEqual(
      list.map((s) => s.id),
      [created.id],
    );

    const a = await app.request(
      `/api/sos/${created.id}`,
      json('PATCH', { status: 'assigned', assignedTeam: 'Demo Rescue A' }),
    );
    assert.equal(a.status, 200);
    const after = (await (await app.request(`/api/sos/${created.id}`)).json()) as Sos;
    assert.equal(after.status, 'assigned');
    assert.equal(after.assignedTeam, 'Demo Rescue A');

    await app.request(`/api/sos/${created.id}`, json('PATCH', { status: 'resolved' }));
    const done = (await (await app.request(`/api/sos/${created.id}`)).json()) as Sos;
    assert.equal(done.status, 'resolved');
    assert.equal(done.assignedTeam, 'Demo Rescue A');
  });

  test('a request can be sent with no description at all', async () => {
    const { description: _d, ...bare } = validSos;
    for (const body of [
      bare,
      { ...validSos, description: '' },
      { ...validSos, description: '   ' },
    ]) {
      const r = await app.request('/api/sos', json('POST', body));
      assert.equal(r.status, 201);
      assert.equal(((await r.json()) as Sos).description, '');
    }
  });

  test('ids are unique', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(((await (await app.request('/api/sos', json('POST', validSos))).json()) as Sos).id);
    }
    assert.equal(ids.size, 20);
  });

  test('browser-opt-in coordinates are coarsened to 2 dp', async () => {
    const r = await app.request(
      '/api/sos',
      json('POST', {
        ...validSos,
        location: { lat: 3.06391, lng: 101.60078 },
        locationMode: 'browser-opt-in',
      }),
    );
    const s = (await r.json()) as Sos;
    assert.deepEqual(s.location, { lat: 3.06, lng: 101.6 });
  });

  test('every demo location is inside the demo bounds', async () => {
    for (const l of store.fixtures.demoLocations) {
      const r = await app.request(
        '/api/sos',
        json('POST', { ...validSos, incidentId: l.incidentId, location: l.location }),
      );
      assert.equal(r.status, 201, l.id);
    }
  });

  for (const [name, patch] of [
    ['missing body', undefined],
    ['malformed json', '{nope'],
    ['negative people', { people: -1 }],
    ['zero people', { people: 0 }],
    ['fractional people', { people: 2.5 }],
    ['bad type', { type: 'pizza' }],
    ['non-string description', { description: 42 }],
    ['long description', { description: 'x'.repeat(281) }],
    ['unknown incident', { incidentId: 'NOPE' }],
    ['location outside demo area', { location: { lat: 51.5, lng: -0.12 } }],
    ['bad locationMode', { locationMode: 'gps' }],
  ] as const) {
    test(`rejects ${name}`, async () => {
      const body =
        patch === undefined ? '' : typeof patch === 'string' ? patch : { ...validSos, ...patch };
      const r = await app.request('/api/sos', json('POST', body));
      assert.equal(r.status, 400);
      assert.equal(((await r.json()) as { error: string }).error, 'invalid SOS');
    });
  }

  test('unknown id -> 404 for GET and PATCH', async () => {
    assert.equal((await app.request('/api/sos/SOS-NOPE')).status, 404);
    assert.equal(
      (await app.request('/api/sos/SOS-NOPE', json('PATCH', { status: 'resolved' }))).status,
      404,
    );
  });

  test('invalid patch -> 400', async () => {
    const s = (await (await app.request('/api/sos', json('POST', validSos))).json()) as Sos;
    assert.equal(
      (await app.request(`/api/sos/${s.id}`, json('PATCH', { status: 'assigned' }))).status,
      400,
    );
    assert.equal(
      (await app.request(`/api/sos/${s.id}`, json('PATCH', { status: 'done' }))).status,
      400,
    );
  });

  test('demo reset clears SOS', async () => {
    await app.request('/api/sos', json('POST', validSos));
    await app.request('/api/demo/reset', { method: 'POST' });
    assert.deepEqual(await (await app.request('/api/sos')).json(), []);
  });
});

describe('live events', () => {
  test('disconnecting an event stream releases its store subscription', async () => {
    let activeSubscriptions = 0;
    const subscribe = store.subscribe.bind(store);
    store.subscribe = (listener) => {
      activeSubscriptions++;
      const unsubscribe = subscribe(listener);
      let closed = false;
      return () => {
        if (!closed) {
          closed = true;
          activeSubscriptions--;
          unsubscribe();
        }
      };
    };
    const response = await app.request('/api/events');
    const reader = response.body!.getReader();
    await reader.read();
    assert.equal(activeSubscriptions, 1);
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(activeSubscriptions, 0);
  });
  test('the store tells subscribers about every change, and stops after unsubscribe', async () => {
    const seen: string[] = [];
    const off = store.subscribe((e) => seen.push(e.type));
    const s = (await (await app.request('/api/sos', json('POST', validSos))).json()) as Sos;
    await app.request(`/api/sos/${s.id}`, json('PATCH', { status: 'assigned', assignedTeam: 'A' }));
    await app.request('/api/demo/reset', { method: 'POST' });
    assert.deepEqual(seen, ['sos', 'sos', 'reset']);
    off();
    await app.request('/api/sos', json('POST', validSos));
    assert.equal(seen.length, 3);
  });

  test('a throwing subscriber does not break a request or the other subscribers', async () => {
    let reached = false;
    store.subscribe(() => {
      throw new Error('boom');
    });
    store.subscribe(() => (reached = true));
    assert.equal((await app.request('/api/sos', json('POST', validSos))).status, 201);
    assert.equal(reached, true);
  });

  test('GET /api/events is an event stream that pushes a change as soon as a request is created', async () => {
    const ctl = new AbortController();
    const r = await app.request('/api/events', { signal: ctl.signal });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') ?? '', /text\/event-stream/);
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let text = '';
    const readUntil = async (needle: string) => {
      const deadline = Date.now() + 2000;
      while (!text.includes(needle)) {
        if (Date.now() > deadline) {
          throw new Error(`timed out waiting for ${needle}; got ${JSON.stringify(text)}`);
        }
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        text += dec.decode(value, { stream: true });
      }
    };
    await readUntil('event: ready');
    await app.request('/api/sos', json('POST', validSos));
    await readUntil('"type":"sos"');
    assert.match(text, /event: change\ndata: \{"type":"sos"\}/);
    ctl.abort();
    await reader.cancel().catch(() => {});
  });

  test('watchFeed announces a newly released simulated update', async () => {
    store.startedAt = Date.now();
    const seen: string[] = [];
    store.subscribe((e) => seen.push(e.type));
    const stop = watchFeed(store, async () => [], 15);
    await new Promise((ok) => setTimeout(ok, 60));
    assert.deepEqual(seen, []); // nothing new yet
    store.startedAt = Date.now() - 10 * 60_000; // every update is now due
    await new Promise((ok) => setTimeout(ok, 80));
    stop();
    assert.deepEqual(seen, ['alerts']);
  });
});
