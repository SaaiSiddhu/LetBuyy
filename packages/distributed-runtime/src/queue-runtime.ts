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

export function queueRetryAvailableAt(attempt: number, policy: QueueRetryPolicy, now = Date.now()): string {
  return new Date(now + queueRetryDelayMs(attempt, policy)).toISOString();
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
  availableAt?: string;
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
    status: input.availableAt ? 'scheduled' : 'available',
    availableAt: input.availableAt || new Date().toISOString(),
    attempts: 0,
    idempotencyKey: input.idempotencyKey,
    tenant: input.tenant || null,
    partition,
    correlation: input.correlation,
    traceparent: input.traceparent || null,
    createdAt: new Date().toISOString(),
  };
}

export class QueueRuntime<TPayload = Record<string, unknown>> {
  constructor(
    private readonly store: QueueRuntimeStorePort<TPayload>,
    private readonly policy: QueueExecutionPolicy,
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

    await this.store.retry(lease, queueRetryAvailableAt(message.attempts + 1, this.policy.retry), result);
  }

  heartbeat(lease: QueueLease): Promise<QueueLease> {
    if (lease.leaseExtensions >= this.policy.visibility.maxLeaseExtensions) {
      throw new Error(`Queue lease ${lease.messageId} cannot be extended again`);
    }

    return this.store.heartbeat(lease, this.policy.visibility.timeoutSeconds);
  }
}
