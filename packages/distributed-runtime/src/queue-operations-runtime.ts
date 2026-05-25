import type { RuntimeCorrelationContext, RuntimeTenantScope } from './event-envelope-runtime';
import type { DistributedQueueMessage, QueueExecutionMetrics, QueueExecutionPolicy, QueueRecoveryPlan } from './queue-runtime';
import { planQueueRecovery, queueThroughputPerSecond } from './queue-runtime';

export interface QueueOperationalSnapshot {
  queueName: string;
  partitionKey?: string | null;
  tenant?: RuntimeTenantScope | null;
  depth: number;
  leased: number;
  retrying: number;
  deadLettered: number;
  oldestAvailableAt?: string | null;
  newestCompletedAt?: string | null;
  sampledAt: string;
}

export interface QueueLagAnalysis {
  queueName: string;
  lagMs: number;
  pressure: 'normal' | 'elevated' | 'critical';
  reason: string;
}

export interface QueuePartitionBalancePlan {
  queueName: string;
  partitions: Array<{
    partitionKey: string;
    depth: number;
    targetWorkers: number;
    action: 'hold' | 'add-worker' | 'shed-low-priority' | 'isolate-tenant';
  }>;
}

export interface DeadLetterReplayRequest {
  queueName: string;
  messageIds: string[];
  requestedBy: string;
  reason: string;
  dryRun: boolean;
  correlation: RuntimeCorrelationContext;
}

export interface DeadLetterReplayResult {
  queueName: string;
  requested: number;
  replayed: number;
  skipped: number;
  dryRun: boolean;
  completedAt: string;
}

export interface QueueOperationsPort<TPayload = Record<string, unknown>> {
  inspect(queueName: string, limit: number): Promise<Array<DistributedQueueMessage<TPayload>>>;
  snapshots(queueName?: string): Promise<QueueOperationalSnapshot[]>;
  recover(plan: QueueRecoveryPlan, correlation: RuntimeCorrelationContext): Promise<void>;
  redrive(request: DeadLetterReplayRequest): Promise<DeadLetterReplayResult>;
  recordMetrics(metrics: QueueExecutionMetrics): Promise<void>;
}

export function analyzeQueueLag(snapshot: QueueOperationalSnapshot, now = new Date()): QueueLagAnalysis {
  const oldest = snapshot.oldestAvailableAt ? new Date(snapshot.oldestAvailableAt).getTime() : now.getTime();
  const lagMs = Math.max(0, now.getTime() - oldest);
  const pressure =
    snapshot.deadLettered > 0 || lagMs > 15 * 60_000
      ? 'critical'
      : snapshot.retrying > snapshot.depth * 0.25 || lagMs > 5 * 60_000
        ? 'elevated'
        : 'normal';

  return {
    queueName: snapshot.queueName,
    lagMs,
    pressure,
    reason: pressure === 'normal' ? 'queue lag is within target' : 'queue lag or retries exceed operational threshold',
  };
}

export function planQueuePartitionBalancing(input: {
  queueName: string;
  partitions: Array<{ partitionKey: string; depth: number; tenant?: RuntimeTenantScope | null }>;
  workersAvailable: number;
  highWatermark: number;
}): QueuePartitionBalancePlan {
  const totalDepth = input.partitions.reduce((sum, partition) => sum + partition.depth, 0);
  const workerBudget = Math.max(1, input.workersAvailable);

  return {
    queueName: input.queueName,
    partitions: input.partitions.map((partition) => {
      const share = totalDepth === 0 ? 0 : partition.depth / totalDepth;
      const targetWorkers = Math.max(1, Math.round(share * workerBudget));
      return {
        partitionKey: partition.partitionKey,
        depth: partition.depth,
        targetWorkers,
        action: partition.depth > input.highWatermark && partition.tenant ? 'isolate-tenant' : partition.depth > input.highWatermark ? 'add-worker' : 'hold',
      };
    }),
  };
}

export function queueExecutionDiagnostic(metrics: QueueExecutionMetrics): QueueLagAnalysis {
  const throughput = queueThroughputPerSecond(metrics);
  const failedRatio = metrics.claimed === 0 ? 0 : (metrics.failed + metrics.deadLettered) / metrics.claimed;
  return {
    queueName: metrics.queueName,
    lagMs: 0,
    pressure: failedRatio > 0.25 || throughput < 1 ? 'elevated' : 'normal',
    reason: failedRatio > 0.25 ? 'queue failure ratio exceeds target' : `queue throughput ${throughput.toFixed(2)} messages/sec`,
  };
}

export class QueueOperationsRuntime<TPayload = Record<string, unknown>> {
  constructor(
    private readonly operations: QueueOperationsPort<TPayload>,
    private readonly policy: QueueExecutionPolicy,
  ) {}

  inspect(limit = 100): Promise<Array<DistributedQueueMessage<TPayload>>> {
    return this.operations.inspect(this.policy.queueName, Math.min(Math.max(limit, 1), 500));
  }

  snapshots(): Promise<QueueOperationalSnapshot[]> {
    return this.operations.snapshots(this.policy.queueName);
  }

  async recoverExpired(
    messages: Array<DistributedQueueMessage<TPayload>>,
    context: RuntimeCorrelationContext,
    nowMs: number,
  ): Promise<QueueRecoveryPlan[]> {
    const plans = messages.map((message) => planQueueRecovery(message, this.policy, nowMs));
    for (const plan of plans.filter((candidate) => candidate.action !== 'ignore')) {
      await this.operations.recover(plan, context);
    }
    return plans;
  }

  redrive(request: DeadLetterReplayRequest): Promise<DeadLetterReplayResult> {
    if (request.queueName !== this.policy.queueName) {
      throw new Error(`Dead-letter redrive queue mismatch: ${request.queueName}`);
    }
    return this.operations.redrive(request);
  }

  recordExecutionMetrics(metrics: QueueExecutionMetrics): Promise<void> {
    return this.operations.recordMetrics(metrics);
  }
}
