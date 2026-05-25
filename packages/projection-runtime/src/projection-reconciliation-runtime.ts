import type { ProjectionRecoverySnapshot } from './projection-rebuild-runtime';
import { assertProjectionRecoverySnapshot } from './projection-rebuild-runtime';
import type { ProjectionStoreRecord } from './projection-store';

export interface DesiredProjectionRecoveryState {
  projectionName: string;
  projectionVersion: number;
  ownerRuntime: string;
  sourceEvents: string[];
  snapshots: ProjectionRecoverySnapshot[];
}

export interface ObservedProjectionState<TReadModel = Record<string, unknown>> {
  projectionName: string;
  projectionVersion: number;
  ownerRuntime: string;
  records: Array<ProjectionStoreRecord<TReadModel>>;
}

export interface ProjectionReconciliationAction {
  projectionName: string;
  action: 'none' | 'rebuild' | 'restore-snapshot' | 'block-owner-drift';
  reason: string;
}

export function reconcileProjectionRecovery<TReadModel = Record<string, unknown>>(
  desired: DesiredProjectionRecoveryState,
  observed: ObservedProjectionState<TReadModel>,
): ProjectionReconciliationAction {
  if (desired.projectionName !== observed.projectionName) {
    throw new Error(`Projection reconciliation name mismatch: ${desired.projectionName} !== ${observed.projectionName}`);
  }

  if (desired.ownerRuntime !== observed.ownerRuntime) {
    return {
      projectionName: desired.projectionName,
      action: 'block-owner-drift',
      reason: 'projection owner runtime differs from manifest',
    };
  }

  if (desired.projectionVersion !== observed.projectionVersion) {
    return {
      projectionName: desired.projectionName,
      action: 'rebuild',
      reason: 'projection version drift requires rebuild',
    };
  }

  for (const snapshot of desired.snapshots) {
    const record = observed.records.find((candidate) => candidate.identity.objectId === snapshot.objectId);
    if (!record) {
      return {
        projectionName: desired.projectionName,
        action: 'restore-snapshot',
        reason: `projection snapshot missing for ${snapshot.objectType}:${snapshot.objectId}`,
      };
    }

    try {
      assertProjectionRecoverySnapshot(record, snapshot);
    } catch (error) {
      return {
        projectionName: desired.projectionName,
        action: 'rebuild',
        reason: error instanceof Error ? error.message : 'projection snapshot integrity failed',
      };
    }
  }

  return {
    projectionName: desired.projectionName,
    action: 'none',
    reason: 'projection recovery state matches manifest',
  };
}
