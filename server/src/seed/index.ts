// Synthetic demo seed. Single source of truth: contracts/demo-fixtures.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Alert, Incident, Scenario } from '../../../contracts/types.ts';

export type SeedAlert = Pick<Alert, 'id' | 'kind' | 'title' | 'text' | 'source'> & {
  incidentId: string;
  afterSeconds: number;
};

export type DemoFixtures = Scenario & { alerts: SeedAlert[] };

type RawIncident = Omit<Incident, 'updatedAt'> & { updatedMinutesAgo: number };
type RawFixtures = Omit<DemoFixtures, 'incidents'> & { incidents: RawIncident[]; _note?: string };

const fixturesPath = fileURLToPath(
  new URL('../../../contracts/demo-fixtures.json', import.meta.url),
);

/** Read a fresh fixture for each reset, with incident times relative to the new start time. */
export function loadFixtures(now = Date.now()): DemoFixtures {
  const { _note, incidents, ...rest } = JSON.parse(
    readFileSync(fixturesPath, 'utf8'),
  ) as RawFixtures;
  return {
    ...rest,
    incidents: incidents.map(({ updatedMinutesAgo, ...incident }) => ({
      ...incident,
      updatedAt: new Date(now - updatedMinutesAgo * 60_000).toISOString(),
    })),
  };
}
