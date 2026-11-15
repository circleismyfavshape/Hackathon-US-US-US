import seed from "../../../../contracts/demo-fixtures.json";
import {
  api,
  ApiRequestError,
  type ComparisonResult,
  type Incident,
  type Sos,
} from "../../shared/api.ts";

export type ResponderClient = Pick<
  typeof api,
  "incidents" | "demoConfig" | "listSos" | "patchSos" | "recovery" | "compare"
>;
export const liveResponderClient: ResponderClient = api;

// Recorded sample responses for the shared seed, not a second allocation engine.
// These are only available after explicitly choosing Sample mode in the UI.
const comparisons: Record<ComparisonResult["strategy"], ComparisonResult> = {
  "priority-first": {
    strategy: "priority-first",
    allocations: [
      {
        centreId: "A",
        allocated: { water: 120, food: 100, hygiene: 40 },
        unmet: { water: 0, food: 0, hygiene: 0 },
      },
      {
        centreId: "B",
        allocated: { water: 80, food: 100, hygiene: 50 },
        unmet: { water: 0, food: 0, hygiene: 0 },
      },
      {
        centreId: "C",
        allocated: { water: 20, food: 0, hygiene: 0 },
        unmet: { water: 130, food: 80, hygiene: 70 },
      },
    ],
    inventoryRemaining: { water: 0, food: 0, hygiene: 0 },
    totals: {
      requested: { water: 350, food: 280, hygiene: 160 },
      allocated: { water: 220, food: 200, hygiene: 90 },
      unmet: { water: 130, food: 80, hygiene: 70 },
    },
    explanation: [
      "Centre A receives its full request first, followed by B. Centre C receives 20 water units and no food or hygiene units.",
    ],
    assumptions: [
      "Recorded sample using the shared fictional seed. Priority numbers are illustrative, not ethical triage decisions.",
    ],
    status: "demo-only",
  },
  proportional: {
    strategy: "proportional",
    allocations: [
      {
        centreId: "A",
        allocated: { water: 76, food: 72, hygiene: 23 },
        unmet: { water: 44, food: 28, hygiene: 17 },
      },
      {
        centreId: "B",
        allocated: { water: 50, food: 71, hygiene: 28 },
        unmet: { water: 30, food: 29, hygiene: 22 },
      },
      {
        centreId: "C",
        allocated: { water: 94, food: 57, hygiene: 39 },
        unmet: { water: 56, food: 23, hygiene: 31 },
      },
    ],
    inventoryRemaining: { water: 0, food: 0, hygiene: 0 },
    totals: {
      requested: { water: 350, food: 280, hygiene: 160 },
      allocated: { water: 220, food: 200, hygiene: 90 },
      unmet: { water: 130, food: 80, hygiene: 70 },
    },
    explanation: [
      "Water is distributed as 76 / 50 / 94 units to A / B / C, proportional to requests with whole-unit rounding.",
    ],
    assumptions: [
      "Recorded sample using the shared fictional seed. Largest remainders receive remaining whole units, with centre ID tie-breaks.",
    ],
    status: "demo-only",
  },
  "equal-share": {
    strategy: "equal-share",
    allocations: [
      {
        centreId: "A",
        allocated: { water: 74, food: 67, hygiene: 30 },
        unmet: { water: 46, food: 33, hygiene: 10 },
      },
      {
        centreId: "B",
        allocated: { water: 73, food: 67, hygiene: 30 },
        unmet: { water: 7, food: 33, hygiene: 20 },
      },
      {
        centreId: "C",
        allocated: { water: 73, food: 66, hygiene: 30 },
        unmet: { water: 77, food: 14, hygiene: 40 },
      },
    ],
    inventoryRemaining: { water: 0, food: 0, hygiene: 0 },
    totals: {
      requested: { water: 350, food: 280, hygiene: 160 },
      allocated: { water: 220, food: 200, hygiene: 90 },
      unmet: { water: 130, food: 80, hygiene: 70 },
    },
    explanation: [
      "Each centre receives 30 hygiene units. Water and food are shared evenly, with the extra whole units assigned in centre ID order.",
    ],
    assumptions: [
      "Recorded sample using the shared fictional seed. Equal share is constrained by each centre's requested units.",
    ],
    status: "demo-only",
  },
};

function initialRequests(): Sos[] {
  return [
    {
      id: "SAMPLE-001",
      incidentId: seed.incidents[0].id,
      people: 3,
      type: "trapped",
      description:
        "Fictional household waiting upstairs; requesting assistance in this simulated scenario.",
      location: seed.demoLocations[0].location,
      locationMode: "manual-demo",
      status: "pending",
      assignedTeam: null,
      createdAt: "2026-11-15T03:05:00.000Z",
      updatedAt: "2026-11-15T03:05:00.000Z",
    },
    {
      id: "SAMPLE-002",
      incidentId: seed.incidents[0].id,
      people: 5,
      type: "supplies",
      description:
        "Fictional group requesting food packages and drinking water. Demo only.",
      location: seed.demoLocations[1].location,
      locationMode: "manual-demo",
      status: "assigned",
      assignedTeam: seed.demoTeams[0],
      createdAt: "2026-11-15T03:10:00.000Z",
      updatedAt: "2026-11-15T03:15:00.000Z",
    },
    {
      id: "SAMPLE-003",
      incidentId: seed.incidents[0].id,
      people: 2,
      type: "other",
      description:
        "Fictional request completed by a demo team. No real dispatch occurred.",
      location: seed.demoLocations[2].location,
      locationMode: "manual-demo",
      status: "resolved",
      assignedTeam: seed.demoTeams[1],
      createdAt: "2026-11-15T03:00:00.000Z",
      updatedAt: "2026-11-15T03:20:00.000Z",
    },
  ];
}

/** Each explicit sample session owns its own mutable queue; never calls the API. */
export function createSampleClient(): ResponderClient {
  const requests = structuredClone(initialRequests());
  return {
    incidents: async () => structuredClone(seed.incidents) as Incident[],
    demoConfig: async () =>
      structuredClone({
        demoLocations: seed.demoLocations,
        demoBounds: seed.demoBounds,
        demoTeams: seed.demoTeams,
      }),
    listSos: async () => structuredClone(requests),
    patchSos: async (id, patch) => {
      const record = requests.find((item) => item.id === id);
      if (!record)
        throw new ApiRequestError(404, { error: "Sample SOS not found" });
      record.status = patch.status;
      if (patch.status === "assigned") record.assignedTeam = patch.assignedTeam;
      if (patch.status === "pending") record.assignedTeam = null;
      record.updatedAt = new Date().toISOString();
      return structuredClone(record);
    },
    recovery: async () => structuredClone(seed.recovery),
    compare: async (strategy) => structuredClone(comparisons[strategy]),
  };
}
