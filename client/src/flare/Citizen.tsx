// 01 Citizen. Overview: a live map of every flood area with the latest updates.
// Pick an area and it is highlighted, with its zones, relief centres and the SOS flow.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, LocateFixed } from 'lucide-react';
import { nearest, zoneAt } from '../features/citizen/geo.ts';
import { api, poll, type Alert, type Incident, type LocationMode, type Sos, type SosType } from '../shared/api.ts';
import { ALERT_TITLE, areaName, SEVERITY_COLOR, useAlerts, useScenario, useSosList } from './data.ts';
import { FlareMap, MapLegend } from './FlareMap.tsx';
import { errText, myt, Shell, STATUS_LABEL, StatusTag, Toasts, TYPE_LABEL, useArrivals, useToasts } from './ui.tsx';

const KEY = 'flare.citizen.sosId';
const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (id: string) => { try { localStorage.setItem(KEY, id); } catch { /* tracking just won't survive a reload */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* see set */ } },
};
const TYPES = Object.keys(TYPE_LABEL) as SosType[];
const ZONE_TEXT = { high: 'Inside the high-impact zone.', moderate: 'Inside the moderate-impact zone.', none: 'Outside the marked zones. Not confirmed safe.' } as const;

export default function Citizen() {
  const { scenario, error, reload } = useScenario();
  const live = useSosList();
  const feed = useAlerts();
  const { toasts, push, dismiss } = useToasts();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ id: string; mode: LocationMode } | null>(null);
  const [gps, setGps] = useState<string | null>(null);
  const [sos, setSos] = useState<Sos | null>(null);

  const open = useCallback((id: string | null) => { setAreaId(id); setChosen(null); setGps(null); }, []);

  useEffect(() => {
    const id = store.get();
    if (id) api.getSos(id).then((s) => { setSos(s); setAreaId(s.incidentId); }, () => store.clear());
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

  // Notifications: new updates from the feed, and changes to this person's own request.
  useArrivals(feed.alerts, feed.loaded, (a: Alert) => {
    const inc = scenario?.incidents.find((i) => i.id === a.incidentId);
    push({ id: a.id, title: ALERT_TITLE[a.kind], body: a.text, meta: a.source, tone: a.kind === 'flood' ? 'flare' : 'ink', onClick: inc && !sos ? () => open(inc.id) : undefined });
  });
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!sos) return void (lastStatus.current = null);
    if (lastStatus.current && lastStatus.current !== sos.status) {
      push(
        sos.status === 'assigned'
          ? { id: `${sos.id}-a`, title: 'Help is on the way', body: `${sos.assignedTeam} has been assigned to your request.`, meta: sos.id, tone: 'flare' }
          : sos.status === 'resolved'
            ? { id: `${sos.id}-r`, title: 'Request resolved', body: 'Your request has been marked resolved.', meta: sos.id }
            : { id: `${sos.id}-p${Date.now()}`, title: 'Request reopened', body: 'Your request is waiting for a team again.', meta: sos.id },
      );
    }
    lastStatus.current = sos.status;
  }, [sos, push]);

  const created = useCallback((s: Sos) => { store.set(s.id); setSos(s); }, []);
  const again = useCallback(() => { store.clear(); setSos(null); }, []);

  if (error || !scenario) {
    return (
      <Shell path="/citizen">
        <div className="fl-page" style={{ paddingTop: 40 }}>
          {error ? (
            <div className="fl-stack">
              <div className="fl-error" role="alert">Could not load the map. {error}</div>
              <button type="button" className="fl-btn" style={{ justifySelf: 'start' }} onClick={reload}>Try again</button>
            </div>
          ) : (
            <p className="fl-dim" role="status">Loading…</p>
          )}
        </div>
      </Shell>
    );
  }

  const { incidents, shelters, config } = scenario;
  const area = incidents.find((i) => i.id === areaId) ?? null;
  const places = area ? config.demoLocations.filter((l) => !l.incidentId || l.incidentId === area.id) : [];
  const picked = places.find((l) => l.id === chosen?.id) ?? null;
  const hit = picked && area ? zoneAt(picked.location, area.zones) : null;

  function useMyLocation() {
    if (!area) return;
    if (!('geolocation' in navigator)) return setGps('This browser has no location support. Pick a place instead.');
    setGps('Asking your browser…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Privacy: the real position never leaves this device. Only the nearest listed place is used.
        const near = nearest({ lat: pos.coords.latitude, lng: pos.coords.longitude }, places);
        setChosen({ id: near.id, mode: 'browser-opt-in' });
        setGps(`Using the nearest listed place: ${near.label}.`);
      },
      () => setGps('Location was not shared. Pick a place instead.'),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <Shell path="/citizen">
      <Toasts toasts={toasts} dismiss={dismiss} />
      <div className="fl-work fl-work-citizen">
        <section className="fl-pane fl-pane-pad" aria-label={area ? area.title : 'Flood areas'}>
          {!area ? (
            <Overview incidents={incidents} alerts={feed.alerts} requests={live.list.length} onOpen={open} />
          ) : (
            <div className="fl-stack-lg fl-in" key={area.id}>
              <div className="fl-stack">
                {!sos && (
                  <button type="button" className="fl-back" onClick={() => open(null)}>
                    <ArrowLeft size={13} aria-hidden /> All areas
                  </button>
                )}
                <div className="fl-row" style={{ flexWrap: 'wrap' }}>
                  <span className="fl-tag" data-s={area.severity === 'high' ? 'high' : area.severity === 'moderate' ? 'moderate' : 'plain'}>{area.severity} severity</span>
                  <span className="fl-label">Updated {myt(area.updatedAt)}</span>
                </div>
                <h1 className="fl-h2" style={{ fontSize: 28 }}>{area.title}</h1>
                <p className="fl-small fl-dim" style={{ margin: 0 }}>Source: {area.sourceLabel}</p>
                <ul className="fl-small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, listStyle: 'disc' }}>
                  {area.guidance.map((g) => <li key={g}>{g}</li>)}
                </ul>
              </div>

              <hr className="fl-rule fl-rule-ink" />

              {sos ? (
                <Tracker sos={sos} onNew={again} />
              ) : (
                <div className="fl-stack">
                  <h2 className="fl-h2">Need help? Where are you?</h2>
                  <div className="fl-locs">
                    {places.map((l) => (
                      <button key={l.id} type="button" className="fl-loc" aria-pressed={chosen?.id === l.id} onClick={() => { setChosen({ id: l.id, mode: 'manual-demo' }); setGps(null); }}>
                        <b>{l.id}</b>
                        <span>{l.label}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="fl-btn fl-btn-quiet fl-btn-sm" style={{ justifySelf: 'start' }} onClick={useMyLocation}>
                    <LocateFixed size={14} aria-hidden /> Use my location
                  </button>
                  {gps && <p className="fl-small fl-dim" role="status" style={{ margin: 0 }}>{gps}</p>}
                  {hit && picked && (
                    <div className="fl-note" data-tone={hit === 'high' ? 'flare' : undefined} role="status">
                      <strong style={{ color: 'var(--ink)' }}>{picked.label}.</strong> {ZONE_TEXT[hit]}
                    </div>
                  )}
                  <SosForm incidentId={area.id} location={picked && chosen ? { ...picked.location, mode: chosen.mode } : null} onCreated={created} />
                </div>
              )}

              <AreaFeed alerts={feed.alerts.filter((a) => a.incidentId === area.id)} />
            </div>
          )}
        </section>

        <div className="fl-mapwrap">
          <FlareMap
            key={area?.id ?? 'all'}
            incidents={incidents}
            activeId={area?.id ?? null}
            onPickIncident={area ? undefined : open}
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

function Overview({ incidents, alerts, requests, onOpen }: { incidents: Incident[]; alerts: Alert[]; requests: number; onOpen: (id: string) => void }) {
  return (
    <div className="fl-stack-lg">
      <div className="fl-stack" style={{ gap: 6 }}>
        <p className="fl-label">Selangor · live</p>
        <h1 className="fl-h2" style={{ fontSize: 28 }}>{incidents.length} active flood areas</h1>
        <p className="fl-small fl-dim" style={{ margin: 0 }}>{requests} help request{requests === 1 ? '' : 's'} open. Pick an area on the map or below.</p>
      </div>
      <div className="fl-areas">
        {incidents.map((i) => (
          <button key={i.id} type="button" className="fl-area" style={{ '--c': SEVERITY_COLOR[i.severity] } as React.CSSProperties} onClick={() => onOpen(i.id)}>
            <span className="fl-between">
              <strong>{areaName(i)}</strong>
              <span className="fl-tag" data-s={i.severity === 'high' ? 'high' : i.severity === 'moderate' ? 'moderate' : 'plain'}>{i.severity}</span>
            </span>
            <span className="fl-small fl-dim">{i.title.split('·')[1]?.trim()} · {i.sourceLabel.split('·')[0].trim()} · {myt(i.updatedAt)}</span>
          </button>
        ))}
      </div>
      <div>
        <p className="fl-label" style={{ marginBottom: 8 }}>Latest updates</p>
        <ul className="fl-feed">
          {alerts.map((a) => (
            <li key={a.id} className="fl-in">
              <button type="button" data-kind={a.kind} onClick={() => onOpen(a.incidentId)}>
                <time>{myt(a.at)}</time>
                <span>
                  <p>{a.text}</p>
                  <small>{a.source}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AreaFeed({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  return (
    <div>
      <p className="fl-label" style={{ marginBottom: 8 }}>Updates for this area</p>
      <ul className="fl-feed">
        {alerts.map((a) => (
          <li key={a.id} className="fl-in">
            <div data-kind={a.kind}>
              <time>{myt(a.at)}</time>
              <span>
                <p>{a.text}</p>
                <small>{a.source}</small>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
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
      <div className="fl-seg" role="group" aria-label="Type of help" style={{ marginTop: 4 }}>
        {TYPES.map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>
        ))}
      </div>
      <div className="fl-field">
        <span className="fl-label">People with you</span>
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
      {error && <div className="fl-error" role="alert">Not sent. {error}</div>}
      <button type="submit" className="fl-btn fl-btn-flare fl-btn-block" disabled={!ready || busy}>
        {busy ? 'Sending…' : 'Send SOS'}
      </button>
      <p className="fl-small fl-dim" style={{ margin: 0 }}>
        {!location ? 'Choose where you are to send. ' : !text.trim() ? 'Say what is happening to send. ' : ''}Simulation: no emergency service receives this. In a real emergency call 999.
      </p>
    </form>
  );
}

function Tracker({ sos, onNew }: { sos: Sos; onNew: () => void }) {
  const step = sos.status === 'pending' ? 0 : sos.status === 'assigned' ? 1 : 2;
  return (
    <div className="fl-stack fl-in" aria-live="polite">
      <div className="fl-between">
        <p className="fl-label">Your request</p>
        <StatusTag status={sos.status} />
      </div>
      <div className="fl-bigid" data-testid="sos-id">{sos.id}</div>
      <p className="fl-small fl-dim" style={{ margin: 0 }}>
        {TYPE_LABEL[sos.type]} · {sos.people} {sos.people === 1 ? 'person' : 'people'} · sent {myt(sos.createdAt)}
      </p>
      <ol className="fl-track" style={{ marginTop: 8 }}>
        <li data-on="true" data-now={step === 0}>
          <strong>Received <span>{myt(sos.createdAt)}</span></strong>
          <p>It is now in the responder queue.</p>
        </li>
        <li data-on={step >= 1} data-now={step === 1}>
          <strong>{STATUS_LABEL.assigned} {step === 1 && <span>{myt(sos.updatedAt)}</span>}</strong>
          <p>{sos.assignedTeam ? `${sos.assignedTeam} is on the way.` : 'Waiting for a team.'}</p>
        </li>
        <li data-on={step >= 2} data-now={step === 2}>
          <strong>Resolved {step === 2 && <span>{myt(sos.updatedAt)}</span>}</strong>
          <p>{step === 2 ? 'Marked resolved by the response team.' : 'Closes when the team marks it resolved.'}</p>
        </li>
      </ol>
      <p className="fl-small fl-dim" style={{ margin: 0 }}>Simulation: no emergency service receives this. In a real emergency call 999.</p>
      <div className="fl-row">
        <button type="button" className="fl-btn fl-btn-quiet fl-btn-sm" onClick={onNew}>New request</button>
      </div>
    </div>
  );
}
