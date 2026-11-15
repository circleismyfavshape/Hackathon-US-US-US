// Screen: command-centre bento dashboard. Ideas: Bento Grid, Card Spotlight, Glowing Effect, animated counters, Aurora.
import type { Resource } from '../shared/api.ts';
import { cn } from '../lib/utils.ts';
import { Counter, SpotlightCard } from './effects.tsx';
import { myt, STATUS_TONE, useLive } from './useLive.ts';

const RESOURCES: Resource[] = ['water', 'food', 'hygiene'];

export default function Command() {
  const live = useLive();
  const c = { pending: 0, assigned: 0, resolved: 0 };
  live.sos.forEach((s) => c[s.status]++);
  const people = live.sos.filter((s) => s.status !== 'resolved').reduce((n, s) => n + s.people, 0);
  const latest = [...live.sos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  const rec = live.recovery;
  const need = (r: Resource) => rec?.centres.reduce((n, x) => n + x.needs[r], 0) ?? 0;

  return (
    <section className="relative isolate overflow-hidden px-4 pt-14">
      <div className="fx-aurora pointer-events-none absolute -inset-10 -z-10" />
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-300">Command centre · simulated</p>
        <h1 className="mt-2 text-3xl font-bold md:text-5xl">Everything open, at a glance</h1>
        <p className="mt-2 text-white/60">Live from the demo backend {live.syncedAt ? `· synced ${myt(live.syncedAt.toISOString())} MYT` : ''}</p>

        <div className="mt-8 grid auto-rows-[minmax(150px,auto)] gap-4 md:grid-cols-4">
          <div className="fx-moving-border rounded-2xl md:col-span-2 md:row-span-2">
            <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950 p-6">
              <div>
                <p className="text-sm text-white/50">Open demo requests</p>
                <Counter value={c.pending + c.assigned} className="mt-2 block text-7xl font-bold tabular-nums" />
                <p className="mt-1 text-white/60">
                  <Counter value={people} /> people reported waiting
                </p>
              </div>
              <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/10">
                {(['pending', 'assigned', 'resolved'] as const).map((k) => (
                  <div key={k} className="fx-grow h-full transition-all duration-700" style={{ width: `${live.sos.length ? (c[k] / live.sos.length) * 100 : 0}%`, background: STATUS_TONE[k].dot }} />
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-white/60">
                {(['pending', 'assigned', 'resolved'] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_TONE[k].dot }} />
                    {STATUS_TONE[k].label} <b className="text-white">{c[k]}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {(['pending', 'assigned'] as const).map((k) => (
            <SpotlightCard key={k} color={k === 'pending' ? 'rgba(244,63,94,0.25)' : 'rgba(245,158,11,0.25)'}>
              <p className="text-sm text-white/50">{STATUS_TONE[k].label}</p>
              <Counter value={c[k]} className="mt-2 block text-5xl font-bold tabular-nums" />
              <p className="mt-2 text-xs text-white/40">{k === 'pending' ? 'Waiting for a demo team' : 'Demo team on the way'}</p>
            </SpotlightCard>
          ))}

          <SpotlightCard className="md:col-span-2" color="rgba(56,189,248,0.2)">
            <p className="text-sm text-white/50">Latest activity</p>
            <ul className="mt-3 space-y-2">
              {latest.length === 0 && <li className="text-sm text-white/40">No demo SOS yet.</li>}
              {latest.map((s) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_TONE[s.status].dot }} />
                  <span className="font-mono text-xs text-white/60">{s.id}</span>
                  <span className="truncate text-white/80">{s.description}</span>
                  <span className="ml-auto shrink-0 text-xs text-white/40">{myt(s.updatedAt)}</span>
                </li>
              ))}
            </ul>
          </SpotlightCard>

          <SpotlightCard className="md:col-span-2" color="rgba(251,191,36,0.2)">
            <p className="text-sm text-white/50">RecoveryGap · requested vs stock (fictional units)</p>
            <div className="mt-4 space-y-3">
              {RESOURCES.map((r) => {
                const n = need(r);
                const have = rec?.inventory[r] ?? 0;
                const pct = n ? Math.min(100, (have / n) * 100) : 0;
                return (
                  <div key={r}>
                    <div className="flex justify-between text-xs">
                      <span className="capitalize text-white/80">{r}</span>
                      <span className="text-white/50">
                        {have} of {n} · <span className={cn(n > have ? 'text-rose-300' : 'text-emerald-300')}>{n > have ? `${n - have} short` : 'covered'}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="fx-grow h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SpotlightCard>

          <SpotlightCard className="md:col-span-2" color="rgba(167,139,250,0.2)">
            <p className="text-sm text-white/50">Shortcuts</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {[
                ['/showcase/map', 'Live map'],
                ['/responder', 'Control room'],
                ['/showcase/recovery', 'Compare allocations'],
                ['/citizen', 'Citizen view'],
              ].map(([h, t]) => (
                <a key={h} href={h} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10">
                  {t} →
                </a>
              ))}
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
