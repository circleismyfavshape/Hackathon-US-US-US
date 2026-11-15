// OWNER: D1. Schematic SVG map: no tiles, no network, cannot block the SOS flow.
import { useMemo } from 'react';
import type { DemoConfig, Incident, Shelter } from '../../shared/api.ts';
import { incidentPoints, projector } from './geo.ts';

type DemoLocation = DemoConfig['demoLocations'][number];

type Props = {
  incident: Incident;
  shelters: Shelter[];
  locations: DemoLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const ZONE_STYLE = {
  high: 'fill-red-500/30 stroke-red-700',
  moderate: 'fill-amber-400/30 stroke-amber-600',
} as const;

export function ScenarioMap({ incident, shelters, locations, selectedId, onSelect }: Props) {
  const pr = useMemo(
    () => projector(incidentPoints(incident, [...shelters.map((s) => s.location), ...locations.map((l) => l.location)])),
    [incident, shelters, locations],
  );
  const zones = [...incident.zones].sort((a) => (a.level === 'moderate' ? -1 : 1));

  return (
    <figure>
      <svg
        viewBox={`0 0 ${pr.width} ${pr.height}`}
        role="group"
        aria-label="Schematic map of the simulated flood. Illustrative zones, not a real basemap."
        className="w-full rounded-lg border border-slate-300 bg-slate-100"
      >
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" className="fill-none stroke-slate-200" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={pr.width} height={pr.height} fill="url(#grid)" />

        {zones.map((z) => (
          <polygon key={z.id} points={pr.ring(z.coordinates)} strokeWidth={2} strokeDasharray={z.level === 'moderate' ? '6 4' : undefined} className={ZONE_STYLE[z.level]}>
            <title>{z.label}</title>
          </polygon>
        ))}

        {shelters.map((s) => {
          const [x, y] = pr.xy(s.location);
          return (
            <g key={s.id}>
              <title>{`${s.name}. ${s.sourceLabel}`}</title>
              <rect x={x - 7} y={y - 7} width={14} height={14} className="fill-sky-600 stroke-white" strokeWidth={2} />
              <text x={x > pr.width / 2 ? x - 12 : x + 12} y={y + 5} textAnchor={x > pr.width / 2 ? 'end' : 'start'} className="fill-sky-900 text-[15px] font-medium">
                {s.name.replace(' (fictional)', '')}
              </text>
            </g>
          );
        })}

        {locations.map((l) => {
          const [x, y] = pr.xy(l.location);
          const on = l.id === selectedId;
          return (
            <g
              key={l.id}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`Use ${l.label}`}
              onClick={() => onSelect(l.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(l.id);
                }
              }}
              className="cursor-pointer outline-none focus-visible:[&>circle:first-of-type]:stroke-slate-900"
            >
              <circle cx={x} cy={y} r={14} className="fill-transparent stroke-transparent" strokeWidth={2} />
              <circle cx={x} cy={y} r={on ? 8 : 6} className={on ? 'fill-slate-900 stroke-white' : 'fill-white stroke-slate-700'} strokeWidth={2} />
              <text x={x > pr.width / 2 ? x - 14 : x + 14} y={y + 5} textAnchor={x > pr.width / 2 ? 'end' : 'start'} className={`text-[15px] ${on ? 'fill-slate-900 font-semibold' : 'fill-slate-600'}`}>
                {l.id}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-2 space-y-1 text-xs text-slate-600">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {incident.zones.map((z) => (
            <li key={z.id} className="flex items-center gap-1.5">
              <span aria-hidden className={`inline-block h-3 w-4 border-2 ${z.level === 'high' ? 'border-red-700 bg-red-500/30' : 'border-dashed border-amber-600 bg-amber-400/30'}`} />
              {z.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 bg-sky-600" />
            Fictional shelter
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-slate-700 bg-white" />
            Demo location (select to use)
          </li>
        </ul>
        <p>
          Schematic only. Zones are illustrative, not a measured flood footprint. Source: {incident.sourceLabel}. Areas outside the drawn zones are not verified safe.
        </p>
      </figcaption>
    </figure>
  );
}
