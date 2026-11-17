# Vercel deployment

Live demonstration: [flare-flood-response.vercel.app](https://flare-flood-response.vercel.app).

The project deploys on Vercel Hobby with the Upstash for Redis Free plan. Automatic database upgrades are disabled. Free-tier quotas still apply; reaching them can pause the hosted demonstration rather than upgrade its plan.

Import `jeffyoh312/flare-flood-response` with the repository root as the project directory. The tracked `vercel.json` builds `client/dist`, routes application pages to the client, and routes `/api/*` to the Node function. Both the function and Redis use Singapore.

Connect the Upstash integration to the project. It provides `KV_REST_API_URL` and `KV_REST_API_TOKEN` as server environment variables. Keep these private; never prefix them with `VITE_` or commit local environment files. Official weather warnings remain enabled unless `FLARE_LIVE_ALERTS=0`.

The hosted API reuses the local validation and request workflows. Redis holds the demonstration's start time and rescue requests. Atomic comparisons prevent overlapping submissions from replacing each other, and pub/sub relays changes between function instances. Streams reconnect before Vercel's function deadline; reconnects refresh the views and polling remains available during outages. Preview branches use separate state from production.

The simulation reset clears the shared hosted queue for all production visitors. Local development keeps its existing in-memory store and needs no Redis account. The hosted service remains a public demonstration with simulated operations and no responder authentication.

Use fictional data only: anyone can read submitted requests and shared profiles, update request status
or reset the queue. Redis credentials being private does not restrict access through these public API
routes. Keep database credentials in server environment variables, never in client code or `VITE_`
variables. See [security and privacy](SECURITY.md) for the review scope and account checks.

After deployment, check `/api/health`, `/citizen`, `/responder` and `/phone/citizen`. Submit a simulated request from one browser, assign it in another, and verify the original citizen sees the assignment. Refresh both pages to confirm the queue survives a new function instance.

Useful commands after signing into the Vercel CLI:

```bash
vercel link --project flare-flood-response
vercel deploy --prod
```

Deployments receive environment variables from Vercel; downloading production secrets is unnecessary
for normal local development. If you need hosted-adapter debugging, use a separate development Redis
database and keep any local environment files untracked. Never paste their contents into issues or logs.

GitHub pushes to `main` deploy production automatically. Other branches create previews. For browser checks over a remote connection, set `FLARE_TEST_URL` to the deployment URL and `FLARE_E2E_SYNC_TIMEOUT=5000`; local checks retain their one-second deadline. The walkthrough resets its target queue, so run it only against a disposable demonstration.

See [Vercel Functions](https://vercel.com/docs/functions), [Marketplace storage](https://vercel.com/docs/marketplace-storage) and [Upstash REST](https://upstash.com/docs/redis/features/restapi).
