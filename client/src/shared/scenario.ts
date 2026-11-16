import type { Scenario } from '../../../contracts/types.ts';

/** Additive map fields may be absent while an older server is still running after a client rebuild. */
export function parseScenario(value: unknown): Scenario {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The server did not return a scenario. Restart FLARE, then try again.');
  }

  const scenario = value as Record<string, unknown>;
  const lists = ['incidents', 'shelters', 'demoLocations', 'routes', 'contacts', 'demoTeams'];
  if (
    lists.some((key) => !Array.isArray(scenario[key])) ||
    !scenario.actions ||
    !scenario.demoBounds ||
    typeof scenario.defaultLocationId !== 'string'
  ) {
    throw new Error(
      'The running server returned an incompatible scenario. Restart FLARE, then try again.',
    );
  }

  return {
    ...scenario,
    mapPoints: Array.isArray(scenario.mapPoints) ? scenario.mapPoints : [],
    roadClosures: Array.isArray(scenario.roadClosures) ? scenario.roadClosures : [],
  } as Scenario;
}
