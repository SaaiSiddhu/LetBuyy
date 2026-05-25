import type { DistributedEventEnvelope, ReplayStoragePlan, ReplayStorageRuntime, RuntimeCorrelationContext } from '@letbuyy/distributed-runtime';
import type { ProjectionStorePort, ProjectionStoreRecord } from './projection-store';

export interface ProjectionEventProjector<TPayload = Record<string, unknown>, TReadModel = Record<string, unknown>> {
  supports(event: DistributedEventEnvelope<TPayload>): boolean;
  project(event: DistributedEventEnvelope<TPayload>, context: RuntimeCorrelationContext): Promise<ProjectionStoreRecord<TReadModel> | null>;
}

export interface ProjectionReplayResult {
  replayId: string;
  scanned: number;
  projected: number;
  skipped: number;
  failed: number;
}

export class ProjectionReplayRuntime<TPayload = Record<string, unknown>, TReadModel = Record<string, unknown>> {
  constructor(
    private readonly replay: ReplayStorageRuntime<TPayload>,
    private readonly store: ProjectionStorePort<TReadModel>,
    private readonly projector: ProjectionEventProjector<TPayload, TReadModel>,
  ) {}

  async run(plan: ReplayStoragePlan, context: RuntimeCorrelationContext): Promise<ProjectionReplayResult> {
    const batch = await this.replay.prepare(plan, context);
    const result: ProjectionReplayResult = {
      replayId: plan.replayId,
      scanned: batch.events.length,
      projected: 0,
      skipped: 0,
      failed: 0,
    };

    for (const event of batch.events) {
      try {
        if (!this.projector.supports(event)) {
          result.skipped += 1;
          continue;
        }

        const record = await this.projector.project(event, context);
        if (!record) {
          result.skipped += 1;
          continue;
        }

        await this.store.upsert(record);
        result.projected += 1;
      } catch {
        result.failed += 1;
      }
    }

    await this.replay.record({
      replayId: plan.replayId,
      status: result.failed > 0 ? 'failed' : 'completed',
      scanned: result.scanned,
      dispatched: result.projected,
      skipped: result.skipped,
      failed: result.failed,
      nextCursor: batch.nextCursor,
    }, context);

    return result;
  }
}
