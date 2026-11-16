// No network: every test injects fetch and the clock.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createMetAlerts,
  MAX_OFFICIAL,
  MET_SOURCE,
  mapWarnings,
  tidy,
} from '../../src/live/met.ts';

const NOW = Date.parse('2026-11-16T10:00:00+08:00');

// Shape copied from a real api.data.gov.my/weather/warning response (16 Nov 2026).
const real = (
  issued: string,
  title: string,
  text: string,
  validTo: string | null = '2026-11-18T23:59:59',
) => ({
  warning_issue: { issued, title_bm: 'x', title_en: title },
  valid_from: '2026-11-16T00:00:00',
  valid_to: validTo,
  heading_en: 'HEADING',
  text_en: text,
});
const SAMPLE = [
  real(
    '2026-11-16T09:00:00',
    'Strong Winds and Rough Seas Warning',
    'SECTION A: FOR MALAYSIAN WATERS [WITHIN 24 NAUTICAL MILES] 1) THUNDERSTORMS WARNING Thunderstorms, heavy rain and strong winds are expected over the waters of Sabah and Sarawak until 6:00 PM.',
  ),
  real(
    '2026-11-16T08:00:00',
    'Continuous Rain Warning',
    'Continuous rain is expected to occur over the state of Selangor (Petaling, Klang) and Kuala Lumpur until Tuesday.',
  ),
  real(
    '2026-11-16T07:00:00',
    'Thunderstorms Warning',
    'Thunderstorms are expected over the states of Perlis • Kedah • Penang until 6:00 PM.',
  ),
];
const respond = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('mapWarnings', () => {
  test('tags every item official with its source, an ISO time and a readable body', () => {
    const out = mapWarnings(SAMPLE, NOW);
    assert.equal(out.length, 3);
    for (const a of out) {
      assert.equal(a.sourceType, 'official');
      assert.equal(a.source, MET_SOURCE);
      assert.equal(a.incidentId, null);
      assert.ok(a.title && a.text && a.url);
    }
    const rain = out.find((a) => a.title === 'Continuous Rain Warning')!;
    assert.equal(rain.at, '2026-11-16T00:00:00.000Z'); // 08:00 MYT
    assert.equal(rain.validTo, '2026-11-18T15:59:59.000Z');
    assert.equal(rain.kind, 'flood');
    // A wind warning whose body mentions heavy rain is still a weather item, not a flood item.
    assert.equal(
      out.find((a) => a.title === 'Strong Winds and Rough Seas Warning')!.kind,
      'weather',
    );
  });

  test('warnings that name Selangor or the Klang Valley come first, then newest', () => {
    const out = mapWarnings(SAMPLE, NOW);
    assert.deepEqual(
      out.map((a) => [a.title, a.local]),
      [
        ['Continuous Rain Warning', true],
        ['Strong Winds and Rough Seas Warning', false],
        ['Thunderstorms Warning', false],
      ],
    );
  });

  test('warnings for other states are kept, so the feed is not empty on a day with nothing for Selangor', () => {
    assert.equal(mapWarnings([SAMPLE[2]], NOW).length, 1);
  });

  test('drops expired warnings, "No Advisory" rows and repeats of one bulletin', () => {
    const rows = [
      real('2026-11-15T09:00:00', 'Old Warning', 'Selangor', '2026-11-15T12:00:00'),
      real('2026-11-16T09:30:00', 'No Advisory', 'No Tropical Cyclone system is observed', null),
      SAMPLE[0],
      { ...SAMPLE[0], valid_to: '2026-11-16T21:00:00' },
    ];
    assert.deepEqual(
      mapWarnings(rows, NOW).map((a) => a.title),
      ['Strong Winds and Rough Seas Warning'],
    );
  });

  test('ids are stable between fetches, so a warning is announced once', () => {
    assert.deepEqual(
      mapWarnings(SAMPLE, NOW).map((a) => a.id),
      mapWarnings(SAMPLE, NOW + 60_000).map((a) => a.id),
    );
    assert.equal(new Set(mapWarnings(SAMPLE, NOW).map((a) => a.id)).size, 3);
  });

  test('skips malformed rows and non-arrays without throwing', () => {
    assert.deepEqual(mapWarnings(null, NOW), []);
    assert.deepEqual(mapWarnings({ error: 'nope' }, NOW), []);
    assert.deepEqual(
      mapWarnings(
        [
          null,
          {},
          { warning_issue: { issued: 'not a date', title_en: 'T' }, text_en: 'Selangor' },
          { warning_issue: { issued: '2026-11-16T09:00:00', title_en: 'T' } },
        ],
        NOW,
      ),
      [],
    );
  });

  test(`returns at most ${MAX_OFFICIAL}`, () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      real(`2026-11-16T0${i}:00:00`, `W${i}`, 'Selangor'),
    );
    assert.equal(mapWarnings(many, NOW).length, MAX_OFFICIAL);
  });
});

describe('tidy', () => {
  test('removes the bulletin headings and bullet dots', () => {
    const t = tidy(SAMPLE[0].text_en);
    assert.equal(
      t,
      'Thunderstorms, heavy rain and strong winds are expected over the waters of Sabah and Sarawak until 6:00 PM.',
    );
    assert.equal(tidy('over Perlis • Kedah • Penang'), 'over Perlis, Kedah, Penang');
  });
  test('shortens a long body at a sentence or word, with an ellipsis', () => {
    const long = `${'Heavy rain is expected over several districts. '.repeat(12)}`;
    const t = tidy(long, 200);
    assert.ok(t.length <= 201);
    assert.ok(/[.…]$/.test(t));
    assert.ok(!/\s…$/.test(t));
  });
});

describe('createMetAlerts', () => {
  test('caches a good response, then refetches after the ttl', async () => {
    let calls = 0;
    let t = NOW;
    const get = createMetAlerts({
      fetchImpl: (async () => (calls++, respond(SAMPLE))) as unknown as typeof fetch,
      now: () => t,
      ttlMs: 1000,
    });
    assert.equal((await get()).length, 3);
    assert.equal((await get()).length, 3);
    assert.equal(calls, 1);
    t = NOW + 1001;
    await get();
    assert.equal(calls, 2);
  });

  test('shares one request between concurrent callers', async () => {
    let calls = 0;
    const get = createMetAlerts({
      now: () => NOW,
      fetchImpl: (async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 10));
        return respond(SAMPLE);
      }) as unknown as typeof fetch,
    });
    await Promise.all([get(), get(), get()]);
    assert.equal(calls, 1);
  });

  test('a failure returns nothing, is cached briefly, and never throws', async () => {
    let calls = 0;
    let t = NOW;
    const get = createMetAlerts({
      now: () => t,
      failTtlMs: 500,
      fetchImpl: (async () => {
        calls++;
        throw new Error('offline');
      }) as unknown as typeof fetch,
    });
    assert.deepEqual(await get(), []);
    assert.deepEqual(await get(), []);
    assert.equal(calls, 1);
    t = NOW + 501;
    await get();
    assert.equal(calls, 2);
  });

  test('after a failure it keeps serving the last good items', async () => {
    let fail = false;
    let t = NOW;
    const get = createMetAlerts({
      now: () => t,
      ttlMs: 100,
      fetchImpl: (async () => {
        if (fail) {
          return new Response('bad gateway', { status: 502 });
        }
        return respond(SAMPLE);
      }) as unknown as typeof fetch,
    });
    assert.equal((await get()).length, 3);
    fail = true;
    t = NOW + 101;
    assert.equal((await get()).length, 3);
  });

  test('a body that is not the expected list gives an empty feed', async () => {
    const get = createMetAlerts({
      now: () => NOW,
      fetchImpl: (async () => respond({ message: 'rate limited' })) as unknown as typeof fetch,
    });
    assert.deepEqual(await get(), []);
  });
});
