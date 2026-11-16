import type { CitizenProfile, Scenario } from '../../../contracts/types.ts';

/** Used only when an older server sends a scenario without a demo profile. */
const FALLBACK_PROFILE: CitizenProfile = {
  name: 'Demo Citizen',
  age: 30,
  idNumber: '',
  phone: '',
  bloodType: '',
  medical: '',
  appearance: '',
  languages: '',
  emergencyContact: '',
};

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
    demoProfile:
      scenario.demoProfile && typeof scenario.demoProfile === 'object'
        ? { ...FALLBACK_PROFILE, ...scenario.demoProfile }
        : FALLBACK_PROFILE,
  } as Scenario;
}
