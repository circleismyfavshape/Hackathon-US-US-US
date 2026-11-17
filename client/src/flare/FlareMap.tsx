// Shared 3D map: buildings, illustrated flood levels, relief pins and stored walking routes.
// Map primitives come from components/ui/map.tsx; response posts and closures use ScenarioLayers.
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Box, Cross, House, Layers as LayersIcon, Square } from 'lucide-react';
import type { FeatureCollection, LineString } from 'geojson';
import type * as MapLibreGL from 'maplibre-gl';
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  useMap,
} from '@/components/ui/map';
import { ClosureLayers, ServiceMarkers } from './ScenarioLayers.tsx';
import { boundsOf, zonesGeoJson } from '../features/citizen/geo.ts';
import {
  ZONE_LEVELS,
  type DemoLocation,
  type LatLng,
  type Route,
  type Scenario,
  type Sos,
  type ZoneLevel,
} from '../shared/api.ts';
import { LEVEL_COLOR, LEVEL_NAME, SEVERITY_COLOR, SEVERITY_NAME } from './data.ts';
import { STATUS_COLOR, STATUS_SHORT } from './ui.tsx';

// OpenFreeMap: free vector tiles with building heights, no key. If it cannot be reached the map
// falls back to a blank
// canvas that still shows zones, pins and routes.
const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
const STYLES = { light: BASEMAP, dark: BASEMAP };

const TILT = 56;
const BEARING = -18;
/**
 * How tall each level's block of water is drawn, in metres. Exaggerated on purpose so levels read
 * at a glance.
 */
const VOLUME_M: Record<ZoneLevel, number> = { severe: 16, high: 10, moderate: 5 };

const css = (v: string) => ({ '--c': v }) as CSSProperties;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * The map can be removed while an effect is still queued (switching views). Nothing here is worth
 * crashing for.
 */
const safely = (fn: () => void) => {
  try {
    fn();
  } catch {
    /* map or style already gone */
  }
};

function useBasemap(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    fetch(BASEMAP, { signal: ctl.signal })
      .then(
        (r) => setOk(r.ok),
        () => setOk(false),
      )
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
    return this.state.failed ? (
      <div className="fl-map-fallback">
        The 3D map could not start on this device. Everything else still works.
      </div>
    ) : (
      this.props.children
    );
  }
}

/* Layers drawn inside the map */
const SRC_ZONES = 'fl-zones';
const SRC_ROUTE = 'fl-route';
const LAYERS = [
  'fl-zone-fill',
  'fl-zone-line',
  'fl-route-case',
  'fl-route-line',
  'fl-route-flow',
  ...ZONE_LEVELS.map((l) => `fl-zone-vol-${l}`),
  'fl-buildings',
];
const levelColor: MapLibreGL.ExpressionSpecification = [
  'match',
  ['get', 'level'],
  'severe',
  LEVEL_COLOR.severe,
  'high',
  LEVEL_COLOR.high,
  LEVEL_COLOR.moderate,
];
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function Layers({
  zones,
  route,
}: {
  zones: FeatureCollection;
  route: FeatureCollection<LineString>;
}) {
  const { map, isLoaded } = useMap();
  const latest = useRef({ zones, route });
  latest.current = { zones, route };

  // Add sources and layers once per loaded style.
  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    safely(() => {
      const style = map.getStyle();
      const firstLabel = style.layers?.find((l) => l.type === 'symbol')?.id;
      const hasBuildings = Boolean(style.sources?.openmaptiles);

      map.addSource(SRC_ZONES, { type: 'geojson', data: latest.current.zones });
      map.addSource(SRC_ROUTE, { type: 'geojson', data: latest.current.route });

      map.addLayer(
        {
          id: 'fl-zone-fill',
          type: 'fill',
          source: SRC_ZONES,
          paint: { 'fill-color': levelColor, 'fill-opacity': 0.16 },
        },
        firstLabel,
      );
      map.addLayer(
        {
          id: 'fl-zone-line',
          type: 'line',
          source: SRC_ZONES,
          paint: { 'line-color': levelColor, 'line-width': 2, 'line-opacity': 0.9 },
        },
        firstLabel,
      );
      // One layer per level: extrusion opacity cannot vary inside a layer. Widest level first,
      // worst on top.
      for (const level of [...ZONE_LEVELS].reverse()) {
        map.addLayer(
          {
            id: `fl-zone-vol-${level}`,
            type: 'fill-extrusion',
            source: SRC_ZONES,
            filter: ['==', ['get', 'level'], level],
            paint: {
              'fill-extrusion-color': LEVEL_COLOR[level],
              'fill-extrusion-height': VOLUME_M[level],
              'fill-extrusion-opacity': level === 'severe' ? 0.42 : 0.3,
              'fill-extrusion-vertical-gradient': false,
            },
          },
          firstLabel,
        );
      }
      // The route is drawn after the water so it stays readable where it crosses a zone.
      map.addLayer(
        {
          id: 'fl-route-case',
          type: 'line',
          source: SRC_ROUTE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.95 },
        },
        firstLabel,
      );
      map.addLayer(
        {
          id: 'fl-route-line',
          type: 'line',
          source: SRC_ROUTE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#16a34a', 'line-width': 6 },
        },
        firstLabel,
      );
      map.addLayer(
        {
          id: 'fl-route-flow',
          type: 'line',
          source: SRC_ROUTE,
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 2,
            'line-opacity': 0.9,
            'line-dasharray': [0, 4, 3],
          },
        },
        firstLabel,
      );
      if (hasBuildings) {
        if (map.getLayer('building')) {
          map.setLayoutProperty('building', 'visibility', 'none');
        }
        map.addLayer(
          {
            id: 'fl-buildings',
            type: 'fill-extrusion',
            source: 'openmaptiles',
            'source-layer': 'building',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'render_height'], 8],
                0,
                '#e9edf3',
                60,
                '#d5dce8',
                200,
                '#bcc7d8',
              ],
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                13,
                0,
                14.2,
                ['coalesce', ['get', 'render_height'], 8],
              ],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.86,
            },
          },
          firstLabel,
        );
      }
    });
    return () =>
      safely(() => {
        for (const id of LAYERS) {
          if (map.getLayer(id)) {
            map.removeLayer(id);
          }
        }
        for (const id of [SRC_ZONES, SRC_ROUTE]) {
          if (map.getSource(id)) {
            map.removeSource(id);
          }
        }
      });
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    safely(() =>
      (map.getSource(SRC_ZONES) as MapLibreGL.GeoJSONSource | undefined)?.setData(zones),
    );
  }, [map, isLoaded, zones]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    safely(() =>
      (map.getSource(SRC_ROUTE) as MapLibreGL.GeoJSONSource | undefined)?.setData(route),
    );
  }, [map, isLoaded, route]);

  // Marching dashes along the route, towards the safe zone.
  const hasRoute = route.features.length > 0;
  useEffect(() => {
    if (!map || !isLoaded || !hasRoute || reducedMotion()) {
      return;
    }
    const frames: number[][] = [
      [0, 4, 3],
      [0.5, 4, 2.5],
      [1, 4, 2],
      [1.5, 4, 1.5],
      [2, 4, 1],
      [2.5, 4, 0.5],
      [3, 4, 0],
      [0, 0.5, 3, 3.5],
      [0, 1, 3, 3],
      [0, 1.5, 3, 2.5],
      [0, 2, 3, 2],
      [0, 2.5, 3, 1.5],
      [0, 3, 3, 1],
      [0, 3.5, 3, 0.5],
    ];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % frames.length;
      safely(() => {
        if (map.getLayer('fl-route-flow')) {
          map.setPaintProperty('fl-route-flow', 'line-dasharray', frames[i]);
        }
      });
    }, 70);
    return () => clearInterval(t);
  }, [map, isLoaded, hasRoute]);

  return null;
}

/** Moves the camera whenever the thing being looked at changes. */
function Camera({
  target,
  cameraKey,
  flat,
  pad,
}: {
  target: [[number, number], [number, number]];
  cameraKey: string;
  flat: boolean;
  pad: number;
}) {
  const { map, isLoaded } = useMap();
  const first = useRef(true);
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    const instant = first.current || reducedMotion();
    first.current = false;
    safely(() =>
      map.fitBounds(targetRef.current, {
        padding: pad,
        pitch: flat ? 0 : TILT,
        bearing: flat ? 0 : BEARING,
        maxZoom: 16.4,
        duration: instant ? 0 : 1400,
        essential: true,
      }),
    );
  }, [map, isLoaded, cameraKey, flat, pad]);

  // The map's box changes size when panels open or the phone rotates. Keep the canvas matched to
  // it.
  useEffect(() => {
    if (!map) {
      return;
    }
    const el = map.getContainer();
    const ro = new ResizeObserver(() => safely(() => map.resize()));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/* The map */
type Props = {
  scenario: Scenario;
  /** The flood area to frame. Null frames every area. */
  focusId: string | null;
  onPickIncident?: (id: string) => void;
  /** Where the citizen is. */
  user?: DemoLocation | null;
  /** The route being followed, drawn on the roads. */
  route?: Route | null;
  selectedShelterId?: string | null;
  onSelectShelter?: (id: string) => void;
  /** Responder: requests to plot. */
  requests?: Sos[];
  selectedRequestId?: string | null;
  onSelectRequest?: (id: string) => void;
  /** A still picture: no gestures, no controls. */
  preview?: boolean;
  /**
   * Open looking straight down instead of tilted. The person can still switch with the 2D/3D
   * button.
   */
  startFlat?: boolean;
  /**
   * Raise this number to switch an already open map to the flat view (for example when directions
   * are asked for).
   */
  flatRequest?: number;
  /**
   * Show the "Map layers" list and the police, fire and aid labels. Off when the person asked for
   * a clear view.
   */
  showInfo?: boolean;
};

const ringPoints = (rings: [number, number][][]): LatLng[] =>
  rings.flatMap((r) => r.map(([lng, lat]) => ({ lat, lng })));

export function FlareMap({
  scenario,
  focusId,
  onPickIncident,
  user,
  route,
  selectedShelterId,
  onSelectShelter,
  requests,
  selectedRequestId,
  onSelectRequest,
  preview = false,
  startFlat = false,
  flatRequest = 0,
  showInfo = true,
}: Props) {
  const reachable = useBasemap();
  const [flat, setFlat] = useState(startFlat);
  const lastFlatRequest = useRef(flatRequest);
  useEffect(() => {
    if (flatRequest !== lastFlatRequest.current) {
      lastFlatRequest.current = flatRequest;
      setFlat(true);
    }
  }, [flatRequest]);
  // The tilt the map is created with. Later changes go through <Camera>, which animates them.
  const [initialFlat] = useState(startFlat);
  const [showServices, setShowServices] = useState(true);
  const [showClosures, setShowClosures] = useState(true);
  const focus = scenario.incidents.find((i) => i.id === focusId) ?? null;

  const zones = useMemo(() => zonesGeoJson(scenario.incidents.flatMap((i) => i.zones)), [scenario]);
  const routeLine = useMemo<FeatureCollection<LineString>>(
    () =>
      route
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: route.coordinates },
              },
            ],
          }
        : (EMPTY as FeatureCollection<LineString>),
    [route],
  );
  const shelters = useMemo(
    () => (focus ? scenario.shelters.filter((s) => s.incidentId === focus.id) : scenario.shelters),
    [scenario, focus],
  );
  const points = useMemo(
    () => (scenario.mapPoints ?? []).filter((point) => !focus || point.incidentId === focus.id),
    [scenario, focus],
  );
  const closures = useMemo(
    () =>
      (scenario.roadClosures ?? []).filter((closure) => !focus || closure.incidentId === focus.id),
    [scenario, focus],
  );

  const target = useMemo(() => {
    if (route) {
      return boundsOf([
        ...route.coordinates.map(([lng, lat]) => ({ lat, lng })),
        ...(user ? [user.location] : []),
      ]);
    }
    if (focus) {
      const pts = [
        ...ringPoints(focus.zones.map((z) => z.coordinates)),
        ...shelters.map((s) => s.location),
      ];
      if (user && user.incidentId === focus.id) {
        pts.push(user.location);
      }
      return boundsOf(pts);
    }
    return boundsOf(
      scenario.incidents.flatMap((i) => ringPoints(i.zones.map((z) => z.coordinates))),
    );
  }, [scenario, focus, shelters, route, user]);
  const cameraKey = `${route?.id ?? ''}|${focus?.id ?? 'all'}|${user?.id ?? ''}`;
  const pad = preview ? 28 : 56;

  // Requests share a few demo places, so fan them out around the spot instead of stacking them.
  const requestPins = useMemo(() => {
    const counts: Record<string, number> = {};
    return (requests ?? []).map((request) => {
      const key = `${request.location.lat},${request.location.lng}`;
      const overlapIndex = counts[key] ?? 0;
      counts[key] = overlapIndex + 1;

      let offset: [number, number] = [0, 0];
      if (overlapIndex > 0) {
        // Use six angular positions per ring, expanding outward as more pins overlap.
        const ring = Math.floor(overlapIndex / 6) + 1;
        const angle = (overlapIndex % 6) * (Math.PI / 3) + ring * 0.5;
        offset = [Math.round(Math.cos(angle) * 20 * ring), Math.round(Math.sin(angle) * 20 * ring)];
      }
      return { request, offset };
    });
  }, [requests]);

  if (reachable === null) {
    return (
      <div className="fl-map-fallback">
        <span className="fl-spinner" aria-hidden /> Loading map…
      </div>
    );
  }

  return (
    <div
      className="fl-map"
      data-preview={preview || undefined}
      role="group"
      aria-label="3D map of flood areas, safe zones and routes"
    >
      <Boundary>
        <Map
          theme="light"
          styles={reachable ? STYLES : undefined}
          blank={!reachable}
          bounds={target}
          fitBoundsOptions={{ padding: pad, maxZoom: 16.4 }}
          pitch={initialFlat ? 0 : TILT}
          bearing={initialFlat ? 0 : BEARING}
          maxPitch={70}
          interactive={!preview}
          attributionControl={{ compact: true }}
        >
          <Layers zones={zones} route={routeLine} />
          <Camera target={target} cameraKey={cameraKey} flat={flat} pad={pad} />
          {!preview && showClosures && <ClosureLayers closures={closures} />}
          {!preview && showServices && showInfo && <ServiceMarkers points={points} />}

          {/* Flood areas: a chip over each one. It opens the area. */}
          {!preview &&
            scenario.incidents
              .filter((i) => i.id !== focus?.id)
              .map((i) => (
                <MapMarker
                  key={i.id}
                  longitude={i.location.lng}
                  latitude={i.location.lat}
                  anchor="bottom"
                  offset={[0, -10]}
                >
                  <MarkerContent>
                    <button
                      type="button"
                      className="fl-chip"
                      style={css(SEVERITY_COLOR[i.severity])}
                      onClick={() => onPickIncident?.(i.id)}
                      aria-label={`${i.area}: ${SEVERITY_NAME[i.severity]} flood. Open.`}
                    >
                      <i aria-hidden />
                      {i.area}
                      <em>{SEVERITY_NAME[i.severity]}</em>
                    </button>
                  </MarkerContent>
                </MapMarker>
              ))}

          {/* Safe zones */}
          {shelters.map((s) => {
            const on = s.id === selectedShelterId;
            const Icon = s.kind === 'medical' ? Cross : House;
            return (
              <MapMarker
                key={s.id}
                longitude={s.location.lng}
                latitude={s.location.lat}
                anchor="bottom"
                onClick={() => onSelectShelter?.(s.id)}
              >
                <MarkerContent>
                  <button
                    type="button"
                    className="fl-pin fl-pin-safe"
                    data-on={on || undefined}
                    data-quiet={(!focus && !on) || undefined}
                    aria-label={`Safe zone: ${s.name}`}
                  >
                    <span className="fl-pin-dot">
                      <Icon size={14} aria-hidden />
                    </span>
                    <span className="fl-pin-label">
                      <small>{s.kind === 'medical' ? 'Hospital / clinic' : 'Shelter'}</small>
                      {s.name.split(',')[0]}
                    </span>
                  </button>
                </MarkerContent>
                {!preview && (
                  <MarkerPopup closeButton>
                    <div className="fl-map-popup">
                      <small>
                        Simulation · {s.kind === 'medical' ? 'Medical care' : 'Relief point'}
                      </small>
                      <strong>{s.name}</strong>
                      <p>{s.note}</p>
                      <p>Scenario listing. Real opening and safe access are not verified.</p>
                    </div>
                  </MarkerPopup>
                )}
              </MapMarker>
            );
          })}

          {/* Responder: one dot per request */}
          {requestPins.map(({ request, offset }) => (
            <MapMarker
              key={request.id}
              longitude={request.location.lng}
              latitude={request.location.lat}
              offset={offset}
              onClick={() => onSelectRequest?.(request.id)}
            >
              <MarkerContent>
                <button
                  type="button"
                  className="fl-req"
                  data-status={request.status}
                  data-on={request.id === selectedRequestId || undefined}
                  style={css(STATUS_COLOR[request.status])}
                  aria-label={`Request ${request.id}, ${STATUS_SHORT[request.status]}, ${request.people} people`}
                >
                  {request.people}
                </button>
              </MarkerContent>
            </MapMarker>
          ))}

          {/* You */}
          {user && (
            <MapMarker longitude={user.location.lng} latitude={user.location.lat}>
              <MarkerContent>
                <div className="fl-you" aria-label={`You are here: ${user.label}`}>
                  <i aria-hidden />
                  <span>You</span>
                </div>
              </MarkerContent>
            </MapMarker>
          )}

          {!preview && <MapControls position="top-right" showZoom showCompass />}
        </Map>
        {!preview && showInfo && (
          <details className="fl-map-layers">
            <summary>
              <LayersIcon size={15} aria-hidden /> Map layers
            </summary>
            <label>
              <input
                type="checkbox"
                checked={showServices}
                onChange={(event) => setShowServices(event.target.checked)}
              />{' '}
              Police, fire and aid
            </label>
            <label>
              <input
                type="checkbox"
                checked={showClosures}
                onChange={(event) => setShowClosures(event.target.checked)}
              />{' '}
              Roadblocks and closures
            </label>
            <p>All operational markers are simulated.</p>
          </details>
        )}
        {!preview && (
          <button
            type="button"
            className="fl-map-tilt"
            onClick={() => setFlat((f) => !f)}
            aria-pressed={!flat}
            title={flat ? 'Switch to the 3D view' : 'Switch to the flat view'}
          >
            {flat ? <Box size={15} aria-hidden /> : <Square size={15} aria-hidden />}
            {flat ? '3D' : '2D'}
          </button>
        )}
      </Boundary>
    </div>
  );
}

/** What the colours mean. */
export function MapLegend({ responder = false }: { responder?: boolean }) {
  return (
    <div className="fl-legend" aria-label="Map key">
      <strong>Flood damage</strong>
      {ZONE_LEVELS.map((l) => (
        <span key={l}>
          <i data-sq style={css(LEVEL_COLOR[l])} />
          {LEVEL_NAME[l]}
        </span>
      ))}
      <span>
        <i style={css('#16a34a')} />
        Shelter / medical
      </span>
      <span>
        <i data-line style={css('#b91c1c')} /> Closed road
      </span>
      {responder ? (
        <>
          <span>
            <i style={css(STATUS_COLOR.pending)} />
            Waiting
          </span>
          <span>
            <i style={css(STATUS_COLOR.assigned)} />
            On the way
          </span>
        </>
      ) : (
        <span>
          <i style={css('#2563eb')} />
          You
        </span>
      )}
    </div>
  );
}
