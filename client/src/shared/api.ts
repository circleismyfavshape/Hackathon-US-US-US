// Typed client for the FLARE API (contracts/API_CONTRACT.md). Call these instead of fetch() so
// shapes stay in sync.
import type {
  Alert,
  ApiError,
  LiveEvent,
  Sos,
  SosCreate,
  SosPatch,
} from '../../../contracts/types.ts';
import { parseScenario } from './scenario.ts';

export type * from '../../../contracts/types.ts';
export { ZONE_LEVELS } from '../../../contracts/types.ts';

function requestErrorMessage(status: number, body: ApiError | null): string {
  if (body?.details?.length) {
    return `${body.error}: ${body.details.join('; ')}`;
  }
  if (body?.error !== undefined && body.error !== null) {
    return body.error;
  }
  // The development proxy can return a non-JSON 5xx when the local API is stopped.
  if (status >= 500) {
    return 'The FLARE server is not running. Start it with npm run dev (or npm start).';
  }
  return `HTTP ${status}`;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public body: ApiError | null,
  ) {
    super(requestErrorMessage(status, body));
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new Error('No connection to the FLARE server. Check that it is running, then try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiRequestError(response.status, data as ApiError | null);
  }
  return data as T;
}

export const api = {
  health: () => request<{ status: 'ok'; mode: 'demo' }>('/api/health'),
  scenario: () => request<unknown>('/api/scenario').then(parseScenario),
  alerts: () => request<Alert[]>('/api/alerts'),
  createSos: (body: SosCreate) => request<Sos>('/api/sos', { method: 'POST', body }),
  listSos: () => request<Sos[]>('/api/sos'),
  getSos: (id: string) => request<Sos>(`/api/sos/${encodeURIComponent(id)}`),
  patchSos: (id: string, body: SosPatch) =>
    request<Sos>(`/api/sos/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  resetDemo: () => request<{ status: 'reset' }>('/api/demo/reset', { method: 'POST' }),
};

/* Live updates.
   One EventSource per page. The server sends a tiny message whenever requests or the feed change,
   and every subscriber refetches at once. If the stream cannot be opened, subscribers poll instead. */
type LiveListener = (type: LiveEvent['type'] | 'resync') => void;
const listeners = new Set<LiveListener>();
let source: EventSource | null = null;
let connected = false;

const notifyListeners = (type: Parameters<LiveListener>[0]) => {
  for (const listener of [...listeners]) {
    listener(type);
  }
};

function openLiveStream() {
  if (source || typeof EventSource === 'undefined') {
    return;
  }
  const eventSource = new EventSource('/api/events');
  source = eventSource;
  eventSource.addEventListener('ready', () => {
    // First connect, or a reconnect after the server restarted: anything may have changed while we
    // were away.
    connected = true;
    notifyListeners('resync');
  });
  eventSource.addEventListener('change', (event) => {
    try {
      notifyListeners((JSON.parse((event as MessageEvent<string>).data) as LiveEvent).type);
    } catch {
      notifyListeners('resync');
    }
  });
  eventSource.onerror = () => {
    // The browser retries by itself. Until it is back, subscribers poll faster.
    connected = false;
  };
}

/** Subscribe to server changes. Returns the unsubscribe function. */
export function onLive(listener: LiveListener): () => void {
  listeners.add(listener);
  openLiveStream();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
      connected = false;
    }
  };
}

export const liveConnected = () => connected;
