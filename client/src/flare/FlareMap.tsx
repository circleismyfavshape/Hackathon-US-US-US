// One map for every interface, built on the team's mapcn (MapLibre) component and D1's geometry helpers.
// Overview: every active area with a chip to open it. Area view: that area's zones, pins and shelters.
// Responder: every request as a selectable dot.
// Failure ladder: basemap unreachable -> tile-less canvas (zones and points still draw);
// WebGL unavailable -> message, and the side panels keep working.
import { Component, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { House } from 'lucide-react';
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerTooltip } from '@/components/ui/map';
import { boundsOf, bucketByLocation, countByStatus, zonesGeoJson } from '../features/citizen/geo.ts';
import type { DemoConfig, Incident, Shelter, Sos } from '../shared/api.ts';
import { areaName, SEVERITY_COLOR } from './data.ts';
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
  incidents: Incident[];
  /** The opened area, or null for the overview of every area. */
  activeId: string | null;
  onPickIncident?: (id: string) => void;
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
  active: { fill: { 'fill-color': '#16150f', 'fill-opacity': 0 }, line: { 'line-color': '#16150f', 'line-width': 2.5 } },
};
const css = (v: string) => ({ '--c': v }) as CSSProperties;

export function FlareMap({ incidents, activeId, onPickIncident, shelters, locations, requests, mode, selectedLocation, onSelectLocation, selectedRequest, onSelectRequest }: Props) {
  const reachable = useBasemap();
  const active = incidents.find((i) => i.id === activeId) ?? null;
  const zones = useMemo(() => incidents.flatMap((i) => i.zones), [incidents]);
  const high = useMemo(() => zonesGeoJson(zones.filter((z) => z.level === 'high')), [zones]);
  const moderate = useMemo(() => zonesGeoJson(zones.filter((z) => z.level === 'moderate')), [zones]);
  // The opened area gets an ink outline around its widest zone, so it reads as "selected".
  const outline = useMemo(() => zonesGeoJson(active ? active.zones.slice(-1) : []), [active]);
  const areaLocations = useMemo(() => (active ? locations.filter((l) => !l.incidentId || l.incidentId === active.id) : []), [locations, active]);
  const areaShelters = useMemo(() => (active ? shelters.filter((s) => s.incidentId === active.id) : shelters), [shelters, active]);
  const bounds = useMemo(() => {
    const ring = (i: Incident) => i.zones.flatMap((z) => z.coordinates.map(([lng, lat]) => ({ lat, lng })));
    return active ? boundsOf([...ring(active), ...areaLocations.map((l) => l.location), ...areaShelters.map((s) => s.location)]) : boundsOf(incidents.flatMap(ring));
  }, [incidents, active, areaLocations, areaShelters]);
  const buckets = useMemo(() => bucketByLocation(requests, locations), [requests, locations]);
  const wide = useMemo(() => window.matchMedia('(min-width: 861px)').matches, []);

  if (reachable === null) return <div className="fl-map-fallback">Loading map…</div>;
  return (
    <div className="fl-map" role="group" aria-label="Live map of flood areas">
      <Boundary>
        <Map theme="light" styles={reachable ? STYLES : undefined} blank={!reachable} bounds={bounds} fitBoundsOptions={{ padding: wide ? 90 : 40, maxZoom: 14.5 }}>
          <MapGeoJSON id="fl-zone-moderate" data={moderate} fillPaint={PAINT.moderate.fill} linePaint={PAINT.moderate.line} />
          <MapGeoJSON id="fl-zone-high" data={high} fillPaint={PAINT.high.fill} linePaint={PAINT.high.line} />
          {active && <MapGeoJSON id="fl-zone-active" data={outline} fillPaint={PAINT.active.fill} linePaint={PAINT.active.line} />}

          {/* Area chips: on the overview they open the area. */}
          {incidents
            .filter((i) => !active || mode === 'responder')
            .map((i) => {
              const [[, ], [, north]] = boundsOf(i.zones.flatMap((z) => z.coordinates.map(([lng, lat]) => ({ lat, lng }))));
              return (
                <MapMarker key={i.id} longitude={i.location.lng} latitude={north} anchor="bottom" offset={[0, -6]}>
                  <MarkerContent>
                    {onPickIncident ? (
                      <button type="button" className="fl-chip" style={css(SEVERITY_COLOR[i.severity])} onClick={() => onPickIncident(i.id)} aria-label={`Open ${i.title}`}>
                        {areaName(i)}
                      </button>
                    ) : (
                      <span className="fl-chip" style={css(SEVERITY_COLOR[i.severity])}>{areaName(i)}</span>
                    )}
                  </MarkerContent>
                </MapMarker>
              );
            })}

          {active &&
            mode === 'citizen' &&
            active.zones.map((z) => {
              const [[west], [east, north]] = boundsOf(z.coordinates.map(([lng, lat]) => ({ lat, lng })));
              return (
                <MapMarker key={z.id} longitude={(west + east) / 2} latitude={north} anchor="bottom">
                  <MarkerContent>
                    <span className="fl-zonetag" data-l={z.level}>{z.level === 'high' ? 'High impact' : 'Moderate impact'}</span>
                  </MarkerContent>
                </MapMarker>
              );
            })}

          {areaShelters.map((s) => (
            <MapMarker key={s.id} longitude={s.location.lng} latitude={s.location.lat}>
              <MarkerContent>
                <span className="fl-shelter" role="img" aria-label={s.name}>
                  <House size={13} aria-hidden />
                </span>
              </MarkerContent>
              <MarkerTooltip>
                <div className="fl-tip">
                  {s.name}
                  <small>Relief centre</small>
                </div>
              </MarkerTooltip>
            </MapMarker>
          ))}

          {mode === 'citizen' &&
            areaLocations.map((l) => {
              const here = buckets.get(l.id) ?? [];
              const c = countByStatus(here);
              return (
                <MapMarker key={l.id} longitude={l.location.lng} latitude={l.location.lat}>
                  <MarkerContent>
                    <div style={{ position: 'relative' }}>
                      {onSelectLocation ? (
                        <button type="button" className="fl-pin" aria-pressed={l.id === selectedLocation} aria-label={`I am at ${l.label}`} onClick={() => onSelectLocation(l.id)}>
                          {l.id}
                        </button>
                      ) : (
                        <span className="fl-pin" data-static>{l.id}</span>
                      )}
                      {here.length > 0 && (
                        <span className="fl-pincount" aria-hidden>
                          {(['pending', 'assigned', 'resolved'] as const).map((k) => c[k] > 0 && <b key={k} style={css(STATUS_COLOR[k])}>{c[k]}</b>)}
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
                // Requests share a few known points: fan them out in a ring so each can be picked.
                const ring = here.length > 1 ? 16 + Math.floor(i / 8) * 14 : 0;
                const a = (i / Math.min(here.length, 8)) * Math.PI * 2 - Math.PI / 2;
                return (
                  <MapMarker key={r.id} longitude={r.location.lng} latitude={r.location.lat} offset={[Math.cos(a) * ring, Math.sin(a) * ring]}>
                    <MarkerContent>
                      <button type="button" className="fl-dot" data-s={r.status} style={css(STATUS_COLOR[r.status])} aria-pressed={r.id === selectedRequest} aria-label={`${r.id}, ${STATUS_LABEL[r.status]}`} onClick={() => onSelectRequest?.(r.id)} />
                    </MarkerContent>
                    <MarkerTooltip>
                      <div className="fl-tip">
                        {l.label}
                        <small>{r.id} · {STATUS_LABEL[r.status]}</small>
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
  return (
    <div className="fl-legend" aria-hidden>
      <span><i data-sq style={css('#e23f12')} />High impact</span>
      <span><i data-sq style={css('#9a6300')} />Moderate</span>
      {mode === 'responder' && (
        <>
          <span><i style={css(STATUS_COLOR.pending)} />Pending</span>
          <span><i style={css(STATUS_COLOR.assigned)} />Assigned</span>
          <span><i style={css(STATUS_COLOR.resolved)} />Resolved</span>
        </>
      )}
      <span><i style={css('#16150f')} />Relief centre</span>
    </div>
  );
}
