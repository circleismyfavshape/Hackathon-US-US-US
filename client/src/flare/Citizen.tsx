// Assemble the citizen tabs, notifications and map.
// The individual screens and request tracking hook live in citizen/.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePhoneFeature } from './phoneNotes.ts';
import {
  Eye,
  EyeOff,
  LifeBuoy,
  Map as MapIcon,
  MapPin,
  Newspaper,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from 'lucide-react';

import type { Alert, DemoLocation, Scenario } from '../shared/api.ts';
import { FlareMark } from '../shared/Logo.tsx';
import {
  LEVEL_COLOR,
  LEVEL_NAME,
  safeStorage,
  situationAt,
  useAlerts,
  useArrivals,
  useDemoLocation,
  useScenario,
  type Situation,
} from './data.ts';
import { FlareMap, MapLegend } from './FlareMap.tsx';
import { ProfileView } from './profile.tsx';
import { Crash, LoadState, Toasts, useToasts, Viewer, type Device } from './ui.tsx';

import { Guide } from './citizen/Guide.tsx';
import { MapCard } from './citizen/MapCard.tsx';
import { News } from './citizen/News.tsx';
import { Help } from './citizen/Help.tsx';
import { useCitizenRequest } from './citizen/useCitizenRequest.ts';
import { alertToast, requestStatusToast } from './citizen/notifications.ts';

type Tab = 'guide' | 'map' | 'news' | 'help' | 'profile';
const SEEN_KEY = 'flare.citizen.newsSeenAt';

export default function Citizen({ device }: { device: Device }) {
  const { scenario, error, reload } = useScenario();
  const [location, setLocation] = useDemoLocation(scenario);
  return (
    <Viewer
      role="citizen"
      device={device}
      scenario={scenario}
      location={location}
      onLocation={setLocation}
    >
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
  const [isWide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 900px)');
    const sync = () => setWide(mediaQuery.matches);
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);
  return isWide;
}

function CitizenApp({ scenario, location }: { scenario: Scenario; location: DemoLocation }) {
  const isWide = useWide();
  const situation = useMemo(() => situationAt(scenario, location), [scenario, location]);
  const feed = useAlerts();
  const requestState = useCitizenRequest();
  const { toasts, push, dismiss } = useToasts();
  const [tab, setTab] = useState<Tab>('guide');
  usePhoneFeature(tab);
  const [shelterId, setShelterId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(
    situation.danger?.incident.id ?? location.incidentId,
  );
  const [seenAt, setSeenAt] = useState(() => safeStorage.get(SEEN_KEY) ?? '');
  // Directions open flat, because a route is easiest to follow from straight above. The map tab
  // itself opens in 3D.
  const [routeView, setRouteView] = useState(false);
  const [flatRequest, setFlatRequest] = useState(0);
  // Hide all map annotations together when the person wants a clear view.
  const [mapInfo, setMapInfo] = useState(true);

  const destination =
    situation.options.find((option) => option.shelter.id === shelterId) ??
    situation.options[0] ??
    null;
  const dangerId = situation.danger?.incident.id ?? null;
  // A route is drawn when you are in danger, or when you picked a safe zone yourself.
  const route = situation.danger || shelterId ? (destination?.route ?? null) : null;
  const selectTab = useCallback(
    (nextTab: Tab) => {
      if (nextTab === 'map') {
        setRouteView(false);
      }
      // The desktop guide already has the map beside it.
      setTab(isWide && nextTab === 'map' ? 'guide' : nextTab);
    },
    [isWide],
  );

  // Moving to a new place: start again from that place's guide. Entering a danger zone raises the
  // alert.
  const previousLocation = useRef(location.id);
  useEffect(() => {
    if (previousLocation.current === location.id) {
      return;
    }
    // The alert for the previous place no longer applies.
    dismiss(`danger-${previousLocation.current}`);
    previousLocation.current = location.id;
    setShelterId(null);
    setFocusId(dangerId ?? location.incidentId);
    setTab('guide');
    if (situation.danger) {
      const level = LEVEL_NAME[situation.danger.level].toLowerCase();
      const area = situation.danger.incident.area;
      push({
        id: `danger-${location.id}`,
        tone: 'danger',
        title: 'EMERGENCY FLOOD',
        body: `You are in a ${level} flood zone at ${area}. Open for what to do.`,
        meta: 'FLARE · Simulation',
      });
    }
  }, [location.id, location.incidentId, dangerId, situation.danger, push, dismiss]);

  // News: a banner for each new item. Official warnings loaded with the page are announced once
  // per browser session.
  const openNews = useCallback(() => setTab('news'), []);
  const announce = useCallback(
    (alert: Alert) => push(alertToast(alert, openNews)),
    [push, openNews],
  );
  useArrivals(feed.alerts, feed.loaded, announce);
  const announcedOfficial = useRef(false);
  const inDanger = useRef(Boolean(situation.danger));
  inDanger.current = Boolean(situation.danger);
  useEffect(() => {
    if (!feed.loaded || announcedOfficial.current) {
      return;
    }
    announcedOfficial.current = true;
    const top = feed.alerts.find((a) => a.sourceType === 'official');
    let told: string | null = null;
    try {
      told = sessionStorage.getItem('flare.official.told');
    } catch {
      // Session storage can be unavailable in private browsing.
    }
    // In a danger zone the first screen is for getting out. Weather news waits on the News tab
    // (its dot shows it is there).
    if (!top || told === top.id || inDanger.current) {
      return;
    }
    try {
      sessionStorage.setItem('flare.official.told', top.id);
    } catch {
      // Session storage can be unavailable in private browsing.
    }
    const t = setTimeout(() => announce(top), 2500);
    return () => clearTimeout(t);
  }, [feed.loaded, feed.alerts, announce]);

  // Your request: a banner when its status changes.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    const request = requestState.sos;
    if (!request) {
      lastStatus.current = null;
      return;
    }
    const key = `${request.id}:${request.status}`;
    if (
      lastStatus.current &&
      lastStatus.current !== key &&
      lastStatus.current.startsWith(request.id)
    ) {
      push({ ...requestStatusToast(request), onClick: () => setTab('help') });
    }
    lastStatus.current = key;
  }, [requestState.sos, push]);

  // Unread dot on News.
  const newest = feed.alerts.reduce((m, a) => (a.at > m ? a.at : m), '');
  const unread =
    tab !== 'news' && newest > seenAt ? feed.alerts.filter((a) => a.at > seenAt).length : 0;
  useEffect(() => {
    if (tab === 'news' && newest && newest !== seenAt) {
      safeStorage.set(SEEN_KEY, newest);
      setSeenAt(newest);
    }
  }, [tab, newest, seenAt]);

  const showRoute = useCallback(
    (id?: string) => {
      if (id) {
        setShelterId(id);
      }
      setFocusId(dangerId ?? location.incidentId);
      setRouteView(true);
      setFlatRequest((count) => count + 1);
      if (!isWide) {
        setTab('map');
      }
    },
    [dangerId, location.incidentId, isWide],
  );
  const openArea = useCallback(
    (id: string) => {
      setFocusId(id);
      if (!isWide) {
        setTab('map');
      }
    },
    [isWide],
  );

  const map = (
    <div className="fl-mapwrap" data-info={mapInfo ? 'shown' : 'hidden'}>
      <FlareMap
        scenario={scenario}
        startFlat={routeView}
        flatRequest={flatRequest}
        showInfo={mapInfo}
        focusId={focusId}
        onPickIncident={setFocusId}
        user={location}
        route={focusId === (dangerId ?? location.incidentId) ? route : null}
        selectedShelterId={route ? destination?.shelter.id : null}
        onSelectShelter={(id) => {
          if (situation.options.some((o) => o.shelter.id === id)) {
            setShelterId(id);
          }
        }}
      />
      {mapInfo && <MapLegend />}
      {mapInfo && (
        <MapCard
          scenario={scenario}
          situation={situation}
          focusId={focusId}
          destination={route ? destination : null}
          onBack={() => setFocusId(dangerId ?? location.incidentId)}
          onAll={() => setFocusId(null)}
          onPick={setShelterId}
        />
      )}
      <button
        type="button"
        className="fl-map-info"
        onClick={() => setMapInfo((shown) => !shown)}
        aria-pressed={!mapInfo}
        data-testid="map-info-toggle"
      >
        {mapInfo ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        {mapInfo ? 'Hide info' : 'Show info'}
      </button>
    </div>
  );

  let body;
  switch (tab) {
    case 'news':
      body = (
        <News
          alerts={feed.alerts}
          loaded={feed.loaded}
          ok={feed.ok}
          scenario={scenario}
          nearId={dangerId ?? location.incidentId}
          seenAt={seenAt}
          onArea={openArea}
          onRetry={feed.refresh}
        />
      );
      break;
    case 'profile':
      body = <ProfileView scenario={scenario} />;
      break;
    case 'help':
      body = (
        <Help
          scenario={scenario}
          situation={situation}
          sos={requestState.sos}
          onSent={requestState.track}
          onClear={requestState.clear}
        />
      );
      break;
    default:
      body = (
        <Guide
          scenario={scenario}
          situation={situation}
          destination={destination}
          onPick={setShelterId}
          onRoute={showRoute}
          onHelp={() => setTab('help')}
          onArea={openArea}
          hasRequest={Boolean(requestState.sos && requestState.sos.status !== 'resolved')}
          preview={!isWide}
        />
      );
  }

  const tabs: { id: Tab; label: string; Icon: typeof MapIcon; badge?: number | boolean }[] = [
    {
      id: 'guide',
      label: situation.danger ? 'Emergency' : 'Home',
      Icon: situation.danger ? TriangleAlert : ShieldCheck,
    },
    { id: 'map', label: 'Map', Icon: MapIcon },
    { id: 'news', label: 'News', Icon: Newspaper, badge: unread },
    {
      id: 'help',
      label: 'Get help',
      Icon: LifeBuoy,
      badge: Boolean(requestState.sos && requestState.sos.status !== 'resolved'),
    },
    { id: 'profile', label: 'Profile', Icon: UserRound },
  ];

  if (isWide) {
    return (
      <div className="fl-desk">
        <Toasts toasts={toasts} dismiss={dismiss} />
        <aside className="fl-desk-side">
          <AppBar location={location} situation={situation} />
          <div className="fl-seg fl-desk-tabs" role="tablist">
            {tabs
              .filter((t) => t.id !== 'map')
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => selectTab(t.id)}
                >
                  <t.Icon size={15} aria-hidden /> {t.label}
                  {Boolean(t.badge) && (
                    <b className="fl-badge">{typeof t.badge === 'number' ? t.badge : ''}</b>
                  )}
                </button>
              ))}
          </div>
          <div className="fl-scroll" key={tab}>
            {body}
          </div>
        </aside>
        {map}
      </div>
    );
  }

  return (
    <div className="fl-phoneapp" data-danger={situation.danger?.level}>
      <Toasts toasts={toasts} dismiss={dismiss} />
      <AppBar location={location} situation={situation} />
      <main className="fl-appmain" data-tab={tab} key={tab}>
        {tab === 'map' ? map : <div className="fl-scroll">{body}</div>}
      </main>
      <nav className="fl-tabbar" aria-label="Sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            data-tone={t.id === 'guide' && situation.danger ? 'danger' : undefined}
            onClick={() => selectTab(t.id)}
          >
            <span className="fl-tabicon">
              <t.Icon size={21} aria-hidden />
              {Boolean(t.badge) && (
                <b className="fl-badge">{typeof t.badge === 'number' ? t.badge : ''}</b>
              )}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function AppBar({ location, situation }: { location: DemoLocation; situation: Situation }) {
  return (
    <header className="fl-appbar">
      <span className="fl-appbar-brand">
        <FlareMark height={20} /> FLARE
      </span>
      <span className="fl-loc" title={`Your location: ${location.label}`}>
        <MapPin size={14} aria-hidden />
        <span>{location.label}</span>
        <i
          style={{ background: situation.danger ? LEVEL_COLOR[situation.danger.level] : '#16a34a' }}
          aria-hidden
        />
      </span>
    </header>
  );
}
