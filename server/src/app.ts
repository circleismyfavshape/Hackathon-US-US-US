// The single FLARE Hono app. Demo only: no auth, synthetic scenario, not an emergency service.
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Alert, ApiError, LiveEvent, Scenario } from '../../contracts/types.ts';
import { noOfficialAlerts, type OfficialAlerts } from './live/met.ts';
import { validateSosCreate, validateSosPatch } from './routes/validate.ts';
import { DemoStore } from './store/store.ts';

const bad = (c: Context, status: 400 | 404 | 409 | 500, error: string, details?: string[]) =>
  c.json<ApiError>(details ? { error, details } : { error }, status);

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/** The whole feed: official warnings first (real, sourced), then the simulated scenario updates. Each item says which it is. */
export async function feed(store: DemoStore, officialAlerts: OfficialAlerts): Promise<Alert[]> {
  const official = await officialAlerts().catch(() => []);
  return [...official, ...store.simulatedAlerts()];
}

export function createApp(
  store = new DemoStore(),
  officialAlerts: OfficialAlerts = noOfficialAlerts,
) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ status: 'ok', mode: 'demo' }));

  // Everything static about the scenario in one call.
  app.get('/api/scenario', (c) => {
    const { alerts: _alerts, ...scenario } = store.fixtures;
    return c.json<Scenario>(scenario);
  });
  app.get('/api/incidents', (c) => c.json(store.fixtures.incidents));
  app.get('/api/shelters', (c) => c.json(store.fixtures.shelters));
  app.get('/api/demo/config', (c) =>
    c.json({
      demoLocations: store.fixtures.demoLocations,
      demoBounds: store.fixtures.demoBounds,
      demoTeams: store.fixtures.demoTeams,
    }),
  );

  app.get('/api/alerts', async (c) => c.json(await feed(store, officialAlerts)));

  // Server-sent events: one small message whenever requests or the feed change, so every open page refetches at once
  // instead of waiting for its next poll. Clients fall back to slow polling if this stream cannot be opened.
  app.get('/api/events', (c) => {
    c.header('cache-control', 'no-cache, no-transform');
    c.header('x-accel-buffering', 'no');
    return streamSSE(c, async (stream) => {
      const queue: LiveEvent[] = [];
      let wake: (() => void) | null = null;
      const off = store.subscribe((e) => {
        queue.push(e);
        wake?.();
      });
      let open = true;
      stream.onAbort(() => {
        open = false;
        off();
        wake?.();
      });
      await stream.writeSSE({ event: 'ready', data: '{}' });
      while (open) {
        const next = queue.shift();
        if (next) {
          await stream.writeSSE({ event: 'change', data: JSON.stringify(next) });
          continue;
        }
        // Wait for the next change, or 20 s, then send a comment line so proxies keep the stream open.
        const timedOut = await new Promise<boolean>((resolve) => {
          const t = setTimeout(() => resolve(true), 20_000);
          wake = () => {
            clearTimeout(t);
            resolve(false);
          };
        });
        wake = null;
        if (timedOut && open) {
          await stream.writeSSE({ event: 'ping', data: '{}' });
        }
      }
      off();
    });
  });

  app.post('/api/sos', async (c) => {
    const v = validateSosCreate(await readJson(c), store.fixtures);
    if (!v.ok) {
      return bad(c, 400, 'invalid SOS', v.details);
    }
    try {
      return c.json(store.createSos(v.value), 201);
    } catch (e) {
      return bad(c, 409, (e as Error).message);
    }
  });

  // DEMO RESPONDER ONLY. Would never be public in a real system.
  app.get('/api/sos', (c) => c.json(store.listSos()));

  app.get('/api/sos/:id', (c) => {
    const s = store.getSos(c.req.param('id'));
    return s ? c.json(s) : bad(c, 404, 'SOS not found');
  });

  app.patch('/api/sos/:id', async (c) => {
    const v = validateSosPatch(await readJson(c));
    if (!v.ok) {
      return bad(c, 400, 'invalid SOS update', v.details);
    }
    const s = store.patchSos(c.req.param('id'), v.value);
    return s ? c.json(s) : bad(c, 404, 'SOS not found');
  });

  // Demo-only reset: reseeds the scenario and clears all requests.
  app.post('/api/demo/reset', (c) => {
    store.reset();
    return c.json({ status: 'reset', mode: 'demo' });
  });

  app.onError((_err, c) => bad(c, 500, 'internal error'));
  app.notFound((c) =>
    c.req.path.startsWith('/api/') ? bad(c, 404, 'not found') : c.text('Not found', 404),
  );
  return app;
}

/** Watches the feed and tells subscribers when it changes: a simulated update was released, or an official warning arrived or expired.
 *  Runs only in the real server (index.ts), never in tests. Returns the stop function. */
export function watchFeed(
  store: DemoStore,
  officialAlerts: OfficialAlerts,
  everyMs = 2000,
): () => void {
  let last: string | null = null;
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      const ids = (await feed(store, officialAlerts)).map((a) => a.id).join('|');
      if (last !== null && ids !== last) {
        store.emit('alerts');
      }
      last = ids;
    } finally {
      busy = false;
    }
  }, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
