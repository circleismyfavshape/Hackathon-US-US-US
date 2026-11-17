// Pure geometry for the map and the danger-zone check. No React, no DOM. Tested in
// server/tests/citizen/.
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

/** Count crossings of a horizontal ray from the point. An odd count means it is inside. */
export function pointInRing(point: LatLng, ring: Ring): boolean {
  let inside = false;
  for (let index = 0; index < ring.length; index++) {
    const previousIndex = index === 0 ? ring.length - 1 : index - 1;
    // GeoJSON coordinates use longitude first, unlike the point object.
    const [startLng, startLat] = ring[index];
    const [endLng, endLat] = ring[previousIndex];
    // Include the boundary: a point on a marked flood edge should still raise the alert.
    const cross =
      (point.lng - startLng) * (endLat - startLat) - (point.lat - startLat) * (endLng - startLng);
    const epsilon = 1e-10;
    if (
      Math.abs(cross) <= epsilon &&
      point.lng >= Math.min(startLng, endLng) - epsilon &&
      point.lng <= Math.max(startLng, endLng) + epsilon &&
      point.lat >= Math.min(startLat, endLat) - epsilon &&
      point.lat <= Math.max(startLat, endLat) + epsilon
    ) {
      return true;
    }
    const startIsAbove = startLat > point.lat;
    const endIsAbove = endLat > point.lat;
    if (startIsAbove !== endIsAbove) {
      const crossingLng =
        ((endLng - startLng) * (point.lat - startLat)) / (endLat - startLat) + startLng;
      if (point.lng < crossingLng) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * Find the worst level at the point. 'none' means outside the drawn zones, not confirmed safe.
 */
export function zoneAt(point: LatLng, zones: Zone[]): ZoneHit {
  // Levels are ordered from severe to moderate, so the first match wins.
  for (const level of ZONE_LEVELS) {
    const containsPoint = zones.some(
      (zone) => zone.level === level && pointInRing(point, zone.coordinates),
    );
    if (containsPoint) {
      return level;
    }
  }
  return 'none';
}

/**
 * Find the incident and worst zone at the point, or null outside every marked zone.
 */
export function dangerAt(
  point: LatLng,
  incidents: Incident[],
): { incident: Incident; level: ZoneLevel; zone: Zone } | null {
  let best: { incident: Incident; level: ZoneLevel; zone: Zone } | null = null;
  for (const incident of incidents) {
    const level = zoneAt(point, incident.zones);
    if (level === 'none') {
      continue;
    }
    if (!best || ZONE_LEVELS.indexOf(level) < ZONE_LEVELS.indexOf(best.level)) {
      best = {
        incident,
        level,
        zone: incident.zones.find(
          (zone) => zone.level === level && pointInRing(point, zone.coordinates),
        )!,
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
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function nearest<T extends { location: LatLng }>(p: LatLng, items: T[]): T {
  let closest = items[0];
  if (!closest) {
    throw new Error('Cannot find the nearest location in an empty list.');
  }
  let closestDistance = distanceM(p, closest.location);
  for (const item of items.slice(1)) {
    const distance = distanceM(p, item.location);
    if (distance < closestDistance) {
      closest = item;
      closestDistance = distance;
    }
  }
  return closest;
}

/**
 * [[minLng, minLat], [maxLng, maxLat]] around every point, in the order MapLibre's `bounds`
 * expects.
 */
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

/** Group requests by their nearest demo place, preserving the API's oldest-first order. */
export function bucketByLocation<T extends { location: LatLng }>(
  items: T[],
  locations: { id: string; location: LatLng }[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>(locations.map((location) => [location.id, []]));
  if (locations.length === 0) {
    return groups;
  }
  for (const item of items) {
    const place = nearest(item.location, locations);
    groups.get(place.id)!.push(item);
  }
  return groups;
}

export function countByStatus(items: { status: SosStatus }[]): Record<SosStatus, number> {
  const counts: Record<SosStatus, number> = { pending: 0, assigned: 0, resolved: 0 };
  for (const item of items) {
    counts[item.status]++;
  }
  return counts;
}

/** "450 m" under a kilometre, "1.6 km" above. */
export const metres = (m: number) =>
  m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
