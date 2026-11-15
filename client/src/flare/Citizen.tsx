// 01 Citizen: see the simulated incident, check a location against the depicted zones,
// send a demo request and follow its status. Real round trip against the demo backend.
import { useCallback, useEffect, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { nearest, zoneAt } from '../features/citizen/geo.ts';
import { ZONE } from '../features/citizen/zone.ts';
import { api, poll, type LocationMode, type Sos, type SosType } from '../shared/api.ts';
import { useScenario, useSosList } from './data.ts';
import { FlareMap, MapLegend } from './FlareMap.tsx';
import { errText, myt, Shell, STATUS_LABEL, StatusTag, TYPE_LABEL } from './ui.tsx';

const KEY = 'flare.citizen.sosId';
const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (id: string) => { try { localStorage.setItem(KEY, id); } catch { /* tracking just won't survive a reload */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* see set */ } },
};
const TYPES = Object.keys(TYPE_LABEL) as SosType[];

export default function Citizen() {
  const { scenario, error, reload } = useScenario();
  const live = useSosList();
  const [chosen, setChosen] = useState<{ id: string; mode: LocationMode } | null>(null);
  const [gps, setGps] = useState<string | null>(null);
  const [sos, setSos] = useState<Sos | null>(null);

  useEffect(() => {
    const id = store.get();
    if (id) api.getSos(id).then(setSos, () => store.clear());
  }, []);
  useEffect(() => {
    if (!sos?.id) return;
    return poll(async () => {
      try {
        setSos(await api.getSos(sos.id));
      } catch {
        /* keep the last known status on screen */
      }
    });
  }, [sos?.id]);

  const created = useCallback((s: Sos) => { store.set(s.id); setSos(s); }, []);
  const again = useCallback(() => { store.clear(); setSos(null); }, []);

  if (error || !scenario) {
    return (
      <Shell path="/citizen">
        <div className="fl-page" style={{ paddingTop: 40 }}>
          {error ? (
            <div className="fl-stack">
              <div className="fl-error" role="alert">Could not load the scenario. {error}</div>
              <button type="button" className="fl-btn" style={{ justifySelf: 'start' }} onClick={reload}>Try again</button>
            </div>
          ) : (
            <p className="fl-dim" role="status">Loading the simulated scenario…</p>
          )}
        </div>
      </Shell>
    );
  }

  const { incident, shelters, config } = scenario;
  const picked = config.demoLocations.find((l) => l.id === chosen?.id) ?? null;
  const hit = picked ? ZONE[zoneAt(picked.location, incident.zones)] : null;

  function useMyLocation() {
    if (!('geolocation' in navigator)) return setGps('This browser has no location support. Pick a demo point instead.');
    setGps('Asking your browser…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Privacy: the real position never leaves this device. Only the nearest demo point is used.
        const near = nearest({ lat: pos.coords.latitude, lng: pos.coords.longitude }, config.demoLocations);
        setChosen({ id: near.id, mode: 'browser-opt-in' });
        setGps(`Using the nearest demo point, ${near.id}. Your real position was not sent.`);
      },
      () => setGps('Location was not shared. Pick a demo point instead.'),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <Shell path="/citizen">
      <div className="fl-work fl-work-citizen">
        <section className="fl-pane fl-pane-pad" aria-label="Incident and help request">
          <div className="fl-stack-lg">
            <div className="fl-stack">
              <div className="fl-row" style={{ flexWrap: 'wrap' }}>
                <span className="fl-tag" data-s="high">Severity {incident.severity}</span>
                <span className="fl-tag" data-s="plain">Simulated</span>
              </div>
              <h1 className="fl-h2" style={{ fontSize: 28 }}>{incident.title.replace(/^SIMULATED\s+/i, '')}</h1>
              <p className="fl-small fl-dim" style={{ margin: 0 }}>
                {incident.sourceLabel}. Updated {myt(incident.updatedAt)} MYT.
              </p>
              <details>
                <summary className="fl-label" style={{ cursor: 'pointer' }}>Guidance and shelters</summary>
                <ul className="fl-small fl-dim" style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
                  {incident.guidance.map((g) => <li key={g}>{g}</li>)}
                  {shelters.map((s) => <li key={s.id}>{s.name}: not an officially designated or verified-open site.</li>)}
                </ul>
              </details>
            </div>

            <hr className="fl-rule fl-rule-ink" />

            {sos ? (
              <Tracker sos={sos} onNew={again} />
            ) : (
              <div className="fl-stack">
                <div>
                  <p className="fl-label">Step 1</p>
                  <h2 className="fl-h2" style={{ marginTop: 4 }}>Where are you?</h2>
                </div>
                <div className="fl-locs">
                  {config.demoLocations.map((l) => (
                    <button key={l.id} type="button" className="fl-loc" aria-pressed={chosen?.id === l.id} onClick={() => { setChosen({ id: l.id, mode: 'manual-demo' }); setGps(null); }}>
                      <b>{l.id}</b>
                      <span>{l.label.replace(/^Demo point /, '').replace(/^./, (m) => m.toUpperCase())}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="fl-btn fl-btn-quiet fl-btn-sm" style={{ justifySelf: 'start' }} onClick={useMyLocation}>
                  <LocateFixed size={14} aria-hidden /> Use my location
                </button>
                {gps && <p className="fl-small fl-dim" role="status" style={{ margin: 0 }}>{gps}</p>}
                {hit && (
                  <div className="fl-note" data-tone={hit.tone === 'danger' ? 'flare' : undefined} role="status">
                    <strong style={{ color: 'var(--ink)' }}>{picked!.id}: {hit.label}.</strong> {hit.text}
                  </div>
                )}
                <SosForm incidentId={incident.id} location={picked && chosen ? { ...picked.location, mode: chosen.mode } : null} onCreated={created} />
              </div>
            )}
          </div>
        </section>

        <div className="fl-mapwrap">
          <FlareMap
            incident={incident}
            shelters={shelters}
            locations={config.demoLocations}
            requests={live.list}
            mode="citizen"
            selectedLocation={chosen?.id ?? null}
            onSelectLocation={sos ? undefined : (id) => { setChosen({ id, mode: 'manual-demo' }); setGps(null); }}
          />
          <MapLegend mode="citizen" />
        </div>
      </div>
    </Shell>
  );
}

function SosForm({ incidentId, location, onCreated }: { incidentId: string; location: { lat: number; lng: number; mode: LocationMode } | null; onCreated: (s: Sos) => void }) {
  const [type, setType] = useState<SosType>('trapped');
  const [people, setPeople] = useState(1);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!location && text.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await api.createSos({ incidentId, people, type, description: text.trim(), location: { lat: location.lat, lng: location.lng }, locationMode: location.mode }));
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <form className="fl-stack" onSubmit={submit}>
      <div style={{ marginTop: 8 }}>
        <p className="fl-label">Step 2</p>
        <h2 className="fl-h2" style={{ marginTop: 4 }}>What do you need?</h2>
      </div>
      <div className="fl-seg" role="group" aria-label="Type of help">
        {TYPES.map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>
        ))}
      </div>
      <div className="fl-field">
        <span className="fl-label">People with you, including yourself</span>
        <div className="fl-step" style={{ maxWidth: 180 }}>
          <button type="button" aria-label="Fewer people" onClick={() => setPeople((p) => Math.max(1, p - 1))}>−</button>
          <output aria-live="polite">{people}</output>
          <button type="button" aria-label="More people" onClick={() => setPeople((p) => Math.min(50, p + 1))}>+</button>
        </div>
      </div>
      <label className="fl-field">
        <span className="fl-label">What is happening <span style={{ float: 'right' }}>{text.length}/280</span></span>
        <textarea className="fl-input" rows={3} maxLength={280} value={text} onChange={(e) => setText(e.target.value)} placeholder="Water is at the stairs. Three of us are upstairs." />
      </label>
      <p className="fl-small fl-dim" style={{ margin: 0 }}>Demo only. No emergency service receives this. Leave out names, phone numbers and addresses.</p>
      {error && <div className="fl-error" role="alert">Not sent. {error}</div>}
      <button type="submit" className="fl-btn fl-btn-flare fl-btn-block" disabled={!ready || busy}>
        {busy ? 'Sending…' : 'Send demo SOS'}
      </button>
      {!ready && <p className="fl-small fl-dim" style={{ margin: 0 }}>{location ? 'Describe what is happening to send.' : 'Choose a location to send.'}</p>}
    </form>
  );
}

function Tracker({ sos, onNew }: { sos: Sos; onNew: () => void }) {
  const step = sos.status === 'pending' ? 0 : sos.status === 'assigned' ? 1 : 2;
  return (
    <div className="fl-stack fl-in" aria-live="polite">
      <div className="fl-between">
        <p className="fl-label">Your demo request</p>
        <StatusTag status={sos.status} />
      </div>
      <div className="fl-bigid" data-testid="sos-id">{sos.id}</div>
      <p className="fl-small fl-dim" style={{ margin: 0 }}>
        {TYPE_LABEL[sos.type]} · {sos.people} {sos.people === 1 ? 'person' : 'people'} · sent {myt(sos.createdAt)} MYT
      </p>
      <ol className="fl-track" style={{ marginTop: 8 }}>
        <li data-on="true" data-now={step === 0}>
          <strong>Received <span>{myt(sos.createdAt)}</span></strong>
          <p>The responder queue shows this same ID.</p>
        </li>
        <li data-on={step >= 1} data-now={step === 1}>
          <strong>{STATUS_LABEL.assigned} {step >= 1 && <span>{step === 1 ? myt(sos.updatedAt) : ''}</span>}</strong>
          <p>{sos.assignedTeam ? `${sos.assignedTeam} has been assigned (fictional team).` : 'Waiting for a responder to assign a demo team.'}</p>
        </li>
        <li data-on={step >= 2} data-now={step === 2}>
          <strong>Resolved {step === 2 && <span>{myt(sos.updatedAt)}</span>}</strong>
          <p>{step === 2 ? 'Marked resolved by the demo responder.' : 'Closes when the responder marks it resolved.'}</p>
        </li>
      </ol>
      <p className="fl-small fl-dim" style={{ margin: 0 }}>This page updates by itself every few seconds. Demo only: no emergency service receives this request.</p>
      <div className="fl-row">
        <a className="fl-btn fl-btn-sm" href="/responder" target="_blank" rel="noreferrer">Open responder view</a>
        <button type="button" className="fl-btn fl-btn-quiet fl-btn-sm" onClick={onNew}>New request</button>
      </div>
    </div>
  );
}
