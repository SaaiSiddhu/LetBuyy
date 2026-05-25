import type { RuntimeCorrelationContext } from '@letbuyy/distributed-runtime';
import type { RetryPolicy, WorkflowDefinition } from './index';
import type {
  WorkflowLifecycleRecord,
  WorkflowLifecycleStorePort,
  WorkflowTimeoutDecision,
} from './workflow-durability-runtime';
import { decideWorkflowTimeout, planWorkflowCompensation } from './workflow-durability-runtime';
import type { WorkflowExecutionSnapshot, WorkflowRecoveryDecision } from './workflow-recovery-runtime';
import { decideWorkflowRecovery } from './workflow-recovery-runtime';

export interface WorkflowHeartbeat {
  executionId: string;
  workflowName: string;
  currentStep?: string | null;
  ownerId: string;
  heartbeatAt: string;
  expiresAt: string;
  correlation: RuntimeCorrelationContext;
}

export interface WorkflowHeartbeatPort {
  record(heartbeat: WorkflowHeartbeat): Promise<void>;
  latest(executionId: string): Promise<WorkflowHeartbeat | null>;
}

export interface WorkflowContinuationPlan {
  executionId: string;
  action: WorkflowRecoveryDecision['action'] | WorkflowTimeoutDecision['action'];
  stepName?: string | null;
  compensationSteps: string[];
  reason: string;
  replaySafe: boolean;
}

export class WorkflowContinuationRuntime<TState = Record<string, unknown>> {
  constructor(
    private readonly lifecycle: WorkflowLifecycleStorePort<TState>,
    private readonly heartbeats: WorkflowHeartbeatPort,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  async heartbeat(input: {
    record: WorkflowLifecycleRecord<TState>;
    ownerId: string;
    ttlSeconds: number;
    context: RuntimeCorrelationContext;
  }): Promise<WorkflowHeartbeat> {
    const now = new Date();
    const heartbeat: WorkflowHeartbeat = {
      executionId: input.record.executionId,
      workflowName: input.record.workflowName,
      currentStep: input.record.currentStep || null,
      ownerId: input.ownerId,
      heartbeatAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000).toISOString(),
      correlation: input.context,
    };
    await this.heartbeats.record(heartbeat);
    return heartbeat;
  }

  async planContinuation(
    executionId: string,
    definition: WorkflowDefinition<TState>,
    context: RuntimeCorrelationContext,
  ): Promise<WorkflowContinuationPlan> {
    const record = await this.lifecycle.load(executionId);
    if (!record) {
      return {
        executionId,
        action: 'ignore',
        compensationSteps: [],
        reason: 'workflow lifecycle record not found',
        replaySafe: false,
      };
    }

    const timeout = decideWorkflowTimeout(record, definition);
    if (timeout.action !== 'continue') {
      const snapshot = workflowSnapshotFromLifecycle(record);
      const compensation = timeout.action === 'compensate'
        ? planWorkflowCompensation(snapshot, definition, timeout.reason)
        : null;
      await this.lifecycle.recordRecovery(executionId, {
        action: timeout.action === 'dead-letter' ? 'dead-letter' : 'compensate',
        reason: timeout.reason,
      }, context);
      return {
        executionId,
        action: timeout.action,
        stepName: record.currentStep || null,
        compensationSteps: compensation?.steps || [],
        reason: timeout.reason,
        replaySafe: definition.replayable,
      };
    }

    const heartbeat = await this.heartbeats.latest(executionId);
    const heartbeatExpired = !heartbeat || new Date(heartbeat.expiresAt) <= new Date();
    const snapshot = workflowSnapshotFromLifecycle(record);
    const recovery = heartbeatExpired
      ? decideWorkflowRecovery(snapshot, definition, this.retryPolicy)
      : { action: 'ignore' as const, reason: 'workflow heartbeat is still active' };

    await this.lifecycle.recordRecovery(executionId, recovery, context);
    return {
      executionId,
      action: recovery.action,
      stepName: record.currentStep || null,
      compensationSteps: recovery.action === 'compensate'
        ? planWorkflowCompensation(snapshot, definition, recovery.reason).steps
        : [],
      reason: recovery.reason,
      replaySafe: definition.replayable,
    };
  }
}

export function workflowSnapshotFromLifecycle<TState>(
  record: WorkflowLifecycleRecord<TState>,
): WorkflowExecutionSnapshot<TState> {
  return {
    workflowName: record.workflowName,
    workflowVersion: record.workflowVersion,
    executionId: record.executionId,
    status: record.status === 'completed'
      ? 'completed'
      : record.status === 'compensated'
        ? 'compensated'
        : record.status === 'compensating'
          ? 'compensating'
          : record.status === 'pending' || record.status === 'running' || record.status === 'waiting'
            ? 'running'
            : 'failed',
    currentStep: record.currentStep || undefined,
    state: record.state,
    attempts: record.attempt,
    updatedAt: record.updatedAt,
  };
}
