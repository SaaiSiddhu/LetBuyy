import { replayPayloadChecksum } from './event-envelope-runtime';

export interface ReplayBranchDefinition {
  branchId: string;
  owner: string;
  baseCheckpoint: string;
  parentBranchId: string | null;
  ttlSeconds: number;
  isolated: boolean;
  mergePolicy: 'checksum-compatible-only';
  expectedProjectionChecksum: string;
}

export interface ReplayBranchRegistry {
  branches: ReplayBranchDefinition[];
  ancestryChecksum: string;
}

export interface ReplayBranchMergeDecision {
  branchId: string;
  mergeAllowed: boolean;
  reason: string;
  decisionChecksum: string;
}

export function compileReplayBranchRegistry(branches: ReplayBranchDefinition[]): ReplayBranchRegistry {
  const ordered = [...branches].sort((left, right) => left.branchId.localeCompare(right.branchId));
  const branchIds = new Set(ordered.map((branch) => branch.branchId));
  for (const branch of ordered) {
    if (!branch.owner) throw new Error(`Replay branch ownership ambiguous: ${branch.branchId}`);
    if (!branch.isolated) throw new Error(`Replay branch leakage exists: ${branch.branchId}`);
    if (branch.ttlSeconds <= 0) throw new Error(`Replay branch TTL governance invalid: ${branch.branchId}`);
    if (branch.parentBranchId && !branchIds.has(branch.parentBranchId)) {
      throw new Error(`Replay branch lineage incomplete: ${branch.branchId}`);
    }
  }
  return {
    branches: ordered,
    ancestryChecksum: replayPayloadChecksum(ordered),
  };
}

export function validateReplayBranchMerge(
  branch: ReplayBranchDefinition,
  observedProjectionChecksum: string,
): ReplayBranchMergeDecision {
  const mergeAllowed = branch.mergePolicy === 'checksum-compatible-only' && observedProjectionChecksum === branch.expectedProjectionChecksum;
  const reason = mergeAllowed ? 'branch-converged' : 'branch-merge-corruption-possible';
  return {
    branchId: branch.branchId,
    mergeAllowed,
    reason,
    decisionChecksum: replayPayloadChecksum({
      branchId: branch.branchId,
      observedProjectionChecksum,
      expectedProjectionChecksum: branch.expectedProjectionChecksum,
      mergeAllowed,
      reason,
    }),
  };
}

export function assertReplayBranchRegistry(registry: ReplayBranchRegistry): void {
  if (registry.branches.length === 0) {
    throw new Error('Replay branch registry requires at least one isolated branch');
  }
  const ids = new Set<string>();
  for (const branch of registry.branches) {
    if (ids.has(branch.branchId)) throw new Error(`Replay branch duplicate id: ${branch.branchId}`);
    ids.add(branch.branchId);
    if (branch.mergePolicy !== 'checksum-compatible-only') {
      throw new Error(`Replay branch merge policy unsafe: ${branch.branchId}`);
    }
  }
}
