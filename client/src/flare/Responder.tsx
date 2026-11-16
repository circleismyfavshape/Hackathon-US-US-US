// The first responder console: every request in one queue and on the map, the moment it is sent.
// Pick a request, send a team, mark it resolved. The citizen's screen follows within a second.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, List, Map as MapIcon, Send, Undo2, Users } from 'lucide-react';
import { countByStatus, nearest } from '../features/citizen/geo.ts';
import { api, type Scenario, type Sos, type SosStatus } from '../shared/api.ts';
import { ago, clockMY, errText, useArrivals, useDemoLocation, useNow, useScenario, useSosList } from './data.ts';
import { FlareMap, MapLegend } from './FlareMap.tsx';
import { Crash, LoadState, STATUS_LABEL, StatusTag, Toasts, TYPE_LABEL, TYPE_PHRASE, useToasts, Viewer, type Device } from './ui.tsx';

type Filter = 'open' | SosStatus | 'all';
const ORDER: Record<SosStatus, number> = { pending: 0, assigned: 1, resolved: 2 };

export default function Responder({ device }: { device: Device }) {
  const { scenario, error, reload } = useScenario();
  const [location, setLocation] = useDemoLocation(scenario);
  return (
    <Viewer role="responder" device={device} scenario={scenario} location={location} onLocation={setLocation}>
      {scenario ? (
        <Crash label="The responder console">
          <Console scenario={scenario} />
        </Crash>
      ) : (
        <LoadState error={error} onRetry={reload} />
      )}
    </Viewer>
  );
}

const placeOf = (s: Sos, scenario: Scenario) => nearest(s.location, scenario.demoLocations).label;
const areaOf = (s: Sos, scenario: Scenario) => scenario.incidents.find((i) => i.id === s.incidentId)?.area ?? 'Unknown area';

function Console({ scenario }: { scenario: Scenario }) {
  const live = useSosList();
  const now = useNow();
  const { toasts, push, dismiss } = useToasts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [pane, setPane] = useState<'list' | 'map'>('list');

  const counts = useMemo(() => countByStatus(live.list), [live.list]);
  const waitingPeople = useMemo(() => live.list.filter((s) => s.status === 'pending').reduce((n, s) => n + s.people, 0), [live.list]);
  const sorted = useMemo(() => [...live.list].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.createdAt.localeCompare(b.createdAt)), [live.list]);
  const shown = useMemo(() => sorted.filter((s) => (filter === 'all' ? true : filter === 'open' ? s.status !== 'resolved' : s.status === filter)), [sorted, filter]);
  const selected = live.list.find((s) => s.id === selectedId) ?? null;

  // A request that no longer exists (the demo was reset) cannot stay selected.
  useEffect(() => {
    if (selectedId && live.loaded && !live.list.some((s) => s.id === selectedId)) setSelectedId(null);
  }, [selectedId, live.list, live.loaded]);

  useArrivals(live.list, live.loaded, (s) =>
    push({
      id: s.id,
      tone: 'danger',
      title: `New request · ${TYPE_LABEL[s.type]}`,
      body: `${s.people} ${s.people === 1 ? 'person' : 'people'} ${TYPE_PHRASE[s.type]} at ${placeOf(s, scenario)}.`,
      meta: `${s.id} · ${areaOf(s, scenario)}`,
      onClick: () => setSelectedId(s.id),
    }),
  );

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: 'open', label: 'Open', n: counts.pending + counts.assigned },
    { id: 'pending', label: 'Waiting', n: counts.pending },
    { id: 'assigned', label: 'On the way', n: counts.assigned },
    { id: 'resolved', label: 'Resolved', n: counts.resolved },
  ];

  return (
    <div className="fl-ops" data-pane={pane} data-detail={selected ? '' : undefined}>
      <Toasts toasts={toasts} dismiss={dismiss} />

      <section className="fl-ops-queue" aria-label="Requests">
        <div className="fl-stats">
          <div data-tone="danger"><b>{counts.pending}</b><span>Waiting</span></div>
          <div data-tone="warn"><b>{counts.assigned}</b><span>En route</span></div>
          <div data-tone="good"><b>{counts.resolved}</b><span>Resolved</span></div>
          <div><b>{waitingPeople}</b><span>People</span></div>
        </div>

        <div className="fl-seg fl-ops-panes" role="group" aria-label="Show">
          <button type="button" aria-pressed={pane === 'list'} onClick={() => setPane('list')}><List size={15} aria-hidden /> Requests</button>
          <button type="button" aria-pressed={pane === 'map'} onClick={() => setPane('map')}><MapIcon size={15} aria-hidden /> Map</button>
        </div>

        <div className="fl-ops-list">
          <div className="fl-pills" role="group" aria-label="Filter requests">
            {filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <b>{f.n}</b>
              </button>
            ))}
          </div>
          {!live.ok && <p className="fl-inline-warn" role="status">Connection lost. Showing the last requests received; retrying.</p>}
          {!live.loaded ? (
            <LoadState error={null} onRetry={() => {}} />
          ) : shown.length === 0 ? (
            <p className="fl-empty">{live.list.length === 0 ? 'No requests yet. When a citizen sends one it appears here at once.' : 'No requests match this filter.'}</p>
          ) : (
            <ul className="fl-queue">
              {shown.map((s) => (
                <li key={s.id}>
                  <button type="button" className="fl-qitem" data-status={s.status} aria-pressed={s.id === selectedId} onClick={() => setSelectedId(s.id)} data-testid="queue-item">
                    <span className="fl-qitem-top">
                      <strong>{TYPE_LABEL[s.type]} · {s.people} {s.people === 1 ? 'person' : 'people'}</strong>
                      <StatusTag status={s.status} />
                    </span>
                    <span className="fl-qitem-place">{placeOf(s, scenario)}</span>
                    <span className="fl-qitem-meta">
                      <span className="fl-id">{s.id}</span>
                      <span>{areaOf(s, scenario)} · {ago(s.createdAt, now)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="fl-mapwrap fl-ops-map">
        <FlareMap scenario={scenario} focusId={selected?.incidentId ?? null} onPickIncident={() => {}} requests={live.list.filter((s) => s.status !== 'resolved' || s.id === selectedId)} selectedRequestId={selectedId} onSelectRequest={setSelectedId} />
        <MapLegend responder />
      </div>

      <aside className="fl-ops-detail" aria-label="Selected request">
        {selected ? (
          <Detail key={selected.id} sos={selected} scenario={scenario} onClose={() => setSelectedId(null)} onChanged={live.refresh} />
        ) : (
          <div className="fl-empty fl-ops-hint">
            <Users size={22} aria-hidden />
            <p>Select a request from the queue or the map to send a team.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Detail({ sos, scenario, onClose, onChanged }: { sos: Sos; scenario: Scenario; onClose: () => void; onChanged: () => Promise<void> }) {
  const [team, setTeam] = useState(sos.assignedTeam ?? scenario.demoTeams[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  const now = useNow();

  const patch = useCallback(
    async (body: Parameters<typeof api.patchSos>[1]) => {
      setBusy(true);
      setError(null);
      try {
        await api.patchSos(sos.id, body);
        await onChanged();
      } catch (e) {
        if (alive.current) setError(errText(e));
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [sos.id, onChanged],
  );

  return (
    <div className="fl-detail">
      <button type="button" className="fl-linkbtn fl-detail-back" onClick={onClose}><ArrowLeft size={15} aria-hidden /> All requests</button>
      <div className="fl-detail-head">
        <div>
          <h2>{TYPE_LABEL[sos.type]} · {sos.people} {sos.people === 1 ? 'person' : 'people'}</h2>
          <span className="fl-id" data-testid="detail-id">{sos.id}</span>
        </div>
        <StatusTag status={sos.status} />
      </div>

      <dl className="fl-facts fl-facts-stack">
        <div><dt>Where</dt><dd>{placeOf(sos, scenario)}<small>{areaOf(sos, scenario)}</small></dd></div>
        <div><dt>Sent</dt><dd>{clockMY(sos.createdAt)}<small>{ago(sos.createdAt, now)}</small></dd></div>
        <div><dt>Status</dt><dd>{STATUS_LABEL[sos.status]}<small>{sos.assignedTeam ?? 'No team yet'}</small></dd></div>
      </dl>
      {sos.description ? <p className="fl-quote">“{sos.description}”</p> : <p className="fl-fine">The citizen sent no extra details.</p>}

      {sos.status !== 'resolved' && (
        <div className="fl-field">
          <label htmlFor="fl-team">Team</label>
          <select id="fl-team" className="fl-select" value={team} onChange={(e) => setTeam(e.target.value)} disabled={busy}>
            {scenario.demoTeams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="fl-inline-warn" role="alert">{error}</p>}

      <div className="fl-detail-actions">
        {sos.status === 'pending' && (
          <button type="button" className="fl-btn fl-btn-primary fl-btn-block" disabled={busy || !team} onClick={() => patch({ status: 'assigned', assignedTeam: team })} data-testid="assign">
            <Send size={16} aria-hidden /> Send {team}
          </button>
        )}
        {sos.status === 'assigned' && (
          <>
            <button type="button" className="fl-btn fl-btn-good fl-btn-block" disabled={busy} onClick={() => patch({ status: 'resolved' })} data-testid="resolve">
              <CheckCheck size={16} aria-hidden /> Mark resolved
            </button>
            {team !== sos.assignedTeam && (
              <button type="button" className="fl-btn fl-btn-block" disabled={busy} onClick={() => patch({ status: 'assigned', assignedTeam: team })}>
                <Send size={16} aria-hidden /> Send {team} instead
              </button>
            )}
          </>
        )}
        {sos.status !== 'pending' && (
          <button type="button" className="fl-btn fl-btn-ghost fl-btn-block" disabled={busy} onClick={() => patch({ status: 'pending' })}>
            <Undo2 size={16} aria-hidden /> Put back in the queue
          </button>
        )}
      </div>
      <p className="fl-fine">Simulation: teams are fictional and nothing is dispatched.</p>
    </div>
  );
}
