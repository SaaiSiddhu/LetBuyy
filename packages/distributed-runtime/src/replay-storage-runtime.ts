import type { DistributedEventEnvelope, RuntimeCorrelationContext } from './event-envelope-runtime';

export type ReplayExecutionStatus = 'planned' | 'authorized' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ReplayCursor {
  streamName?: string;
  afterGlobalPosition?: number;
  afterStreamPosition?: number;
  occurredAfter?: string;
  occurredBefore?: string;
}

export interface ReplayAuthorization {
  requestedBy: string;
  approvedBy?: string | null;
  reason: string;
  expiresAt: string;
}

export interface ReplayStoragePlan {
  replayId: string;
  ownerRuntime: string;
  eventTypes: string[];
  tenantScope?: string | null;
  cursor: ReplayCursor;
  batchSize: number;
  authorization: ReplayAuthorization;
  dryRun: boolean;
}

export interface ReplayStorageBatch<TPayload = Record<string, unknown>> {
  replayId: string;
  events: Array<DistributedEventEnvelope<TPayload>>;
  nextCursor?: ReplayCursor;
}

export interface ReplayStorageResult {
  replayId: string;
  status: ReplayExecutionStatus;
  scanned: number;
  dispatched: number;
  skipped: number;
  failed: number;
  nextCursor?: ReplayCursor;
}

export interface ReplayStoragePort<TPayload = Record<string, unknown>> {
  authorize(plan: ReplayStoragePlan, context: RuntimeCorrelationContext): Promise<void>;
  loadBatch(plan: ReplayStoragePlan): Promise<ReplayStorageBatch<TPayload>>;
  recordResult(result: ReplayStorageResult, context: RuntimeCorrelationContext): Promise<void>;
}

export function assertReplayAuthorized(plan: ReplayStoragePlan, now = new Date()): void {
  if (!plan.authorization.approvedBy) {
    throw new Error(`Replay ${plan.replayId} is not approved`);
  }

  if (new Date(plan.authorization.expiresAt) <= now) {
    throw new Error(`Replay ${plan.replayId} authorization expired`);
  }
}

export class ReplayStorageRuntime<TPayload = Record<string, unknown>> {
  constructor(private readonly store: ReplayStoragePort<TPayload>) {}

  async prepare(plan: ReplayStoragePlan, context: RuntimeCorrelationContext): Promise<ReplayStorageBatch<TPayload>> {
    assertReplayAuthorized(plan);
    await this.store.authorize(plan, context);
    return this.store.loadBatch({
      ...plan,
      batchSize: Math.min(Math.max(plan.batchSize, 1), 1000),
    });
  }

  record(result: ReplayStorageResult, context: RuntimeCorrelationContext): Promise<void> {
    return this.store.recordResult(result, context);
  }
}
