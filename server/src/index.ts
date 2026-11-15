// FLARE server entry (owner: D2). One process = one shared demo state for both portals.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';
import { createMetAlerts } from './live/met.ts';

const PORT = Number(process.env.PORT ?? 8787);
// Real MET Malaysia warnings are opt-in: FLARE_LIVE_ALERTS=1. Off by default, so the demo never depends on the network.
// In live mode the alerts feed is official-only: no simulated alert is shown beside a real one.
const live = process.env.FLARE_LIVE_ALERTS === '1';
const app = createApp(undefined, undefined, live ? createMetAlerts() : undefined, live);

// `npm start` serves the built client from the same origin, so /citizen and /responder share one backend.
const distDir = fileURLToPath(new URL('../../client/dist/', import.meta.url));
if (existsSync(distDir)) {
  const indexHtml = readFileSync(`${distDir}index.html`, 'utf8');
  app.use('/assets/*', serveStatic({ root: distDir }));
  app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.notFound() : c.html(indexHtml)));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`FLARE demo API on http://localhost:${info.port} (simulated data, not an emergency service)`);
});
