// OWNER: D2. Typed client for the frozen FLARE API (contracts/API_CONTRACT.md).
// D1/D3: call these instead of fetch() directly so shapes stay in sync.
import type {
  AiExplanation,
  Alert,
  ApiError,
  ComparisonResult,
  Incident,
  LatLng,
  RecoverySnapshot,
  Shelter,
  Sos,
  SosCreate,
  SosPatch,
  Strategy,
} from '../../../contracts/types.ts';

export type * from '../../../contracts/types.ts';

export type DemoConfig = {
  demoLocations: { id: string; incidentId?: string; label: string; location: LatLng }[];
  demoBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  demoTeams: string[];
};

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public body: ApiError | null,
  ) {
    super(body?.details?.length ? `${body.error}: ${body.details.join('; ')}` : (body?.error ?? `HTTP ${status}`));
  }
}

async function req<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiRequestError(r.status, data as ApiError | null);
  return data as T;
}

export const api = {
  health: () => req<{ status: 'ok'; mode: 'demo' }>('/api/health'),
  incidents: () => req<Incident[]>('/api/incidents'),
  alerts: () => req<Alert[]>('/api/alerts'),
  shelters: () => req<Shelter[]>('/api/shelters'),
  demoConfig: () => req<DemoConfig>('/api/demo/config'),
  createSos: (body: SosCreate) => req<Sos>('/api/sos', { method: 'POST', body }),
  listSos: () => req<Sos[]>('/api/sos'),
  getSos: (id: string) => req<Sos>(`/api/sos/${encodeURIComponent(id)}`),
  patchSos: (id: string, body: SosPatch) => req<Sos>(`/api/sos/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  recovery: () => req<RecoverySnapshot>('/api/recovery'),
  compare: (strategy: Strategy) => req<ComparisonResult>('/api/recovery/compare', { method: 'POST', body: { strategy } }),
  /** v1.1: AI-written trade-off summary. Slow (seconds); rejects with 503 when AI is not configured. */
  explain: () => req<AiExplanation>('/api/recovery/explain', { method: 'POST' }),
  resetDemo: () => req<{ status: 'reset' }>('/api/demo/reset', { method: 'POST' }),
};

/** Poll `fn` every `ms` (default 2500) until the returned stop() is called. */
export function poll(fn: () => Promise<void> | void, ms = 2500): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      await fn();
    } finally {
      if (!stopped) timer = setTimeout(tick, ms);
    }
  };
  let timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
