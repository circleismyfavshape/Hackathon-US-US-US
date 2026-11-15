// OWNER: D1 (Citizen UI). App.tsx routes /citizen to this default export.
import '@fontsource-variable/geist';
import '@fontsource-variable/inter';
import '@/components/arc/foundation.css';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert } from '@/components/arc/alert/alert';
import { Badge } from '@/components/arc/badge/badge';
import { Button } from '@/components/arc/button/button';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { api, type DemoConfig, type Incident, type Shelter, type Sos } from '../../shared/api.ts';
import { LocationPicker, type Chosen } from './LocationPicker.tsx';
import { MapView } from './MapView.tsx';
import { SosForm } from './SosForm.tsx';
import { SosTracker } from './SosTracker.tsx';
import { useLiveSos } from './useLiveSos.ts';
import styles from './citizen.module.css';

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
  const live = useLiveSos();

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
        <div className={styles.group} style={{ maxWidth: 560 }}>
          <Alert tone="danger" title="We could not load the scenario">
            {error}. Check that the demo server is running, then try again.
          </Alert>
          <div>
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          </div>
        </div>
      </Shell>
    );
  }
  if (!scenario) {
    return (
      <Shell>
        <div className={styles.loading} aria-busy="true">
          <Skeleton label="Loading the simulated scenario" lines={3} />
          <Skeleton label="Loading the map" lines={6} />
        </div>
      </Shell>
    );
  }

  const { incident, shelters, config } = scenario;
  const picked = config.demoLocations.find((l) => l.id === chosen?.id);
  const location = picked && chosen ? { ...picked.location, mode: chosen.mode } : null;

  return (
    <Shell>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>{incident.title}</h1>
          <Badge tone="danger">Severity: {incident.severity}</Badge>
        </div>
        <p className={styles.meta}>
          {incident.sourceLabel}. Updated {new Date(incident.updatedAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })} MYT.
        </p>
        <ul className={styles.guidance}>
          {incident.guidance.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </header>

      <div className={styles.columns}>
        <div className={styles.areaMap}>
          <MapView incident={incident} shelters={shelters} locations={config.demoLocations} selectedId={chosen?.id ?? null} onSelect={(id) => setChosen({ id, mode: 'manual-demo' })} live={live} ownId={sos?.id ?? null} />
        </div>

        <section aria-labelledby="shelters-title" className={`${styles.group} ${styles.areaShelters}`}>
          <h2 id="shelters-title" className={styles.sectionTitle}>
            Shelters
          </h2>
          <ul className={styles.shelters}>
            {shelters.map((s) => (
              <li key={s.id} className={styles.shelter}>
                <span className={styles.shelterName}>{s.name}</span>
                <span className={styles.hint}>{s.sourceLabel}. No route is suggested.</span>
              </li>
            ))}
          </ul>
        </section>

        <div className={`${styles.region} ${styles.areaSos}`}>
          {sos ? (
            <SosTracker sos={sos} onUpdate={setSos} onGone={clear} onNew={clear} />
          ) : (
            <>
              <section aria-labelledby="sos-title" className={styles.group} style={{ gap: 4 }}>
                <h2 id="sos-title" className={styles.sectionTitle}>
                  Ask for help (demo)
                </h2>
                <p className={styles.hint}>Simulation only. No real responder receives this. In a real emergency, contact the official authorities.</p>
              </section>
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
  return (
    <div className={styles.root}>
      <main className={styles.page}>{children}</main>
    </div>
  );
}
