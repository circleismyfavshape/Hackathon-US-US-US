// FLARE server entry. One process = one shared demo state for every open page.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp, watchFeed } from './app.ts';
import { createMetAlerts, noOfficialAlerts } from './live/met.ts';
import { DemoStore } from './store/store.ts';

const PORT = Number(process.env.PORT ?? 8787);
// Official MET Malaysia warnings are on unless FLARE_LIVE_ALERTS=0. If the network is down the feed simply has no official items.
const live = process.env.FLARE_LIVE_ALERTS !== '0';
const store = new DemoStore();
const officialAlerts = live ? createMetAlerts() : noOfficialAlerts;
const app = createApp(store, officialAlerts);
watchFeed(store, officialAlerts);

// `npm start` serves the built client from the same origin. index.html is read per request, so a rebuild needs no restart.
const distDir = fileURLToPath(new URL('../../client/dist/', import.meta.url));
if (existsSync(distDir)) {
  app.use('/assets/*', serveStatic({ root: distDir }));
  app.get('/favicon.svg', serveStatic({ root: distDir }));
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api/')) return c.notFound();
    c.header('cache-control', 'no-store');
    return c.html(readFileSync(`${distDir}index.html`, 'utf8'));
  });
}

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`FLARE on http://localhost:${info.port} (simulated scenario${live ? ', official MET Malaysia warnings on' : ''}; not an emergency service)`);
});
server.on('error', (e: NodeJS.ErrnoException) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Stop the other FLARE server, or set PORT to another number.` : e);
  process.exit(1);
});
