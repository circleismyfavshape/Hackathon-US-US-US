// The single FLARE Hono app (owner: D2). Demo only — no auth, synthetic data, not an emergency service.
import { Hono, type Context } from 'hono';
import type { ApiError } from '../../contracts/types.ts';
import { noOfficialAlerts, type OfficialAlerts } from './live/met.ts';
import { AiUnavailableError, explainTradeoffs, type Explainer } from './recovery/explain.ts';
import { compareAllocations, NotImplementedError } from './recovery/index.ts';
import { validateSosCreate, validateSosPatch, validateStrategy } from './routes/validate.ts';
import { DemoStore } from './store/store.ts';

const bad = (c: Context, status: 400 | 404 | 409 | 500 | 501 | 503, error: string, details?: string[]) =>
  c.json<ApiError>(details ? { error, details } : { error }, status);

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

export function createApp(store = new DemoStore(), explainer: Explainer = explainTradeoffs, officialAlerts: OfficialAlerts = noOfficialAlerts) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ status: 'ok', mode: 'demo' }));

  app.get('/api/incidents', (c) => c.json(store.fixtures.incidents));
  app.get('/api/shelters', (c) => c.json(store.fixtures.shelters));
  app.get('/api/demo/config', (c) =>
    c.json({ demoLocations: store.fixtures.demoLocations, demoBounds: store.fixtures.demoBounds, demoTeams: store.fixtures.demoTeams }),
  );

  // v1.2: live updates, released over time since the server started or was reset.
  // Official items (real, sourced, off unless enabled in index.ts) come first; any failure leaves just the simulated ones.
  app.get('/api/alerts', async (c) => {
    const elapsed = (Date.now() - store.startedAt) / 1000;
    const simulated = store.fixtures.alerts
      .filter((a) => a.afterSeconds <= elapsed)
      .map(({ afterSeconds, ...a }) => ({ ...a, at: new Date(store.startedAt + afterSeconds * 1000).toISOString() }));
    const official = await officialAlerts().catch(() => []);
    return c.json([...official, ...simulated]);
  });

  app.post('/api/sos', async (c) => {
    const v = validateSosCreate(await readJson(c), store.fixtures);
    if (!v.ok) return bad(c, 400, 'invalid SOS', v.details);
    try {
      return c.json(store.createSos(v.value), 201);
    } catch (e) {
      return bad(c, 409, (e as Error).message);
    }
  });

  // DEMO RESPONDER ONLY — would never be public in a real system.
  app.get('/api/sos', (c) => c.json(store.listSos()));

  app.get('/api/sos/:id', (c) => {
    const s = store.getSos(c.req.param('id'));
    return s ? c.json(s) : bad(c, 404, 'SOS not found');
  });

  app.patch('/api/sos/:id', async (c) => {
    const v = validateSosPatch(await readJson(c));
    if (!v.ok) return bad(c, 400, 'invalid SOS update', v.details);
    const s = store.patchSos(c.req.param('id'), v.value);
    return s ? c.json(s) : bad(c, 404, 'SOS not found');
  });

  app.get('/api/recovery', (c) => c.json(store.fixtures.recovery));

  app.post('/api/recovery/compare', async (c) => {
    const v = validateStrategy(await readJson(c));
    if (!v.ok) return bad(c, 400, 'invalid strategy', v.details);
    try {
      // Pass a deep copy: comparison must never mutate stored inventory.
      return c.json(compareAllocations(structuredClone(store.fixtures.recovery), v.value));
    } catch (e) {
      if (e instanceof NotImplementedError) return bad(c, 501, e.message);
      return bad(c, 500, 'recovery comparison failed');
    }
  });

  // P1 (D4): AI-written explanation of the engine's numbers. 503 when no AI credentials.
  app.post('/api/recovery/explain', async (c) => {
    try {
      return c.json(await explainer(structuredClone(store.fixtures.recovery)));
    } catch (e) {
      if (e instanceof AiUnavailableError) return bad(c, 503, e.message);
      return bad(c, 500, 'recovery explanation failed');
    }
  });

  // Demo-only reset: reseeds fixtures and clears all SOS.
  app.post('/api/demo/reset', (c) => {
    store.reset();
    return c.json({ status: 'reset', mode: 'demo' });
  });

  app.notFound((c) => (c.req.path.startsWith('/api/') ? bad(c, 404, 'not found') : c.text('Not found', 404)));
  return app;
}
