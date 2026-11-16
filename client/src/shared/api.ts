// Typed client for the FLARE API (contracts/API_CONTRACT.md). Call these instead of fetch() so shapes stay in sync.
import type { Alert, ApiError, LiveEvent, Scenario, Sos, SosCreate, SosPatch } from '../../../contracts/types.ts';

export type * from '../../../contracts/types.ts';
export { ZONE_LEVELS } from '../../../contracts/types.ts';

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public body: ApiError | null,
  ) {
    super(
      body?.details?.length
        ? `${body.error}: ${body.details.join('; ')}`
        : (body?.error ??
            // A 5xx with no JSON body comes from the dev proxy, not from FLARE: the API server on :8787 is not running.
            (status >= 500 ? 'The FLARE server is not running. Start it with npm run dev (or npm start).' : `HTTP ${status}`)),
    );
  }
}

async function req<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new Error('No connection to the FLARE server. Check that it is running, then try again.');
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiRequestError(r.status, data as ApiError | null);
  return data as T;
}

export const api = {
  health: () => req<{ status: 'ok'; mode: 'demo' }>('/api/health'),
  scenario: () => req<Scenario>('/api/scenario'),
  alerts: () => req<Alert[]>('/api/alerts'),
  createSos: (body: SosCreate) => req<Sos>('/api/sos', { method: 'POST', body }),
  listSos: () => req<Sos[]>('/api/sos'),
  getSos: (id: string) => req<Sos>(`/api/sos/${encodeURIComponent(id)}`),
  patchSos: (id: string, body: SosPatch) => req<Sos>(`/api/sos/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  resetDemo: () => req<{ status: 'reset' }>('/api/demo/reset', { method: 'POST' }),
};

/* ── Live updates ─────────────────────────────────────────────────────
   One EventSource per page. The server sends a tiny message whenever requests or the feed change,
   and every subscriber refetches at once. If the stream cannot be opened, subscribers poll instead. */
type LiveListener = (type: LiveEvent['type'] | 'resync') => void;
const listeners = new Set<LiveListener>();
let source: EventSource | null = null;
let connected = false;

const tell = (type: Parameters<LiveListener>[0]) => {
  for (const fn of [...listeners]) fn(type);
};

function open() {
  if (source || typeof EventSource === 'undefined') return;
  const es = new EventSource('/api/events');
  source = es;
  es.addEventListener('ready', () => {
    // First connect, or a reconnect after the server restarted: anything may have changed while we were away.
    connected = true;
    tell('resync');
  });
  es.addEventListener('change', (e) => {
    try {
      tell((JSON.parse((e as MessageEvent<string>).data) as LiveEvent).type);
    } catch {
      tell('resync');
    }
  });
  es.onerror = () => {
    // The browser retries by itself. Until it is back, subscribers poll faster.
    connected = false;
  };
}

/** Subscribe to server changes. Returns the unsubscribe function. */
export function onLive(fn: LiveListener): () => void {
  listeners.add(fn);
  open();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
      connected = false;
    }
  };
}

export const liveConnected = () => connected;
