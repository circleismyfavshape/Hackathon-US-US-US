// Shared data hooks. Every interface reads the same demo backend through the frozen API client.
import { useCallback, useEffect, useState } from 'react';
import { api, poll, type DemoConfig, type Incident, type RecoverySnapshot, type Shelter, type Sos } from '../shared/api.ts';
import { errText } from './ui.tsx';

export type Scenario = { incident: Incident; shelters: Shelter[]; config: DemoConfig; recovery: RecoverySnapshot };

export function useScenario() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    Promise.all([api.incidents(), api.shelters(), api.demoConfig(), api.recovery()]).then(
      ([incidents, shelters, config, recovery]) => {
        if (!incidents[0]) return setError('No incident is available.');
        setScenario({ incident: incidents[0], shelters: shelters.filter((s) => s.incidentId === incidents[0].id), config, recovery });
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

export const RESOURCES = ['water', 'food', 'hygiene'] as const;
export const RESOURCE_LABEL = { water: 'Water', food: 'Food', hygiene: 'Hygiene' } as const;
