import { useCallback, useEffect, useState } from 'react';
import { api, ApiRequestError, liveConnected, onLive, type Sos } from '../../shared/api.ts';
import { safeStorage } from '../data.ts';

const SOS_KEY = 'flare.citizen.sosId';

/**
 * The citizen's own request, kept across reloads, refreshed the moment the server reports a
 * change.
 */
export function useCitizenRequest() {
  const [id, setId] = useState<string | null>(() => safeStorage.get(SOS_KEY));
  const [sos, setSos] = useState<Sos | null>(null);

  useEffect(() => {
    if (!id) {
      setSos(null);
      return;
    }
    let stopped = false;
    let requestId = 0;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const currentRequest = ++requestId;
      try {
        const next = await api.getSos(id);
        if (!stopped && currentRequest === requestId) {
          setSos(next);
        }
      } catch (error) {
        if (stopped || currentRequest !== requestId) {
          return;
        }
        // The server no longer knows this request (it was reset or restarted): stop tracking it.
        if (error instanceof ApiRequestError && error.status === 404) {
          safeStorage.set(SOS_KEY, null);
          setId(null);
        }
      }
    };
    const loop = () => {
      timer = setTimeout(
        async () => {
          if (stopped) {
            return;
          }
          await load();
          if (!stopped) {
            loop();
          }
        },
        liveConnected() ? 20_000 : 3000,
      );
    };
    void load();
    loop();
    const off = onLive((type) => {
      if (type !== 'alerts') {
        void load();
      }
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      off();
    };
  }, [id]);

  const track = useCallback((created: Sos) => {
    safeStorage.set(SOS_KEY, created.id);
    setSos(created);
    setId(created.id);
  }, []);
  const clear = useCallback(() => {
    safeStorage.set(SOS_KEY, null);
    setId(null);
    setSos(null);
  }, []);
  return { sos: id ? sos : null, track, clear };
}
