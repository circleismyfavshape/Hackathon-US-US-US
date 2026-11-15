// OWNER: D1. Pure geometry for the citizen map and zone check. No React, no DOM.
import type { FeatureCollection, Polygon } from 'geojson';
import type { LatLng, Ring, SosStatus, Zone } from '../../../../contracts/types.ts';

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

/** [[minLng, minLat], [maxLng, maxLat]] around every point, in the order MapLibre's `bounds` expects. */
export function boundsOf(points: LatLng[]): [[number, number], [number, number]] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** The depicted zones as GeoJSON, with the level and label the map styles from. */
export function zonesGeoJson(zones: Zone[]): FeatureCollection<Polygon, { level: Zone['level']; label: string }> {
  return {
    type: 'FeatureCollection',
    features: zones.map((z) => ({
      type: 'Feature',
      properties: { level: z.level, label: z.label },
      geometry: { type: 'Polygon', coordinates: [z.coordinates] },
    })),
  };
}

/** Every SOS snaps to a demo point, so many share one spot. Group them by nearest demo point (oldest first, as the API lists them). */
export function bucketByLocation<T extends { location: LatLng }>(items: T[], locations: { id: string; location: LatLng }[]): Map<string, T[]> {
  const out = new Map<string, T[]>(locations.map((l) => [l.id, []]));
  if (locations.length === 0) return out;
  for (const it of items) out.get(nearest(it.location, locations).id)!.push(it);
  return out;
}

export function countByStatus(items: { status: SosStatus }[]): Record<SosStatus, number> {
  const c: Record<SosStatus, number> = { pending: 0, assigned: 0, resolved: 0 };
  for (const it of items) c[it.status]++;
  return c;
}
