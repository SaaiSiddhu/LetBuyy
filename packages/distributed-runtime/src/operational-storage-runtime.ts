import { replayPayloadChecksum } from './event-envelope-runtime';

export interface OperationalStoragePolicy {
  storageId: string;
  owner: string;
  stateClass: 'execution-wal' | 'saga-wal' | 'replay-checkpoint' | 'lineage-archive' | 'lease-checkpoint';
  retentionDays: number;
  archivePolicy: 'hot-then-cold' | 'checkpoint-only' | 'lineage-cold-storage';
  provenanceRequired: boolean;
}

export interface OperationalStorageTopology {
  policies: OperationalStoragePolicy[];
  archivalLineageChecksum: string;
}

export function compileOperationalStorageTopology(policies: OperationalStoragePolicy[]): OperationalStorageTopology {
  const ordered = [...policies].sort((left, right) => left.storageId.localeCompare(right.storageId));
  return {
    policies: ordered,
    archivalLineageChecksum: replayPayloadChecksum(ordered),
  };
}

export function assertOperationalStorageGovernance(topology: OperationalStorageTopology): void {
  const ids = new Set<string>();
  for (const policy of topology.policies) {
    if (ids.has(policy.storageId)) throw new Error(`Storage ownership ambiguous: ${policy.storageId}`);
    ids.add(policy.storageId);
    if (policy.retentionDays < 1) throw new Error(`WAL retention undefined: ${policy.storageId}`);
    if (!policy.provenanceRequired) throw new Error(`Lineage retention incomplete: ${policy.storageId}`);
  }
  for (const stateClass of ['execution-wal', 'saga-wal', 'replay-checkpoint', 'lineage-archive', 'lease-checkpoint'] as const) {
    if (!topology.policies.some((policy) => policy.stateClass === stateClass)) {
      throw new Error(`Operational storage lifecycle incomplete for ${stateClass}`);
    }
  }
}
