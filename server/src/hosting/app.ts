import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { LiveEvent } from '../../../contracts/types.ts';
import { createApp, watchFeed } from '../app.ts';
import { noOfficialAlerts, type OfficialAlerts } from '../live/met.ts';
import { DemoStore, type DemoSnapshot } from '../store/store.ts';
import type { SharedState } from './redis.ts';

const MAX_WRITE_ATTEMPTS = 8;

/** Translate Redis's event stream without exposing its URL or token to the browser. */
export function subscriptionEvent(line: string): 'ready' | LiveEvent['type'] | null {
  if (!line.startsWith('data:')) {
    return null;
  }
  const data = line.slice(5).trim();
  if (data.startsWith('subscribe,')) {
    return 'ready';
  }
  if (!data.startsWith('message,')) {
    return null;
  }
  // Redis sends "message,<channel>,<JSON>". The JSON itself may contain commas.
  const channelEnd = data.indexOf(',', 'message,'.length);
  const payload = data.slice(channelEnd + 1);
  try {
    const event = JSON.parse(payload) as LiveEvent;
    return ['sos', 'reset', 'alerts'].includes(event.type) ? event.type : null;
  } catch {
    return null;
  }
}

export function createHostedApp(
  state: SharedState,
  officialAlerts: OfficialAlerts = noOfficialAlerts,
) {
  const app = new Hono();
  app.use('/api/*', async (c, next) => {
    c.header('cache-control', 'no-store');
    await next();
  });

  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      const controller = new AbortController();
      stream.onAbort(() => controller.abort());
      // Finish before the function deadline; EventSource reconnects and resynchronizes
      // automatically.
      const deadline = setTimeout(() => controller.abort(), 25_000);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let stopFeed: (() => void) | undefined;
      let stopListener: (() => void) | undefined;
      try {
        const saved = await state.read();
        const store = new DemoStore(saved ? (JSON.parse(saved) as DemoSnapshot) : undefined);
        stopListener = store.subscribe((event) => {
          void stream
            .writeSSE({ event: 'change', data: JSON.stringify(event) })
            .catch(() => controller.abort());
        });
        stopFeed = watchFeed(store, officialAlerts);
        const response = await state.subscribe(controller.signal);
        reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let pending = '';
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) {
            break;
          }
          pending += decoder.decode(chunk.value, { stream: true });
          let end: number;
          while ((end = pending.indexOf('\n')) >= 0) {
            const event = subscriptionEvent(pending.slice(0, end));
            pending = pending.slice(end + 1);
            if (event === 'ready') {
              await stream.writeSSE({ event: 'ready', data: '{}', retry: 500 });
            } else if (event) {
              await stream.writeSSE({ event: 'change', data: JSON.stringify({ type: event }) });
            }
          }
        }
      } catch {
        // Closing the stream lets the existing browser polling fallback take over.
      } finally {
        clearTimeout(deadline);
        stopFeed?.();
        stopListener?.();
        controller.abort();
        await reader?.cancel().catch(() => {});
      }
    }),
  );

  app.all('/api/*', async (c) => {
    const isWrite = ['POST', 'PATCH', 'DELETE'].includes(c.req.method);
    // Each Vercel instance starts from the same saved snapshot. A write succeeds only if that
    // snapshot is still current; otherwise, reload and apply the request to the newer state.
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      let before = await state.read();
      if (before === null) {
        const initial = JSON.stringify(new DemoStore().snapshot());
        if (!(await state.compareAndSet(null, initial, null))) {
          continue;
        }
        before = initial;
      }
      const store = new DemoStore(JSON.parse(before) as DemoSnapshot);
      const response = await createApp(store, officialAlerts).fetch(c.req.raw.clone());
      if (!response.ok || !isWrite) {
        return response;
      }
      const event = c.req.path === '/api/demo/reset' ? 'reset' : 'sos';
      if (await state.compareAndSet(before, JSON.stringify(store.snapshot()), event)) {
        return response;
      }
    }
    return c.json({ error: 'The demo is busy. Please try again.' }, 503);
  });
  app.onError(
    () =>
      new Response(
        JSON.stringify({
          error: 'The shared demo service is temporarily unavailable. Please try again.',
        }),
        {
          status: 503,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        },
      ),
  );
  return app;
}
