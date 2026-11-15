// Live demo data for the showcase screens. Uses only the frozen shared API client.
import { useEffect, useState } from 'react';
import { api, poll, type DemoConfig, type Incident, type RecoverySnapshot, type Shelter, type Sos } from '../shared/api.ts';

export type Live = {
  incident: Incident | null;
  shelters: Shelter[];
  config: DemoConfig | null;
  recovery: RecoverySnapshot | null;
  sos: Sos[];
  error: string | null;
  syncedAt: Date | null;
};

export function useLive(pollMs = 2500): Live {
  const [s, set] = useState<Live>({ incident: null, shelters: [], config: null, recovery: null, sos: [], error: null, syncedAt: null });
  useEffect(() => {
    let alive = true;
    Promise.all([api.incidents(), api.shelters(), api.demoConfig(), api.recovery()]).then(
      ([inc, sh, cfg, rec]) => alive && set((p) => ({ ...p, incident: inc[0] ?? null, shelters: sh, config: cfg, recovery: rec })),
      (e: Error) => alive && set((p) => ({ ...p, error: e.message })),
    );
    const stop = poll(async () => {
      try {
        const sos = await api.listSos();
        if (alive) set((p) => ({ ...p, sos, error: null, syncedAt: new Date() }));
      } catch (e) {
        if (alive) set((p) => ({ ...p, error: (e as Error).message }));
      }
    }, pollMs);
    return () => {
      alive = false;
      stop();
    };
  }, [pollMs]);
  return s;
}

export const myt = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });

export const STATUS_TONE = {
  pending: { dot: '#f43f5e', label: 'Pending', chip: 'bg-rose-500/15 text-rose-300 ring-rose-500/30' },
  assigned: { dot: '#f59e0b', label: 'Assigned', chip: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  resolved: { dot: '#34d399', label: 'Resolved', chip: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
} as const;
