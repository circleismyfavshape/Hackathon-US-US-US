// 03 RecoveryGap: the same scarce stock, split four ways. Every number comes from the engine
// (POST /api/recovery/compare). Nothing is calculated in the browser except percentages for display.
import { useEffect, useState } from 'react';
import { api, type ComparisonResult, type Strategy } from '../shared/api.ts';
import { RESOURCE_LABEL, RESOURCES, useScenario } from './data.ts';
import { errText, Shell } from './ui.tsx';

const STRATEGIES: { id: Strategy; name: string; rule: string }[] = [
  { id: 'priority-first', name: 'Priority first', rule: 'Fill the highest-priority centre before the next.' },
  { id: 'proportional', name: 'Proportional', rule: 'Each centre gets stock in proportion to its request.' },
  { id: 'equal-share', name: 'Equal share', rule: 'Equal units to every centre that still needs them.' },
  { id: 'optimized', name: 'Optimized', rule: 'Raise the minimum share every centre gets, then by priority.' },
];

const sum = (q: Record<(typeof RESOURCES)[number], number>) => RESOURCES.reduce((n, r) => n + q[r], 0);

function served(r: ComparisonResult) {
  return r.allocations.map((a) => {
    const got = sum(a.allocated);
    const want = got + sum(a.unmet);
    return { id: a.centreId, pct: want ? Math.round((got / want) * 100) : 100 };
  });
}

export default function Recovery() {
  const { scenario, error } = useScenario();
  const [results, setResults] = useState<Partial<Record<Strategy, ComparisonResult>>>({});
  const [failed, setFailed] = useState<Partial<Record<Strategy, string>>>({});
  const [picked, setPicked] = useState<Strategy>('priority-first');
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'done' | 'off'; text?: string }>({ state: 'idle' });

  useEffect(() => {
    STRATEGIES.forEach(({ id }) =>
      api.compare(id).then(
        (r) => setResults((p) => ({ ...p, [id]: r })),
        (e) => setFailed((p) => ({ ...p, [id]: errText(e) })),
      ),
    );
  }, []);

  const rec = scenario?.recovery;
  const centres = rec?.centres ?? [];
  const centreName = (id: string) => centres.find((c) => c.id === id)?.name ?? `Centre ${id}`;
  const requested = (r: (typeof RESOURCES)[number]) => centres.reduce((n, c) => n + c.needs[r], 0);
  const totalShort = rec ? RESOURCES.reduce((n, r) => n + Math.max(0, requested(r) - rec.inventory[r]), 0) : 0;
  const sel = results[picked];

  async function explain() {
    setAi({ state: 'loading' });
    try {
      setAi({ state: 'done', text: (await api.explain()).text });
    } catch {
      setAi({ state: 'off' });
    }
  }

  return (
    <Shell path="/recovery">
      <main className="fl-page" style={{ paddingBottom: 64 }} id="recovery">
        <header className="fl-rhead">
          <p className="fl-label">03 RecoveryGap · fictional demand and stock</p>
          <h1 className="fl-h1">{totalShort ? `${totalShort} units short.` : 'Supply and demand.'} Who goes without?</h1>
          <p className="fl-dim" style={{ maxWidth: '62ch', margin: 0 }}>
            Three relief centres ask for more water, food and hygiene kits than the store holds. Compare four ways to split it. This is a planning comparison: nothing is dispatched and the stock never changes.
          </p>
        </header>

        {error && <div className="fl-error" role="alert">Scenario unavailable. {error}</div>}

        {rec && (
          <section className="fl-ledger" aria-label="Requested against stock">
            {RESOURCES.map((r) => {
              const want = requested(r);
              const have = rec.inventory[r];
              const short = Math.max(0, want - have);
              return (
                <div key={r}>
                  <span className="fl-label">{RESOURCE_LABEL[r]}</span>
                  <span className="fl-num">−{short}<small>short</small></span>
                  <div className="fl-bar" data-full={short === 0}><i style={{ width: `${want ? Math.min(100, (have / want) * 100) : 100}%` }} /></div>
                  <p className="fl-mono fl-small fl-dim" style={{ margin: '8px 0 0' }}>{have} in stock · {want} requested</p>
                </div>
              );
            })}
          </section>
        )}

        <div className="fl-rgrid">
          <section aria-label="Strategies">
            <div className="fl-between" style={{ marginBottom: 12 }}>
              <h2 className="fl-h2">Four ways to split it</h2>
              <span className="fl-label">Share of request met</span>
            </div>
            <table className="fl-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  {centres.map((c) => <th key={c.id}>{c.id}</th>)}
                  <th>Lowest</th>
                </tr>
              </thead>
              <tbody>
                {STRATEGIES.map((s) => {
                  const r = results[s.id];
                  const pct = r ? served(r) : null;
                  const low = pct ? Math.min(...pct.map((p) => p.pct)) : null;
                  return (
                    <tr key={s.id} aria-selected={picked === s.id} tabIndex={0} onClick={() => setPicked(s.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPicked(s.id))}>
                      <td>
                        <strong>{s.name}</strong>
                        <small className="fl-dim">{failed[s.id] ? `Unavailable. ${failed[s.id]}` : s.rule}</small>
                      </td>
                      {centres.map((c) => {
                        const p = pct?.find((x) => x.id === c.id)?.pct;
                        return <td key={c.id} className="fl-mono" data-low={p !== undefined && p === low && low < 60}>{p === undefined ? '·' : `${p}%`}</td>;
                      })}
                      <td className="fl-mono" data-low={low !== null && low < 60}>{low === null ? '·' : `${low}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="fl-small fl-dim" style={{ marginTop: 12 }}>
              Every strategy hands out all the scarce stock, so the total shortfall is the same. What changes is who carries it. Priority numbers are fictional and are not a triage judgement.
            </p>

            <div style={{ marginTop: 28 }}>
              <h3 className="fl-h3">What the engine reports</h3>
              {sel ? (
                <ol className="fl-explain fl-in" key={picked} style={{ marginTop: 8 }}>
                  {sel.explanation.map((line) => <li key={line}>{line}</li>)}
                </ol>
              ) : (
                <p className="fl-dim fl-small">{failed[picked] ?? 'Calculating…'}</p>
              )}
              {ai.state !== 'off' && (
                <div style={{ marginTop: 16 }}>
                  {ai.state === 'done' ? (
                    <div className="fl-note fl-in">
                      <span className="fl-label" style={{ display: 'block', marginBottom: 4 }}>AI summary of the engine's numbers</span>
                      {ai.text}
                    </div>
                  ) : (
                    <button type="button" className="fl-btn fl-btn-quiet fl-btn-sm" onClick={explain} disabled={ai.state === 'loading'}>
                      {ai.state === 'loading' ? 'Writing summary…' : 'Summarise the trade-offs'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <section aria-label="Allocation by centre">
            <div className="fl-between" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
              <h2 className="fl-h2">{STRATEGIES.find((s) => s.id === picked)?.name}</h2>
              <div className="fl-barkey">
                <span><i data-k="got" />Allocated</span>
                <span><i data-k="short" />Unmet</span>
              </div>
            </div>
            {sel ? (
              sel.allocations.map((a) => {
                const c = centres.find((x) => x.id === a.centreId);
                const got = sum(a.allocated);
                const want = got + sum(a.unmet);
                return (
                  <div className="fl-centre" key={a.centreId}>
                    <div className="fl-between">
                      <h3 className="fl-h3">{centreName(a.centreId)} {c && <span className="fl-label" style={{ marginLeft: 8 }}>Priority {c.priority}</span>}</h3>
                      <span className="fl-mono fl-small">{want ? Math.round((got / want) * 100) : 100}% met</span>
                    </div>
                    {RESOURCES.map((r) => {
                      const w = a.allocated[r] + a.unmet[r];
                      return (
                        <div className="fl-resrow" key={r}>
                          <span className="fl-dim">{RESOURCE_LABEL[r]}</span>
                          <div className="fl-bar" data-full={a.unmet[r] === 0}><i key={picked} style={{ width: `${w ? (a.allocated[r] / w) * 100 : 100}%` }} /></div>
                          <span className="fl-mono">{a.allocated[r]}/{w}{a.unmet[r] > 0 && <em>−{a.unmet[r]}</em>}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <p className="fl-empty">{failed[picked] ? `This strategy is unavailable. ${failed[picked]}` : 'Calculating…'}</p>
            )}
            {sel && <p className="fl-small fl-dim" style={{ marginTop: 12 }}>{sel.assumptions.join(' ')}</p>}
          </section>
        </div>
      </main>
    </Shell>
  );
}
