import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareAllocations, RecoveryInputError } from '../../src/recovery/index.ts';
import {
  RESOURCES,
  STRATEGIES,
  type ComparisonResult,
  type Quantities,
  type RecoverySnapshot,
  type Strategy,
} from '../../../contracts/types.ts';

const fixtures = JSON.parse(readFileSync(new URL('../../../contracts/demo-fixtures.json', import.meta.url), 'utf8'));
const seed: RecoverySnapshot = fixtures.recovery;

const q = (water: number, food: number, hygiene: number): Quantities => ({ water, food, hygiene });

function snap(inventory: Quantities, ...needs: [string, number, Quantities][]): RecoverySnapshot {
  return { inventory, centres: needs.map(([id, priority, n]) => ({ id, name: `Centre ${id}`, priority, needs: n })) };
}

function allocOf(r: ComparisonResult): Record<string, Quantities> {
  return Object.fromEntries(r.allocations.map((a) => [a.centreId, a.allocated]));
}

/** Invariants from the contract, checked on every result. */
function assertInvariants(s: RecoverySnapshot, r: ComparisonResult) {
  assert.equal(r.status, 'demo-only');
  assert.deepEqual(
    r.allocations.map((a) => a.centreId),
    s.centres.map((c) => c.id),
  );
  for (const res of RESOURCES) {
    let sum = 0;
    let need = 0;
    for (const c of s.centres) {
      const a = r.allocations.find((x) => x.centreId === c.id)!;
      assert.ok(Number.isInteger(a.allocated[res]) && a.allocated[res] >= 0);
      assert.ok(a.allocated[res] <= c.needs[res], `${c.id}.${res} over need`);
      assert.equal(a.unmet[res], c.needs[res] - a.allocated[res]);
      sum += a.allocated[res];
      need += c.needs[res];
    }
    assert.ok(sum <= s.inventory[res], `${res} over stock`);
    assert.equal(r.inventoryRemaining[res], s.inventory[res] - sum);
    assert.equal(r.totals.allocated[res], sum);
    assert.equal(r.totals.requested[res], need);
    assert.equal(r.totals.unmet[res], need - sum);
    // No stock is wasted while someone still needs it.
    assert.equal(sum, Math.min(need, s.inventory[res]), `${res} not fully used`);
  }
  assert.ok(r.explanation.length > 0 && r.assumptions.length > 0);
}

describe('seed fixture (known outputs, for D2/D3)', () => {
  test('priority-first', () => {
    const r = compareAllocations(seed, 'priority-first');
    assertInvariants(seed, r);
    assert.deepEqual(allocOf(r), { A: q(120, 100, 40), B: q(80, 100, 50), C: q(20, 0, 0) });
    assert.deepEqual(r.inventoryRemaining, q(0, 0, 0));
  });
  test('proportional', () => {
    const r = compareAllocations(seed, 'proportional');
    assertInvariants(seed, r);
    assert.deepEqual(allocOf(r), { A: q(76, 72, 23), B: q(50, 71, 28), C: q(94, 57, 39) });
  });
  test('equal-share', () => {
    const r = compareAllocations(seed, 'equal-share');
    assertInvariants(seed, r);
    assert.deepEqual(allocOf(r), { A: q(74, 67, 30), B: q(73, 67, 30), C: q(73, 66, 30) });
  });
  test('optimized (GLPK): 55% floor for everyone, rest by priority', () => {
    const r = compareAllocations(seed, 'optimized');
    assertInvariants(seed, r);
    assert.deepEqual(allocOf(r), { A: q(91, 99, 23), B: q(45, 56, 28), C: q(84, 45, 39) });
    assert.ok(r.explanation.some((l) => l.includes('at least 55%')));
  });
  test('all strategies differ under the seed shortage', () => {
    const outs = STRATEGIES.map((s) => JSON.stringify(allocOf(compareAllocations(seed, s))));
    assert.equal(new Set(outs).size, STRATEGIES.length);
  });
});

describe('edge cases, all strategies', () => {
  for (const strategy of STRATEGIES) {
    test(`${strategy}: no supply`, () => {
      const s = snap(q(0, 0, 0), ['A', 1, q(5, 5, 5)], ['B', 2, q(3, 3, 3)]);
      const r = compareAllocations(s, strategy);
      assertInvariants(s, r);
      assert.deepEqual(r.totals.allocated, q(0, 0, 0));
      assert.deepEqual(r.totals.unmet, q(8, 8, 8));
    });
    test(`${strategy}: exact supply meets everyone`, () => {
      const s = snap(q(8, 8, 8), ['A', 1, q(5, 5, 5)], ['B', 2, q(3, 3, 3)]);
      const r = compareAllocations(s, strategy);
      assertInvariants(s, r);
      assert.deepEqual(r.totals.unmet, q(0, 0, 0));
      assert.deepEqual(r.inventoryRemaining, q(0, 0, 0));
    });
    test(`${strategy}: surplus stays in stock`, () => {
      const s = snap(q(100, 9, 8), ['A', 1, q(5, 5, 5)], ['B', 2, q(3, 3, 3)]);
      const r = compareAllocations(s, strategy);
      assertInvariants(s, r);
      assert.deepEqual(r.inventoryRemaining, q(92, 1, 0));
    });
    test(`${strategy}: zero demand and no centres`, () => {
      const s1 = snap(q(10, 10, 10), ['A', 1, q(0, 0, 0)]);
      assertInvariants(s1, compareAllocations(s1, strategy));
      const s2 = snap(q(10, 10, 10));
      const r2 = compareAllocations(s2, strategy);
      assertInvariants(s2, r2);
      assert.deepEqual(r2.inventoryRemaining, q(10, 10, 10));
    });
    test(`${strategy}: deterministic and does not mutate input`, () => {
      const before = structuredClone(seed);
      const a = compareAllocations(seed, strategy);
      const b = compareAllocations(seed, strategy);
      assert.deepEqual(a, b);
      assert.deepEqual(seed, before);
    });
    test(`${strategy}: centre order in input does not change amounts`, () => {
      const rev = { ...seed, centres: [...seed.centres].reverse() };
      assert.deepEqual(allocOf(compareAllocations(rev, strategy)), allocOf(compareAllocations(seed, strategy)));
    });
  }
});

describe('strategy specifics', () => {
  test('priority-first: lower priority number wins; tie broken by id', () => {
    const s = snap(q(10, 10, 10), ['Z', 1, q(6, 6, 6)], ['B', 2, q(6, 6, 6)], ['A', 2, q(6, 6, 6)]);
    assert.deepEqual(allocOf(compareAllocations(s, 'priority-first')), { Z: q(6, 6, 6), B: q(0, 0, 0), A: q(4, 4, 4) });
  });
  test('proportional: largest remainder, tie by id', () => {
    // 10 units, requests 1:1:1 -> 3.33 each, one leftover goes to lowest id.
    const s = snap(q(10, 10, 10), ['C', 1, q(9, 9, 9)], ['B', 1, q(9, 9, 9)], ['A', 1, q(9, 9, 9)]);
    assert.deepEqual(allocOf(compareAllocations(s, 'proportional')), { C: q(3, 3, 3), B: q(3, 3, 3), A: q(4, 4, 4) });
  });
  test('proportional: large numbers stay exact', () => {
    const big = 9_000_000_000_000;
    const s = snap(q(big, 0, 0), ['A', 1, q(big, 0, 0)], ['B', 1, q(big, 0, 0)]);
    assert.deepEqual(allocOf(compareAllocations(s, 'proportional')), { A: q(big / 2, 0, 0), B: q(big / 2, 0, 0) });
  });
  test('equal-share: small requests are capped, rest is shared', () => {
    const s = snap(q(20, 0, 0), ['A', 1, q(2, 0, 0)], ['B', 2, q(100, 0, 0)], ['C', 3, q(100, 0, 0)]);
    assert.deepEqual(allocOf(compareAllocations(s, 'equal-share')), { A: q(2, 0, 0), B: q(9, 0, 0), C: q(9, 0, 0) });
  });
  test('equal-share: matches a naive one-unit round-robin', () => {
    const s = snap(q(17, 5, 31), ['A', 2, q(3, 4, 20)], ['B', 1, q(10, 1, 7)], ['C', 3, q(8, 9, 2)]);
    const r = allocOf(compareAllocations(s, 'equal-share'));
    for (const res of RESOURCES) {
      const order = [...s.centres].sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1));
      const got: Record<string, number> = Object.fromEntries(order.map((c) => [c.id, 0]));
      let left = s.inventory[res];
      let progress = true;
      while (left > 0 && progress) {
        progress = false;
        for (const c of order) {
          if (left > 0 && got[c.id] < c.needs[res]) {
            got[c.id]++;
            left--;
            progress = true;
          }
        }
      }
      for (const c of s.centres) assert.equal(r[c.id][res], got[c.id], `${res}/${c.id}`);
    }
  });
});

describe('optimized strategy (GLPK)', () => {
  /** Smallest allocated/need ratio over every nonzero need. */
  const minShare = (s: RecoverySnapshot, r: ComparisonResult) =>
    Math.min(
      1,
      ...s.centres.flatMap((c) =>
        RESOURCES.filter((res) => c.needs[res] > 0).map(
          (res) => r.allocations.find((a) => a.centreId === c.id)!.allocated[res] / c.needs[res],
        ),
      ),
    );
  test('guaranteed share is at least as high as every other strategy', () => {
    let x = 777;
    const rnd = (n: number) => ((x = (x * 1103515245 + 12345) % 2 ** 31), x % n);
    for (let i = 0; i < 60; i++) {
      const centres = Array.from({ length: 1 + rnd(4) }, (_, k) => [`C${k}`, rnd(3), q(rnd(120), rnd(120), rnd(40))]) as [
        string,
        number,
        Quantities,
      ][];
      const s = snap(q(rnd(250), rnd(250), rnd(80)), ...centres);
      const best = minShare(s, compareAllocations(s, 'optimized'));
      for (const other of ['priority-first', 'proportional', 'equal-share'] as const) {
        assert.ok(best >= minShare(s, compareAllocations(s, other)) - 1e-9, `case ${i} vs ${other}`);
      }
    }
  });
  test('leftover above the floor goes to the higher priority centre', () => {
    // 15 units, two requests of 10: the best whole-unit floor is 70% (7 each), then the 1 spare unit goes to A.
    const s = snap(q(15, 0, 0), ['B', 2, q(10, 0, 0)], ['A', 1, q(10, 0, 0)]);
    assert.deepEqual(allocOf(compareAllocations(s, 'optimized')), { B: q(7, 0, 0), A: q(8, 0, 0) });
  });
});

describe('invalid input', () => {
  const bad: [string, RecoverySnapshot][] = [
    ['negative need', snap(q(5, 5, 5), ['A', 1, q(-1, 0, 0)])],
    ['fractional need', snap(q(5, 5, 5), ['A', 1, q(1.5, 0, 0)])],
    ['negative stock', snap(q(-5, 5, 5), ['A', 1, q(1, 0, 0)])],
    ['NaN stock', snap(q(NaN, 5, 5), ['A', 1, q(1, 0, 0)])],
    ['duplicate ids', snap(q(5, 5, 5), ['A', 1, q(1, 0, 0)], ['A', 2, q(1, 0, 0)])],
  ];
  for (const [name, s] of bad) {
    test(`rejects ${name}`, () => {
      assert.throws(() => compareAllocations(s, 'proportional'), RecoveryInputError);
    });
  }
  test('rejects unknown strategy', () => {
    assert.throws(() => compareAllocations(seed, 'magic' as Strategy), RecoveryInputError);
  });
});

describe('randomised invariants', () => {
  test('500 random snapshots x 3 strategies', () => {
    let x = 12345;
    const rnd = (n: number) => ((x = (x * 1103515245 + 12345) % 2 ** 31), x % n);
    for (let i = 0; i < 500; i++) {
      const centres = Array.from({ length: rnd(6) }, (_, k) => [
        `C${k}`,
        rnd(4),
        q(rnd(200), rnd(200), rnd(50)),
      ]) as [string, number, Quantities][];
      const s = snap(q(rnd(400), rnd(400), rnd(100)), ...centres);
      for (const strategy of STRATEGIES) assertInvariants(s, compareAllocations(s, strategy));
    }
  });
});
