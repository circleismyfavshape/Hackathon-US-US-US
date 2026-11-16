import {
  SOS_STATUSES,
  SOS_TYPES,
  type LatLng,
  type SosCreate,
  type SosPatch,
} from '../../../contracts/types.ts';
import type { DemoFixtures } from '../seed/index.ts';

type Result<T> = { ok: true; value: T } | { ok: false; details: string[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const round = (value: number, decimalPlaces: number) =>
  Math.round(value * 10 ** decimalPlaces) / 10 ** decimalPlaces;

export const MAX_DESCRIPTION = 280;
export const MAX_PEOPLE = 50;
export const MAX_TEAM = 40;

export function validateSosCreate(body: unknown, fixtures: DemoFixtures): Result<SosCreate> {
  const details: string[] = [];
  if (!isObject(body)) {
    return { ok: false, details: ['body must be a JSON object'] };
  }

  const { incidentId, people, type, description, location, locationMode } = body;
  if (
    typeof incidentId !== 'string' ||
    !fixtures.incidents.some((incident) => incident.id === incidentId)
  ) {
    details.push('incidentId must be a known incident id');
  }
  if (!Number.isInteger(people) || (people as number) < 1 || (people as number) > MAX_PEOPLE) {
    details.push(`people must be an integer 1-${MAX_PEOPLE}`);
  }
  if (typeof type !== 'string' || !(SOS_TYPES as readonly string[]).includes(type)) {
    details.push(`type must be one of ${SOS_TYPES.join(', ')}`);
  }
  // Optional: a person in danger must be able to send a request without typing anything.
  if (
    description !== undefined &&
    (typeof description !== 'string' || description.length > MAX_DESCRIPTION)
  ) {
    details.push(`description must be at most ${MAX_DESCRIPTION} characters`);
  }
  if (locationMode !== 'manual-demo' && locationMode !== 'browser-opt-in') {
    details.push('locationMode must be manual-demo or browser-opt-in');
  }

  let normalizedLocation: LatLng | null = null;
  if (
    !isObject(location) ||
    typeof location.lat !== 'number' ||
    typeof location.lng !== 'number' ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    details.push('location must be { lat: number, lng: number }');
  } else {
    const bounds = fixtures.demoBounds;
    if (
      location.lat < bounds.minLat ||
      location.lat > bounds.maxLat ||
      location.lng < bounds.minLng ||
      location.lng > bounds.maxLng
    ) {
      details.push('location must be inside the demo scenario area');
    } else {
      // Privacy: never keep precise coordinates. Browser-derived points are coarsened to ~1 km.
      const decimalPlaces = locationMode === 'browser-opt-in' ? 2 : 3;
      normalizedLocation = {
        lat: round(location.lat, decimalPlaces),
        lng: round(location.lng, decimalPlaces),
      };
    }
  }

  if (details.length || !normalizedLocation) {
    return { ok: false, details };
  }
  return {
    ok: true,
    value: {
      incidentId: incidentId as string,
      people: people as number,
      type: type as SosCreate['type'],
      description: typeof description === 'string' ? description.trim() : '',
      location: normalizedLocation,
      locationMode: locationMode as SosCreate['locationMode'],
    },
  };
}

export function validateSosPatch(body: unknown): Result<SosPatch> {
  if (!isObject(body)) {
    return { ok: false, details: ['body must be a JSON object'] };
  }
  const { status, assignedTeam } = body;
  if (typeof status !== 'string' || !(SOS_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, details: [`status must be one of ${SOS_STATUSES.join(', ')}`] };
  }
  if (status === 'assigned') {
    if (
      typeof assignedTeam !== 'string' ||
      assignedTeam.trim().length === 0 ||
      assignedTeam.length > MAX_TEAM
    ) {
      return {
        ok: false,
        details: [`assignedTeam must be 1-${MAX_TEAM} characters when status is assigned`],
      };
    }
    return { ok: true, value: { status, assignedTeam: assignedTeam.trim() } };
  }
  return { ok: true, value: { status: status as 'resolved' | 'pending' } };
}
