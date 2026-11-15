// Screen: Liveuamap-style live operations map. Ideas: World Map (dots + animated arcs), pulsing markers.
// Schematic only: a dotted canvas in demo coordinates, not a basemap. Data is the live demo API.
import { useMemo, useState } from 'react';
import type { LatLng, Sos } from '../shared/api.ts';
import { cn } from '../lib/utils.ts';
import { myt, STATUS_TONE, useLive } from './useLive.ts';

const VIEW = { minLng: 101.5, maxLng: 101.546, minLat: 3.056, maxLat: 3.0928 };
const GRID_LNG = [101.505, 101.51, 101.515, 101.52, 101.525, 101.53, 101.535, 101.54, 101.545];
const GRID_LAT = [3.06, 3.065, 3.07, 3.075, 3.08, 3.085, 3.09];
const W = 1000;
const H = 800;
const px = (p: LatLng) => ({ x: ((p.lng - VIEW.minLng) / (VIEW.maxLng - VIEW.minLng)) * W, y: (1 - (p.lat - VIEW.minLat) / (VIEW.maxLat - VIEW.minLat)) * H });
const inView = (p: LatLng) => p.lng >= VIEW.minLng && p.lng <= VIEW.maxLng && p.lat >= VIEW.minLat && p.lat <= VIEW.maxLat;
const dist2 = (a: LatLng, b: LatLng) => (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

export default function LiveMap() {
  const live = useLive(2000);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Sos['status']>('all');

  const sos = useMemo(() => live.sos.filter((s) => filter === 'all' || s.status === filter), [live.sos, filter]);
  const feed = useMemo(() => [...live.sos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [live.sos]);
  const offMap = live.sos.filter((s) => !inView(s.location)).length;
  const counts = { pending: 0, assigned: 0, resolved: 0 };
  live.sos.forEach((s) => counts[s.status]++);

  // Several demo SOS share one demo point; fan them out a little so each dot is clickable.
  const placed = useMemo(() => {
    const seen = new Map<string, number>();
    return sos.filter((s) => inView(s.location)).map((s) => {
      const k = `${s.location.lat},${s.location.lng}`;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      const p = px(s.location);
      const a = n * 2.4;
      return { s, x: p.x + (n ? Math.cos(a) * (20 + n * 6) : 0), y: p.y + (n ? Math.sin(a) * (20 + n * 6) : 0) };
    });
  }, [sos]);

  return (
    <div className="grid min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1fr_360px]">
      <div className="relative overflow-hidden border-b border-white/10 lg:border-b-0 lg:border-r">
        <div className="absolute left-4 top-4 z-10 max-w-sm rounded-xl border border-white/10 bg-slate-900/85 p-3 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-300">Live ops map · simulated</p>
          <p className="mt-1 text-lg font-semibold">{live.incident?.title ?? 'Loading scenario…'}</p>
          <p className="text-xs text-white/50">Schematic in demo coordinates. Zones are illustrative, not a measured flood footprint. Areas outside them are not verified safe.</p>
        </div>
        <div className="absolute right-4 top-4 z-10 flex gap-1 rounded-full border border-white/10 bg-slate-900/85 p-1 text-xs backdrop-blur">
          {(['all', 'pending', 'assigned', 'resolved'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn('rounded-full px-3 py-1 capitalize transition', filter === f ? 'bg-white text-slate-950' : 'text-white/70 hover:text-white')}
            >
              {f} {f !== 'all' && <span className="opacity-60">{counts[f]}</span>}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="h-full min-h-[480px] w-full" role="img" aria-label="Schematic live map of simulated incident, shelters and demo SOS requests">
          <defs>
            <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#ffffff" fillOpacity="0.09" />
            </pattern>
            <radialGradient id="vignette">
              <stop offset="0.75" stopColor="#020617" stopOpacity="0" />
              <stop offset="1" stopColor="#020617" stopOpacity="0.55" />
            </radialGradient>
            <radialGradient id="glow">
              <stop offset="0" stopColor="#f43f5e" stopOpacity="0.35" />
              <stop offset="1" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="#020617" />
          <rect width={W} height={H} fill="url(#dots)" />
          {GRID_LNG.map((lng) => {
            const x = px({ lat: VIEW.minLat, lng }).x;
            return (
              <g key={lng}>
                <line x1={x} x2={x} y1={0} y2={H} stroke="#38bdf8" strokeOpacity="0.07" />
                <text x={x + 4} y={H - 8} fontSize="11" fill="#64748b">{lng.toFixed(3)}°E</text>
              </g>
            );
          })}
          {GRID_LAT.map((lat) => {
            const y = px({ lat, lng: VIEW.minLng }).y;
            return (
              <g key={lat}>
                <line x1={0} x2={W} y1={y} y2={y} stroke="#38bdf8" strokeOpacity="0.07" />
                <text x={6} y={y - 4} fontSize="11" fill="#64748b">{lat.toFixed(3)}°N</text>
              </g>
            );
          })}
          {live.incident && (() => {
            const c = px(live.incident.location);
            return <circle cx={c.x} cy={c.y} r="260" fill="url(#glow)" />;
          })()}

          {live.incident?.zones.map((z) => {
            const pts = z.coordinates.map(([lng, lat]) => px({ lat, lng })).map((p) => `${p.x},${p.y}`).join(' ');
            const high = z.level === 'high';
            const top = z.coordinates.reduce((m, [lng, lat]) => (lat > m.lat ? { lat, lng } : m), { lat: -90, lng: 0 });
            const left = Math.min(...z.coordinates.map(([lng]) => lng));
            const lp = px({ lat: top.lat, lng: left });
            return (
              <g key={z.id}>
                <polygon points={pts} fill={high ? '#f43f5e' : '#f59e0b'} fillOpacity={high ? 0.22 : 0.08} stroke={high ? '#fb7185' : '#fbbf24'} strokeWidth="2" strokeDasharray={high ? undefined : '8 6'} />
                <text x={lp.x + 6} y={lp.y + 16} fontSize="12" fill={high ? '#fecdd3' : '#fde68a'} fillOpacity="0.85">
                  {high ? 'High-impact zone (illustrative)' : 'Moderate-impact zone (illustrative)'}
                </text>
              </g>
            );
          })}

          {live.incident && (() => {
            const c = px(live.incident.location);
            return (
              <g>
                <circle cx={c.x} cy={c.y} r="10" fill="none" stroke="#fb7185" className="fx-ping" />
                <text x={c.x} y={c.y - 18} textAnchor="middle" fontSize="15" fill="#fecdd3">⚠ SIMULATED flood</text>
              </g>
            );
          })()}

          {placed
            .filter(({ s }) => s.status === 'assigned')
            .map(({ s, x, y }) => {
              const near = [...live.shelters].sort((a, b) => dist2(a.location, s.location) - dist2(b.location, s.location))[0];
              if (!near || !inView(near.location)) return null;
              const t = px(near.location);
              const mx = (x + t.x) / 2;
              const my = Math.min(y, t.y) - 80;
              return <path key={`arc-${s.id}`} d={`M${x},${y} Q${mx},${my} ${t.x},${t.y}`} fill="none" stroke="#fbbf24" strokeOpacity="0.7" strokeWidth="2" className="fx-dash" />;
            })}

          {live.shelters.filter((s) => inView(s.location)).map((s) => {
            const p = px(s.location);
            return (
              <g key={s.id}>
                <rect x={p.x - 9} y={p.y - 9} width="18" height="18" rx="4" fill="#0ea5e9" stroke="#e0f2fe" strokeWidth="2" />
                <text x={p.x + 14} y={p.y + 5} fontSize="14" fill="#bae6fd">{s.name}</text>
              </g>
            );
          })}

          {placed.map(({ s, x, y }) => {
            const tone = STATUS_TONE[s.status];
            const on = selected === s.id;
            return (
              <g key={s.id} onClick={() => setSelected(s.id)} className="cursor-pointer">
                {s.status !== 'resolved' && <circle cx={x} cy={y} r="8" fill="none" stroke={tone.dot} strokeWidth="2.5" className="fx-ping" />}
                <circle cx={x} cy={y} r={on ? 12 : 9} fill={tone.dot} stroke={on ? '#fff' : '#020617'} strokeWidth="2.5" />
                {on && (
                  <text x={x + 16} y={y + 5} fontSize="14" fontWeight="600" fill="#fff">
                    {s.id} · {s.people}p
                  </text>
                )}
              </g>
            );
          })}
          <rect width={W} height={H} fill="url(#vignette)" pointerEvents="none" />
        </svg>

        <div className="absolute bottom-20 left-4 right-4 z-10 flex flex-wrap gap-3 rounded-xl border border-white/10 bg-slate-900/85 px-3 py-2 text-xs backdrop-blur">
          <Legend c="#f43f5e" t="Pending SOS" />
          <Legend c="#f59e0b" t="Assigned" />
          <Legend c="#34d399" t="Resolved" />
          <Legend c="#0ea5e9" t="Fictional shelter" square />
          <span className="text-white/50">Amber dashes: nearest demo shelter, not a route</span>
          {offMap > 0 && <span className="text-white/50">· {offMap} outside view</span>}
        </div>
      </div>

      <aside className="flex max-h-[calc(100vh-2.5rem)] flex-col overflow-hidden">
        <div className="border-b border-white/10 p-4">
          <p className="text-sm font-semibold">Event feed</p>
          <p className="text-xs text-white/50">
            {live.error ? `API error: ${live.error}` : live.syncedAt ? `Live · synced ${myt(live.syncedAt.toISOString())} MYT` : 'Connecting…'}
          </p>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-3">
          {feed.length === 0 && <li className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/50">No demo SOS yet. Send one from the citizen portal and it appears here within 2 s.</li>}
          {feed.map((s) => {
            const tone = STATUS_TONE[s.status];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={cn('fx-fade-up w-full rounded-xl border p-3 text-left transition', selected === s.id ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-white/70">{s.id}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] ring-1', tone.chip)}>{tone.label}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-white/85">{s.description}</p>
                  <p className="mt-1 text-[11px] text-white/45">
                    {s.type} · {s.people} {s.people === 1 ? 'person' : 'people'} · {s.assignedTeam ? `${s.assignedTeam} · ` : ''}updated {myt(s.updatedAt)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-white/10 p-3 text-[11px] text-white/40">Demo only. No emergency service receives these requests.</p>
      </aside>
    </div>
  );
}

function Legend({ c, t, square }: { c: string; t: string; square?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-white/75">
      <span className={square ? 'h-2.5 w-2.5 rounded-sm' : 'h-2.5 w-2.5 rounded-full'} style={{ background: c }} />
      {t}
    </span>
  );
}
