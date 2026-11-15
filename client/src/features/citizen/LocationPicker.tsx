// OWNER: D1. Demo-point picker plus opt-in browser location.
// Raw GPS stays in this component's state for the zone check only. It is never displayed or sent:
// the parent receives the nearest demo point (API_CONTRACT.md, privacy fix E1).
import { useState } from 'react';
import { Badge, type BadgeTone } from '@/components/arc/badge/badge';
import { Button } from '@/components/arc/button/button';
import { RadioCards } from '@/components/arc/radio-cards/radio-cards';
import type { DemoConfig, Incident, LatLng, LocationMode } from '../../shared/api.ts';
import { nearest, zoneAt, type ZoneHit } from './geo.ts';
import styles from './citizen.module.css';

type DemoLocation = DemoConfig['demoLocations'][number];

export type Chosen = { id: string; mode: LocationMode };

type Props = {
  incident: Incident;
  locations: DemoLocation[];
  chosen: Chosen | null;
  onChoose: (c: Chosen) => void;
};

const ZONE: Record<ZoneHit, { label: string; tone: BadgeTone; text: string }> = {
  high: { label: 'High-impact zone', tone: 'danger', text: 'Inside the depicted high-impact zone (simulated).' },
  moderate: { label: 'Moderate-impact zone', tone: 'warning', text: 'Inside the depicted moderate-impact zone (simulated).' },
  none: { label: 'Outside drawn zones', tone: 'neutral', text: 'Outside the depicted zones. This does not mean it is safe.' },
};

type Gps = { state: 'idle' } | { state: 'asking' } | { state: 'denied'; reason: string } | { state: 'done'; hit: ZoneHit };

export function LocationPicker({ incident, locations, chosen, onChoose }: Props) {
  const [gps, setGps] = useState<Gps>({ state: 'idle' });
  const picked = locations.find((l) => l.id === chosen?.id) ?? null;

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

  const hit = picked ? ZONE[zoneAt(picked.location, incident.zones)] : null;

  return (
    <div className={styles.group}>
      <h3 className={styles.stepTitle} id="where-title">
        Where are you?
      </h3>
      <RadioCards
        aria-labelledby="where-title"
        layout="list"
        value={chosen?.id ?? null}
        onValueChange={(id) => {
          setGps({ state: 'idle' });
          onChoose({ id, mode: 'manual-demo' });
        }}
        options={locations.map((l) => ({ value: l.id, label: l.label, meta: l.id }))}
      />

      <div className={styles.group} style={{ gap: 8 }}>
        <div>
          <Button variant="secondary" loading={gps.state === 'asking'} onClick={useMyLocation}>
            Use my location instead
          </Button>
        </div>
        <p className={styles.hint}>Optional. Your browser asks first. Your real position is checked on this device only and never sent. The request uses the nearest demo point.</p>
        {(gps.state === 'denied' || gps.state === 'done') && (
          <p role="status" className={styles.status}>
            {gps.state === 'denied' ? `${gps.reason} Pick a demo location above.` : `Your position: ${ZONE[gps.hit].text}`}
          </p>
        )}
      </div>

      <div role="status" className={styles.zoneResult}>
        {hit && picked ? (
          <>
            <Badge tone={hit.tone}>{hit.label}</Badge>
            <p className={styles.status}>{chosen?.mode === 'browser-opt-in' ? `Your request will be sent from demo point ${picked.id}, the nearest to you.` : hit.text}</p>
          </>
        ) : (
          <p className={styles.hint}>Choose a location on the map or from the list.</p>
        )}
      </div>
    </div>
  );
}
