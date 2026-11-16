// Shared data hooks. Every view reads the same server through the typed API client, and refetches the moment
// the server says something changed (shared/api.ts onLive), with slow polling underneath as a safety net.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  liveConnected,
  onLive,
  type Alert,
  type DemoLocation,
  type LiveEvent,
  type Route,
  type Scenario,
  type Shelter,
  type Sos,
  type ZoneLevel,
} from '../shared/api.ts';
import { dangerAt, distanceM } from '../features/citizen/geo.ts';

export const errText = (e: unknown) =>
  e instanceof Error ? e.message : 'The service could not be reached.';

/* ── Scenario (static until the demo is reset) ────────────────────── */
export function useScenario() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    api.scenario().then(
      (s) =>
        s.incidents.length
          ? setScenario(s)
          : setError('No flood information is available right now.'),
      (e) => setError(errText(e)),
    );
  }, []);
  useEffect(() => {
    load();
    return onLive((type) => {
      if (type === 'reset') {
        load();
      }
    });
  }, [load]);
  return { scenario, error, reload: load };
}

/* ── Live resources ───────────────────────────────────────────────── */
/** Fetches now, whenever the server announces one of `on`, when the tab becomes visible again, and on a slow timer
 *  (faster while the push stream is down). A slower earlier response can never overwrite a newer one. */
function useLive<T>(fetcher: () => Promise<T>, on: LiveEvent['type'][], initial: T) {
  const [state, setState] = useState<{ data: T; loaded: boolean; ok: boolean }>({
    data: initial,
    loaded: false,
    ok: true,
  });
  const seq = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const types = on.join(',');

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const data = await fetchRef.current();
      if (mine === seq.current) {
        setState({ data, loaded: true, ok: true });
      }
    } catch {
      if (mine === seq.current) {
        setState((s) => ({ ...s, ok: false }));
      }
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(
        async () => {
          if (stopped) {
            return;
          }
          if (document.visibilityState === 'visible') {
            await refresh();
          }
          loop();
        },
        liveConnected() ? 20_000 : 3000,
      );
    };
    void refresh();
    loop();
    const wanted = types.split(',');
    const off = onLive((type) => {
      if (type === 'resync' || type === 'reset' || wanted.includes(type)) {
        void refresh();
      }
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      off();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, types]);

  return { ...state, refresh };
}

const NO_SOS: Sos[] = [];
const NO_ALERTS: Alert[] = [];

/** Every request, oldest first. Demo responder only. */
export function useSosList() {
  const { data, ...rest } = useLive(api.listSos, ['sos'], NO_SOS);
  return { list: data, ...rest };
}

/** The news feed: official warnings first, then simulated scenario updates, newest first within each. */
export function useAlerts() {
  const { data, ...rest } = useLive(api.alerts, ['alerts'], NO_ALERTS);
  return { alerts: data, ...rest };
}

/** Calls `onNew` for items that arrive after the first load. */
export function useArrivals<T extends { id: string }>(
  items: T[],
  loaded: boolean,
  onNew: (item: T) => void,
) {
  const seen = useRef<Set<string> | null>(null);
  const cb = useRef(onNew);
  cb.current = onNew;
  useEffect(() => {
    if (!loaded) {
      return;
    }
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id));
      return;
    }
    for (const it of items) {
      if (!seen.current.has(it.id)) {
        seen.current.add(it.id);
        cb.current(it);
      }
    }
  }, [items, loaded]);
}

/* ── Simulated location ───────────────────────────────────────────────
   In this demo "where the phone is" is one of the scenario's demo places. The tester picks it in the bar outside
   the phone; the app inside the phone (an iframe) hears the change through localStorage. */
const LOC_KEY = 'flare.location';
const LOC_EVENT = 'flare:location';
const safeStorage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) {
        localStorage.removeItem(k);
      } else {
        localStorage.setItem(k, v);
      }
    } catch {
      /* private mode: the value just lasts for this page */
    }
  },
};
export { safeStorage };

export function useDemoLocation(
  scenario: Scenario | null,
): [DemoLocation | null, (id: string) => void] {
  const [id, setId] = useState<string | null>(() => safeStorage.get(LOC_KEY));
  useEffect(() => {
    const sync = () => setId(safeStorage.get(LOC_KEY));
    window.addEventListener('storage', sync);
    window.addEventListener(LOC_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(LOC_EVENT, sync);
    };
  }, []);
  const choose = useCallback((next: string) => {
    safeStorage.set(LOC_KEY, next);
    setId(next);
    window.dispatchEvent(new Event(LOC_EVENT));
  }, []);
  const location = useMemo(() => {
    if (!scenario) {
      return null;
    }
    return (
      scenario.demoLocations.find((l) => l.id === id) ??
      scenario.demoLocations.find((l) => l.id === scenario.defaultLocationId) ??
      scenario.demoLocations[0] ??
      null
    );
  }, [scenario, id]);
  return [location, choose];
}

/* ── What the app knows about where you are ───────────────────────── */
export type SafeOption = {
  shelter: Shelter;
  route: Route | null;
  distanceM: number;
  minutes: number;
};
export type Situation = {
  location: DemoLocation;
  /** The marked zone the location is in, or null when it is outside every marked zone. */
  danger: ReturnType<typeof dangerAt>;
  /** Safe zones: relief points quickest first, then medical points. */
  options: SafeOption[];
  /** The closest flood area and how far away its centre is. */
  nearestFlood: { area: string; id: string; metres: number } | null;
};

const WALK_M_PER_MIN = 75;

export function situationAt(scenario: Scenario, location: DemoLocation): Situation {
  const danger = dangerAt(location.location, scenario.incidents);
  const incidentId = danger?.incident.id ?? location.incidentId;
  const pool = scenario.shelters.filter((s) => s.incidentId === incidentId);
  const options = (pool.length ? pool : scenario.shelters)
    .map((shelter): SafeOption => {
      const route =
        scenario.routes.find(
          (r) => r.fromLocationId === location.id && r.shelterId === shelter.id,
        ) ?? null;
      const straight = distanceM(location.location, shelter.location);
      return {
        shelter,
        route,
        distanceM: route?.distanceM ?? Math.round(straight * 1.3),
        minutes: route?.minutes ?? Math.max(1, Math.ceil((straight * 1.3) / WALK_M_PER_MIN)),
      };
    })
    // Relief points first, quickest first. Medical points come after: they are for injuries, not for shelter.
    .sort(
      (a, b) =>
        Number(a.shelter.kind === 'medical') - Number(b.shelter.kind === 'medical') ||
        a.minutes - b.minutes,
    );
  const near =
    scenario.incidents
      .map((i) => ({ area: i.area, id: i.id, metres: distanceM(location.location, i.location) }))
      .sort((a, b) => a.metres - b.metres)[0] ?? null;
  return { location, danger, options, nearestFlood: near };
}

/* ── Words and colours shared by every view ───────────────────────── */
export const LEVEL_COLOR: Record<ZoneLevel, string> = {
  severe: '#dc2626',
  high: '#ea580c',
  moderate: '#d97706',
};
export const LEVEL_NAME: Record<ZoneLevel, string> = {
  severe: 'Severe',
  high: 'High',
  moderate: 'Moderate',
};
export const SEVERITY_COLOR = {
  severe: '#dc2626',
  high: '#ea580c',
  moderate: '#d97706',
  low: '#64748b',
} as const;
export const SEVERITY_NAME = {
  severe: 'Severe',
  high: 'High',
  moderate: 'Moderate',
  low: 'Watch',
} as const;

/** "just now", "4 min ago", "2 h ago", then the date. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) {
    return 'just now';
  }
  if (s < 3600) {
    return `${Math.max(1, Math.round(s / 60))} min ago`;
  }
  if (s < 86_400) {
    return `${Math.round(s / 3600)} h ago`;
  }
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

export const clockMY = (d: string | number | Date) =>
  new Date(d).toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kuala_Lumpur',
  });

/** Re-renders once a minute so "4 min ago" stays true. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
