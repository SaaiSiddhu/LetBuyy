import { replayPayloadChecksum, type CheckpointStorageRuntime, type ReplayCursor, type RuntimeCorrelationContext } from '@letbuyy/distributed-runtime';
import type { ProjectionIdentity, ProjectionStorePort, ProjectionStoreRecord } from './projection-store';

export interface ProjectionRebuildPlan {
  rebuildId: string;
  projectionName: string;
  projectionVersion: number;
  ownerRuntime: string;
  tenantId?: string | null;
  reason: string;
  cursor: ReplayCursor;
  batchSize: number;
  requestedBy: string;
}

export interface ProjectionRebuildResult {
  rebuildId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  nextCursor?: ReplayCursor;
  integrityHash?: string;
}

export interface ProjectionRebuilder<TReadModel = Record<string, unknown>> {
  rebuild(plan: ProjectionRebuildPlan, context: RuntimeCorrelationContext): Promise<Array<ProjectionStoreRecord<TReadModel>>>;
}

export interface ProjectionRecoverySnapshot {
  projectionName: string;
  projectionVersion: number;
  objectType: string;
  objectId: string;
  sourceGlobalPosition: number;
  integrityHash: string;
}

export function projectionIntegrityHash<TReadModel = Record<string, unknown>>(
  record: ProjectionStoreRecord<TReadModel>,
): string {
  return replayPayloadChecksum({
    freshness: record.freshness,
    identity: record.identity,
    readModel: record.readModel,
  });
}

export function assertProjectionRecoverySnapshot<TReadModel = Record<string, unknown>>(
  record: ProjectionStoreRecord<TReadModel>,
  snapshot: ProjectionRecoverySnapshot,
): void {
  const actualHash = projectionIntegrityHash(record);
  if (actualHash !== snapshot.integrityHash) {
    throw new Error(`Projection recovery hash mismatch for ${snapshot.projectionName}:${snapshot.objectId}`);
  }

  if (record.identity.projectionName !== snapshot.projectionName) {
    throw new Error(`Projection recovery snapshot projection mismatch for ${snapshot.objectId}`);
  }

  if (record.identity.projectionVersion !== snapshot.projectionVersion) {
    throw new Error(`Projection recovery snapshot version mismatch for ${snapshot.objectId}`);
  }

  if (record.identity.objectType !== snapshot.objectType || record.identity.objectId !== snapshot.objectId) {
    throw new Error(`Projection recovery snapshot identity mismatch for ${snapshot.objectType}:${snapshot.objectId}`);
  }

  if (record.freshness.sourceGlobalPosition !== snapshot.sourceGlobalPosition) {
    throw new Error(`Projection recovery snapshot source position mismatch for ${snapshot.objectId}`);
  }
}

export class ProjectionRebuildRuntime<TReadModel = Record<string, unknown>> {
  constructor(
    private readonly store: ProjectionStorePort<TReadModel>,
    private readonly checkpoint: CheckpointStorageRuntime,
    private readonly rebuilder: ProjectionRebuilder<TReadModel>,
  ) {}

  async run(plan: ProjectionRebuildPlan, context: RuntimeCorrelationContext): Promise<ProjectionRebuildResult> {
    await this.checkpoint.record({
      checkpointId: `${plan.rebuildId}:start`,
      ownerRuntime: plan.ownerRuntime,
      kind: 'projection',
      executionId: plan.rebuildId,
      stepName: 'start',
      state: {
        plan,
      },
      cursor: { ...plan.cursor },
      attempt: 1,
      correlation: context,
    });

    let records: Array<ProjectionStoreRecord<TReadModel>> = [];
    try {
      records = await this.rebuilder.rebuild(plan, context);
    } catch (error) {
      const failed: ProjectionRebuildResult = {
        rebuildId: plan.rebuildId,
        status: 'failed',
        scanned: 0,
        updated: 0,
        skipped: 0,
        failed: 1,
      };
      await this.checkpoint.record({
        checkpointId: `${plan.rebuildId}:failed`,
        ownerRuntime: plan.ownerRuntime,
        kind: 'projection',
        executionId: plan.rebuildId,
        stepName: 'failed',
        state: {
          result: failed,
          reason: error instanceof Error ? error.message : 'projection rebuild failed',
        },
        cursor: { ...plan.cursor },
        attempt: 1,
        correlation: context,
      });
      return failed;
    }

    let updated = 0;
    let failed = 0;
    for (const record of records) {
      try {
        await this.store.upsert(record);
        updated += 1;
      } catch {
        failed += 1;
      }
    }

    const result: ProjectionRebuildResult = {
      rebuildId: plan.rebuildId,
      status: failed > 0 ? 'failed' : 'completed',
      scanned: records.length,
      updated,
      skipped: 0,
      failed,
      integrityHash: replayPayloadChecksum(records.map((record) => projectionIntegrityHash(record)).sort()),
    };

    await this.checkpoint.record({
      checkpointId: `${plan.rebuildId}:complete`,
      ownerRuntime: plan.ownerRuntime,
      kind: 'projection',
      executionId: plan.rebuildId,
      stepName: 'complete',
      state: { result },
      cursor: { ...(result.nextCursor || plan.cursor) },
      attempt: 1,
      correlation: context,
    });

    return result;
  }
}

export function projectionRebuildIdentity(plan: ProjectionRebuildPlan, objectType: string, objectId: string): ProjectionIdentity {
  return {
    projectionName: plan.projectionName,
    projectionVersion: plan.projectionVersion,
    tenant: plan.tenantId ? { siteId: plan.tenantId, tenantPartitionKey: plan.tenantId } : null,
    objectType,
    objectId,
  };
}
