// FLARE shared contract types — FROZEN v1 (owner: D2 / @69sxjid).
// Imported with `import type` by both client and server. Do not edit without a
// versioned D2 change announced on the board. See contracts/API_CONTRACT.md.

export type LatLng = { lat: number; lng: number };

/** GeoJSON order: [longitude, latitude]. First point repeated at the end. */
export type Ring = [number, number][];

export type SourceType = 'simulation' | 'official';

export type Zone = {
  id: string;
  level: 'high' | 'moderate';
  label: string;
  coordinates: Ring;
};

export type Incident = {
  id: string;
  title: string;
  type: 'flood';
  severity: 'high' | 'moderate' | 'low';
  sourceType: SourceType;
  sourceLabel: string;
  sourceUrl: string | null;
  updatedAt: string;
  location: LatLng;
  zones: Zone[];
  guidance: string[];
};

export type Shelter = {
  id: string;
  incidentId: string;
  name: string;
  location: LatLng;
  status: 'demo-listed';
  sourceType: SourceType;
  sourceLabel: string;
  sourceUrl: string | null;
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
  | { status: 'assigned'; assignedTeam: string }
  | { status: 'resolved' }
  | { status: 'pending' };

export const RESOURCES = ['water', 'food', 'hygiene'] as const;
export type Resource = (typeof RESOURCES)[number];
export type Quantities = Record<Resource, number>;

export type Centre = { id: string; name: string; priority: number; needs: Quantities };
export type RecoverySnapshot = { centres: Centre[]; inventory: Quantities };

export const STRATEGIES = ['priority-first', 'proportional', 'equal-share'] as const;
export type Strategy = (typeof STRATEGIES)[number];

export type CentreAllocation = { centreId: string; allocated: Quantities; unmet: Quantities };

export type ComparisonResult = {
  strategy: Strategy;
  allocations: CentreAllocation[];
  inventoryRemaining: Quantities;
  totals: { requested: Quantities; allocated: Quantities; unmet: Quantities };
  explanation: string[];
  assumptions: string[];
  status: 'demo-only';
};

export type ApiError = { error: string; details?: string[] };
