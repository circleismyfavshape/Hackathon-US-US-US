// 02 First responder: the same requests the citizen sent, in a live queue and on the map.
// Assign a fictional team or resolve; the citizen view follows within seconds.
import { useEffect, useMemo, useState } from 'react';
import { api, type Sos, type SosPatch, type SosStatus } from '../shared/api.ts';
import { useScenario, useSosList } from './data.ts';
import { FlareMap, MapLegend } from './FlareMap.tsx';
import { errText, myt, Shell, StatusTag, TYPE_LABEL } from './ui.tsx';

const FILTERS: ('all' | SosStatus)[] = ['all', 'pending', 'assigned', 'resolved'];
const FILTER_LABEL = { all: 'All', pending: 'Pending', assigned: 'Assigned', resolved: 'Resolved' } as const;

export default function Responder() {
  const { scenario, error } = useScenario();
  const live = useSosList(2000);
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
    if (!window.confirm('Clear every demo request and reseed the scenario?')) return;
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
              {live.ok ? (live.at ? `Live · synced ${myt(live.at)} MYT` : 'Connecting…') : 'Connection lost · retrying'}
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="fl-empty">{live.list.length === 0 ? 'No requests yet. Send one from the Citizen view and it appears here within two seconds.' : 'Nothing in this filter.'}</p>
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
                      {TYPE_LABEL[s.type]} · {s.people} {s.people === 1 ? 'person' : 'people'} · {myt(s.createdAt)}
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
              <FlareMap incident={scenario.incident} shelters={scenario.shelters} locations={scenario.config.demoLocations} requests={live.list} mode="responder" selectedRequest={selectedId} onSelectRequest={setSelectedId} />
              <MapLegend mode="responder" />
            </>
          ) : (
            <div className="fl-map-fallback">{error ? `Scenario unavailable. ${error}` : 'Loading scenario…'}</div>
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
            <a className="fl-btn fl-btn-quiet fl-btn-sm" href="/recovery">Open RecoveryGap</a>
            <button type="button" className="fl-btn fl-btn-quiet fl-btn-sm" onClick={reset}>Reset demo</button>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Detail({ sos, scenario, team, setTeam, busy, act, error }: {
  sos: Sos;
  scenario: ReturnType<typeof useScenario>['scenario'];
  team: string;
  setTeam: (t: string) => void;
  busy: boolean;
  act: (p: SosPatch) => void;
  error: string | null;
}) {
  const point = scenario?.config.demoLocations.find((l) => Math.abs(l.location.lat - sos.location.lat) < 0.006 && Math.abs(l.location.lng - sos.location.lng) < 0.006);
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
          {point ? `${point.id} · ${point.label.replace(/^Demo point /, '')}` : 'Demo area'}
          <span className="fl-mono fl-dim fl-small" style={{ display: 'block' }}>{sos.location.lat.toFixed(3)}, {sos.location.lng.toFixed(3)} · {sos.locationMode === 'browser-opt-in' ? 'approximate' : 'demo point'}</span>
        </dd>
        <dt>Received</dt><dd>{myt(sos.createdAt)} MYT</dd>
        <dt>Team</dt><dd>{sos.assignedTeam ?? 'Not assigned'}</dd>
        {sos.status !== 'pending' && (<><dt>Updated</dt><dd>{myt(sos.updatedAt)} MYT</dd></>)}
      </dl>

      {sos.status === 'pending' && (
        <div className="fl-stack" style={{ gap: 10 }}>
          <label className="fl-field">
            <span className="fl-label">Demo team</span>
            <select className="fl-input" value={team} onChange={(e) => setTeam(e.target.value)}>
              {scenario?.config.demoTeams.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <button type="button" className="fl-btn fl-btn-primary fl-btn-block" disabled={busy || !team} onClick={() => act({ status: 'assigned', assignedTeam: team })}>
            {busy ? 'Saving…' : 'Assign demo team'}
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
      {sos.status === 'resolved' && <div className="fl-note">Resolved by {sos.assignedTeam ?? 'the demo responder'}. The citizen view shows this now.</div>}
      {error && <div className="fl-error" role="alert">{error}</div>}
      <p className="fl-small fl-dim" style={{ margin: 0 }}>Assignments are fictional. No emergency service receives these requests.</p>
    </div>
  );
}
