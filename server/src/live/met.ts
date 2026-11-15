// Official alerts from MET Malaysia, through data.gov.my. Read-only, server-side, and OFF unless index.ts turns it on.
// Rules (docs/process/FLARE_TEAM_AUTOPILOT.md section 1): real data carries its provenance and a timestamp, and it never blocks the demo.
// Any failure falls back to nothing, so /api/alerts keeps serving the simulated alerts.
import type { Alert } from '../../../contracts/types.ts';

export type OfficialAlerts = () => Promise<Alert[]>;
export const noOfficialAlerts: OfficialAlerts = async () => [];

export const MET_URL = 'https://api.data.gov.my/weather/warning/?limit=8'; // the trailing slash matters: without it the API answers 301
export const MET_SOURCE = 'MET Malaysia (official, api.data.gov.my)';

type Raw = { warning_issue?: { issued?: unknown; title_en?: unknown }; valid_to?: unknown; text_en?: unknown };

/** Map the API's warning list to Alerts. Only warnings that mention Selangor, newest three, malformed rows skipped. */
export function mapWarnings(raw: unknown, incidentId: string): Alert[] {
  if (!Array.isArray(raw)) return [];
  const out: Alert[] = [];
  for (const r of raw as Raw[]) {
    const issued = r?.warning_issue?.issued;
    const title = r?.warning_issue?.title_en;
    if (typeof issued !== 'string' || typeof title !== 'string') continue;
    if (typeof r.text_en !== 'string' || !/selangor/i.test(r.text_en)) continue;
    const at = new Date(`${issued}+08:00`); // MET reports Malaysia time without an offset
    if (Number.isNaN(at.getTime())) continue;
    const until = typeof r.valid_to === 'string' ? ` Valid until ${r.valid_to.slice(0, 10)}.` : '';
    out.push({
      id: `MET-${issued}-${out.length}`,
      incidentId,
      kind: /flood|rain/i.test(title) ? 'flood' : 'update',
      text: `${title}.${until}`,
      source: MET_SOURCE,
      at: at.toISOString(),
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
}

type Options = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  failTtlMs?: number;
  timeoutMs?: number;
  incidentId?: string;
};

export function createMetAlerts({ fetchImpl = fetch, now = Date.now, ttlMs = 5 * 60_000, failTtlMs = 60_000, timeoutMs = 4000, incidentId = 'INC-DEMO-001' }: Options = {}): OfficialAlerts {
  let cache: { until: number; items: Alert[] } | null = null;
  let inflight: Promise<Alert[]> | null = null;

  async function load(): Promise<Alert[]> {
    try {
      const res = await fetchImpl(MET_URL, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = mapWarnings(await res.json(), incidentId);
      cache = { until: now() + ttlMs, items };
      return items;
    } catch {
      // Keep serving the last good items. Cache the failure briefly so a dead network does not add the timeout to every poll.
      const items = cache?.items ?? [];
      cache = { until: now() + failTtlMs, items };
      return items;
    }
  }

  return async () => {
    if (cache && now() < cache.until) return cache.items;
    inflight ??= load().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}
