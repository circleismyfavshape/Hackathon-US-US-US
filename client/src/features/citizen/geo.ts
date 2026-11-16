// Pure geometry for the map and the danger-zone check. No React, no DOM. Tested in server/tests/citizen/.
import type { FeatureCollection, Polygon } from 'geojson';
import {
  ZONE_LEVELS,
  type Incident,
  type LatLng,
  type Ring,
  type SosStatus,
  type Zone,
  type ZoneLevel,
} from '../../../../contracts/types.ts';

export type ZoneHit = ZoneLevel | 'none';

/** Ray casting. `ring` is GeoJSON order [lng, lat]; `p` is {lat, lng}. */
export function pointInRing(p: LatLng, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Worst marked level containing `p`. Never means "safe": 'none' only says outside the drawn zones. */
export function zoneAt(p: LatLng, zones: Zone[]): ZoneHit {
  const hit = new Set(zones.filter((z) => pointInRing(p, z.coordinates)).map((z) => z.level));
  return ZONE_LEVELS.find((l) => hit.has(l)) ?? 'none';
}

/** The incident whose zones contain `p`, with the worst level there. Null when `p` is outside every marked zone. */
export function dangerAt(
  p: LatLng,
  incidents: Incident[],
): { incident: Incident; level: ZoneLevel; zone: Zone } | null {
  let best: { incident: Incident; level: ZoneLevel; zone: Zone } | null = null;
  for (const incident of incidents) {
    const level = zoneAt(p, incident.zones);
    if (level === 'none') {
      continue;
    }
    if (!best || ZONE_LEVELS.indexOf(level) < ZONE_LEVELS.indexOf(best.level)) {
      best = {
        incident,
        level,
        zone: incident.zones.find((z) => z.level === level && pointInRing(p, z.coordinates))!,
      };
    }
  }
  return best;
}

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function nearest<T extends { location: LatLng }>(p: LatLng, items: T[]): T {
  return items.reduce((best, it) =>
    distanceM(p, it.location) < distanceM(p, best.location) ? it : best,
  );
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

/** The marked zones as GeoJSON, widest level first so the worst is drawn on top. */
export function zonesGeoJson(
  zones: Zone[],
): FeatureCollection<Polygon, { id: string; level: ZoneLevel; label: string; depth: string }> {
  const order = [...zones].sort(
    (a, b) => ZONE_LEVELS.indexOf(b.level) - ZONE_LEVELS.indexOf(a.level),
  );
  return {
    type: 'FeatureCollection',
    features: order.map((z) => ({
      type: 'Feature',
      properties: { id: z.id, level: z.level, label: z.label, depth: z.depth },
      geometry: { type: 'Polygon', coordinates: [z.coordinates] },
    })),
  };
}

/** Every request snaps to a demo point, so many share one spot. Group them by nearest demo point (oldest first, as the API lists them). */
export function bucketByLocation<T extends { location: LatLng }>(
  items: T[],
  locations: { id: string; location: LatLng }[],
): Map<string, T[]> {
  const out = new Map<string, T[]>(locations.map((l) => [l.id, []]));
  if (locations.length === 0) {
    return out;
  }
  for (const it of items) {
    out.get(nearest(it.location, locations).id)!.push(it);
  }
  return out;
}

export function countByStatus(items: { status: SosStatus }[]): Record<SosStatus, number> {
  const c: Record<SosStatus, number> = { pending: 0, assigned: 0, resolved: 0 };
  for (const it of items) {
    c[it.status]++;
  }
  return c;
}

/** "450 m" under a kilometre, "1.6 km" above. */
export const metres = (m: number) =>
  m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
