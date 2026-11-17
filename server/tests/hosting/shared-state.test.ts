import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Sos, LiveEvent } from '../../../contracts/types.ts';
import { createHostedApp, subscriptionEvent } from '../../src/hosting/app.ts';
import { hostedState, type SharedState } from '../../src/hosting/redis.ts';
import { DemoStore } from '../../src/store/store.ts';

class MemoryState implements SharedState {
  value: string | null = null;
  events: string[] = [];
  async read() {
    return this.value;
  }
  async compareAndSet(before: string | null, after: string, event: LiveEvent['type'] | null) {
    if (this.value !== before) {
      return false;
    }
    this.value = after;
    if (event) {
      this.events.push(event);
    }
    return true;
  }
  async subscribe(): Promise<Response> {
    throw new Error('No stream in this test');
  }
}

const input = {
  incidentId: 'INC-DEMO-004',
  people: 3,
  type: 'trapped',
  description: 'Hosted demo request',
  location: { lat: 3.0639, lng: 101.6008 },
  locationMode: 'manual-demo',
};
const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

test('requests survive fresh server instances and reset is shared', async () => {
  const state = new MemoryState();
  const created = await createHostedApp(state).request('/api/sos', post(input));
  assert.equal(created.status, 201);
  const record = (await created.json()) as Sos;
  const listing = await createHostedApp(state).request('/api/sos');
  assert.equal(((await listing.json()) as Sos[])[0].id, record.id);
  const assigned = await createHostedApp(state).request(`/api/sos/${record.id}`, {
    ...post({ status: 'assigned', assignedTeam: new DemoStore().fixtures.demoTeams[0] }),
    method: 'PATCH',
  });
  assert.equal(assigned.status, 200);
  assert.equal(((await assigned.json()) as Sos).status, 'assigned');
  await createHostedApp(state).request('/api/demo/reset', post({}));
  assert.deepEqual(await (await createHostedApp(state).request('/api/sos')).json(), []);
  assert.deepEqual(state.events, ['sos', 'sos', 'reset']);
});

test('concurrent submissions cannot overwrite each other', async () => {
  const state = new MemoryState();
  state.value = JSON.stringify(new DemoStore().snapshot());
  const results = await Promise.all(
    Array.from({ length: 6 }, () => createHostedApp(state).request('/api/sos', post(input))),
  );
  assert.ok(results.every((response) => response.status === 201));
  const records = (await (await createHostedApp(state).request('/api/sos')).json()) as Sos[];
  assert.equal(records.length, 6);
  assert.equal(new Set(records.map((record) => record.id)).size, 6);
});

test('invalid writes and storage failures do not acknowledge an unsaved request', async () => {
  const state = new MemoryState();
  await createHostedApp(state).request('/api/health');
  const original = state.value;
  assert.equal((await createHostedApp(state).request('/api/sos', post({}))).status, 400);
  assert.equal(state.value, original);
  state.read = async () => {
    throw new Error('offline');
  };
  const failure = await createHostedApp(state).request('/api/sos', post(input));
  assert.equal(failure.status, 503);
  assert.match(await failure.text(), /temporarily unavailable/);
});

test('Redis event parsing accepts known events and ignores malformed input', () => {
  assert.equal(subscriptionEvent('data: subscribe,flare:events,1'), 'ready');
  assert.equal(subscriptionEvent('data: message,flare:events,{"type":"sos"}'), 'sos');
  assert.equal(subscriptionEvent('data: message,flare:events,{"type":"reset"}'), 'reset');
  for (const line of [
    ': ping',
    'data: invalid',
    'data: message,channel,invalid',
    'data: message,channel,{"type":"unknown"}',
  ]) {
    assert.equal(subscriptionEvent(line), null);
  }
});

test('preview and production use separate state and event channels', () => {
  const credentials = { KV_REST_API_URL: 'https://example.invalid', KV_REST_API_TOKEN: 'test' };
  assert.notEqual(
    hostedState({ ...credentials, VERCEL_ENV: 'production' }).channel,
    hostedState({ ...credentials, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'hosting' })
      .channel,
  );
  assert.throws(() => hostedState({}), /Connect the free Redis/);
});

test('snapshot copies cannot change the original store', () => {
  const store = new DemoStore();
  const snapshot = store.snapshot();
  snapshot.startedAt = 1;
  assert.notEqual(store.snapshot().startedAt, 1);
  assert.throws(() => new DemoStore({ startedAt: NaN, requests: [] }), /Invalid stored/);
});
