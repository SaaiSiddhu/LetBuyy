import type { QueryConsistencyContract } from '@letbuyy/distributed-runtime';
import type { ProjectionStoreRecord } from './projection-store';

export interface ProjectionConsistencyResult {
  status: 'consistent' | 'stale' | 'missing-source-position' | 'version-mismatch';
  reason: string;
  stalenessMs: number;
}

export function verifyProjectionConsistency(
  record: ProjectionStoreRecord,
  contract: QueryConsistencyContract,
  now = new Date(),
): ProjectionConsistencyResult {
  if (record.identity.projectionVersion !== contract.readModelVersion) {
    return {
      status: 'version-mismatch',
      reason: `projection version ${record.identity.projectionVersion} does not match query contract ${contract.readModelVersion}`,
      stalenessMs: 0,
    };
  }

  if (record.freshness.sourceGlobalPosition === undefined || record.freshness.sourceGlobalPosition === null) {
    return {
      status: 'missing-source-position',
      reason: 'projection lacks source global position metadata',
      stalenessMs: 0,
    };
  }

  const projectedAt = new Date(record.freshness.projectedAt).getTime();
  const stalenessMs = Math.max(0, now.getTime() - projectedAt);
  if (contract.consistency !== 'strong' && stalenessMs > contract.stalenessBudgetMs) {
    return {
      status: 'stale',
      reason: 'projection exceeds query staleness budget',
      stalenessMs,
    };
  }

  return {
    status: 'consistent',
    reason: 'projection satisfies query consistency contract',
    stalenessMs,
  };
}

export class ProjectionConsistencyRuntime {
  verify(record: ProjectionStoreRecord, contract: QueryConsistencyContract): ProjectionConsistencyResult {
    return verifyProjectionConsistency(record, contract);
  }

  assert(record: ProjectionStoreRecord, contract: QueryConsistencyContract): void {
    const result = this.verify(record, contract);
    if (result.status !== 'consistent') {
      throw new Error(`Projection consistency check failed: ${result.reason}`);
    }
  }
}
