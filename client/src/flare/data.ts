// Shared data hooks. Every interface reads the same backend through the typed API client.
import { useCallback, useEffect, useState } from 'react';
import { api, poll, type Alert, type DemoConfig, type Incident, type RecoverySnapshot, type Shelter, type Sos } from '../shared/api.ts';
import { errText } from './ui.tsx';

export type Scenario = { incidents: Incident[]; shelters: Shelter[]; config: DemoConfig; recovery: RecoverySnapshot };

export function useScenario() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    Promise.all([api.incidents(), api.shelters(), api.demoConfig(), api.recovery()]).then(
      ([incidents, shelters, config, recovery]) => {
        if (!incidents.length) return setError('No incident is available.');
        setScenario({ incidents, shelters, config, recovery });
      },
      (e) => setError(errText(e)),
    );
  }, []);
  useEffect(load, [load]);
  return { scenario, error, reload: load };
}

export type LiveSos = { list: Sos[]; ok: boolean; at: number | null; refresh: () => Promise<void> };

export function useSosList(ms = 2500): LiveSos {
  const [state, setState] = useState<{ list: Sos[]; ok: boolean; at: number | null }>({ list: [], ok: true, at: null });
  const refresh = useCallback(async () => {
    try {
      const list = await api.listSos();
      setState({ list, ok: true, at: Date.now() });
    } catch {
      setState((s) => ({ ...s, ok: false }));
    }
  }, []);
  useEffect(() => poll(refresh, ms), [refresh, ms]);
  return { ...state, refresh };
}

/** Live update feed, newest first. `loaded` turns true after the first successful fetch. */
export function useAlerts(ms = 4000) {
  const [state, setState] = useState<{ alerts: Alert[]; loaded: boolean }>({ alerts: [], loaded: false });
  useEffect(
    () =>
      poll(async () => {
        try {
          const alerts = (await api.alerts()).sort((a, b) => b.at.localeCompare(a.at));
          setState({ alerts, loaded: true });
        } catch {
          /* keep the last feed */
        }
      }, ms),
    [ms],
  );
  return state;
}

export const ALERT_TITLE = { flood: 'New flood spotted', shelter: 'Relief centre open', update: 'Update' } as const;
export const SEVERITY_COLOR = { high: '#ff4d1c', moderate: '#9a6300', low: '#55524a' } as const;
export const areaName = (i: Incident) => i.title.split('·')[0].trim();

export const RESOURCES = ['water', 'food', 'hygiene'] as const;
export const RESOURCE_LABEL = { water: 'Water', food: 'Food', hygiene: 'Hygiene' } as const;
