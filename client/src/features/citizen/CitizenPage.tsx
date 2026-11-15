// OWNER: D1 (Citizen UI). App.tsx routes /citizen to this default export.
// Full-viewport map; the incident, request and live status are panels floating over it (a bottom sheet on phones).
import '@fontsource-variable/geist';
import '@fontsource-variable/inter';
import '@/components/arc/foundation.css';
import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { Alert } from '@/components/arc/alert/alert';
import { Badge } from '@/components/arc/badge/badge';
import { Button } from '@/components/arc/button/button';
import { ScrollArea } from '@/components/arc/scroll-area/scroll-area';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { api, type DemoConfig, type Incident, type Shelter, type Sos } from '../../shared/api.ts';
import { zoneAt } from './geo.ts';
import { LocationPicker, type Chosen } from './LocationPicker.tsx';
import { MapView, useBasemapReachable } from './MapView.tsx';
import { IncidentPanel, LivePanel } from './panels.tsx';
import { SosForm } from './SosForm.tsx';
import { SosTracker } from './SosTracker.tsx';
import { useLiveSos } from './useLiveSos.ts';
import { ZONE } from './zone.ts';
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

/** The map fills the viewport under the sticky demo banner (D2's DemoBanner), if the app shows one. Measure it so the stage fits exactly, including when it wraps on phones; 0 when there is none. */
function useBannerHeight(): number {
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('[role="status"][class*="sticky"]');
    if (!el) return;
    const read = () => setH(Math.round(el.getBoundingClientRect().height));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

export default function CitizenPage() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [sos, setSos] = useState<Sos | null>(null);
  const [open, setOpen] = useState(false);
  const live = useLiveSos();
  const reachable = useBasemapReachable();
  const bannerH = useBannerHeight();

  const load = useCallback(() => {
    setError(null);
    loadScenario().then(setScenario, (e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const id = store.get();
    if (!id) return;
    api.getSos(id).then((s) => { setSos(s); setOpen(true); }, () => store.clear());
  }, []);

  const created = useCallback((s: Sos) => { store.set(s.id); setSos(s); setOpen(true); }, []);
  const clear = useCallback(() => { store.clear(); setSos(null); }, []);

  const stage = { '--banner-h': `${bannerH}px` } as CSSProperties;

  if (error) {
    return (
      <div className={styles.root} style={stage}>
        <div className={styles.loadError}>
          <Alert tone="danger" title="We could not load the scenario">
            {error}. Check that the demo server is running, then try again.
          </Alert>
          <div>
            <Button variant="secondary" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (!scenario) {
    return (
      <div className={styles.root} style={stage}>
        <div className={styles.loading} aria-busy="true">
          <Skeleton label="Loading the simulated scenario" lines={2} />
          <Skeleton label="Loading the request form" lines={5} />
        </div>
      </div>
    );
  }

  const { incident, shelters, config } = scenario;
  const picked = config.demoLocations.find((l) => l.id === chosen?.id);
  const location = picked && chosen ? { ...picked.location, mode: chosen.mode } : null;
  const zone = picked ? ZONE[zoneAt(picked.location, incident.zones)] : null;

  return (
    <div className={styles.root} style={stage} data-sheet={open ? 'open' : 'peek'}>
      <MapView
        incident={incident}
        shelters={shelters}
        locations={config.demoLocations}
        selectedId={chosen?.id ?? null}
        onSelect={(id) => setChosen({ id, mode: 'manual-demo' })}
        live={live}
        ownId={sos?.id ?? null}
        reachable={reachable}
      />

      <div className={styles.rail}>
        <IncidentPanel incident={incident} shelters={shelters} live={live} demoNote={bannerH === 0} />

        <aside className={`${styles.panel} ${styles.request}`} data-open={open} aria-label={sos ? 'Your request' : 'Ask for help'}>
          <div className={styles.requestHead}>
            <div className={styles.requestTitleRow}>
              <h2 className={styles.sectionTitle}>{sos ? 'Your request (demo)' : 'Ask for help (demo)'}</h2>
              <Button className={styles.sheetToggle} variant={open ? 'ghost' : 'primary'} size="sm" aria-expanded={open} aria-controls="request-body" onClick={() => setOpen((o) => !o)}>
                {open ? 'Collapse' : sos ? 'Show request' : 'Ask for help'}
              </Button>
            </div>
            {!sos && (
              <div role="status" className={styles.zoneResult}>
                {zone && picked ? (
                  <>
                    <Badge tone={zone.tone} size="sm">
                      {zone.label}
                    </Badge>
                    <span className={styles.status}>{chosen?.mode === 'browser-opt-in' ? `Sending from demo point ${picked.id}, nearest to you.` : zone.text}</span>
                  </>
                ) : (
                  <span className={styles.hint}>Tap a pin on the map to set your location.</span>
                )}
              </div>
            )}
          </div>

          <ScrollArea className={styles.requestScroll} label={sos ? 'Your request' : 'Request form'}>
            <div id="request-body" className={styles.requestBody}>
              {sos ? (
                <SosTracker sos={sos} onUpdate={setSos} onGone={clear} onNew={clear} />
              ) : (
                <>
                  <LocationPicker incident={incident} locations={config.demoLocations} chosen={chosen} onChoose={setChosen} />
                  <SosForm incidentId={incident.id} location={location} onCreated={created} />
                </>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>

      <LivePanel incident={incident} live={live} reachable={reachable} />
    </div>
  );
}
