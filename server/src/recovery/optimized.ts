// OWNER: D4. "optimized" strategy, solved with GLPK.js (mixed-integer programming).
//
// Objective, in two stages (lexicographic):
//   1. Maximise t, the share of need that EVERY centre is guaranteed for EVERY resource:
//        allocated[c][r] >= t * need[c][r]
//   2. Keeping that guarantee, maximise priority-weighted units delivered, so the stock left
//      above the guaranteed floor goes to higher-priority centres first.
// Constraints: integer units, allocated <= need, sum per resource <= stock.
// One t is shared by all resources, which couples them: this is what the solver is for.
// "Optimal" here means optimal for this stated objective only.
import GLPK, { type LP } from 'glpk.js/node';
import { RESOURCES, type Centre, type Quantities, type RecoverySnapshot, type Resource } from '../../../contracts/types.ts';

export class SolverError extends Error {}

// WASM loads once at module import; solve() itself is synchronous in Node.
// A load failure must not take the server down: the other strategies keep working and
// only 'optimized' fails (the route answers 500).
const loaded = await GLPK().catch(() => null);

function solver() {
  if (!loaded) throw new SolverError('GLPK.js failed to load; the optimized strategy is unavailable');
  return loaded;
}

export type OptimizedResult = {
  /** centre id -> whole units per resource */
  allocated: Map<string, Quantities>;
  /** Guaranteed share of every nonzero need, as a whole percentage (rounded down). */
  guaranteedPercent: number;
};

const v = (centreIndex: number, r: Resource) => `a_${centreIndex}_${r}`;

function solve(lp: LP): Record<string, number> {
  const glpk = solver();
  const out = glpk.solve(lp, { msglev: glpk.GLP_MSG_OFF, presol: true });
  if (out.result.status !== glpk.GLP_OPT) throw new SolverError(`GLPK returned status ${out.result.status} for ${lp.name}`);
  return out.result.vars;
}

export function optimize(snapshot: RecoverySnapshot): OptimizedResult {
  // Stable order: priority ascending, then id. Index in this order names the variables,
  // so the model (and so the answer) does not depend on input order.
  const centres: Centre[] = [...snapshot.centres].sort(
    (a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const allocated = new Map<string, Quantities>(centres.map((c) => [c.id, { water: 0, food: 0, hygiene: 0 }]));

  type Var = { name: string; ci: number; r: Resource; need: number };
  const vars: Var[] = [];
  centres.forEach((c, ci) => {
    for (const r of RESOURCES) if (c.needs[r] > 0) vars.push({ name: v(ci, r), ci, r, need: c.needs[r] });
  });
  if (vars.length === 0) return { allocated, guaranteedPercent: 100 };
  const glpk = solver();

  const stockRows = (prefix: string) =>
    RESOURCES.filter((r) => vars.some((x) => x.r === r)).map((r) => ({
      name: `${prefix}_stock_${r}`,
      vars: vars.filter((x) => x.r === r).map((x) => ({ name: x.name, coef: 1 })),
      bnds: { type: glpk.GLP_UP, ub: snapshot.inventory[r], lb: 0 },
    }));

  // Stage 1: maximise the guaranteed share t.
  const stage1 = solve({
    name: 'recoverygap_floor',
    objective: { direction: glpk.GLP_MAX, name: 'floor', vars: [{ name: 't', coef: 1 }] },
    subjectTo: [
      ...stockRows('s1'),
      ...vars.map((x) => ({
        name: `floor_${x.name}`,
        vars: [
          { name: x.name, coef: 1 },
          { name: 't', coef: -x.need },
        ],
        bnds: { type: glpk.GLP_LO, lb: 0, ub: 0 },
      })),
    ],
    bounds: [
      { name: 't', type: glpk.GLP_DB, lb: 0, ub: 1 },
      ...vars.map((x) => ({ name: x.name, type: glpk.GLP_DB, lb: 0, ub: x.need })),
    ],
    generals: vars.map((x) => x.name),
  });
  const t = Math.min(1, Math.max(0, stage1.t));

  // Integer floors implied by t. The epsilon absorbs solver float noise; the stage-1 integer
  // solution already satisfies these floors, so they always fit in stock.
  const floors = new Map(vars.map((x) => [x.name, Math.min(x.need, Math.max(0, Math.ceil(t * x.need - 1e-6)))]));

  // Stage 2: keep the floors, maximise priority-weighted units. Weights are distinct per
  // centre (higher priority = larger weight), which makes the optimum unique.
  const weight = (ci: number) => centres.length - ci;
  const stage2 = solve({
    name: 'recoverygap_priority',
    objective: {
      direction: glpk.GLP_MAX,
      name: 'weighted_units',
      vars: vars.map((x) => ({ name: x.name, coef: weight(x.ci) })),
    },
    subjectTo: stockRows('s2'),
    bounds: vars.map((x) => {
      const lb = floors.get(x.name)!;
      return { name: x.name, type: lb === x.need ? glpk.GLP_FX : glpk.GLP_DB, lb, ub: x.need };
    }),
    generals: vars.map((x) => x.name),
  });

  let minRatio = 1;
  for (const x of vars) {
    const units = Math.round(stage2[x.name]);
    allocated.get(centres[x.ci].id)![x.r] = units;
    minRatio = Math.min(minRatio, units / x.need);
  }
  return { allocated, guaranteedPercent: Math.floor(minRatio * 100 + 1e-9) };
}
