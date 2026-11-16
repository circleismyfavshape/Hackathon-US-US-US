import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { CitizenProfile, Scenario, Sos } from '../../../contracts/types.ts';
import { parseScenario } from '../../../client/src/shared/scenario.ts';
import { createApp } from '../../src/app.ts';
import { PROFILE_LIMITS, validateProfile } from '../../src/routes/validate.ts';
import { loadFixtures } from '../../src/seed/index.ts';

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp();
});

const post = (body: unknown) =>
  app.request('/api/sos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const request = {
  incidentId: 'INC-DEMO-004',
  people: 1,
  type: 'trapped',
  description: '',
  location: { lat: 3.0639, lng: 101.6008 },
  locationMode: 'manual-demo',
};

const profile: CitizenProfile = {
  name: 'Aisyah Rahman',
  age: 21,
  idNumber: 'DEMO-050412-10-0000',
  phone: '012-555 0142',
  bloodType: 'O+',
  medical: 'Asthma. Carries a blue inhaler.',
  appearance: 'Yellow raincoat, grey backpack.',
  languages: 'Malay, English',
  emergencyContact: 'Rahman Idris (father) · 019-555 0177',
};

describe('the demo profile', () => {
  test('the scenario carries a complete, valid profile', async () => {
    const scenario = (await (await app.request('/api/scenario')).json()) as Scenario;
    const checked = validateProfile(scenario.demoProfile);
    assert.equal(checked.ok, true);
    assert.ok(scenario.demoProfile.name && scenario.demoProfile.appearance);
  });

  test('a scenario from an older server still gives the app a usable profile', () => {
    const { demoProfile: _removed, ...older } = loadFixtures();
    const parsed = parseScenario(older);
    assert.equal(validateProfile(parsed.demoProfile).ok, true);
  });
});

describe('a profile shared with a request', () => {
  test('is stored with the request and returned to the responder list', async () => {
    const created = (await (await post({ ...request, profile })).json()) as Sos;
    assert.deepEqual(created.profile, profile);
    const [listed] = (await (await app.request('/api/sos')).json()) as Sos[];
    assert.deepEqual(listed.profile, profile);
    const one = (await (await app.request(`/api/sos/${created.id}`)).json()) as Sos;
    assert.equal(one.profile?.name, 'Aisyah Rahman');
  });

  test('is optional: absent or null means the request carries no profile', async () => {
    for (const body of [request, { ...request, profile: null }]) {
      const response = await post(body);
      assert.equal(response.status, 201);
      assert.equal(((await response.json()) as Sos).profile, null);
    }
  });

  test('is trimmed, and optional fields may be empty', async () => {
    const sparse = { ...profile, name: '  Aisyah  ', medical: '', appearance: '   ', phone: '' };
    const created = (await (await post({ ...request, profile: sparse })).json()) as Sos;
    assert.equal(created.profile?.name, 'Aisyah');
    assert.equal(created.profile?.medical, '');
    assert.equal(created.profile?.appearance, '');
  });

  test('survives an update to the request', async () => {
    const created = (await (await post({ ...request, profile })).json()) as Sos;
    const updated = (await (
      await app.request(`/api/sos/${created.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'assigned', assignedTeam: 'Rescue Team Alpha' }),
      })
    ).json()) as Sos;
    assert.deepEqual(updated.profile, profile);
  });

  for (const [name, bad] of [
    ['not an object', 'Aisyah'],
    ['an array', [profile]],
    ['an empty name', { ...profile, name: '   ' }],
    ['a missing field', { ...profile, phone: undefined }],
    ['a non-text field', { ...profile, medical: 42 }],
    ['an over-long field', { ...profile, appearance: 'x'.repeat(PROFILE_LIMITS.appearance + 1) }],
    ['a fractional age', { ...profile, age: 20.5 }],
    ['an age of zero', { ...profile, age: 0 }],
    ['an impossible age', { ...profile, age: 121 }],
    ['an age sent as text', { ...profile, age: '21' }],
  ] as const) {
    test(`rejects ${name}`, async () => {
      const response = await post({ ...request, profile: bad });
      assert.equal(response.status, 400);
      const body = (await response.json()) as { error: string; details: string[] };
      assert.equal(body.error, 'invalid SOS');
      assert.ok(body.details.every((detail) => detail.startsWith('profile')));
      assert.deepEqual(await (await app.request('/api/sos')).json(), []);
    });
  }

  test('unknown extra fields are dropped, not stored', async () => {
    const created = (await (
      await post({ ...request, profile: { ...profile, password: 'secret', isAdmin: true } })
    ).json()) as Sos;
    assert.deepEqual(created.profile, profile);
  });
});
