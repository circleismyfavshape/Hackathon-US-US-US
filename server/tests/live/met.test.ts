// No network: every test injects fetch and the clock.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createApp } from '../../src/app.ts';
import { createMetAlerts, MET_SOURCE, mapWarnings } from '../../src/live/met.ts';
import { DemoStore } from '../../src/store/store.ts';

// Shape copied from a real api.data.gov.my/weather/warning response (15 Nov 2026).
const real = (issued: string, title: string, text: string, validTo = '2026-11-18T23:59:59') => ({
  warning_issue: { issued, title_bm: 'x', title_en: title },
  valid_from: '2026-11-16T00:00:00',
  valid_to: validTo,
  heading_en: 'HEADING',
  text_en: text,
});
const SAMPLE = [
  real('2026-11-15T13:00:00', 'Strong Winds and Rough Seas Warning', 'Thunderstorms expected over the waters of Penang • Selangor • Johor until 6:00 PM'),
  real('2026-11-15T09:00:00', 'Heavy Rain Warning', 'Continuous heavy rain over Selangor and Kuala Lumpur'),
  real('2026-11-15T11:00:00', 'Strong Winds Warning', 'Only Sabah and Sarawak'),
];
const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe('mapWarnings', () => {
  test('keeps Selangor warnings, newest first, tagged official with an ISO +08:00 time', () => {
    const out = mapWarnings(SAMPLE, 'INC-DEMO-001');
    assert.equal(out.length, 2);
    assert.equal(out[0].text, 'Strong Winds and Rough Seas Warning. Valid until 2026-11-18.');
    assert.equal(out[0].at, '2026-11-15T05:00:00.000Z'); // 13:00 MYT
    assert.equal(out[0].source, MET_SOURCE);
    assert.equal(out[0].incidentId, 'INC-DEMO-001');
    assert.equal(out[0].kind, 'update');
    assert.equal(out[1].kind, 'flood'); // a rain warning
  });
  test('skips malformed rows and non-arrays without throwing', () => {
    assert.deepEqual(mapWarnings(null, 'x'), []);
    assert.deepEqual(mapWarnings({ error: 'nope' }, 'x'), []);
    assert.deepEqual(mapWarnings([null, {}, { warning_issue: { issued: 'not a date', title_en: 'T' }, text_en: 'Selangor' }], 'x'), []);
  });
  test('returns at most three', () => {
    const many = Array.from({ length: 6 }, (_, i) => real(`2026-11-1${i}T10:00:00`, `W${i}`, 'Selangor'));
    assert.equal(mapWarnings(many, 'x').length, 3);
  });
});

describe('createMetAlerts', () => {
  test('caches a good response, then refetches after the ttl', async () => {
    let calls = 0;
    let t = 0;
    const get = createMetAlerts({ fetchImpl: (async () => { calls++; return new Response(JSON.stringify(SAMPLE)); }) as unknown as typeof fetch, now: () => t, ttlMs: 1000 });
    assert.equal((await get()).length, 2);
    assert.equal((await get()).length, 2);
    assert.equal(calls, 1);
    t = 1001;
    await get();
    assert.equal(calls, 2);
  });
  test('shares one request between concurrent callers', async () => {
    let calls = 0;
    const get = createMetAlerts({ fetchImpl: (async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return new Response(JSON.stringify(SAMPLE)); }) as unknown as typeof fetch });
    await Promise.all([get(), get(), get()]);
    assert.equal(calls, 1);
  });
  test('a failure returns nothing, and is cached so a dead network is not retried every poll', async () => {
    let calls = 0;
    let t = 0;
    const get = createMetAlerts({ fetchImpl: (async () => { calls++; throw new Error('offline'); }) as unknown as typeof fetch, now: () => t, failTtlMs: 60_000 });
    assert.deepEqual(await get(), []);
    assert.deepEqual(await get(), []);
    assert.equal(calls, 1);
    t = 60_001;
    await get();
    assert.equal(calls, 2);
  });
  test('after a failure the last good items keep being served', async () => {
    let fail = false;
    let t = 0;
    const get = createMetAlerts({ fetchImpl: (async () => { if (fail) throw new Error('offline'); return new Response(JSON.stringify(SAMPLE)); }) as unknown as typeof fetch, now: () => t, ttlMs: 10, failTtlMs: 10 });
    assert.equal((await get()).length, 2);
    fail = true;
    t = 11;
    assert.equal((await get()).length, 2);
  });
  test('a non-200 answer is treated as a failure', async () => {
    const get = createMetAlerts({ fetchImpl: (async () => new Response('no', { status: 500 })) as unknown as typeof fetch });
    assert.deepEqual(await get(), []);
  });
});

describe('GET /api/alerts', () => {
  const list = async (app: ReturnType<typeof createApp>) => (await (await app.request('/api/alerts')).json()) as { source: string; id: string }[];

  test('by default there is no network call and no official item', async () => {
    const out = await list(createApp());
    assert.ok(out.every((a) => !a.source.startsWith('MET Malaysia')));
  });
  test('official items come first, then the simulated ones', async () => {
    const out = await list(createApp(new DemoStore(), undefined, createMetAlerts({ fetchImpl: ok(SAMPLE) })));
    assert.equal(out[0].source, MET_SOURCE);
    assert.equal(out.filter((a) => a.source === MET_SOURCE).length, 2);
    assert.ok(out.length >= 3, 'simulated alerts are still there');
  });
  test('a provider that throws leaves the simulated alerts and a 200', async () => {
    const app = createApp(new DemoStore(), undefined, async () => { throw new Error('boom'); });
    const res = await app.request('/api/alerts');
    assert.equal(res.status, 200);
    assert.ok((await res.json() as unknown[]).every((a) => !(a as { source: string }).source.startsWith('MET Malaysia')));
  });
});

describe('GET /api/alerts in official-only (live) mode', () => {
  const list = async (app: ReturnType<typeof createApp>) => (await (await app.request('/api/alerts')).json()) as { source: string }[];

  test('only official items, never a simulated one', async () => {
    const out = await list(createApp(new DemoStore(), undefined, createMetAlerts({ fetchImpl: ok(SAMPLE) }), true));
    assert.equal(out.length, 2);
    assert.ok(out.every((a) => a.source === MET_SOURCE));
  });
  test('official source down: the feed is empty, not padded with simulated items', async () => {
    const out = await list(createApp(new DemoStore(), undefined, async () => { throw new Error('offline'); }, true));
    assert.deepEqual(out, []);
  });
  test('flag off keeps the simulated alerts exactly as before', async () => {
    const out = await list(createApp(new DemoStore(), undefined, undefined, false));
    assert.ok(out.length > 0 && out.every((a) => !a.source.startsWith('MET Malaysia')));
  });
});
