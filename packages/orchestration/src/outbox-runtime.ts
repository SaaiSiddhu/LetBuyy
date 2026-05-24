import type { RuntimeEventEnvelope } from '@letbuyy/event-core';
import type { CorrelationContext, RetryPolicy } from './index';

export interface OutboxRecord<TPayload = Record<string, unknown>> {
  id: string;
  event: RuntimeEventEnvelope<TPayload>;
  status: 'queued' | 'processing' | 'processed' | 'failed' | 'dead';
  attempts: number;
  availableAt: string;
  idempotencyKey: string;
}

export interface OutboxRuntimePort {
  append<TPayload = Record<string, unknown>>(event: RuntimeEventEnvelope<TPayload>, context: CorrelationContext): Promise<OutboxRecord<TPayload>>;
  claim(limit: number, workerId: string): Promise<OutboxRecord[]>;
  acknowledge(recordId: string): Promise<void>;
  retry(recordId: string, nextAvailableAt: string, reason: string): Promise<void>;
  deadLetter(recordId: string, reason: string): Promise<void>;
}

export interface OutboxProcessorHandler {
  handle(record: OutboxRecord, context: CorrelationContext): Promise<'processed' | 'retry' | 'dead'>;
}

export class OutboxProcessor {
  constructor(
    private readonly outbox: OutboxRuntimePort,
    private readonly handler: OutboxProcessorHandler,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  async processBatch(workerId: string, limit: number, context: CorrelationContext): Promise<{ processed: number; retried: number; dead: number }> {
    const records = await this.outbox.claim(limit, workerId);
    const result = { processed: 0, retried: 0, dead: 0 };

    for (const record of records) {
      const outcome = await this.handler.handle(record, context);
      if (outcome === 'processed') {
        await this.outbox.acknowledge(record.id);
        result.processed += 1;
      } else if (outcome === 'dead' || record.attempts >= this.retryPolicy.maxAttempts) {
        await this.outbox.deadLetter(record.id, outcome === 'dead' ? 'handler requested dead-letter' : 'retry attempts exhausted');
        result.dead += 1;
      } else {
        await this.outbox.retry(record.id, nextRetryIso(record.attempts, this.retryPolicy), 'handler requested retry');
        result.retried += 1;
      }
    }

    return result;
  }
}

export function nextRetryIso(attempt: number, policy: RetryPolicy): string {
  const multiplier = policy.backoff === 'exponential' ? 2 ** Math.max(attempt - 1, 0) : 1;
  const delay = Math.min(policy.initialDelayMs * multiplier, policy.maxDelayMs);
  return new Date(Date.now() + delay).toISOString();
}
