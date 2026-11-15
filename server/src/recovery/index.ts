// OWNER: D4 (RecoveryGap engine, @circleismyfavshape).
// Signature frozen by D2: keep the exported name and types (contracts/types.ts) unchanged.
//
// Pure + deterministic; never mutates `snapshot`; nonnegative integers only.
// Per resource: sum(allocated) <= inventory, allocated <= need, unmet = need - allocated,
// inventoryRemaining = inventory - sum(allocated). Returns every centre and every resource.
// Each resource is allocated independently. No LLM is involved: explanation text is built
// from the calculated numbers only.
import {
  RESOURCES,
  STRATEGIES,
  type Centre,
  type CentreAllocation,
  type ComparisonResult,
  type Quantities,
  type RecoverySnapshot,
  type Resource,
  type Strategy,
} from '../../../contracts/types.ts';

/** Kept for the route's 501 branch; the engine no longer throws it. */
export class NotImplementedError extends Error {}

/** Thrown for malformed input (negative, fractional or non-numeric quantities, duplicate ids). */
export class RecoveryInputError extends Error {}

type Demand = { id: string; priority: number; need: number };

const STRATEGY_LABEL: Record<Strategy, string> = {
  'priority-first': 'Priority first',
  proportional: 'Proportional',
  'equal-share': 'Equal share',
};

function isQuantity(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
}

function validate(snapshot: RecoverySnapshot, strategy: Strategy): void {
  if (!STRATEGIES.includes(strategy)) throw new RecoveryInputError(`unknown strategy: ${String(strategy)}`);
  if (!snapshot || !Array.isArray(snapshot.centres) || !snapshot.inventory) {
    throw new RecoveryInputError('snapshot must have centres[] and inventory');
  }
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const r of RESOURCES) {
    if (!isQuantity(snapshot.inventory[r])) errors.push(`inventory.${r} must be a nonnegative integer`);
  }
  for (const c of snapshot.centres) {
    if (typeof c?.id !== 'string' || c.id === '') {
      errors.push('every centre needs a string id');
      continue;
    }
    if (seen.has(c.id)) errors.push(`duplicate centre id: ${c.id}`);
    seen.add(c.id);
    if (typeof c.priority !== 'number' || !Number.isFinite(c.priority)) errors.push(`centre ${c.id}: priority must be a number`);
    for (const r of RESOURCES) {
      if (!isQuantity(c.needs?.[r])) errors.push(`centre ${c.id}: needs.${r} must be a nonnegative integer`);
    }
  }
  if (errors.length) throw new RecoveryInputError(errors.join('; '));
}

/** Priority ascending (1 = most urgent), then id, for a stable order. */
function byPriorityThenId(a: Demand, b: Demand): number {
  return a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function byId(a: Demand, b: Demand): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function priorityFirst(demands: Demand[], stock: number): Map<string, number> {
  const out = new Map<string, number>();
  let left = stock;
  for (const d of [...demands].sort(byPriorityThenId)) {
    const give = Math.min(d.need, left);
    out.set(d.id, give);
    left -= give;
  }
  return out;
}

/** Largest-remainder (Hamilton) apportionment by requested units. BigInt avoids overflow. */
function proportional(demands: Demand[], stock: number): Map<string, number> {
  const out = new Map<string, number>();
  const total = demands.reduce((s, d) => s + d.need, 0);
  if (stock >= total) {
    for (const d of demands) out.set(d.id, d.need);
    return out;
  }
  const S = BigInt(stock);
  const T = BigInt(total);
  const rems: { d: Demand; rem: bigint }[] = [];
  let given = 0;
  for (const d of demands) {
    const prod = S * BigInt(d.need);
    const base = Number(prod / T);
    out.set(d.id, base);
    given += base;
    rems.push({ d, rem: prod % T });
  }
  // Leftover < number of centres with a nonzero remainder, and a nonzero remainder means
  // base < need, so one extra unit never exceeds the request.
  let leftover = stock - given;
  rems.sort((a, b) => (a.rem > b.rem ? -1 : a.rem < b.rem ? 1 : byId(a.d, b.d)));
  for (const { d, rem } of rems) {
    if (leftover === 0 || rem === 0n) break;
    out.set(d.id, out.get(d.id)! + 1);
    leftover -= 1;
  }
  return out;
}

/** Water-filling: equivalent to round-robin one unit at a time, without the per-unit loop.
 *  Units that cannot be split evenly go one each in priority-then-id order. */
function equalShare(demands: Demand[], stock: number): Map<string, number> {
  const out = new Map<string, number>(demands.map((d) => [d.id, 0]));
  let left = stock;
  let active = demands.filter((d) => d.need > 0).sort(byPriorityThenId);
  while (active.length && left > 0) {
    const share = Math.floor(left / active.length);
    if (share === 0) {
      for (const d of active.slice(0, left)) out.set(d.id, out.get(d.id)! + 1);
      break;
    }
    const smallestGap = Math.min(...active.map((d) => d.need - out.get(d.id)!));
    const give = Math.min(share, smallestGap);
    for (const d of active) out.set(d.id, out.get(d.id)! + give);
    left -= give * active.length;
    active = active.filter((d) => out.get(d.id)! < d.need);
  }
  return out;
}

const ALLOCATORS: Record<Strategy, (d: Demand[], stock: number) => Map<string, number>> = {
  'priority-first': priorityFirst,
  proportional,
  'equal-share': equalShare,
};

function zeros(): Quantities {
  return { water: 0, food: 0, hygiene: 0 };
}

function explain(strategy: Strategy, centres: Centre[], result: Omit<ComparisonResult, 'explanation' | 'assumptions' | 'status'>): string[] {
  const lines: string[] = [];
  const name = new Map(centres.map((c) => [c.id, c.name]));
  const { requested, allocated, unmet } = result.totals;
  lines.push(
    `${STRATEGY_LABEL[strategy]}: ` +
      RESOURCES.map((r) => `${r} ${allocated[r]}/${requested[r]} requested units allocated`).join(', ') +
      '.',
  );
  for (const r of RESOURCES) {
    if (unmet[r] === 0) {
      lines.push(`All ${r} requests are met; ${result.inventoryRemaining[r]} units stay in stock.`);
    } else {
      const short = result.allocations
        .filter((a) => a.unmet[r] > 0)
        .map((a) => `${name.get(a.centreId) ?? a.centreId} (${a.unmet[r]} short)`);
      lines.push(`${r}: shortfall of ${unmet[r]} units across ${short.join(', ')}.`);
    }
  }
  const stillNeed = result.allocations
    .filter((a) => RESOURCES.some((r) => a.unmet[r] > 0))
    .map((a) => name.get(a.centreId) ?? a.centreId);
  lines.push(stillNeed.length ? `Still need help: ${stillNeed.join(', ')}.` : 'Every centre is fully supplied.');
  return lines;
}

const ASSUMPTIONS: Record<Strategy, string> = {
  'priority-first': 'Centres are filled in order of their fictional priority (1 first); ties go to the lower centre id.',
  proportional:
    'Under shortage, each centre gets stock in proportion to its request (largest-remainder rounding, ties by centre id).',
  'equal-share':
    'Stock is shared in equal units among centres that still need it; leftover single units go by priority, then id.',
};

export function compareAllocations(snapshot: RecoverySnapshot, strategy: Strategy): ComparisonResult {
  validate(snapshot, strategy);
  const centres = snapshot.centres;
  const per = new Map<string, CentreAllocation>(
    centres.map((c) => [c.id, { centreId: c.id, allocated: zeros(), unmet: zeros() }]),
  );
  const inventoryRemaining = zeros();
  const totals = { requested: zeros(), allocated: zeros(), unmet: zeros() };

  for (const r of RESOURCES as readonly Resource[]) {
    const demands: Demand[] = centres.map((c) => ({ id: c.id, priority: c.priority, need: c.needs[r] }));
    const stock = snapshot.inventory[r];
    const given = ALLOCATORS[strategy](demands, stock);
    for (const d of demands) {
      const a = per.get(d.id)!;
      const g = given.get(d.id) ?? 0;
      a.allocated[r] = g;
      a.unmet[r] = d.need - g;
      totals.requested[r] += d.need;
      totals.allocated[r] += g;
      totals.unmet[r] += d.need - g;
    }
    inventoryRemaining[r] = stock - totals.allocated[r];
  }

  const allocations = centres.map((c) => per.get(c.id)!);
  const core = { strategy, allocations, inventoryRemaining, totals };
  return {
    ...core,
    explanation: explain(strategy, centres, core),
    assumptions: [
      ASSUMPTIONS[strategy],
      'Each resource (water, food, hygiene) is allocated independently in whole units.',
      'Needs, priorities and stock are simulated demo data, not real reports.',
      'This compares simple rules; it is not a proven optimal plan. A human coordinator decides.',
    ],
    status: 'demo-only',
  };
}
