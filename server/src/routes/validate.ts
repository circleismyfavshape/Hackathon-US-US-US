import {
  SOS_STATUSES,
  SOS_TYPES,
  STRATEGIES,
  type LatLng,
  type SosCreate,
  type SosPatch,
  type Strategy,
} from '../../../contracts/types.ts';
import type { DemoFixtures } from '../seed/index.ts';

type Result<T> = { ok: true; value: T } | { ok: false; details: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export const MAX_DESCRIPTION = 280;
export const MAX_PEOPLE = 50;
export const MAX_TEAM = 40;

export function validateSosCreate(body: unknown, fx: DemoFixtures): Result<SosCreate> {
  const d: string[] = [];
  if (!isObj(body)) return { ok: false, details: ['body must be a JSON object'] };

  const { incidentId, people, type, description, location, locationMode } = body;
  if (typeof incidentId !== 'string' || !fx.incidents.some((i) => i.id === incidentId)) d.push('incidentId must be a known incident id');
  if (!Number.isInteger(people) || (people as number) < 1 || (people as number) > MAX_PEOPLE) d.push(`people must be an integer 1-${MAX_PEOPLE}`);
  if (typeof type !== 'string' || !(SOS_TYPES as readonly string[]).includes(type)) d.push(`type must be one of ${SOS_TYPES.join(', ')}`);
  if (typeof description !== 'string' || description.trim().length === 0 || description.length > MAX_DESCRIPTION)
    d.push(`description must be 1-${MAX_DESCRIPTION} characters`);
  if (locationMode !== 'manual-demo' && locationMode !== 'browser-opt-in') d.push('locationMode must be manual-demo or browser-opt-in');

  let loc: LatLng | null = null;
  if (!isObj(location) || typeof location.lat !== 'number' || typeof location.lng !== 'number' || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    d.push('location must be { lat: number, lng: number }');
  } else {
    const b = fx.demoBounds;
    if (location.lat < b.minLat || location.lat > b.maxLat || location.lng < b.minLng || location.lng > b.maxLng) {
      d.push('location must be inside the demo scenario area');
    } else {
      // Privacy: never keep precise coordinates. Browser-derived points are coarsened to ~1 km.
      const dp = locationMode === 'browser-opt-in' ? 2 : 3;
      loc = { lat: round(location.lat, dp), lng: round(location.lng, dp) };
    }
  }

  if (d.length || !loc) return { ok: false, details: d };
  return {
    ok: true,
    value: {
      incidentId: incidentId as string,
      people: people as number,
      type: type as SosCreate['type'],
      description: (description as string).trim(),
      location: loc,
      locationMode: locationMode as SosCreate['locationMode'],
    },
  };
}

export function validateSosPatch(body: unknown): Result<SosPatch> {
  if (!isObj(body)) return { ok: false, details: ['body must be a JSON object'] };
  const { status, assignedTeam } = body;
  if (typeof status !== 'string' || !(SOS_STATUSES as readonly string[]).includes(status))
    return { ok: false, details: [`status must be one of ${SOS_STATUSES.join(', ')}`] };
  if (status === 'assigned') {
    if (typeof assignedTeam !== 'string' || assignedTeam.trim().length === 0 || assignedTeam.length > MAX_TEAM)
      return { ok: false, details: [`assignedTeam must be 1-${MAX_TEAM} characters when status is assigned`] };
    return { ok: true, value: { status, assignedTeam: assignedTeam.trim() } };
  }
  return { ok: true, value: { status: status as 'resolved' | 'pending' } };
}

export function validateStrategy(body: unknown): Result<Strategy> {
  if (!isObj(body) || typeof body.strategy !== 'string' || !(STRATEGIES as readonly string[]).includes(body.strategy))
    return { ok: false, details: [`strategy must be one of ${STRATEGIES.join(', ')}`] };
  return { ok: true, value: body.strategy as Strategy };
}
