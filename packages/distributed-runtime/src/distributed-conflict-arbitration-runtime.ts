import { replayPayloadChecksum } from './event-envelope-runtime';
import type { DistributedStateOwner } from './distributed-consistency-runtime';

export interface DistributedConflictObservation {
  resourceId: string;
  owner: DistributedStateOwner;
  authorityRank: number;
  version: number;
  checksum: string;
}

export interface DistributedConflictDecision {
  resourceId: string;
  selectedOwner: DistributedStateOwner;
  selectedChecksum: string;
  staleAuthorities: DistributedStateOwner[];
  conflictLineageChecksum: string;
}

export function arbitrateDistributedConflicts(observations: DistributedConflictObservation[]): DistributedConflictDecision[] {
  const byResource = new Map<string, DistributedConflictObservation[]>();
  for (const observation of observations) {
    const list = byResource.get(observation.resourceId) || [];
    list.push(observation);
    byResource.set(observation.resourceId, list);
  }

  return [...byResource.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resourceId, candidates]) => {
      const ordered = [...candidates].sort((left, right) => {
        if (left.authorityRank !== right.authorityRank) return left.authorityRank - right.authorityRank;
        if (right.version !== left.version) return right.version - left.version;
        return left.checksum.localeCompare(right.checksum);
      });
      const selected = ordered[0];
      if (!selected) throw new Error(`conflict ownership ambiguous for ${resourceId}`);
      const staleAuthorities = ordered
        .slice(1)
        .filter((candidate) => candidate.checksum !== selected.checksum || candidate.version !== selected.version)
        .map((candidate) => candidate.owner)
        .sort();
      return {
        resourceId,
        selectedOwner: selected.owner,
        selectedChecksum: selected.checksum,
        staleAuthorities,
        conflictLineageChecksum: replayPayloadChecksum({
          resourceId,
          selectedOwner: selected.owner,
          selectedChecksum: selected.checksum,
          staleAuthorities,
        }),
      };
    });
}

export function assertDistributedConflictArbitration(decisions: DistributedConflictDecision[]): void {
  const seen = new Set<string>();
  for (const decision of decisions) {
    if (seen.has(decision.resourceId)) {
      throw new Error(`convergence arbitration unstable for ${decision.resourceId}`);
    }
    seen.add(decision.resourceId);
    if (decision.staleAuthorities.includes(decision.selectedOwner)) {
      throw new Error(`stale authority survives for ${decision.resourceId}`);
    }
    if (!decision.conflictLineageChecksum) {
      throw new Error(`replay conflict divergence exists for ${decision.resourceId}`);
    }
  }
}
