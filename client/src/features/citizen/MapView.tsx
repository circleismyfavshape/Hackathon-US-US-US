// OWNER: D1. mapcn (MapLibre) map of the simulated incident: depicted zones, fictional shelters, selectable demo points.
// Failure ladder, so the map can never block the SOS flow:
//   CARTO basemap unreachable -> mapcn tile-less `blank` mode (zones and points still draw)
//   WebGL unavailable         -> error boundary message; the location list and form keep working
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerLabel } from '@/components/ui/map';
import type { DemoConfig, Incident, Shelter } from '../../shared/api.ts';
import { boundsOf, zonesGeoJson } from './geo.ts';
import styles from './citizen.module.css';

type DemoLocation = DemoConfig['demoLocations'][number];

type Props = {
  incident: Incident;
  shelters: Shelter[];
  locations: DemoLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

// CARTO Positron without labels: roads and water for orientation, no street names competing with the pins.
const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';
const STYLES = { light: BASEMAP_STYLE, dark: BASEMAP_STYLE };

function useBasemapReachable(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    fetch(BASEMAP_STYLE, { signal: ctl.signal })
      .then((r) => setOk(r.ok), () => setOk(false))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, []);
  return ok;
}

/** MapLibre paints cannot read CSS variables or oklch, so resolve an Arc token to rgb() through a canvas. */
function tokenColor(name: string): string {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return 'rgb(128,128,128)';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="status" className={styles.mapFallback}>
        The map could not start on this device. You can still choose a location from the list and send your request.
      </div>
    ) : (
      this.props.children
    );
  }
}

export function MapView({ incident, shelters, locations, selectedId, onSelect }: Props) {
  const reachable = useBasemapReachable();
  const zones = useMemo(() => zonesGeoJson(incident.zones), [incident.zones]);
  const bounds = useMemo(
    () => boundsOf([incident.location, ...incident.zones.flatMap((z) => z.coordinates.map(([lng, lat]) => ({ lat, lng }))), ...shelters.map((s) => s.location), ...locations.map((l) => l.location)]),
    [incident, shelters, locations],
  );
  const paint = useMemo(() => {
    const byLevel = (high: string | number, moderate: string | number) => ['match', ['get', 'level'], 'high', high, moderate] as never;
    const danger = tokenColor('--danger');
    const warning = tokenColor('--warning');
    return {
      fill: { 'fill-color': byLevel(danger, warning), 'fill-opacity': byLevel(0.3, 0.16) },
      line: { 'line-color': byLevel(danger, warning), 'line-width': byLevel(2.5, 1.5) },
    };
  }, []);

  return (
    <figure style={{ margin: 0 }}>
      <div className={styles.mapFrame} role="group" aria-label="Map of the simulated flood with illustrative zones. Not an official map.">
        {reachable === null ? (
          <div role="status" className={styles.mapFallback}>
            Loading map…
          </div>
        ) : (
          <>
            <p className={styles.mapHint}>Select a point to set your location</p>
            <MapBoundary>
              <Map theme="light" styles={reachable ? STYLES : undefined} blank={!reachable} bounds={bounds} fitBoundsOptions={{ padding: { top: 64, bottom: 48, left: 72, right: 72 }, maxZoom: 14 }} cooperativeGestures>
                <MapGeoJSON data={zones} fillPaint={paint.fill} linePaint={paint.line} />

                {shelters.map((s) => (
                  <MapMarker key={s.id} longitude={s.location.lng} latitude={s.location.lat}>
                    <MarkerContent>
                      <span className={styles.shelterPin} role="img" aria-label={`${s.name}. ${s.sourceLabel}`} />
                      <MarkerLabel position="bottom" className={`text-xs ${styles.halo}`}>
                        {s.name.replace(' (fictional)', '')}
                      </MarkerLabel>
                    </MarkerContent>
                  </MapMarker>
                ))}

                {locations.map((l) => (
                  <MapMarker key={l.id} longitude={l.location.lng} latitude={l.location.lat}>
                    <MarkerContent>
                      <button type="button" className={styles.pin} aria-pressed={l.id === selectedId} aria-label={`Use ${l.label} (${l.id})`} onClick={() => onSelect(l.id)}>
                        {l.id}
                      </button>
                    </MarkerContent>
                  </MapMarker>
                ))}

                <MapControls position="top-right" showZoom />
              </Map>
            </MapBoundary>
          </>
        )}
      </div>

      <ul className={styles.legend} aria-label="Map legend">
        {incident.zones.map((z) => (
          <li key={z.id}>
            <span aria-hidden className={`${styles.swatch} ${z.level === 'high' ? styles.swatchHigh : styles.swatchModerate}`} />
            {z.label}
          </li>
        ))}
        <li>
          <span aria-hidden className={`${styles.swatch} ${styles.swatchShelter}`} />
          Fictional shelter
        </li>
      </ul>
      <p className={styles.caption} role={reachable === false ? 'status' : undefined}>
        {reachable === false && 'Basemap unavailable, showing zones and points only. '}
        Zones are illustrative, not a measured flood footprint. Areas outside them are not verified safe.
      </p>
    </figure>
  );
}
