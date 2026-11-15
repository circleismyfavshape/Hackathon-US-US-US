// One map for every interface, built on the team's mapcn (MapLibre) component and D1's geometry helpers.
// Citizen: demo points are selectable. Responder: each request is a selectable dot.
// Failure ladder: basemap unreachable -> tile-less canvas (zones and points still draw);
// WebGL unavailable -> message, and the side panels keep working.
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { House } from 'lucide-react';
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerTooltip } from '@/components/ui/map';
import { boundsOf, bucketByLocation, countByStatus, zonesGeoJson } from '../features/citizen/geo.ts';
import type { DemoConfig, Incident, Shelter, Sos } from '../shared/api.ts';
import { STATUS_COLOR, STATUS_LABEL } from './ui.tsx';

const BASEMAP = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const STYLES = { light: BASEMAP, dark: BASEMAP };

function useBasemap(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    fetch(BASEMAP, { signal: ctl.signal })
      .then((r) => setOk(r.ok), () => setOk(false))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, []);
  return ok;
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="fl-map-fallback">The map could not start on this device. Everything else on this page still works.</div> : this.props.children;
  }
}

type Props = {
  incident: Incident;
  shelters: Shelter[];
  locations: DemoConfig['demoLocations'];
  requests: Pick<Sos, 'id' | 'status' | 'location'>[];
  mode: 'citizen' | 'responder';
  selectedLocation?: string | null;
  onSelectLocation?: (id: string) => void;
  selectedRequest?: string | null;
  onSelectRequest?: (id: string) => void;
};

const PAINT = {
  high: { fill: { 'fill-color': '#ff4d1c', 'fill-opacity': 0.16 }, line: { 'line-color': '#e23f12', 'line-width': 2 } },
  moderate: { fill: { 'fill-color': '#9a6300', 'fill-opacity': 0.07 }, line: { 'line-color': '#9a6300', 'line-width': 1.5, 'line-dasharray': [3, 2] } },
};
const ZONE_TAG = { high: 'High impact · illustrative', moderate: 'Moderate impact · illustrative' } as const;

export function FlareMap({ incident, shelters, locations, requests, mode, selectedLocation, onSelectLocation, selectedRequest, onSelectRequest }: Props) {
  const reachable = useBasemap();
  const high = useMemo(() => zonesGeoJson(incident.zones.filter((z) => z.level === 'high')), [incident.zones]);
  const moderate = useMemo(() => zonesGeoJson(incident.zones.filter((z) => z.level === 'moderate')), [incident.zones]);
  const bounds = useMemo(
    () => boundsOf([...incident.zones.flatMap((z) => z.coordinates.map(([lng, lat]) => ({ lat, lng }))), ...shelters.map((s) => s.location), ...locations.map((l) => l.location)]),
    [incident, shelters, locations],
  );
  const tags = useMemo(
    () =>
      incident.zones.map((z) => {
        const [[west], [east, north]] = boundsOf(z.coordinates.map(([lng, lat]) => ({ lat, lng })));
        return { id: z.id, level: z.level, lng: (west + east) / 2, lat: north };
      }),
    [incident.zones],
  );
  const buckets = useMemo(() => bucketByLocation(requests, locations), [requests, locations]);
  const wide = useMemo(() => window.matchMedia('(min-width: 861px)').matches, []);

  if (reachable === null) return <div className="fl-map-fallback">Loading map…</div>;
  return (
    <div className="fl-map" role="group" aria-label="Map of the simulated flood. Zones are illustrative, not an official map.">
      <Boundary>
        <Map theme="light" styles={reachable ? STYLES : undefined} blank={!reachable} bounds={bounds} fitBoundsOptions={{ padding: wide ? 90 : 44, maxZoom: 14.5 }}>
          <MapGeoJSON id="fl-zone-moderate" data={moderate} fillPaint={PAINT.moderate.fill} linePaint={PAINT.moderate.line} />
          <MapGeoJSON id="fl-zone-high" data={high} fillPaint={PAINT.high.fill} linePaint={PAINT.high.line} />

          {tags.map((t) => (
            <MapMarker key={t.id} longitude={t.lng} latitude={t.lat} anchor="bottom">
              <MarkerContent>
                <span className="fl-zonetag" data-l={t.level}>
                  {ZONE_TAG[t.level]}
                </span>
              </MarkerContent>
            </MapMarker>
          ))}

          {shelters.map((s) => (
            <MapMarker key={s.id} longitude={s.location.lng} latitude={s.location.lat}>
              <MarkerContent>
                <span className="fl-shelter" role="img" aria-label={s.name}>
                  <House size={13} aria-hidden />
                </span>
              </MarkerContent>
              <MarkerTooltip>
                <div className="fl-tip">
                  {s.name.replace(' (fictional)', '')}
                  <small>Fictional shelter. No route is suggested.</small>
                </div>
              </MarkerTooltip>
            </MapMarker>
          ))}

          {locations.map((l) => {
            const here = buckets.get(l.id) ?? [];
            const c = countByStatus(here);
            const select = mode === 'citizen' && onSelectLocation;
            return (
              <MapMarker key={l.id} longitude={l.location.lng} latitude={l.location.lat} anchor={mode === 'responder' ? 'top' : 'center'} offset={mode === 'responder' ? [0, 14] : undefined}>
                <MarkerContent>
                  <div style={{ position: 'relative' }}>
                    {select ? (
                      <button type="button" className="fl-pin" aria-pressed={l.id === selectedLocation} aria-label={`Use ${l.label} (${l.id})`} onClick={() => onSelectLocation(l.id)}>
                        {l.id}
                      </button>
                    ) : (
                      <span className="fl-pin" data-static>
                        {l.id}
                      </span>
                    )}
                    {mode === 'citizen' && here.length > 0 && (
                      <span className="fl-pincount" aria-hidden>
                        {(['pending', 'assigned', 'resolved'] as const).map((k) => c[k] > 0 && <b key={k} style={{ '--c': STATUS_COLOR[k] } as React.CSSProperties}>{c[k]}</b>)}
                      </span>
                    )}
                  </div>
                </MarkerContent>
                <MarkerTooltip>
                  <div className="fl-tip">
                    {l.label}
                    <small>{here.length ? `${c.pending} pending · ${c.assigned} assigned · ${c.resolved} resolved` : 'No requests here'}</small>
                  </div>
                </MarkerTooltip>
              </MapMarker>
            );
          })}

          {mode === 'responder' &&
            locations.flatMap((l) => {
              const here = buckets.get(l.id) ?? [];
              return here.map((r, i) => {
                // Requests snap to demo points, so several share one spot: fan them out in a ring.
                const ring = here.length > 1 ? 16 + Math.floor(i / 8) * 14 : 0;
                const a = (i / Math.min(here.length, 8)) * Math.PI * 2 - Math.PI / 2;
                return (
                  <MapMarker key={r.id} longitude={r.location.lng} latitude={r.location.lat} offset={[Math.cos(a) * ring, Math.sin(a) * ring]}>
                    <MarkerContent>
                      <button
                        type="button"
                        className="fl-dot"
                        data-s={r.status}
                        style={{ '--c': STATUS_COLOR[r.status] } as React.CSSProperties}
                        aria-pressed={r.id === selectedRequest}
                        aria-label={`${r.id}, ${STATUS_LABEL[r.status]}`}
                        onClick={() => onSelectRequest?.(r.id)}
                      />
                    </MarkerContent>
                    <MarkerTooltip>
                      <div className="fl-tip">
                        {r.id}
                        <small>{STATUS_LABEL[r.status]}</small>
                      </div>
                    </MarkerTooltip>
                  </MapMarker>
                );
              });
            })}

          {wide && <MapControls position="top-right" showZoom />}
        </Map>
      </Boundary>
    </div>
  );
}

export function MapLegend({ mode }: { mode: 'citizen' | 'responder' }) {
  const c = (v: string) => ({ '--c': v }) as React.CSSProperties;
  return (
    <div className="fl-legend" aria-hidden>
      <span><i data-sq style={c('#e23f12')} />High impact</span>
      <span><i data-sq style={c('#9a6300')} />Moderate</span>
      <span><i style={c(STATUS_COLOR.pending)} />Pending</span>
      <span><i style={c(STATUS_COLOR.assigned)} />Assigned</span>
      <span><i style={c(STATUS_COLOR.resolved)} />Resolved</span>
      <span><i style={c('#16150f')} />Shelter (fictional)</span>
      {mode === 'citizen' && <span>Outside the zones is not verified safe</span>}
    </div>
  );
}
