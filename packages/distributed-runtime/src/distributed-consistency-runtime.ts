import { replayPayloadChecksum } from './event-envelope-runtime';

export type DistributedStateOwner =
  | 'event-store'
  | 'replay-runtime'
  | 'queue-runtime'
  | 'projection-runtime'
  | 'deployment-runtime'
  | 'reconciliation-runtime';

export interface DistributedConsistencyContract {
  authoritativeOwnership: Record<DistributedStateOwner, string[]>;
  precedenceHierarchy: DistributedStateOwner[];
  staleStateArbitration: 'highest-precedence-wins-with-checksum-match';
  convergenceTimeoutSeconds: number;
  eventualConsistencyPolicy: 'deterministic-fixed-point-required';
  replayConflictArbitration: 'event-store-precedes-derived-state';
  reconciliationAuthorityOrdering: DistributedStateOwner[];
}

export interface DistributedStateObservation {
  owner: DistributedStateOwner;
  resourceId: string;
  version: number;
  checksum: string;
  observedAt: string;
}

export interface DistributedConsistencyDecision {
  resourceId: string;
  authoritativeOwner: DistributedStateOwner;
  selectedChecksum: string;
  staleOwners: DistributedStateOwner[];
  decisionChecksum: string;
}

function ownerRank(contract: DistributedConsistencyContract, owner: DistributedStateOwner): number {
  const index = contract.precedenceHierarchy.indexOf(owner);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function arbitrateDistributedConsistency(
  contract: DistributedConsistencyContract,
  observations: DistributedStateObservation[],
): DistributedConsistencyDecision[] {
  const byResource = new Map<string, DistributedStateObservation[]>();
  for (const observation of observations) {
    const list = byResource.get(observation.resourceId) || [];
    list.push(observation);
    byResource.set(observation.resourceId, list);
  }

  return [...byResource.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resourceId, resourceObservations]) => {
      const ordered = [...resourceObservations].sort((left, right) => {
        const rankDiff = ownerRank(contract, left.owner) - ownerRank(contract, right.owner);
        if (rankDiff !== 0) return rankDiff;
        if (left.version !== right.version) return right.version - left.version;
        return left.checksum.localeCompare(right.checksum);
      });
      const selected = ordered[0];
      if (!selected) throw new Error(`Distributed consistency missing observation for ${resourceId}`);
      const staleOwners = ordered
        .slice(1)
        .filter((observation) => observation.checksum !== selected.checksum || observation.version !== selected.version)
        .map((observation) => observation.owner)
        .sort();
      return {
        resourceId,
        authoritativeOwner: selected.owner,
        selectedChecksum: selected.checksum,
        staleOwners,
        decisionChecksum: replayPayloadChecksum({
          resourceId,
          authoritativeOwner: selected.owner,
          selectedChecksum: selected.checksum,
          staleOwners,
        }),
      };
    });
}

export function assertConsistencyConverges(
  contract: DistributedConsistencyContract,
  decisions: DistributedConsistencyDecision[],
): void {
  if (contract.eventualConsistencyPolicy !== 'deterministic-fixed-point-required') {
    throw new Error('Distributed consistency requires deterministic fixed-point governance');
  }
  if (contract.replayConflictArbitration !== 'event-store-precedes-derived-state') {
    throw new Error('Replay conflict arbitration must use event-store precedence');
  }
  const seen = new Set<string>();
  for (const decision of decisions) {
    if (seen.has(decision.resourceId)) {
      throw new Error(`Distributed consistency produced duplicate decision for ${decision.resourceId}`);
    }
    seen.add(decision.resourceId);
    if (!decision.decisionChecksum) {
      throw new Error(`Distributed consistency decision lacks checksum for ${decision.resourceId}`);
    }
  }
}
