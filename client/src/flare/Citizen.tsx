// The citizen app. Phone first: it opens on a guide for where you are right now. Inside a marked flood zone that
// guide is an emergency screen (what to do, who to call, the way to a safe zone); outside one it is a calm status.
// Map, news and "request help" are one tap away on the tab bar. On a wide screen the same pieces sit beside the map.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Cross, Footprints, House, LifeBuoy, Map as MapIcon, MapPin, Minus, Newspaper, Package, Phone as PhoneIcon, Plus, ShieldCheck, Stethoscope, TriangleAlert, Waves } from 'lucide-react';
import { metres } from '../features/citizen/geo.ts';
import { api, liveConnected, onLive, type Alert, type DemoLocation, type Scenario, type Sos, type SosType } from '../shared/api.ts';
import { FlareMark } from '../shared/Logo.tsx';
import { ago, clockMY, errText, LEVEL_COLOR, LEVEL_NAME, safeStorage, SEVERITY_COLOR, SEVERITY_NAME, situationAt, useAlerts, useArrivals, useDemoLocation, useNow, useScenario, type Situation } from './data.ts';
import { FlareMap, MapLegend } from './FlareMap.tsx';
import { Crash, LevelTag, LoadState, STATUS_LABEL, Toasts, TYPE_LABEL, useToasts, Viewer, type Device, type Toast } from './ui.tsx';

type Tab = 'guide' | 'map' | 'news' | 'help';
const SOS_KEY = 'flare.citizen.sosId';
const SEEN_KEY = 'flare.citizen.newsSeenAt';

export default function Citizen({ device }: { device: Device }) {
  const { scenario, error, reload } = useScenario();
  const [location, setLocation] = useDemoLocation(scenario);
  return (
    <Viewer role="citizen" device={device} scenario={scenario} location={location} onLocation={setLocation}>
      {scenario && location ? (
        <Crash label="The citizen app">
          <CitizenApp scenario={scenario} location={location} />
        </Crash>
      ) : (
        <LoadState error={error} onRetry={reload} />
      )}
    </Viewer>
  );
}

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const sync = () => setWide(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return wide;
}

/** The citizen's own request, kept across reloads, refreshed the moment the server reports a change. */
function useMySos() {
  const [id, setId] = useState<string | null>(() => safeStorage.get(SOS_KEY));
  const [sos, setSos] = useState<Sos | null>(null);

  useEffect(() => {
    if (!id) return setSos(null);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const next = await api.getSos(id);
        if (!stopped) setSos(next);
      } catch (e) {
        // The server no longer knows this request (it was reset or restarted): stop tracking it.
        if (!stopped && e instanceof Error && 'status' in e && (e as { status: number }).status === 404) {
          safeStorage.set(SOS_KEY, null);
          setId(null);
        }
      }
    };
    const loop = () => {
      timer = setTimeout(async () => {
        if (stopped) return;
        await load();
        loop();
      }, liveConnected() ? 20_000 : 3000);
    };
    void load();
    loop();
    const off = onLive((type) => {
      if (type !== 'alerts') void load();
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

function CitizenApp({ scenario, location }: { scenario: Scenario; location: DemoLocation }) {
  const wide = useWide();
  const sit = useMemo(() => situationAt(scenario, location), [scenario, location]);
  const feed = useAlerts();
  const my = useMySos();
  const { toasts, push, dismiss } = useToasts();
  const [tab, setTab] = useState<Tab>('guide');
  const [shelterId, setShelterId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(sit.danger?.incident.id ?? location.incidentId);
  const [seenAt, setSeenAt] = useState(() => safeStorage.get(SEEN_KEY) ?? '');

  const chosen = sit.options.find((o) => o.shelter.id === shelterId) ?? sit.options[0] ?? null;
  const dangerId = sit.danger?.incident.id ?? null;
  // A route is drawn when you are in danger, or when you picked a safe zone yourself.
  const route = sit.danger || shelterId ? (chosen?.route ?? null) : null;
  const go = useCallback((t: Tab) => setTab(wide && t === 'map' ? 'guide' : t), [wide]);

  // Moving to a new place: start again from that place's guide. Entering a danger zone raises the alert.
  const lastLoc = useRef(location.id);
  useEffect(() => {
    if (lastLoc.current === location.id) return;
    dismiss(`danger-${lastLoc.current}`); // the alert for the place you just left no longer applies
    lastLoc.current = location.id;
    setShelterId(null);
    setFocusId(dangerId ?? location.incidentId);
    setTab('guide');
    if (sit.danger) {
      push({ id: `danger-${location.id}`, tone: 'danger', title: 'EMERGENCY FLOOD', body: `You are in a ${LEVEL_NAME[sit.danger.level].toLowerCase()} flood zone at ${sit.danger.incident.area}. Open for what to do.`, meta: 'FLARE · Simulation' });
    }
  }, [location.id, location.incidentId, dangerId, sit.danger, push, dismiss]);

  // News: a banner for each new item. Official warnings loaded with the page are announced once per browser session.
  const openNews = useCallback(() => setTab('news'), []);
  const announce = useCallback(
    (a: Alert) =>
      push({
        id: a.id,
        tone: a.sourceType === 'official' ? 'info' : a.kind === 'shelter' ? 'good' : a.kind === 'flood' ? 'danger' : 'info',
        title: a.title,
        body: a.text.length > 110 ? `${a.text.slice(0, 108).trimEnd()}…` : a.text,
        meta: a.sourceType === 'official' ? `Official · ${a.source}` : `Simulated · ${a.source}`,
        onClick: openNews,
      }),
    [push, openNews],
  );
  useArrivals(feed.alerts, feed.loaded, announce);
  const announcedOfficial = useRef(false);
  const inDanger = useRef(Boolean(sit.danger));
  inDanger.current = Boolean(sit.danger);
  useEffect(() => {
    if (!feed.loaded || announcedOfficial.current) return;
    announcedOfficial.current = true;
    const top = feed.alerts.find((a) => a.sourceType === 'official');
    let told: string | null = null;
    try {
      told = sessionStorage.getItem('flare.official.told');
    } catch {
      /* private mode */
    }
    // In a danger zone the first screen is for getting out. Weather news waits on the News tab (its dot shows it is there).
    if (!top || told === top.id || inDanger.current) return;
    try {
      sessionStorage.setItem('flare.official.told', top.id);
    } catch {
      /* private mode */
    }
    const t = setTimeout(() => announce(top), 2500);
    return () => clearTimeout(t);
  }, [feed.loaded, feed.alerts, announce]);

  // Your request: a banner when its status changes.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    const s = my.sos;
    if (!s) return void (lastStatus.current = null);
    const key = `${s.id}:${s.status}`;
    if (lastStatus.current && lastStatus.current !== key && lastStatus.current.startsWith(s.id)) {
      const t: Toast =
        s.status === 'assigned'
          ? { id: key, tone: 'good', title: 'Help is on the way', body: `${s.assignedTeam ?? 'A team'} has been sent to you.`, meta: s.id }
          : s.status === 'resolved'
            ? { id: key, tone: 'good', title: 'Request resolved', body: 'The team marked your request as resolved.', meta: s.id }
            : { id: key, tone: 'info', title: 'Request back in the queue', body: 'Your request is waiting for a team again.', meta: s.id };
      push({ ...t, onClick: () => setTab('help') });
    }
    lastStatus.current = key;
  }, [my.sos, push]);

  // Unread dot on News.
  const newest = feed.alerts.reduce((m, a) => (a.at > m ? a.at : m), '');
  const unread = tab !== 'news' && newest > seenAt ? feed.alerts.filter((a) => a.at > seenAt).length : 0;
  useEffect(() => {
    if (tab === 'news' && newest && newest !== seenAt) {
      safeStorage.set(SEEN_KEY, newest);
      setSeenAt(newest);
    }
  }, [tab, newest, seenAt]);

  const showRoute = useCallback(
    (id?: string) => {
      if (id) setShelterId(id);
      setFocusId(dangerId ?? location.incidentId);
      if (!wide) setTab('map');
    },
    [dangerId, location.incidentId, wide],
  );
  const openArea = useCallback(
    (id: string) => {
      setFocusId(id);
      if (!wide) setTab('map');
    },
    [wide],
  );

  const map = (
    <div className="fl-mapwrap">
      <FlareMap
        scenario={scenario}
        focusId={focusId}
        onPickIncident={setFocusId}
        user={location}
        route={focusId === (dangerId ?? location.incidentId) ? route : null}
        selectedShelterId={route ? chosen?.shelter.id : null}
        onSelectShelter={(id) => {
          if (sit.options.some((o) => o.shelter.id === id)) setShelterId(id);
        }}
      />
      <MapLegend />
      <MapCard scenario={scenario} sit={sit} focusId={focusId} chosen={route ? chosen : null} onBack={() => setFocusId(dangerId ?? location.incidentId)} onAll={() => setFocusId(null)} onPick={setShelterId} />
    </div>
  );

  const body =
    tab === 'news' ? (
      <News alerts={feed.alerts} loaded={feed.loaded} ok={feed.ok} scenario={scenario} nearId={dangerId ?? location.incidentId} onArea={openArea} />
    ) : tab === 'help' ? (
      <Help scenario={scenario} sit={sit} sos={my.sos} onSent={my.track} onClear={my.clear} />
    ) : (
      <Guide scenario={scenario} sit={sit} chosen={chosen} onPick={setShelterId} onRoute={showRoute} onHelp={() => setTab('help')} onArea={openArea} hasRequest={Boolean(my.sos && my.sos.status !== 'resolved')} preview={!wide} />
    );

  const tabs: { id: Tab; label: string; Icon: typeof MapIcon; badge?: number | boolean }[] = [
    { id: 'guide', label: sit.danger ? 'Emergency' : 'Home', Icon: sit.danger ? TriangleAlert : ShieldCheck },
    { id: 'map', label: 'Map', Icon: MapIcon },
    { id: 'news', label: 'News', Icon: Newspaper, badge: unread },
    { id: 'help', label: 'Get help', Icon: LifeBuoy, badge: Boolean(my.sos && my.sos.status !== 'resolved') },
  ];

  if (wide) {
    return (
      <div className="fl-desk">
        <Toasts toasts={toasts} dismiss={dismiss} />
        <aside className="fl-desk-side">
          <AppBar location={location} sit={sit} />
          <div className="fl-seg fl-desk-tabs" role="tablist">
            {tabs.filter((t) => t.id !== 'map').map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>
                <t.Icon size={15} aria-hidden /> {t.label}
                {Boolean(t.badge) && <b className="fl-badge">{typeof t.badge === 'number' ? t.badge : ''}</b>}
              </button>
            ))}
          </div>
          <div className="fl-scroll" key={tab}>{body}</div>
        </aside>
        {map}
      </div>
    );
  }

  return (
    <div className="fl-phoneapp" data-danger={sit.danger?.level}>
      <Toasts toasts={toasts} dismiss={dismiss} />
      <AppBar location={location} sit={sit} />
      <main className="fl-appmain" data-tab={tab} key={tab}>
        {tab === 'map' ? map : <div className="fl-scroll">{body}</div>}
      </main>
      <nav className="fl-tabbar" aria-label="Sections">
        {tabs.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} data-tone={t.id === 'guide' && sit.danger ? 'danger' : undefined} onClick={() => go(t.id)}>
            <span className="fl-tabicon">
              <t.Icon size={21} aria-hidden />
              {Boolean(t.badge) && <b className="fl-badge">{typeof t.badge === 'number' ? t.badge : ''}</b>}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function AppBar({ location, sit }: { location: DemoLocation; sit: Situation }) {
  return (
    <header className="fl-appbar">
      <span className="fl-appbar-brand"><FlareMark height={20} /> FLARE</span>
      <span className="fl-loc" title={`Your location: ${location.label}`}>
        <MapPin size={14} aria-hidden />
        <span>{location.label}</span>
        <i style={{ background: sit.danger ? LEVEL_COLOR[sit.danger.level] : '#16a34a' }} aria-hidden />
      </span>
    </header>
  );
}

/* ── Guide ─────────────────────────────────────────────────────────── */
type GuideProps = {
  scenario: Scenario;
  sit: Situation;
  chosen: Situation['options'][number] | null;
  onPick: (id: string) => void;
  onRoute: (id?: string) => void;
  onHelp: () => void;
  onArea: (id: string) => void;
  hasRequest: boolean;
  preview: boolean;
};

function Guide({ scenario, sit, chosen, onPick, onRoute, onHelp, onArea, hasRequest, preview }: GuideProps) {
  const now = useNow();
  const { danger, location } = sit;

  if (!danger) {
    return (
      <>
        <section className="fl-hero" data-tone="safe">
          <span className="fl-hero-kicker"><ShieldCheck size={16} aria-hidden /> No alert for your location</span>
          <h1>You are outside the marked flood zones</h1>
          <p>
            {sit.nearestFlood ? `The nearest flood is ${sit.nearestFlood.area}, about ${metres(sit.nearestFlood.metres)} away.` : 'No floods are marked right now.'} This is not a promise that your street is dry. FLARE will alert you if your location enters a flood zone.
          </p>
        </section>
        <section className="fl-card">
          <h2>Floods right now</h2>
          <ul className="fl-rows">
            {scenario.incidents.map((i) => (
              <li key={i.id}>
                <button type="button" className="fl-row" onClick={() => onArea(i.id)}>
                  <span className="fl-row-icon" style={{ background: SEVERITY_COLOR[i.severity] }}><Waves size={16} aria-hidden /></span>
                  <span className="fl-row-text">
                    <strong>{i.area}</strong>
                    <small>{SEVERITY_NAME[i.severity]} · {i.summary}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="fl-card">
          <h2>Be ready</h2>
          <ul className="fl-ticks">
            <li><Check size={16} aria-hidden /> Keep your phone charged and notifications on.</li>
            <li><Check size={16} aria-hidden /> Know your nearest safe zone before you need it.</li>
            <li><Check size={16} aria-hidden /> Keep ID, medicine and water where you can grab them.</li>
          </ul>
          <button type="button" className="fl-btn fl-btn-block" onClick={() => onRoute(chosen?.shelter.id)} disabled={!chosen}>
            <Footprints size={16} aria-hidden /> Show my nearest safe zone
          </button>
        </section>
        <Contacts scenario={scenario} onHelp={onHelp} />
      </>
    );
  }

  const steps = scenario.actions[danger.level];
  return (
    <>
      <section className="fl-hero" data-tone={danger.level}>
        <span className="fl-hero-kicker"><TriangleAlert size={16} aria-hidden /> Flood emergency · {danger.incident.area}</span>
        <h1>You are inside a flood danger zone</h1>
        <p>
          <strong>{LEVEL_NAME[danger.level]} damage level.</strong> {danger.zone.depth}. Reported {ago(danger.incident.updatedAt, now)} for {location.label}.
        </p>
        <div className="fl-hero-actions">
          <a className="fl-btn fl-btn-white" href="tel:999" target="_top"><PhoneIcon size={17} aria-hidden /> Call 999</a>
          <button type="button" className="fl-btn fl-btn-outline-white" onClick={onHelp}>
            <LifeBuoy size={17} aria-hidden /> {hasRequest ? 'View my request' : 'Request rescue'}
          </button>
        </div>
      </section>

      <section className="fl-card">
        <h2>Do this now</h2>
        <ol className="fl-steps">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      {chosen && (
        <section className="fl-card">
          <h2>Get to a safe zone</h2>
          {preview && (
            <button type="button" className="fl-minimap" onClick={() => onRoute()} aria-label="Open the map with the route to the safe zone">
              <FlareMap scenario={scenario} focusId={danger.incident.id} user={location} route={chosen.route} selectedShelterId={chosen.shelter.id} preview />
              <span className="fl-minimap-cta">Open map <ArrowRight size={14} aria-hidden /></span>
            </button>
          )}
          <ul className="fl-rows">
            {sit.options.map((o, n) => {
              const on = o.shelter.id === chosen.shelter.id;
              const Icon = o.shelter.kind === 'medical' ? Cross : House;
              return (
                <li key={o.shelter.id}>
                  <button type="button" className="fl-row" data-on={on || undefined} aria-pressed={on} onClick={() => onPick(o.shelter.id)}>
                    <span className="fl-row-icon" data-safe><Icon size={16} aria-hidden /></span>
                    <span className="fl-row-text">
                      <strong>{o.shelter.name}</strong>
                      <small>
                        <b>{o.minutes} min walk</b> · {metres(o.distanceM)}{n === 0 ? ' · Nearest shelter' : ''}{o.shelter.kind === 'medical' ? ' · Medical' : ''}
                      </small>
                      {on && <small>{o.shelter.note}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="fl-btn fl-btn-primary fl-btn-block" onClick={() => onRoute()}>
            <Footprints size={16} aria-hidden /> Show the route to {chosen.shelter.name.split(',')[0]}
          </button>
          <p className="fl-fine">Routes follow real roads but cannot see which ones are flooded. If the way is under water, turn back and go up.</p>
        </section>
      )}

      <Contacts scenario={scenario} onHelp={onHelp} />
    </>
  );
}

function Contacts({ scenario, onHelp }: { scenario: Scenario; onHelp: () => void }) {
  return (
    <section className="fl-card">
      <h2>Who to contact</h2>
      <ul className="fl-rows">
        {scenario.contacts.map((c) => (
          <li key={c.id}>
            <a className="fl-row" href={`tel:${c.number.replace(/[^\d+]/g, '')}`} target="_top">
              <span className="fl-row-icon" data-call><PhoneIcon size={16} aria-hidden /></span>
              <span className="fl-row-text">
                <strong>{c.label} · {c.number}</strong>
                <small>{c.note}</small>
              </span>
            </a>
          </li>
        ))}
        <li>
          <button type="button" className="fl-row" onClick={onHelp}>
            <span className="fl-row-icon" data-help><LifeBuoy size={16} aria-hidden /></span>
            <span className="fl-row-text">
              <strong>Request help in the app</strong>
              <small>Goes to the first responders' queue with your location</small>
            </span>
            <ChevronRight size={18} aria-hidden />
          </button>
        </li>
      </ul>
      <p className="fl-fine">This is a simulation: a request sent here reaches the demo responder screen only. The phone numbers are real. Call them only in a real emergency.</p>
    </section>
  );
}

/* ── Map card (over the map) ───────────────────────────────────────── */
type MapCardProps = { scenario: Scenario; sit: Situation; focusId: string | null; chosen: Situation['options'][number] | null; onBack: () => void; onAll: () => void; onPick: (id: string) => void };

function MapCard({ scenario, sit, focusId, chosen, onBack, onAll, onPick }: MapCardProps) {
  const mine = sit.danger?.incident.id ?? sit.location.incidentId;
  const focus = scenario.incidents.find((i) => i.id === focusId) ?? null;
  if (focusId !== mine) {
    return (
      <div className="fl-mapcard">
        <div className="fl-mapcard-text">
          <strong>{focus ? focus.area : 'All flood areas'}</strong>
          <small>{focus ? `${SEVERITY_NAME[focus.severity]} · ${focus.summary}` : 'Tap an area on the map to look closer.'}</small>
        </div>
        <button type="button" className="fl-btn fl-btn-sm" onClick={onBack}><MapPin size={14} aria-hidden /> My location</button>
      </div>
    );
  }
  return (
    <div className="fl-mapcard">
      <div className="fl-mapcard-text">
        {chosen ? (
          <>
            <strong>{chosen.shelter.name}</strong>
            <small><b>{chosen.minutes} min walk</b> · {metres(chosen.distanceM)} · {chosen.shelter.note}</small>
          </>
        ) : (
          <>
            <strong>{focus?.area ?? sit.location.label}</strong>
            <small>{sit.danger ? `${LEVEL_NAME[sit.danger.level]} · ${sit.danger.zone.depth}` : 'You are outside the marked flood zones.'}</small>
          </>
        )}
      </div>
      <div className="fl-mapcard-actions">
        {chosen && sit.options.length > 1 && (
          <div className="fl-pills" role="group" aria-label="Safe zones">
            {sit.options.map((o) => (
              <button key={o.shelter.id} type="button" aria-pressed={o.shelter.id === chosen.shelter.id} onClick={() => onPick(o.shelter.id)}>
                {o.minutes} min
              </button>
            ))}
          </div>
        )}
        <button type="button" className="fl-btn fl-btn-sm fl-btn-ghost" onClick={onAll}>All areas</button>
      </div>
    </div>
  );
}

/* ── News ──────────────────────────────────────────────────────────── */
type NewsProps = { alerts: Alert[]; loaded: boolean; ok: boolean; scenario: Scenario; nearId: string; onArea: (id: string) => void };
const KIND_LABEL = { flood: 'Flood', shelter: 'Safe zone', update: 'Update', weather: 'Weather' } as const;

function News({ alerts, loaded, ok, scenario, nearId, onArea }: NewsProps) {
  const now = useNow();
  const [filter, setFilter] = useState<'all' | 'near' | 'official'>('all');
  const official = alerts.filter((a) => a.sourceType === 'official');
  const scenarioItems = alerts.filter((a) => a.sourceType === 'simulation');
  const near = scenarioItems.filter((a) => a.incidentId === nearId);
  const elsewhere = scenarioItems.filter((a) => a.incidentId !== nearId);
  const areaOf = (a: Alert) => scenario.incidents.find((i) => i.id === a.incidentId) ?? null;

  const item = (a: Alert) => {
    const area = areaOf(a);
    return (
      <li key={a.id}>
        <article className="fl-news" data-kind={a.kind} data-official={a.sourceType === 'official' || undefined}>
          <header>
            <span className="fl-news-kind">{KIND_LABEL[a.kind]}</span>
            <time dateTime={a.at} title={new Date(a.at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}>{ago(a.at, now)}</time>
          </header>
          <h3>{a.title}</h3>
          <p>{a.text}</p>
          <footer>
            <span className="fl-news-src" data-official={a.sourceType === 'official' || undefined}>
              {a.sourceType === 'official' ? `Official · ${a.source}` : `Simulated · ${a.source}`}
            </span>
            {a.validTo && <span>Until {new Date(a.validTo).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' })}, {clockMY(a.validTo)}</span>}
            {a.sourceType === 'official' && !a.local && <span>Other states</span>}
            {area && <button type="button" className="fl-linkbtn" onClick={() => onArea(area.id)}>{area.area} on map</button>}
            {a.url && <a className="fl-linkbtn" href={a.url} target="_blank" rel="noreferrer">met.gov.my</a>}
          </footer>
        </article>
      </li>
    );
  };

  const section = (title: string, hint: string, list: Alert[], empty: string) => (
    <section className="fl-newsgroup">
      <div className="fl-newsgroup-head">
        <h2>{title}</h2>
        <small>{hint}</small>
      </div>
      {list.length ? <ul className="fl-newslist">{list.map(item)}</ul> : <p className="fl-empty">{empty}</p>}
    </section>
  );

  return (
    <>
      <div className="fl-pagehead">
        <h1>News and warnings</h1>
        <div className="fl-pills" role="group" aria-label="Filter news">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
          <button type="button" aria-pressed={filter === 'near'} onClick={() => setFilter('near')}>Near me</button>
          <button type="button" aria-pressed={filter === 'official'} onClick={() => setFilter('official')}>Official</button>
        </div>
      </div>
      {!ok && <p className="fl-inline-warn" role="status">Could not refresh just now. Showing the last updates received.</p>}
      {!loaded ? (
        <LoadState error={null} onRetry={() => {}} />
      ) : (
        <>
          {filter !== 'official' && section('Near you', 'Simulated scenario', near, 'No updates for your area yet.')}
          {filter !== 'near' && section('Official weather warnings', 'Live from MET Malaysia', official, 'No official warnings are in force right now, or the MET Malaysia feed could not be reached.')}
          {filter === 'all' && section('Other areas', 'Simulated scenario', elsewhere, 'Nothing from other areas yet.')}
        </>
      )}
    </>
  );
}

/* ── Get help ──────────────────────────────────────────────────────── */
const NEEDS: { type: SosType; label: string; Icon: typeof Waves }[] = [
  { type: 'trapped', label: 'Trapped', Icon: Waves },
  { type: 'medical-help', label: 'Medical', Icon: Stethoscope },
  { type: 'supplies', label: 'Supplies', Icon: Package },
  { type: 'other', label: 'Other', Icon: LifeBuoy },
];
const STEPS = ['pending', 'assigned', 'resolved'] as const;

function Help({ scenario, sit, sos, onSent, onClear }: { scenario: Scenario; sit: Situation; sos: Sos | null; onSent: (s: Sos) => void; onClear: () => void }) {
  const [type, setType] = useState<SosType>('trapped');
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onSent(await api.createSos({ incidentId: sit.danger?.incident.id ?? sit.location.incidentId, people, type, description: note.trim(), location: sit.location.location, locationMode: 'manual-demo' }));
      setNote('');
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (sos) {
    const at = STEPS.indexOf(sos.status);
    return (
      <>
        <div className="fl-pagehead">
          <h1>Your request</h1>
        </div>
        <section className="fl-card fl-track" data-status={sos.status}>
          <div className="fl-track-head">
            <div>
              <strong data-testid="sos-headline">{STATUS_LABEL[sos.status]}</strong>
              <small>{sos.status === 'assigned' ? `${sos.assignedTeam} has your location.` : sos.status === 'resolved' ? `Closed by ${sos.assignedTeam ?? 'the responders'}.` : 'The responders can see your request and location.'}</small>
            </div>
            <span className="fl-id" data-testid="sos-id">{sos.id}</span>
          </div>
          <ol className="fl-timeline">
            {(['Request sent', 'Team on the way', 'Resolved'] as const).map((label, n) => (
              <li key={label} data-done={n <= at || undefined} data-now={n === at || undefined}>
                <i aria-hidden>{n <= at && <Check size={13} />}</i>
                <span>
                  <strong>{label}</strong>
                  <small>{n === 0 ? `${clockMY(sos.createdAt)} · ${ago(sos.createdAt, now)}` : n === at ? `${clockMY(sos.updatedAt)}${n === 1 && sos.assignedTeam ? ` · ${sos.assignedTeam}` : ''}` : n < at ? 'Done' : 'Waiting'}</small>
                </span>
              </li>
            ))}
          </ol>
          <dl className="fl-facts">
            <div><dt>Need</dt><dd>{TYPE_LABEL[sos.type]}</dd></div>
            <div><dt>People</dt><dd>{sos.people}</dd></div>
            <div><dt>From</dt><dd>{sit.location.label}</dd></div>
          </dl>
          {sos.description && <p className="fl-quote">“{sos.description}”</p>}
        </section>
        {sos.status === 'resolved' ? (
          <button type="button" className="fl-btn fl-btn-block" onClick={onClear}>Send a new request</button>
        ) : (
          <section className="fl-card">
            <h2>While you wait</h2>
            <ul className="fl-ticks">
              {scenario.actions[sit.danger?.level ?? 'moderate'].slice(0, 3).map((s) => (
                <li key={s}><Check size={16} aria-hidden /> {s}</li>
              ))}
            </ul>
            <a className="fl-btn fl-btn-block" href="tel:999" target="_top"><PhoneIcon size={16} aria-hidden /> Call 999 if it gets worse</a>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <div className="fl-pagehead">
        <h1>Request help</h1>
      </div>
      <section className="fl-card">
        <h2>What do you need?</h2>
        <div className="fl-choices" role="radiogroup" aria-label="What do you need?">
          {NEEDS.map((n) => (
            <button key={n.type} type="button" role="radio" aria-checked={type === n.type} onClick={() => setType(n.type)}>
              <n.Icon size={20} aria-hidden />
              {n.label}
            </button>
          ))}
        </div>

        <h2>How many people?</h2>
        <div className="fl-stepper">
          <button type="button" onClick={() => setPeople((p) => Math.max(1, p - 1))} disabled={people <= 1} aria-label="One fewer"><Minus size={18} aria-hidden /></button>
          <output aria-live="polite" data-testid="people">{people}</output>
          <button type="button" onClick={() => setPeople((p) => Math.min(50, p + 1))} disabled={people >= 50} aria-label="One more"><Plus size={18} aria-hidden /></button>
        </div>

        <h2><label htmlFor="fl-note">Anything they should know? <span className="fl-optional">Optional</span></label></h2>
        <textarea id="fl-note" className="fl-textarea" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: second floor, one elderly person, water still rising" />

        <p className="fl-sendfrom"><MapPin size={15} aria-hidden /> Sending from <strong>{sit.location.label}</strong></p>
        {error && <p className="fl-inline-warn" role="alert">{error}</p>}
        <button type="button" className="fl-btn fl-btn-danger fl-btn-block fl-btn-lg" onClick={send} disabled={busy} data-testid="send-sos">
          <LifeBuoy size={18} aria-hidden /> {busy ? 'Sending…' : 'Send request'}
        </button>
        <p className="fl-fine">Simulation: this goes to the demo first-responder screen, not to a real emergency service. In a real emergency call 999.</p>
      </section>
      {sit.danger && <p className="fl-fine fl-center"><LevelTag level={sit.danger.level} /> You are in the {LEVEL_NAME[sit.danger.level].toLowerCase()} zone at {sit.danger.incident.area}.</p>}
    </>
  );
}
