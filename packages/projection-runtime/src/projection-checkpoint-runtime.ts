import type {
  CheckpointStorageRuntime,
  ReplayCursor,
  RuntimeCorrelationContext,
} from '@letbuyy/distributed-runtime';
import type { ProjectionIdentity } from './projection-store';

export interface ProjectionCheckpoint {
  checkpointId: string;
  identity: ProjectionIdentity;
  ownerRuntime: string;
  cursor: ReplayCursor;
  sourceGlobalPosition?: number | null;
  sourceStreamPosition?: number | null;
  projectedCount: number;
  failedCount: number;
  recordedAt: string;
}

export class ProjectionCheckpointRuntime {
  constructor(private readonly checkpoints: CheckpointStorageRuntime<ProjectionCheckpoint>) {}

  async record(input: Omit<ProjectionCheckpoint, 'recordedAt'>, context: RuntimeCorrelationContext): Promise<ProjectionCheckpoint> {
    const checkpoint: ProjectionCheckpoint = {
      ...input,
      recordedAt: new Date().toISOString(),
    };
    await this.checkpoints.record({
      checkpointId: checkpoint.checkpointId,
      ownerRuntime: checkpoint.ownerRuntime,
      kind: 'projection',
      executionId: `${checkpoint.identity.projectionName}:${checkpoint.identity.objectType}:${checkpoint.identity.objectId}`,
      stepName: 'projection-checkpoint',
      state: checkpoint,
      cursor: { ...checkpoint.cursor },
      attempt: checkpoint.failedCount,
      correlation: context,
    });
    return checkpoint;
  }

  async latest(identity: ProjectionIdentity): Promise<ProjectionCheckpoint | null> {
    const checkpoint = await this.checkpoints.latest(
      `${identity.projectionName}:${identity.objectType}:${identity.objectId}`,
      'projection',
    );
    return checkpoint?.state || null;
  }
}
