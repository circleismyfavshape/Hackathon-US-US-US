// FLARE server entry (owner: D2). One process = one shared demo state for both portals.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';

const PORT = Number(process.env.PORT ?? 8787);
const app = createApp();

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
