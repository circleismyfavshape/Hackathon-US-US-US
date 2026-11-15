// OWNER: D1 (Citizen UI). D2 placeholder — replace freely inside features/citizen/**.
// Keep the default export name; App.tsx routes /citizen here.
import { useEffect, useState } from 'react';
import { api, type Incident } from '../../shared/api.ts';

export default function CitizenPage() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.incidents().then(setIncidents, (e: Error) => setError(e.message));
  }, []);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Citizen portal</h1>
      <p className="text-sm text-slate-500">Placeholder — D1 builds the map, incident card, SOS form and status tracking here.</p>
      {error && <p className="mt-4 text-red-700">API error: {error}</p>}
      {incidents?.map((i) => (
        <div key={i.id} className="mt-4 rounded border bg-white p-4">
          <div className="font-semibold">{i.title}</div>
          <div className="text-xs text-slate-500">{i.sourceLabel}</div>
        </div>
      ))}
    </main>
  );
}
