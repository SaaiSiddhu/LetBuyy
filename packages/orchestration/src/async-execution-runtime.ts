import type { AsyncExecutionPolicy, CorrelationContext } from './index';
import { nextRetryIso } from './outbox-runtime';

export type AsyncExecutionStatus = 'scheduled' | 'claimed' | 'completed' | 'retry' | 'dead-letter';

export interface AsyncExecutionEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  queueName: string;
  jobType: string;
  payload: TPayload;
  idempotencyKey: string;
  attempts: number;
  availableAt: string;
  correlation: CorrelationContext;
}

export interface AsyncExecutionResult {
  status: AsyncExecutionStatus;
  reason?: string;
  output?: Record<string, unknown>;
}

export interface AsyncExecutionQueuePort<TPayload = Record<string, unknown>> {
  schedule(envelope: AsyncExecutionEnvelope<TPayload>, policy: AsyncExecutionPolicy): Promise<void>;
  claim(queueName: string, workerId: string, limit: number): Promise<Array<AsyncExecutionEnvelope<TPayload>>>;
  complete(jobId: string, result: AsyncExecutionResult): Promise<void>;
  retry(jobId: string, availableAt: string, result: AsyncExecutionResult): Promise<void>;
  deadLetter(jobId: string, result: AsyncExecutionResult): Promise<void>;
}

export interface AsyncExecutionHandler<TPayload = Record<string, unknown>> {
  handle(envelope: AsyncExecutionEnvelope<TPayload>): Promise<AsyncExecutionResult>;
}

export class AsyncExecutionRuntime<TPayload = Record<string, unknown>> {
  constructor(
    private readonly queue: AsyncExecutionQueuePort<TPayload>,
    private readonly handler: AsyncExecutionHandler<TPayload>,
    private readonly policy: AsyncExecutionPolicy,
  ) {}

  async schedule(envelope: AsyncExecutionEnvelope<TPayload>): Promise<void> {
    await this.queue.schedule(envelope, this.policy);
  }

  async consume(workerId: string, limit: number): Promise<{ completed: number; retried: number; deadLettered: number }> {
    const jobs = await this.queue.claim(this.policy.queueName, workerId, limit);
    const summary = { completed: 0, retried: 0, deadLettered: 0 };

    for (const job of jobs) {
      const result = await this.handler.handle(job);
      if (result.status === 'completed') {
        await this.queue.complete(job.id, result);
        summary.completed += 1;
      } else if (result.status === 'dead-letter' || job.attempts >= this.policy.retryPolicy.maxAttempts) {
        await this.queue.deadLetter(job.id, result);
        summary.deadLettered += 1;
      } else {
        await this.queue.retry(job.id, nextRetryIso(job.attempts, this.policy.retryPolicy), result);
        summary.retried += 1;
      }
    }

    return summary;
  }
}
