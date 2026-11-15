// 02 First responder: every request in a live queue and on the map, across all areas.
// New requests arrive as notifications. Assign a team or resolve; the citizen follows within seconds.
import { useEffect, useMemo, useState } from 'react';
import { nearest } from '../features/citizen/geo.ts';
import { api, type Alert, type Sos, type SosPatch, type SosStatus } from '../shared/api.ts';
import { ALERT_TITLE, useAlerts, useScenario, useSosList, type Scenario } from './data.ts';
import { FlareMap, MapLegend } from './FlareMap.tsx';
import { errText, myt, Shell, StatusTag, Toasts, TYPE_LABEL, TYPE_PHRASE, useArrivals, useToasts } from './ui.tsx';

const FILTERS: ('all' | SosStatus)[] = ['all', 'pending', 'assigned', 'resolved'];
const FILTER_LABEL = { all: 'All', pending: 'Pending', assigned: 'Assigned', resolved: 'Resolved' } as const;

const placeOf = (s: Pick<Sos, 'location'>, scenario: Scenario | null) => (scenario?.config.demoLocations.length ? nearest(s.location, scenario.config.demoLocations).label : 'Unknown place');

export default function Responder() {
  const { scenario, error } = useScenario();
  const live = useSosList(2000);
  const feed = useAlerts();
  const { toasts, push, dismiss } = useToasts();
  const [filter, setFilter] = useState<'all' | SosStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [team, setTeam] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { pending: 0, assigned: 0, resolved: 0 };
    live.list.forEach((s) => c[s.status]++);
    return c;
  }, [live.list]);
  const waiting = live.list.filter((s) => s.status !== 'resolved').reduce((n, s) => n + s.people, 0);
  const rows = useMemo(
    () => live.list.filter((s) => filter === 'all' || s.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [live.list, filter],
  );
  const selected = live.list.find((s) => s.id === selectedId) ?? null;

  // Notifications: a new request ("3 people stuck at … — send help") and new flood reports.
  useArrivals(live.list, live.at !== null && !!scenario, (s: Sos) =>
    push({
      id: s.id,
      title: `${s.people} ${s.people === 1 ? 'person' : 'people'} ${TYPE_PHRASE[s.type]} · ${placeOf(s, scenario)}`,
      body: s.description,
      meta: 'Send help · tap to open',
      tone: 'flare',
      onClick: () => { setFilter('all'); setSelectedId(s.id); },
    }),
  );
  useArrivals(feed.alerts, feed.loaded, (a: Alert) => push({ id: a.id, title: ALERT_TITLE[a.kind], body: a.text, meta: a.source }));

  // Keep something useful selected: the newest pending request, else the newest of any kind.
  useEffect(() => {
    if (selectedId && live.list.some((s) => s.id === selectedId)) return;
    const newest = [...live.list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setSelectedId((newest.find((s) => s.status === 'pending') ?? newest[0])?.id ?? null);
  }, [live.list, selectedId]);
  useEffect(() => {
    if (scenario && !team) setTeam(scenario.config.demoTeams[0] ?? '');
  }, [scenario, team]);

  async function act(patch: SosPatch) {
    if (!selected || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.patchSos(selected.id, patch);
      await live.refresh();
    } catch (e) {
      setActionError(`Not saved. ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!window.confirm('Clear every request and restart the scenario?')) return;
    try {
      await api.resetDemo();
      setSelectedId(null);
      await live.refresh();
    } catch (e) {
      setActionError(`Reset failed. ${errText(e)}`);
    }
  }

  return (
    <Shell path="/responder">
      <Toasts toasts={toasts} dismiss={dismiss} />
      <div className="fl-work fl-work-ops">
        <section className="fl-pane" aria-label="Request queue" id="sos-queue">
          <div className="fl-stats">
            <div data-hot={counts.pending > 0}><span className="fl-label">Pending</span><span className="fl-num">{counts.pending}</span></div>
            <div><span className="fl-label">Assigned</span><span className="fl-num">{counts.assigned}</span></div>
            <div><span className="fl-label">People waiting</span><span className="fl-num">{waiting}</span></div>
            <div><span className="fl-label">Resolved</span><span className="fl-num">{counts.resolved}</span></div>
          </div>
          <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--rule)' }}>
            <div className="fl-seg" role="group" aria-label="Filter requests">
              {FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {FILTER_LABEL[f]}
                  {f !== 'all' && <span>{counts[f]}</span>}
                </button>
              ))}
            </div>
            <p className="fl-label" style={{ margin: '10px 2px 0' }} role="status">
              {live.ok ? (live.at ? `Live · ${myt(live.at)}` : 'Connecting…') : 'Connection lost · retrying'}
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="fl-empty">{live.list.length === 0 ? 'No requests yet.' : 'Nothing in this filter.'}</p>
          ) : (
            <ul className="fl-list">
              {rows.map((s) => (
                <li key={s.id}>
                  <button type="button" className="fl-item fl-in" data-s={s.status} aria-pressed={s.id === selectedId} onClick={() => setSelectedId(s.id)}>
                    <span className="fl-between">
                      <span className="fl-id" data-testid="sos-id">{s.id}</span>
                      <StatusTag status={s.status} />
                    </span>
                    <p>{s.description}</p>
                    <span className="fl-label" style={{ display: 'block', marginTop: 6 }}>
                      {placeOf(s, scenario)} · {s.people} {s.people === 1 ? 'person' : 'people'} · {myt(s.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="fl-mapwrap">
          {scenario ? (
            <>
              <FlareMap incidents={scenario.incidents} activeId={null} shelters={scenario.shelters} locations={scenario.config.demoLocations} requests={live.list} mode="responder" selectedRequest={selectedId} onSelectRequest={setSelectedId} />
              <MapLegend mode="responder" />
            </>
          ) : (
            <div className="fl-map-fallback">{error ? `Map unavailable. ${error}` : 'Loading…'}</div>
          )}
        </div>

        <section className="fl-pane fl-pane-pad" aria-label="Request detail">
          {selected ? (
            <Detail key={selected.id} sos={selected} scenario={scenario} team={team} setTeam={setTeam} busy={busy} act={act} error={actionError} />
          ) : (
            <p className="fl-empty">Select a request from the queue or the map.</p>
          )}
          <hr className="fl-rule" style={{ margin: '24px 0 14px' }} />
          <div className="fl-between">
            <a className="fl-btn fl-btn-quiet fl-btn-sm" href="/recovery" target="_top">Open Recovery</a>
            <button type="button" className="fl-btn fl-btn-quiet fl-btn-sm" onClick={reset}>Reset</button>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Detail({ sos, scenario, team, setTeam, busy, act, error }: {
  sos: Sos;
  scenario: Scenario | null;
  team: string;
  setTeam: (t: string) => void;
  busy: boolean;
  act: (p: SosPatch) => void;
  error: string | null;
}) {
  const area = scenario?.incidents.find((i) => i.id === sos.incidentId);
  return (
    <div className="fl-stack fl-in">
      <div className="fl-between">
        <p className="fl-label">Request</p>
        <StatusTag status={sos.status} />
      </div>
      <div className="fl-bigid">{sos.id}</div>
      <p style={{ margin: 0, fontSize: 17, lineHeight: 1.35 }}>{sos.description}</p>
      <dl className="fl-kv">
        <dt>Need</dt><dd>{TYPE_LABEL[sos.type]}</dd>
        <dt>People</dt><dd>{sos.people}</dd>
        <dt>Location</dt>
        <dd>
          {placeOf(sos, scenario)}
          <span className="fl-mono fl-dim fl-small" style={{ display: 'block' }}>{sos.location.lat.toFixed(3)}, {sos.location.lng.toFixed(3)}{sos.locationMode === 'browser-opt-in' ? ' · approximate' : ''}</span>
        </dd>
        {area && (<><dt>Area</dt><dd>{area.title}</dd></>)}
        <dt>Received</dt><dd>{myt(sos.createdAt)}</dd>
        <dt>Team</dt><dd>{sos.assignedTeam ?? 'Not assigned'}</dd>
        {sos.status !== 'pending' && (<><dt>Updated</dt><dd>{myt(sos.updatedAt)}</dd></>)}
      </dl>

      {sos.status === 'pending' && (
        <div className="fl-stack" style={{ gap: 10 }}>
          <label className="fl-field">
            <span className="fl-label">Team</span>
            <select className="fl-input" value={team} onChange={(e) => setTeam(e.target.value)}>
              {scenario?.config.demoTeams.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <button type="button" className="fl-btn fl-btn-primary fl-btn-block" disabled={busy || !team} onClick={() => act({ status: 'assigned', assignedTeam: team })}>
            {busy ? 'Saving…' : 'Assign team'}
          </button>
        </div>
      )}
      {sos.status === 'assigned' && (
        <div className="fl-stack" style={{ gap: 10 }}>
          <button type="button" className="fl-btn fl-btn-primary fl-btn-block" disabled={busy} onClick={() => act({ status: 'resolved' })}>
            {busy ? 'Saving…' : 'Mark resolved'}
          </button>
          <button type="button" className="fl-btn fl-btn-quiet fl-btn-sm" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => act({ status: 'pending' })}>Return to pending</button>
        </div>
      )}
      {sos.status === 'resolved' && <div className="fl-note">Resolved by {sos.assignedTeam ?? 'the response team'}.</div>}
      {error && <div className="fl-error" role="alert">{error}</div>}
    </div>
  );
}
