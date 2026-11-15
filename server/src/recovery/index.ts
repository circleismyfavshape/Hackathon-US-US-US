// OWNER: D4 (RecoveryGap engine). D2 created this placeholder only to freeze the signature.
// Replace the body; keep the exported name and types (contracts/types.ts) unchanged.
//
// Required: pure + deterministic; must not mutate `snapshot`; nonnegative integers only;
// per resource: sum(allocated) <= inventory, allocated <= need, unmet = need - allocated,
// inventoryRemaining = inventory - sum(allocated). Return all centres and all resources.
import type { ComparisonResult, RecoverySnapshot, Strategy } from '../../../contracts/types.ts';

export class NotImplementedError extends Error {}

export function compareAllocations(snapshot: RecoverySnapshot, strategy: Strategy): ComparisonResult {
  void snapshot;
  void strategy;
  throw new NotImplementedError('RecoveryGap engine not merged yet (D4)');
}
