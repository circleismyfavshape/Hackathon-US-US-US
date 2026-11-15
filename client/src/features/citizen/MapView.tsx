// OWNER: D1. Full-viewport mapcn (MapLibre) map: depicted zones, fictional shelters, selectable demo points, live request dots.
// Failure ladder, so the map can never block the SOS flow:
//   CARTO basemap unreachable -> mapcn tile-less `blank` mode (zones and points still draw)
//   WebGL unavailable         -> error boundary message; the location list and form keep working
import { Component, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { House } from 'lucide-react';
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip } from '@/components/ui/map';
import type { DemoConfig, Incident, Shelter } from '../../shared/api.ts';
import { boundsOf, bucketByLocation, countByStatus, zonesGeoJson } from './geo.ts';
import type { Live } from './useLiveSos.ts';
import { ZONE_SHORT } from './zone.ts';
import styles from './citizen.module.css';

type DemoLocation = DemoConfig['demoLocations'][number];

type Props = {
  incident: Incident;
  shelters: Shelter[];
  locations: DemoLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  live: Live;
  ownId: string | null;
  reachable: boolean | null;
};

const MAX_DOTS = 8;

// CARTO Voyager without labels: soft land, parks and water for orientation, no street names competing with the pins.
const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json';
const STYLES = { light: BASEMAP_STYLE, dark: BASEMAP_STYLE };

export function useBasemapReachable(): boolean | null {
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

const isWide = () => window.matchMedia('(min-width: 1024px)').matches;
/** Keep the depicted area clear of the panels: the rail on desktop, the top bar and sheet peek on phones. */
function fitPadding() {
  return isWide() ? { top: 72, bottom: 112, left: 440, right: 96 } : { top: 120, bottom: 128, left: 48, right: 48 };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export function MapView({ incident, shelters, locations, selectedId, onSelect, live, ownId, reachable }: Props) {
  const high = useMemo(() => zonesGeoJson(incident.zones.filter((z) => z.level === 'high')), [incident.zones]);
  const moderate = useMemo(() => zonesGeoJson(incident.zones.filter((z) => z.level === 'moderate')), [incident.zones]);
  const bounds = useMemo(
    () => boundsOf([incident.location, ...incident.zones.flatMap((z) => z.coordinates.map(([lng, lat]) => ({ lat, lng }))), ...shelters.map((s) => s.location), ...locations.map((l) => l.location)]),
    [incident, shelters, locations],
  );
  const padding = useMemo(fitPadding, []);
  const wide = useMemo(isWide, []);
  const buckets = useMemo(() => bucketByLocation(live.requests, locations), [live.requests, locations]);
  const paint = useMemo(() => {
    const danger = tokenColor('--danger');
    const warning = tokenColor('--warning');
    return {
      high: { fill: { 'fill-color': danger, 'fill-opacity': 0.28 }, line: { 'line-color': danger, 'line-width': 2.5 } },
      moderate: { fill: { 'fill-color': warning, 'fill-opacity': 0.14 }, line: { 'line-color': warning, 'line-width': 1.75, 'line-dasharray': [3, 2] } },
    };
  }, []);
  const tags = useMemo(
    () =>
      incident.zones.map((z) => {
        const [[west], [east, north]] = boundsOf(z.coordinates.map(([lng, lat]) => ({ lat, lng })));
        return { id: z.id, level: z.level, lng: (west + east) / 2, lat: north };
      }),
    [incident.zones],
  );

  return (
    <div className={styles.map} role="group" aria-label="Map of the simulated flood with illustrative zones. Not an official map.">
      {reachable === null ? (
        <div role="status" className={styles.mapFallback}>
          Loading map…
        </div>
      ) : (
        <MapBoundary>
          <Map theme="light" styles={reachable ? STYLES : undefined} blank={!reachable} bounds={bounds} fitBoundsOptions={{ padding, maxZoom: 14 }}>
            <MapGeoJSON id="zones-moderate" data={moderate} fillPaint={paint.moderate.fill} linePaint={paint.moderate.line} />
            <MapGeoJSON id="zones-high" data={high} fillPaint={paint.high.fill} linePaint={paint.high.line} />

            {tags.map((t) => (
              <MapMarker key={t.id} longitude={t.lng} latitude={t.lat} anchor="bottom">
                <MarkerContent>
                  <span className={styles.zoneTag}>{ZONE_SHORT[t.level]}</span>
                </MarkerContent>
              </MapMarker>
            ))}

            {shelters.map((s) => (
              <MapMarker key={s.id} longitude={s.location.lng} latitude={s.location.lat}>
                <MarkerContent>
                  <span className={styles.shelterPin} role="img" aria-label={`${s.name}. ${s.sourceLabel}`}>
                    <House size={16} aria-hidden />
                  </span>
                </MarkerContent>
                <MarkerTooltip>
                  <div className={styles.tip}>
                    <span className={styles.tipTitle}>{s.name.replace(' (fictional)', '')}</span>
                  </div>
                </MarkerTooltip>
                <MarkerPopup closeButton>
                  <div className={styles.tip}>
                    <span className={styles.tipTitle}>{s.name}</span>
                    <span className={styles.tipMuted}>{s.sourceLabel}. No route is suggested.</span>
                  </div>
                </MarkerPopup>
              </MapMarker>
            ))}

            {locations.map((l) => {
              const here = buckets.get(l.id) ?? [];
              const shown = here.slice(0, MAX_DOTS);
              const c = countByStatus(here);
              return (
                <MapMarker key={l.id} longitude={l.location.lng} latitude={l.location.lat}>
                  <MarkerContent>
                    <button
                      type="button"
                      className={styles.pin}
                      aria-pressed={l.id === selectedId}
                      aria-label={`Use ${l.label} (${l.id})${here.length ? `. ${plural(here.length, 'help request')} here` : ''}`}
                      onClick={() => onSelect(l.id)}
                    >
                      {l.id}
                    </button>
                    <span className={styles.cluster} aria-hidden>
                      {shown.map((r, i) => (
                        <span key={r.id} className={`${styles.dot} ${styles[r.status]} ${r.id === ownId ? styles.own : ''}`} style={{ '--a': `${-90 + (i * 360) / shown.length}deg` } as CSSProperties} />
                      ))}
                      {here.length > MAX_DOTS && <span className={styles.more}>+{here.length - MAX_DOTS}</span>}
                    </span>
                  </MarkerContent>
                  <MarkerTooltip offset={[0, -20]}>
                    <div className={styles.tip}>
                      <span className={styles.tipTitle}>{l.label}</span>
                      <span className={styles.tipMuted}>{here.length ? `${c.pending} pending, ${c.assigned} assigned, ${c.resolved} resolved` : 'No requests here'}</span>
                    </div>
                  </MarkerTooltip>
                </MapMarker>
              );
            })}

            {wide && <MapControls position="top-right" showZoom />}
          </Map>
        </MapBoundary>
      )}
    </div>
  );
}
