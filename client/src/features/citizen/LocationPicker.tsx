// OWNER: D1. Demo-point picker plus opt-in browser location.
// Raw GPS stays in this component's state for the zone check only. It is never displayed or sent:
// the parent receives the nearest demo point (API_CONTRACT.md, privacy fix E1).
import { useState } from 'react';
import { Button } from '@/components/arc/button/button';
import { RadioCards } from '@/components/arc/radio-cards/radio-cards';
import type { DemoConfig, Incident, LatLng, LocationMode } from '../../shared/api.ts';
import { nearest, zoneAt } from './geo.ts';
import { ZONE, ZONE_SHORT } from './zone.ts';
import styles from './citizen.module.css';

type DemoLocation = DemoConfig['demoLocations'][number];

export type Chosen = { id: string; mode: LocationMode };

type Props = {
  incident: Incident;
  locations: DemoLocation[];
  chosen: Chosen | null;
  onChoose: (c: Chosen) => void;
};

type Gps = { state: 'idle' } | { state: 'asking' } | { state: 'denied'; reason: string } | { state: 'done'; hit: keyof typeof ZONE };

export function LocationPicker({ incident, locations, chosen, onChoose }: Props) {
  const [gps, setGps] = useState<Gps>({ state: 'idle' });

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
    <div className={styles.group}>
      <p className={styles.fieldLabel} id="where-label">
        Where are you?
      </p>
      <RadioCards
        aria-labelledby="where-label"
        layout="grid"
        minColumnWidth={96}
        value={chosen?.id ?? null}
        onValueChange={(id) => {
          setGps({ state: 'idle' });
          onChoose({ id, mode: 'manual-demo' });
        }}
        options={locations.map((l) => ({ value: l.id, label: l.id, description: ZONE_SHORT[zoneAt(l.location, incident.zones)] }))}
      />
      <div className={styles.zoneResult}>
        <Button variant="secondary" size="sm" loading={gps.state === 'asking'} onClick={useMyLocation}>
          Use my location
        </Button>
        <span className={styles.hint}>Checked on this device only, never sent.</span>
      </div>
      {(gps.state === 'denied' || gps.state === 'done') && (
        <p role="status" className={styles.status}>
          {gps.state === 'denied' ? `${gps.reason} Pick a point instead.` : `Your position: ${ZONE[gps.hit].text}`}
        </p>
      )}
    </div>
  );
}
