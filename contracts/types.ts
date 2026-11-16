// Shared API types, v2.1. Client and server import this file to keep their data shapes aligned.
// Keep this file and contracts/API_CONTRACT.md aligned when the data shapes change.

export type LatLng = { lat: number; lng: number };

/** GeoJSON order: [longitude, latitude]. First point repeated at the end. */
export type Ring = [number, number][];

export type SourceType = 'simulation' | 'official';

/** Damage level of a flood zone, worst first. */
export const ZONE_LEVELS = ['severe', 'high', 'moderate'] as const;
export type ZoneLevel = (typeof ZONE_LEVELS)[number];

export type Zone = {
  id: string;
  level: ZoneLevel;
  /** Short name of the level, e.g. "Severe". */
  label: string;
  /** Plain-words water depth for the level, e.g. "Water above 1 m". */
  depth: string;
  coordinates: Ring;
};

export type Incident = {
  id: string;
  /** "Place · what is happening" */
  title: string;
  /** Short place name, e.g. "Sunway–Monash". */
  area: string;
  type: 'flood';
  severity: 'severe' | 'high' | 'moderate' | 'low';
  sourceType: SourceType;
  sourceLabel: string;
  sourceUrl: string | null;
  updatedAt: string;
  location: LatLng;
  summary: string;
  zones: Zone[];
};

/** A safe zone: a relief point or a medical point outside every marked zone. */
export type Shelter = {
  id: string;
  incidentId: string;
  name: string;
  kind: 'relief' | 'medical';
  note: string;
  location: LatLng;
  status: 'demo-listed';
  sourceType: SourceType;
  sourceLabel: string;
  sourceUrl: string | null;
};

export type DemoLocation = { id: string; incidentId: string; label: string; location: LatLng };

/** A walking route on the road network from a demo location to a safe zone. [lng, lat] points.
 *  It follows real roads but does not know which of them are flooded. */
export type Route = {
  id: string;
  fromLocationId: string;
  shelterId: string;
  distanceM: number;
  minutes: number;
  coordinates: [number, number][];
};

export type Contact = { id: string; label: string; number: string; note: string };

/** Illustrated operations, not live agency locations or confirmed service availability. */
export type MapPoint = {
  id: string;
  incidentId: string;
  kind: 'police' | 'fire' | 'roadblock' | 'aid';
  name: string;
  note: string;
  location: LatLng;
  sourceType: 'simulation';
};

/** A closed road segment in the scenario. Routes are not recalculated around these lines. */
export type RoadClosure = {
  id: string;
  incidentId: string;
  name: string;
  reason: string;
  coordinates: [number, number][];
  sourceType: 'simulation';
};

/** What to do, by the level of the zone the person is in. */
export type Actions = Record<ZoneLevel, string[]>;

export type Scenario = {
  incidents: Incident[];
  shelters: Shelter[];
  demoLocations: DemoLocation[];
  routes: Route[];
  mapPoints: MapPoint[];
  roadClosures: RoadClosure[];
  actions: Actions;
  contacts: Contact[];
  defaultLocationId: string;
  demoBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  demoTeams: string[];
};

export const SOS_TYPES = ['trapped', 'medical-help', 'supplies', 'other'] as const;
export type SosType = (typeof SOS_TYPES)[number];

export const SOS_STATUSES = ['pending', 'assigned', 'resolved'] as const;
export type SosStatus = (typeof SOS_STATUSES)[number];

/** manual-demo: a demo coordinate picked in the UI.
 *  browser-opt-in: user consented to geolocation; the CLIENT must snap it to the
 *  nearest demo point before POST. The server rounds manual-demo to 3 dp and
 *  browser-opt-in to 2 dp (~1 km), and rejects anything outside demoBounds.
 *  Raw GPS is never stored. */
export type LocationMode = 'manual-demo' | 'browser-opt-in';

export type SosCreate = {
  incidentId: string;
  people: number;
  type: SosType;
  /** Optional free text, at most 280 characters. May be empty. */
  description: string;
  location: LatLng;
  locationMode: LocationMode;
};

export type Sos = SosCreate & {
  id: string;
  status: SosStatus;
  assignedTeam: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SosPatch =
  { status: 'assigned'; assignedTeam: string } | { status: 'resolved' } | { status: 'pending' };

/** One item in the news feed. `sourceType` says whether it is a real official warning or part of the simulated scenario. */
export type Alert = {
  id: string;
  /** The simulated incident it belongs to; null for official warnings. */
  incidentId: string | null;
  kind: 'flood' | 'shelter' | 'update' | 'weather';
  title: string;
  text: string;
  source: string;
  sourceType: SourceType;
  /** When it was issued (official) or released (simulated). */
  at: string;
  /** Official only: when the warning stops applying. */
  validTo: string | null;
  /** Official only: true when the warning names Selangor or the Klang Valley. */
  local: boolean;
  url: string | null;
};

/** Sent on GET /api/events (server-sent events) whenever something changes, so clients refetch at once. */
export type LiveEvent = { type: 'sos' | 'alerts' | 'reset' };

export type ApiError = { error: string; details?: string[] };
