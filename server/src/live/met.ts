// Fetch MET Malaysia warnings on the server because data.gov.my does not send a CORS header.
// On by default; FLARE_LIVE_ALERTS=0 turns it off. No key or account is needed.
// If fetching fails, keep only the still-valid cached warnings.
import type { Alert } from '../../../contracts/types.ts';

export type OfficialAlerts = () => Promise<Alert[]>;
export const noOfficialAlerts: OfficialAlerts = async () => [];

// The trailing slash avoids a redirect from the weather API.
export const MET_URL = 'https://api.data.gov.my/weather/warning/?limit=12';
export const MET_SOURCE = 'MET Malaysia';
export const MET_PAGE = 'https://www.met.gov.my/';
export const MAX_OFFICIAL = 6;

type MetWarning = {
  warning_issue?: { issued?: unknown; title_en?: unknown };
  valid_to?: unknown;
  heading_en?: unknown;
  text_en?: unknown;
};

const LOCAL_AREAS =
  /selangor|kuala lumpur|putrajaya|klang valley|petaling|subang|shah alam|klang\b/i;

/** MET reports Malaysia time without an offset. */
const parseMalaysiaTime = (value: unknown): Date | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const date = new Date(`${value}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
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
  const shortened = flat.slice(0, max);
  const sentenceEnd = Math.max(shortened.lastIndexOf('. '), shortened.lastIndexOf('; '));
  // Prefer a complete sentence if it keeps enough of the warning; otherwise, stop at a word.
  let summary: string;
  if (sentenceEnd > 120) {
    summary = shortened.slice(0, sentenceEnd + 1);
  } else {
    summary = shortened.slice(0, shortened.lastIndexOf(' '));
  }
  summary = summary.replace(/[,;]$/, '');
  return `${summary}…`.replace('.…', '.');
}

/**
 * Map the API's warning list to feed items: current warnings only, duplicates merged, local ones
 * first, then newest.
 */
export function mapWarnings(raw: unknown, now = Date.now()): Alert[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const warnings: Alert[] = [];
  for (const warning of raw as MetWarning[]) {
    const issued = parseMalaysiaTime(warning?.warning_issue?.issued);
    const title = warning?.warning_issue?.title_en;
    if (!issued || typeof title !== 'string' || typeof warning.text_en !== 'string') {
      continue;
    }
    if (/^no advisory$/i.test(title.trim())) {
      continue;
    }
    const validTo = parseMalaysiaTime(warning.valid_to);
    if (validTo && validTo.getTime() <= now) {
      continue;
    }
    const key = `${title}|${warning.warning_issue?.issued}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    warnings.push({
      id: `MET-${String(warning.warning_issue?.issued)}-${title.replace(/\W+/g, '-').toLowerCase()}`,
      incidentId: null,
      // Classify by title: most weather bulletin bodies mention rain at least once.
      kind: /flood|rain/i.test(title) ? 'flood' : 'weather',
      title,
      text: tidy(warning.text_en),
      source: MET_SOURCE,
      sourceType: 'official',
      at: issued.toISOString(),
      validTo: validTo ? validTo.toISOString() : null,
      local: LOCAL_AREAS.test(warning.text_en),
      url: MET_PAGE,
    });
  }
  return warnings
    .sort((first, second) => {
      if (first.local !== second.local) {
        return first.local ? -1 : 1;
      }
      return second.at.localeCompare(first.at);
    })
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
  let pendingRequest: Promise<Alert[]> | null = null;

  async function load(): Promise<Alert[]> {
    try {
      const response = await fetchImpl(MET_URL, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('Unexpected MET warning response');
      }
      const items = mapWarnings(payload, now());
      cache = { until: now() + ttlMs, items };
      return items;
    } catch {
      // Cache failures briefly so an outage does not add a timeout to every page refresh.
      const items = cache?.items ?? [];
      cache = { until: now() + failTtlMs, items };
      return items;
    }
  }

  return async () => {
    // A cached bulletin can expire before the cache TTL, including during an outage.
    const currentItems = (items: Alert[]) =>
      items.filter((item) => item.validTo === null || Date.parse(item.validTo) > now());
    if (cache && now() < cache.until) {
      return currentItems(cache.items);
    }
    // Visitors refreshing at the same time share one upstream weather request.
    if (!pendingRequest) {
      pendingRequest = load().finally(() => {
        pendingRequest = null;
      });
    }
    return currentItems(await pendingRequest);
  };
}
