import { getRequestListener } from '@hono/node-server';
import { createHostedApp } from '../server/src/hosting/app.ts';
import { hostedState } from '../server/src/hosting/redis.ts';
import { createMetAlerts, noOfficialAlerts } from '../server/src/live/met.ts';

const officialAlerts = process.env.FLARE_LIVE_ALERTS === '0' ? noOfficialAlerts : createMetAlerts();

export default getRequestListener((request) => {
  try {
    return createHostedApp(hostedState(), officialAlerts).fetch(request);
  } catch {
    return Response.json({ error: 'Shared demo storage is not configured.' }, { status: 503 });
  }
});
