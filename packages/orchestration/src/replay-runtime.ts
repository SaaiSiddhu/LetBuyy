import type { RuntimeEventEnvelope } from '@letbuyy/event-core';
import type { CorrelationContext, RetryPolicy } from './index';
import type { EventHandlerResult } from './event-runtime';

export type EventReplayStatus = 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface EventReplayCursor {
  afterEventId?: string;
  occurredAfter?: string;
  occurredBefore?: string;
}

export interface EventReplayPlan {
  replayId: string;
  owner: string;
  eventTypes: string[];
  tenantScope?: string | null;
  cursor: EventReplayCursor;
  batchSize: number;
  reason: string;
  requestedBy?: string | null;
}

export interface EventReplayBatch<TPayload = Record<string, unknown>> {
  replayId: string;
  events: Array<RuntimeEventEnvelope<TPayload>>;
  nextCursor?: EventReplayCursor;
}

export interface EventReplayResult {
  replayId: string;
  status: EventReplayStatus;
  processed: number;
  skipped: number;
  failed: number;
  nextCursor?: EventReplayCursor;
}

export interface EventReplayStorePort<TPayload = Record<string, unknown>> {
  markReplayRunning(plan: EventReplayPlan, context: CorrelationContext): Promise<void>;
  loadBatch(plan: EventReplayPlan, context: CorrelationContext): Promise<EventReplayBatch<TPayload>>;
  recordEventResult(replayId: string, event: RuntimeEventEnvelope<TPayload>, result: EventHandlerResult): Promise<void>;
  completeReplay(result: EventReplayResult): Promise<void>;
}

export interface EventReplayDispatcher<TPayload = Record<string, unknown>> {
  dispatchReplay(event: RuntimeEventEnvelope<TPayload>, context: CorrelationContext): Promise<EventHandlerResult[]>;
}

export class EventReplayRuntime<TPayload = Record<string, unknown>> {
  constructor(
    private readonly store: EventReplayStorePort<TPayload>,
    private readonly dispatcher: EventReplayDispatcher<TPayload>,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  async run(plan: EventReplayPlan, context: CorrelationContext): Promise<EventReplayResult> {
    await this.store.markReplayRunning(plan, context);
    const batch = await this.store.loadBatch(plan, context);
    const result: EventReplayResult = {
      replayId: plan.replayId,
      status: 'completed',
      processed: 0,
      skipped: 0,
      failed: 0,
      nextCursor: batch.nextCursor,
    };

    for (const event of batch.events) {
      const outcomes = await this.dispatcher.dispatchReplay(event, {
        ...context,
        causationId: context.causationId || plan.replayId,
      });
      const terminal = outcomes.some((outcome) => outcome.status === 'dead-letter' || outcome.status === 'retry');

      for (const outcome of outcomes) {
        await this.store.recordEventResult(plan.replayId, event, outcome);
      }

      if (terminal) {
        result.failed += 1;
        if (result.failed >= this.retryPolicy.maxAttempts) result.status = 'failed';
      } else if (outcomes.every((outcome) => outcome.status === 'skipped')) {
        result.skipped += 1;
      } else {
        result.processed += 1;
      }
    }

    await this.store.completeReplay(result);
    return result;
  }
}
