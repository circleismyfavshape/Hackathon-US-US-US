// Operational context is separate from relief points: a rescue launch is not a shelter.
import { useEffect, useMemo } from 'react';
import { Ban, Flame, Package, Shield } from 'lucide-react';
import type { FeatureCollection, LineString } from 'geojson';
import { MapMarker, MarkerContent, MarkerPopup, useMap } from '@/components/ui/map';
import type { MapPoint, RoadClosure } from '../shared/api.ts';

const SERVICE = {
  police: { Icon: Shield, label: 'Police', color: '#2563eb' },
  fire: { Icon: Flame, label: 'Fire and rescue', color: '#b45309' },
  roadblock: { Icon: Ban, label: 'Police roadblock', color: '#b91c1c' },
  aid: { Icon: Package, label: 'Aid distribution', color: '#7c3aed' },
} as const;

export function ServiceMarkers({ points }: { points: MapPoint[] }) {
  return points.map((point) => {
    const { Icon, label, color } = SERVICE[point.kind];
    return (
      <MapMarker
        key={point.id}
        longitude={point.location.lng}
        latitude={point.location.lat}
        anchor="bottom"
      >
        <MarkerContent>
          <button
            type="button"
            className="fl-service-pin"
            style={{ '--c': color } as React.CSSProperties}
            aria-label={`${label}: ${point.name}. Simulated.`}
          >
            <span>
              <Icon size={14} aria-hidden />
            </span>
            <b>{point.name}</b>
          </button>
        </MarkerContent>
        <MarkerPopup closeButton>
          <div className="fl-map-popup">
            <small>Simulation · {label}</small>
            <strong>{point.name}</strong>
            <p>{point.note}</p>
            <p>Illustrated response post; availability is not verified.</p>
          </div>
        </MarkerPopup>
      </MapMarker>
    );
  });
}

/** Dashed lines describe closures without implying that a stored route avoids them. */
export function ClosureLayers({ closures }: { closures: RoadClosure[] }) {
  const { map, isLoaded } = useMap();
  const data = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: closures.map((closure) => ({
        type: 'Feature',
        properties: { id: closure.id },
        geometry: { type: 'LineString', coordinates: closure.coordinates },
      })),
    }),
    [closures],
  );

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    map.addSource('fl-closures', { type: 'geojson', data });
    map.addLayer({
      id: 'fl-closure-lines',
      type: 'line',
      source: 'fl-closures',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#b91c1c', 'line-width': 5, 'line-dasharray': [1.5, 1.5] },
    });
    return () => {
      // Map removal can happen before React disposes child effects when switching views.
      try {
        if (map.getLayer('fl-closure-lines')) {
          map.removeLayer('fl-closure-lines');
        }
        if (map.getSource('fl-closures')) {
          map.removeSource('fl-closures');
        }
      } catch {
        /* the map has already been removed */
      }
    };
  }, [map, isLoaded, data]);

  return closures.map((closure) => {
    const [lng, lat] = closure.coordinates[Math.floor(closure.coordinates.length / 2)];
    return (
      <MapMarker key={closure.id} longitude={lng} latitude={lat} anchor="bottom">
        <MarkerContent>
          <button
            type="button"
            className="fl-closure-pin"
            aria-label={`Closed road: ${closure.name}. Simulated.`}
          >
            <Ban size={13} aria-hidden /> Closed · {closure.name}
          </button>
        </MarkerContent>
        <MarkerPopup closeButton>
          <div className="fl-map-popup">
            <small>Simulation · Closed road</small>
            <strong>{closure.name}</strong>
            <p>{closure.reason}</p>
            <p>Illustrated segment. Stored routes do not avoid this closure.</p>
          </div>
        </MarkerPopup>
      </MapMarker>
    );
  });
}
