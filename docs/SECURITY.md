# Security and privacy

FLARE is a public simulation. It has no user accounts or responder authentication. Anyone can read
submitted rescue requests and their shared profiles, update requests and reset the demonstration.
Use fictional names, ID numbers, contact details and medical notes only. Do not use it to collect
real personal information or coordinate a real emergency.

## What stays private

The hosted Redis URL and token are read from `KV_REST_API_URL` and `KV_REST_API_TOKEN` by server code.
The browser calls FLARE's API; it does not receive those credentials. Keep them in Vercel's server
environment variables and never use a `VITE_` prefix, which exposes values to the browser build.

Profile edits are saved in the browser's local storage until submitted with a request. Sharing a
profile sends a copy to the public demo API and, on Vercel, to Redis. Turning sharing off later or
restoring the local demo profile does not remove an already submitted copy. Reset clears the app's
shared queue for every visitor; browser storage, provider logs and backups have separate lifetimes.
Hosted requests have no automatic expiry in the current implementation.

Only `client/dist` is configured as the public build output. The repository's source, docs, editor
settings and environment files are not a static web directory. The repository itself is public, so
anything committed to it must be suitable for public access, including screenshots and videos.

## Repository review: 17 November 2026

- Gitleaks 8.30.1, using its default rules and fully redacted output, found no secrets in Git
  history across all available refs or in the scanned working files.
- No environment files or private-key files were found in the reviewed tracked path history.
- `npm audit` reported zero known vulnerabilities in the installed dependency tree.
- Read-only probes of the hosted `.env`, `.env.local`, `.git/config`, `package.json` and Redis source
  paths returned the client HTML fallback, without the requested files or credentials.
- The scanned JavaScript and CSS served by Vercel contained no detected credentials.
- The hosted request-list endpoint was publicly readable, consistent with the simulation design.

These are checks for the reviewed version, not a guarantee against every vulnerability. Pattern-based
scanning cannot recognize every possible secret, and this review does not cover deleted remote refs,
other clones, provider logs or private Vercel/Upstash account settings.

## Hosting account checks

In the Vercel and Upstash dashboards, confirm that only intended team members have access and that
database credentials are configured as secrets. Maintain preview/production separation and monitor
usage limits. The app uses separate Redis key namespaces for preview and production, but this is
application separation, not separate database credentials or an authorization boundary.

If a credential is exposed, revoke or rotate it at its provider, update Vercel and redeploy. Removing
the file from the latest commit does not remove it from Git history or invalidate copied credentials.

Using FLARE with real data would require authentication, authorization on every request and responder
action, abuse controls, data retention rules and an appropriate privacy policy. The current public
simulation does not provide these controls.

References: [Vercel environment variables](https://vercel.com/docs/environment-variables),
[Vite environment variables](https://vite.dev/guide/env-and-mode),
[Upstash REST authentication](https://upstash.com/docs/redis/features/restapi).
