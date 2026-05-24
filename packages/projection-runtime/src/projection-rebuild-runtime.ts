import type { CheckpointStorageRuntime, ReplayCursor, RuntimeCorrelationContext } from '@letbuyy/distributed-runtime';
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
}

export interface ProjectionRebuilder<TReadModel = Record<string, unknown>> {
  rebuild(plan: ProjectionRebuildPlan, context: RuntimeCorrelationContext): Promise<Array<ProjectionStoreRecord<TReadModel>>>;
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

    const records = await this.rebuilder.rebuild(plan, context);
    let updated = 0;

    for (const record of records) {
      await this.store.upsert(record);
      updated += 1;
    }

    const result: ProjectionRebuildResult = {
      rebuildId: plan.rebuildId,
      status: 'completed',
      scanned: records.length,
      updated,
      skipped: 0,
      failed: 0,
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
