// OWNER: D1. Polls GET /api/sos for the live map. Demo only: the contract marks that list as responder-only,
// so it is cut down to id, status and location here and descriptions never reach the page.
import { useEffect, useState } from 'react';
import { api, poll, type Sos } from '../../shared/api.ts';

export type LiveRequest = Pick<Sos, 'id' | 'status' | 'location'>;
export type Live = { requests: LiveRequest[]; ok: boolean; updatedAt: number | null };

export function useLiveSos(): Live {
  const [live, setLive] = useState<Live>({ requests: [], ok: true, updatedAt: null });
  useEffect(
    () =>
      poll(async () => {
        try {
          const all = await api.listSos();
          setLive({ requests: all.map(({ id, status, location }) => ({ id, status, location })), ok: true, updatedAt: Date.now() });
        } catch {
          setLive((l) => ({ ...l, ok: false }));
        }
      }),
    [],
  );
  return live;
}
