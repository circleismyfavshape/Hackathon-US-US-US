// Screen: RecoveryGap strategy comparison. Ideas: Focus Cards, animated bars, Text Generate, Stateful Button.
// Every number comes from POST /api/recovery/compare (D4's engine); nothing is computed here.
import { useEffect, useState } from 'react';
import { api, type ComparisonResult, type Resource, type Strategy } from '../shared/api.ts';
import { cn } from '../lib/utils.ts';
import { TextGenerate } from './effects.tsx';
import { useLive } from './useLive.ts';

const STRATS: { id: Strategy; name: string; blurb: string }[] = [
  { id: 'priority-first', name: 'Priority first', blurb: 'Fill the highest-priority centre first.' },
  { id: 'proportional', name: 'Proportional', blurb: 'Share stock in proportion to each request.' },
  { id: 'equal-share', name: 'Equal share', blurb: 'Equal units to every centre still in need.' },
  { id: 'optimized', name: 'Optimized', blurb: 'Raise the minimum share everyone gets, then priority.' },
];
const RES: Resource[] = ['water', 'food', 'hygiene'];
const RES_COLOR: Record<Resource, string> = { water: '#38bdf8', food: '#f59e0b', hygiene: '#a78bfa' };

export default function Recovery() {
  const live = useLive(10000);
  const [results, setResults] = useState<Partial<Record<Strategy, ComparisonResult>>>({});
  const [errors, setErrors] = useState<Partial<Record<Strategy, string>>>({});
  const [hover, setHover] = useState<Strategy | null>(null);
  const [picked, setPicked] = useState<Strategy>('proportional');
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'done' | 'off'; text?: string }>({ state: 'idle' });

  useEffect(() => {
    STRATS.forEach(({ id }) =>
      api.compare(id).then(
        (r) => setResults((p) => ({ ...p, [id]: r })),
        (e: Error) => setErrors((p) => ({ ...p, [id]: e.message })),
      ),
    );
  }, []);

  const centres = live.recovery?.centres ?? [];
  const name = (id: string) => centres.find((c) => c.id === id)?.name ?? id;
  const sel = results[picked];

  async function explain() {
    setAi({ state: 'loading' });
    try {
      const r = await api.explain();
      setAi({ state: 'done', text: r.text });
    } catch {
      setAi({ state: 'off' });
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pt-14">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">RecoveryGap · fictional demand and stock</p>
      <h1 className="mt-2 text-3xl font-bold md:text-5xl">Not enough for everyone. Who goes short?</h1>
      <p className="mt-3 max-w-2xl text-white/60">Four ways to split the same water, food and hygiene kits between three relief centres. Planning comparison only: nothing is dispatched and the stock never changes.</p>

      <div className="mt-8 grid gap-3 md:grid-cols-4" onMouseLeave={() => setHover(null)}>
        {STRATS.map((s) => {
          const r = results[s.id];
          // Every strategy spends all scarce stock, so total unmet is the same; the worst-off centre differs.
          const worst = r
            ? r.allocations
                .map((a) => {
                  const got = RES.reduce((n, k) => n + a.allocated[k], 0);
                  const want = got + RES.reduce((n, k) => n + a.unmet[k], 0);
                  return { id: a.centreId, pct: want ? Math.round((got / want) * 100) : 100 };
                })
                .sort((a, b) => a.pct - b.pct)[0]
            : null;
          const dim = hover !== null && hover !== s.id;
          return (
            <button
              key={s.id}
              type="button"
              onMouseEnter={() => setHover(s.id)}
              onClick={() => setPicked(s.id)}
              className={cn(
                'rounded-2xl border p-4 text-left transition duration-300',
                picked === s.id ? 'border-amber-300/60 bg-amber-400/10' : 'border-white/10 bg-white/[0.03]',
                dim && 'scale-[0.98] opacity-50 blur-[1px]',
              )}
            >
              <p className="font-semibold">{s.name}</p>
              <p className="mt-1 text-xs text-white/50">{s.blurb}</p>
              <div className="mt-4 flex h-16 items-end gap-1.5">
                {r
                  ? r.allocations.map((a) => {
                      const got = RES.reduce((n, k) => n + a.allocated[k], 0);
                      const want = got + RES.reduce((n, k) => n + a.unmet[k], 0);
                      return (
                        <div key={a.centreId} className="flex flex-1 flex-col items-center gap-1">
                          <div className="relative w-full overflow-hidden rounded-md bg-white/10" style={{ height: 48 }}>
                            <div className="fx-grow absolute bottom-0 w-full bg-gradient-to-t from-amber-500 to-amber-300" style={{ height: `${want ? (got / want) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[10px] text-white/50">{a.centreId}</span>
                        </div>
                      );
                    })
                  : <p className="text-xs text-white/40">{errors[s.id] ? `Unavailable: ${errors[s.id]}` : 'Calculating…'}</p>}
              </div>
              {worst && (
                <p className="mt-3 text-xs text-white/60">
                  Worst off: centre {worst.id} gets <b className={worst.pct < 30 ? 'text-rose-300' : 'text-amber-200'}>{worst.pct}%</b> of its request
                </p>
              )}
            </button>
          );
        })}
      </div>

      {sel && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-white/60">{STRATS.find((s) => s.id === picked)?.name}: allocated vs requested</p>
            <div className="mt-5 space-y-6">
              {sel.allocations.map((a) => (
                <div key={a.centreId}>
                  <p className="text-sm font-medium">{name(a.centreId)}</p>
                  <div className="mt-2 space-y-1.5">
                    {RES.map((k) => {
                      const want = a.allocated[k] + a.unmet[k];
                      return (
                        <div key={k} className="flex items-center gap-3 text-xs">
                          <span className="w-14 capitalize text-white/60">{k}</span>
                          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-rose-500/20">
                            <div key={`${picked}-${k}`} className="fx-grow h-full rounded-full" style={{ width: `${want ? (a.allocated[k] / want) * 100 : 100}%`, background: RES_COLOR[k] }} />
                          </div>
                          <span className="w-24 text-right tabular-nums text-white/70">
                            {a.allocated[k]}/{want} {a.unmet[k] > 0 && <span className="text-rose-300">−{a.unmet[k]}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-sm text-white/60">What the engine says</p>
              <div key={picked} className="mt-3 space-y-2">
                {sel.explanation.map((line) => (
                  <TextGenerate key={line} text={line} className="text-sm text-white/80" />
                ))}
              </div>
              <p className="mt-4 text-[11px] text-white/40">{sel.assumptions.join(' ')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-sm text-white/60">AI trade-off summary (optional)</p>
              {ai.state === 'done' ? (
                <>
                  <TextGenerate text={ai.text ?? ''} className="mt-3 text-sm text-white/80" />
                  <p className="mt-2 text-[11px] text-white/40">AI-written from the engine’s numbers. A human coordinator decides.</p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={explain}
                  disabled={ai.state === 'loading'}
                  className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition disabled:opacity-60"
                >
                  {ai.state === 'loading' ? 'Asking Claude…' : ai.state === 'off' ? 'AI not configured on this server' : 'Explain the trade-offs'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
