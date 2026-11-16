import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseScenario } from '../../../client/src/shared/scenario.ts';
import { loadFixtures } from '../../src/seed/index.ts';

test('older scenario responses keep citizen and responder maps usable', () => {
  const { mapPoints, roadClosures, ...olderScenario } = loadFixtures();
  const scenario = parseScenario(olderScenario);
  assert.deepEqual(scenario.mapPoints, []);
  assert.deepEqual(scenario.roadClosures, []);
  assert.deepEqual(scenario.incidents, olderScenario.incidents);
  assert.ok(mapPoints.length && roadClosures.length);
});

test('current operational layers are preserved', () => {
  const fixture = loadFixtures();
  assert.deepEqual(parseScenario(fixture).mapPoints, fixture.mapPoints);
  assert.deepEqual(parseScenario(fixture).roadClosures, fixture.roadClosures);
});

test('an invalid scenario becomes a load error instead of a render crash', () => {
  for (const value of [null, [], {}, '<html>proxy response</html>']) {
    assert.throws(() => parseScenario(value), /server|Restart FLARE/);
  }
});
