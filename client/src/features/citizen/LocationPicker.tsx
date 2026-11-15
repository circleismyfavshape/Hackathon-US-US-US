// OWNER: D1. Demo-point picker plus opt-in browser location.
// Raw GPS stays in this component's state for the zone check only. It is never displayed or sent:
// the parent receives the nearest demo point (API_CONTRACT.md, privacy fix E1).
import { useState } from 'react';
import type { DemoConfig, Incident, LatLng, LocationMode } from '../../shared/api.ts';
import { nearest, zoneAt, type ZoneHit } from './geo.ts';

type DemoLocation = DemoConfig['demoLocations'][number];

export type Chosen = { id: string; mode: LocationMode };

type Props = {
  incident: Incident;
  locations: DemoLocation[];
  chosen: Chosen | null;
  onChoose: (c: Chosen) => void;
};

const ZONE_TEXT: Record<ZoneHit, string> = {
  high: 'Inside the depicted high-impact zone (simulated).',
  moderate: 'Inside the depicted moderate-impact zone (simulated).',
  none: 'Outside the depicted zones. This does not mean it is safe.',
};

type Gps = { state: 'idle' } | { state: 'asking' } | { state: 'denied'; reason: string } | { state: 'done'; hit: ZoneHit };

export function LocationPicker({ incident, locations, chosen, onChoose }: Props) {
  const [gps, setGps] = useState<Gps>({ state: 'idle' });
  const picked = locations.find((l) => l.id === chosen?.id) ?? null;
  const demoHit = picked && chosen?.mode === 'manual-demo' ? zoneAt(picked.location, incident.zones) : null;

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setGps({ state: 'denied', reason: 'This browser has no location support.' });
      return;
    }
    setGps({ state: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const raw: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps({ state: 'done', hit: zoneAt(raw, incident.zones) });
        onChoose({ id: nearest(raw, locations).id, mode: 'browser-opt-in' });
      },
      (err) => setGps({ state: 'denied', reason: err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Your location could not be read.' }),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-900">Where are you?</legend>
      <div role="radiogroup" aria-label="Demo location" className="grid gap-2">
        {locations.map((l) => {
          const on = chosen?.mode === 'manual-demo' && chosen.id === l.id;
          return (
            <label key={l.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${on ? 'border-slate-900 bg-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
              <input type="radio" name="demo-location" className="mt-0.5" checked={on} onChange={() => { setGps({ state: 'idle' }); onChoose({ id: l.id, mode: 'manual-demo' }); }} />
              <span>
                <span className="font-medium">{l.id}</span> <span className="text-slate-600">{l.label}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm">
        <button type="button" onClick={useMyLocation} disabled={gps.state === 'asking'} className="rounded-md border border-slate-400 bg-white px-3 py-1.5 font-medium hover:bg-slate-100 disabled:opacity-60">
          {gps.state === 'asking' ? 'Waiting for permission…' : 'Use my location instead'}
        </button>
        <p className="mt-2 text-slate-600">Optional. Your browser asks first. Your real position is checked on this device only and is never sent. The request uses the nearest demo point.</p>
        <p role="status" className="mt-2 text-slate-800">
          {gps.state === 'denied' && `${gps.reason} Pick a demo location above.`}
          {gps.state === 'done' && `Your position: ${ZONE_TEXT[gps.hit]}`}
        </p>
      </div>

      <p role="status" className="text-sm text-slate-800">
        {picked
          ? chosen?.mode === 'browser-opt-in'
            ? `Request will be sent from demo point ${picked.id}, the nearest to you.`
            : `${picked.label}. ${ZONE_TEXT[demoHit ?? 'none']}`
          : 'Choose a location to enable sending.'}
      </p>
    </fieldset>
  );
}
