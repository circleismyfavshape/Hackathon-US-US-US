// Official weather warnings from MET Malaysia, through data.gov.my. Read-only, fetched on the server (the API sends no CORS header).
// On by default; FLARE_LIVE_ALERTS=0 turns it off. No key or account is needed.
// Real data always carries its source and issue time, and it never blocks the app: any failure serves the last good items, or none.
import type { Alert } from '../../../contracts/types.ts';

export type OfficialAlerts = () => Promise<Alert[]>;
export const noOfficialAlerts: OfficialAlerts = async () => [];

export const MET_URL = 'https://api.data.gov.my/weather/warning/?limit=12'; // the trailing slash matters: without it the API answers 301
export const MET_SOURCE = 'MET Malaysia';
export const MET_PAGE = 'https://www.met.gov.my/';
export const MAX_OFFICIAL = 6;

type Raw = {
  warning_issue?: { issued?: unknown; title_en?: unknown };
  valid_to?: unknown;
  heading_en?: unknown;
  text_en?: unknown;
};

const LOCAL = /selangor|kuala lumpur|putrajaya|klang valley|petaling|subang|shah alam|klang\b/i;

/** MET reports Malaysia time without an offset. */
const myt = (v: unknown): Date | null => {
  if (typeof v !== 'string') {
    return null;
  }
  const d = new Date(`${v}+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** MET bodies are long, upper-case-headed bulletins. Keep the first sentences, as plain prose. */
export function tidy(text: string, max = 260): string {
  const flat = text
    .replace(/SECTION [A-Z]:[^)]*\]\s*/g, '')
    .replace(/^\d\)\s*[A-Z ]+WARNING\s*/g, '')
    .replace(/\s*•\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= max) {
    return flat;
  }
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return `${(stop > 120 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(' '))).replace(/[,;]$/, '')}…`.replace(
    '.…',
    '.',
  );
}

/** Map the API's warning list to feed items: current warnings only, duplicates merged, local ones first, then newest. */
export function mapWarnings(raw: unknown, now = Date.now()): Alert[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: Alert[] = [];
  for (const r of raw as Raw[]) {
    const issued = myt(r?.warning_issue?.issued);
    const title = r?.warning_issue?.title_en;
    if (!issued || typeof title !== 'string' || typeof r.text_en !== 'string') {
      continue;
    }
    if (/^no advisory$/i.test(title.trim())) {
      continue;
    } // "nothing to report" rows
    const validTo = myt(r.valid_to);
    if (validTo && validTo.getTime() < now) {
      continue;
    } // expired
    const key = `${title}|${r.warning_issue?.issued}`;
    if (seen.has(key)) {
      continue;
    } // MET lists one bulletin once per validity window
    seen.add(key);
    out.push({
      id: `MET-${String(r.warning_issue?.issued)}-${title.replace(/\W+/g, '-').toLowerCase()}`,
      incidentId: null,
      kind: /flood|rain/i.test(title) ? 'flood' : 'weather', // by title only: most bulletins mention rain somewhere in the body
      title,
      text: tidy(r.text_en),
      source: MET_SOURCE,
      sourceType: 'official',
      at: issued.toISOString(),
      validTo: validTo ? validTo.toISOString() : null,
      local: LOCAL.test(r.text_en),
      url: MET_PAGE,
    });
  }
  return out
    .sort((a, b) => Number(b.local) - Number(a.local) || b.at.localeCompare(a.at))
    .slice(0, MAX_OFFICIAL);
}

type Options = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  failTtlMs?: number;
  timeoutMs?: number;
};

export function createMetAlerts({
  fetchImpl = fetch,
  now = Date.now,
  ttlMs = 2 * 60_000,
  failTtlMs = 30_000,
  timeoutMs = 4000,
}: Options = {}): OfficialAlerts {
  let cache: { until: number; items: Alert[] } | null = null;
  let inflight: Promise<Alert[]> | null = null;

  async function load(): Promise<Alert[]> {
    try {
      const res = await fetchImpl(MET_URL, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const items = mapWarnings(await res.json(), now());
      cache = { until: now() + ttlMs, items };
      return items;
    } catch {
      // Keep serving the last good items. Cache the failure briefly so a dead network does not add the timeout to every request.
      const items = cache?.items ?? [];
      cache = { until: now() + failTtlMs, items };
      return items;
    }
  }

  return async () => {
    if (cache && now() < cache.until) {
      return cache.items;
    }
    inflight ??= load().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}
