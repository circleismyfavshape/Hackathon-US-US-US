// OWNER: D1. Pure geometry for the citizen map and zone check. No React, no DOM.
import type { Incident, LatLng, Ring, Zone } from '../../../../contracts/types.ts';

export type ZoneHit = Zone['level'] | 'none';

/** Ray casting. `ring` is GeoJSON order [lng, lat]; `p` is {lat, lng}. */
export function pointInRing(p: LatLng, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Highest depicted level containing `p`. Never means "safe": 'none' only says outside the drawn zones. */
export function zoneAt(p: LatLng, zones: Zone[]): ZoneHit {
  const hit = zones.filter((z) => pointInRing(p, z.coordinates));
  return hit.some((z) => z.level === 'high') ? 'high' : hit.length ? 'moderate' : 'none';
}

export function nearest<T extends { location: LatLng }>(p: LatLng, items: T[]): T {
  const d = (q: LatLng) => (q.lat - p.lat) ** 2 + (q.lng - p.lng) ** 2;
  return items.reduce((best, it) => (d(it.location) < d(best.location) ? it : best));
}

export type Projector = {
  width: number;
  height: number;
  xy: (p: LatLng) => [number, number];
  ring: (r: Ring) => string;
};

/** Fit every given point into a width x height SVG box with padding. At ~3 deg N the lat/lng scale difference is under 0.2%, so one uniform scale is accurate enough for a schematic. */
export function projector(points: LatLng[], width = 640, pad = 36): Projector {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const scale = (width - 2 * pad) / (maxLng - minLng);
  const height = Math.round((maxLat - minLat) * scale + 2 * pad);
  const xy = (p: LatLng): [number, number] => [pad + (p.lng - minLng) * scale, pad + (maxLat - p.lat) * scale];
  const ring = (r: Ring) => r.map(([lng, lat]) => xy({ lat, lng }).map((n) => n.toFixed(1)).join(',')).join(' ');
  return { width, height, xy, ring };
}

export function incidentPoints(incident: Incident, extra: LatLng[]): LatLng[] {
  const ringPoints = incident.zones.flatMap((z) => z.coordinates.map(([lng, lat]) => ({ lat, lng })));
  return [incident.location, ...ringPoints, ...extra];
}
