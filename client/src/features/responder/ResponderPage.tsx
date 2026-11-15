// OWNER: D3 (Responder & Recovery UI). D2 placeholder — replace freely inside features/responder/**.
// Keep the default export name; App.tsx routes /responder here.
import { useEffect, useState } from 'react';
import { api, poll, type Sos } from '../../shared/api.ts';

export default function ResponderPage() {
  const [sos, setSos] = useState<Sos[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () =>
      poll(async () => {
        try {
          setSos(await api.listSos());
          setError(null);
        } catch (e) {
          setError((e as Error).message);
        }
      }),
    [],
  );
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Responder portal</h1>
      <p className="text-sm text-slate-500">Placeholder — D3 builds the SOS queue, assignment controls and recovery comparison here.</p>
      {error && <p className="mt-4 text-red-700">API error: {error}</p>}
      <p className="mt-4">{sos.length} demo SOS request(s)</p>
    </main>
  );
}
