// OWNER: D1 (Citizen UI). App.tsx routes /citizen to this default export.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, type DemoConfig, type Incident, type Shelter, type Sos } from '../../shared/api.ts';
import { LocationPicker, type Chosen } from './LocationPicker.tsx';
import { ScenarioMap } from './ScenarioMap.tsx';
import { SosForm } from './SosForm.tsx';
import { SosTracker } from './SosTracker.tsx';

type Scenario = { incident: Incident; shelters: Shelter[]; config: DemoConfig };

const SOS_KEY = 'flare.citizen.sosId';
const store = {
  get: () => { try { return localStorage.getItem(SOS_KEY); } catch { return null; } },
  set: (id: string) => { try { localStorage.setItem(SOS_KEY, id); } catch { /* storage blocked: tracking just won't survive a reload */ } },
  clear: () => { try { localStorage.removeItem(SOS_KEY); } catch { /* see set */ } },
};

async function loadScenario(): Promise<Scenario> {
  const [incidents, shelters, config] = await Promise.all([api.incidents(), api.shelters(), api.demoConfig()]);
  if (!incidents[0]) throw new Error('No incident is available.');
  return { incident: incidents[0], shelters: shelters.filter((s) => s.incidentId === incidents[0].id), config };
}

export default function CitizenPage() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [sos, setSos] = useState<Sos | null>(null);

  const load = useCallback(() => {
    setError(null);
    loadScenario().then(setScenario, (e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const id = store.get();
    if (!id) return;
    api.getSos(id).then(setSos, () => store.clear());
  }, []);

  const created = useCallback((s: Sos) => { store.set(s.id); setSos(s); }, []);
  const clear = useCallback(() => { store.clear(); setSos(null); }, []);

  if (error) {
    return (
      <Shell>
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
          <p className="font-semibold">Could not load the scenario.</p>
          <p className="text-sm">{error}</p>
          <button type="button" onClick={load} className="mt-3 rounded-md border border-red-400 bg-white px-3 py-1.5 text-sm font-medium hover:bg-red-100">
            Try again
          </button>
        </div>
      </Shell>
    );
  }
  if (!scenario) {
    return (
      <Shell>
        <p role="status" className="text-slate-600">Loading the simulated scenario…</p>
      </Shell>
    );
  }

  const { incident, shelters, config } = scenario;
  const picked = config.demoLocations.find((l) => l.id === chosen?.id);
  const location = picked && chosen ? { ...picked.location, mode: chosen.mode } : null;

  return (
    <Shell>
      <section aria-labelledby="incident-title" className="rounded-lg border-2 border-red-300 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">SIMULATED</span>
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">Severity: {incident.severity}</span>
        </div>
        <h1 id="incident-title" className="mt-2 text-2xl font-semibold">{incident.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {incident.sourceLabel}. Updated {new Date(incident.updatedAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })} MYT.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {incident.guidance.map((g) => <li key={g}>{g}</li>)}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <ScenarioMap incident={incident} shelters={shelters} locations={config.demoLocations} selectedId={chosen?.id ?? null} onSelect={(id) => setChosen({ id, mode: 'manual-demo' })} />

          <section aria-labelledby="shelters-title">
            <h2 id="shelters-title" className="text-lg font-semibold">Shelters</h2>
            <ul className="mt-2 space-y-2">
              {shelters.map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-300 bg-white p-3 text-sm">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-slate-600">{s.sourceLabel}. No route is suggested.</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          {sos ? (
            <SosTracker sos={sos} onUpdate={setSos} onGone={clear} onNew={clear} />
          ) : (
            <>
              <h2 className="text-lg font-semibold">Ask for help (demo)</h2>
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">This is a simulation. No real responder or emergency service receives your request. In a real emergency, contact the official authorities.</p>
              <LocationPicker incident={incident} locations={config.demoLocations} chosen={chosen} onChoose={setChosen} />
              <SosForm incidentId={incident.id} location={location} onCreated={created} />
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>;
}
