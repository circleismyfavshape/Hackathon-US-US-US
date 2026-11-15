import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../../src/app.ts';
import { AiUnavailableError, buildExplainInput, EXPLAIN_MODEL, explainTradeoffs, type MessagesClient } from '../../src/recovery/explain.ts';
import { compareAllocations } from '../../src/recovery/index.ts';
import { DemoStore } from '../../src/store/store.ts';
import { STRATEGIES, type AiExplanation, type RecoverySnapshot } from '../../../contracts/types.ts';

const seed: RecoverySnapshot = JSON.parse(
  readFileSync(new URL('../../../contracts/demo-fixtures.json', import.meta.url), 'utf8'),
).recovery;

/** Fake SDK client: records the request, returns a canned response. No network. */
function fakeClient(response: unknown) {
  const calls: any[] = [];
  const client: MessagesClient = {
    beta: { messages: { create: async (body) => (calls.push(body), response) } },
  };
  return { client, calls };
}

describe('explainTradeoffs', () => {
  test('sends only engine numbers and returns labelled AI text', async () => {
    const { client, calls } = fakeClient({
      model: EXPLAIN_MODEL,
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: ' Priority first fully supplies A and B. ' },
      ],
    });
    const before = structuredClone(seed);
    const out = await explainTradeoffs(seed, client);
    assert.deepEqual(seed, before);
    assert.equal(out.text, 'Priority first fully supplies A and B.');
    assert.equal(out.source, 'ai');
    assert.equal(out.status, 'demo-only');
    assert.deepEqual(out.basedOn, [...STRATEGIES]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, EXPLAIN_MODEL);
    const sent = JSON.parse(calls[0].messages[0].content);
    assert.deepEqual(
      sent.strategies.map((s: any) => s.strategy),
      [...STRATEGIES],
    );
    for (const s of sent.strategies) {
      assert.deepEqual(s.allocations, compareAllocations(seed, s.strategy).allocations);
    }
    assert.equal(
      calls[0].messages[0].content,
      buildExplainInput(
        seed,
        STRATEGIES.map((s) => compareAllocations(seed, s)),
      ),
    );
  });

  test('refusal and empty responses become AiUnavailableError', async () => {
    await assert.rejects(explainTradeoffs(seed, fakeClient({ stop_reason: 'refusal', content: [] }).client), AiUnavailableError);
    await assert.rejects(explainTradeoffs(seed, fakeClient({ stop_reason: 'end_turn', content: [] }).client), AiUnavailableError);
  });

  test('a failing client becomes AiUnavailableError', async () => {
    const client: MessagesClient = { beta: { messages: { create: async () => Promise.reject(new Error('no credentials')) } } };
    await assert.rejects(explainTradeoffs(seed, client), AiUnavailableError);
  });
});

describe('POST /api/recovery/explain', () => {
  const ok: AiExplanation = { text: 'x', model: 'm', source: 'ai', basedOn: [...STRATEGIES], disclaimer: 'd', status: 'demo-only' };
  test('200 with the explainer result', async () => {
    const app = createApp(new DemoStore(), async () => ok);
    const r = await app.request('/api/recovery/explain', { method: 'POST' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), ok);
  });
  test('503 when AI is unavailable', async () => {
    const app = createApp(new DemoStore(), async () => Promise.reject(new AiUnavailableError('AI explanation unavailable: test')));
    const r = await app.request('/api/recovery/explain', { method: 'POST' });
    assert.equal(r.status, 503);
    assert.match(((await r.json()) as any).error, /unavailable/);
  });
  test('optimized is accepted by the compare route', async () => {
    const r = await createApp().request('/api/recovery/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ strategy: 'optimized' }),
    });
    assert.equal(r.status, 200);
  });
});
