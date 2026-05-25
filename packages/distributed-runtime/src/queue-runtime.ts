import type { RuntimeCorrelationContext, RuntimeTenantScope } from './event-envelope-runtime';
import { routeQueuePartition, type QueuePartitionRoute, type QueuePartitioningPolicy } from './queue-partitioning';

export type QueueMessageStatus = 'scheduled' | 'available' | 'leased' | 'completed' | 'retrying' | 'dead-lettered' | 'cancelled';

export interface QueueRetryPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  initialDelayMs: number;
  maxDelayMs: number;
  retryableReasons: string[];
}

export interface QueueDeadLetterPolicy {
  queueName: string;
  retainForDays: number;
  alertAfterFailures: number;
}

export interface QueueVisibilityPolicy {
  timeoutSeconds: number;
  heartbeatSeconds: number;
  maxLeaseExtensions: number;
}

export interface QueueExecutionPolicy {
  queueName: string;
  partitioning: QueuePartitioningPolicy;
  retry: QueueRetryPolicy;
  deadLetter: QueueDeadLetterPolicy;
  visibility: QueueVisibilityPolicy;
  maxConcurrency: number;
  backpressureThreshold: number;
}

export interface QueueRuntimeClock {
  nowIso(): string;
  nowMs(): number;
}

export interface DistributedQueueMessage<TPayload = Record<string, unknown>> {
  messageId: string;
  queueName: string;
  jobType: string;
  payload: TPayload;
  status: QueueMessageStatus;
  availableAt: string;
  attempts: number;
  idempotencyKey: string;
  tenant?: RuntimeTenantScope | null;
  partition: QueuePartitionRoute;
  correlation: RuntimeCorrelationContext;
  traceparent?: string | null;
  createdAt: string;
}

export interface QueueLease {
  messageId: string;
  queueName: string;
  workerId: string;
  fencingToken: string;
  leasedUntil: string;
  leaseExtensions: number;
}

export interface QueueExecutionResult {
  status: 'completed' | 'retry' | 'dead-letter' | 'cancelled';
  reason?: string;
  output?: Record<string, unknown>;
}

export interface QueueExecutionMetrics {
  queueName: string;
  workerId: string;
  claimed: number;
  completed: number;
  retried: number;
  deadLettered: number;
  cancelled: number;
  failed: number;
  startedAt: string;
  finishedAt: string;
}

export interface QueueRecoveryPlan {
  queueName: string;
  messageId: string;
  action: 'release-expired-lease' | 'retry' | 'dead-letter' | 'ignore';
  availableAt?: string;
  reason: string;
}

export interface QueueExecutionHandler<TPayload = Record<string, unknown>> {
  handle(message: DistributedQueueMessage<TPayload>, lease: QueueLease): Promise<QueueExecutionResult>;
}

export interface QueueRuntimeStorePort<TPayload = Record<string, unknown>> {
  enqueue(message: DistributedQueueMessage<TPayload>, policy: QueueExecutionPolicy): Promise<void>;
  claim(queueName: string, workerId: string, limit: number, visibilitySeconds: number): Promise<Array<{ message: DistributedQueueMessage<TPayload>; lease: QueueLease }>>;
  complete(lease: QueueLease, result: QueueExecutionResult): Promise<void>;
  retry(lease: QueueLease, availableAt: string, result: QueueExecutionResult): Promise<void>;
  deadLetter(lease: QueueLease, result: QueueExecutionResult): Promise<void>;
  heartbeat(lease: QueueLease, visibilitySeconds: number): Promise<QueueLease>;
}

export function queueRetryDelayMs(attempt: number, policy: QueueRetryPolicy): number {
  const boundedAttempt = Math.max(1, attempt);
  const multiplier =
    policy.backoff === 'exponential'
      ? 2 ** Math.min(boundedAttempt - 1, 10)
      : policy.backoff === 'linear'
        ? boundedAttempt
        : 1;
  return Math.min(policy.initialDelayMs * multiplier, policy.maxDelayMs);
}

export function queueRetryAvailableAt(attempt: number, policy: QueueRetryPolicy, nowMs: number): string {
  if (!Number.isFinite(nowMs)) {
    throw new Error('Queue retry scheduling requires caller-supplied deterministic runtime time');
  }

  return new Date(nowMs + queueRetryDelayMs(attempt, policy)).toISOString();
}

export function planQueueRecovery<TPayload = Record<string, unknown>>(
  message: DistributedQueueMessage<TPayload>,
  policy: QueueExecutionPolicy,
  nowMs: number,
): QueueRecoveryPlan {
  if (!Number.isFinite(nowMs)) {
    throw new Error('Queue recovery requires caller-supplied deterministic runtime time');
  }

  if (message.status === 'completed' || message.status === 'cancelled' || message.status === 'dead-lettered') {
    return {
      queueName: message.queueName,
      messageId: message.messageId,
      action: 'ignore',
      reason: `queue message is already ${message.status}`,
    };
  }

  if (message.attempts >= policy.retry.maxAttempts) {
    return {
      queueName: message.queueName,
      messageId: message.messageId,
      action: 'dead-letter',
      reason: 'queue retry attempts exhausted',
    };
  }

  return {
    queueName: message.queueName,
    messageId: message.messageId,
    action: message.status === 'leased' ? 'release-expired-lease' : 'retry',
    availableAt: queueRetryAvailableAt(message.attempts + 1, policy.retry, nowMs),
    reason: message.status === 'leased' ? 'queue lease expired before completion' : 'queue message requires retry',
  };
}

export function queueThroughputPerSecond(metrics: QueueExecutionMetrics): number {
  const elapsedMs = Math.max(1, new Date(metrics.finishedAt).getTime() - new Date(metrics.startedAt).getTime());
  return metrics.completed / (elapsedMs / 1000);
}

export function createQueueMessage<TPayload = Record<string, unknown>>(input: {
  messageId: string;
  jobType: string;
  payload: TPayload;
  idempotencyKey: string;
  tenant?: RuntimeTenantScope | null;
  correlation: RuntimeCorrelationContext;
  policy: QueueExecutionPolicy;
  aggregateId?: string | null;
  availableAt: string;
  createdAt: string;
  traceparent?: string | null;
}): DistributedQueueMessage<TPayload> {
  const partition = routeQueuePartition({
    policy: input.policy.partitioning,
    tenant: input.tenant,
    aggregateId: input.aggregateId,
  });

  return {
    messageId: input.messageId,
    queueName: input.policy.queueName,
    jobType: input.jobType,
    payload: input.payload,
    status: input.availableAt > input.createdAt ? 'scheduled' : 'available',
    availableAt: input.availableAt,
    attempts: 0,
    idempotencyKey: input.idempotencyKey,
    tenant: input.tenant || null,
    partition,
    correlation: input.correlation,
    traceparent: input.traceparent || null,
    createdAt: input.createdAt,
  };
}

export class QueueRuntime<TPayload = Record<string, unknown>> {
  constructor(
    private readonly store: QueueRuntimeStorePort<TPayload>,
    private readonly policy: QueueExecutionPolicy,
    private readonly clock: QueueRuntimeClock,
  ) {}

  enqueue(message: DistributedQueueMessage<TPayload>): Promise<void> {
    return this.store.enqueue(message, this.policy);
  }

  claim(workerId: string, limit: number): Promise<Array<{ message: DistributedQueueMessage<TPayload>; lease: QueueLease }>> {
    return this.store.claim(
      this.policy.queueName,
      workerId,
      Math.min(Math.max(limit, 1), this.policy.maxConcurrency),
      this.policy.visibility.timeoutSeconds,
    );
  }

  async settle(lease: QueueLease, message: DistributedQueueMessage<TPayload>, result: QueueExecutionResult): Promise<void> {
    if (result.status === 'completed' || result.status === 'cancelled') {
      await this.store.complete(lease, result);
      return;
    }

    if (result.status === 'dead-letter' || message.attempts >= this.policy.retry.maxAttempts) {
      await this.store.deadLetter(lease, result);
      return;
    }

    await this.store.retry(lease, queueRetryAvailableAt(message.attempts + 1, this.policy.retry, this.clock.nowMs()), result);
  }

  heartbeat(lease: QueueLease): Promise<QueueLease> {
    if (lease.leaseExtensions >= this.policy.visibility.maxLeaseExtensions) {
      throw new Error(`Queue lease ${lease.messageId} cannot be extended again`);
    }

    return this.store.heartbeat(lease, this.policy.visibility.timeoutSeconds);
  }

  async executeBatch(
    workerId: string,
    limit: number,
    handler: QueueExecutionHandler<TPayload>,
  ): Promise<QueueExecutionMetrics> {
    const startedAt = this.clock.nowIso();
    const claimed = await this.claim(workerId, limit);
    const metrics: QueueExecutionMetrics = {
      queueName: this.policy.queueName,
      workerId,
      claimed: claimed.length,
      completed: 0,
      retried: 0,
      deadLettered: 0,
      cancelled: 0,
      failed: 0,
      startedAt,
      finishedAt: startedAt,
    };

    for (const { message, lease } of claimed) {
      try {
        const result = await handler.handle(message, lease);
        await this.settle(lease, message, result);
        if (result.status === 'completed') metrics.completed += 1;
        if (result.status === 'retry') metrics.retried += 1;
        if (result.status === 'dead-letter') metrics.deadLettered += 1;
        if (result.status === 'cancelled') metrics.cancelled += 1;
      } catch (error) {
        metrics.failed += 1;
        const result: QueueExecutionResult = {
          status: message.attempts + 1 >= this.policy.retry.maxAttempts ? 'dead-letter' : 'retry',
          reason: error instanceof Error ? error.message : 'queue handler failed',
        };
        await this.settle(lease, message, result);
        if (result.status === 'dead-letter') metrics.deadLettered += 1;
        if (result.status === 'retry') metrics.retried += 1;
      }
    }

    metrics.finishedAt = this.clock.nowIso();
    return metrics;
  }
}
