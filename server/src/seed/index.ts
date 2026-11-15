// Synthetic demo seed. Single source of truth: contracts/demo-fixtures.json (owner: D2).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Incident, LatLng, RecoverySnapshot, Shelter } from '../../../contracts/types.ts';

export type DemoFixtures = {
  incidents: Incident[];
  shelters: Shelter[];
  demoLocations: { id: string; label: string; location: LatLng }[];
  demoBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  demoTeams: string[];
  recovery: RecoverySnapshot;
};

const fixturesPath = fileURLToPath(new URL('../../../contracts/demo-fixtures.json', import.meta.url));

/** Fresh deep copy every call, so store resets never share references with the seed. */
export function loadFixtures(): DemoFixtures {
  return JSON.parse(readFileSync(fixturesPath, 'utf8')) as DemoFixtures;
}
