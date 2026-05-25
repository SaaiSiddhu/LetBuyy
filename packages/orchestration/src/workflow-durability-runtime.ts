import type {
  CheckpointStorageRuntime,
  ExecutionLease,
  RuntimeCorrelationContext,
} from '@letbuyy/distributed-runtime';
import type { RetryPolicy, WorkflowDefinition } from './index';
import type { WorkflowExecutionSnapshot, WorkflowRecoveryDecision } from './workflow-recovery-runtime';
import { decideWorkflowRecovery } from './workflow-recovery-runtime';

export interface WorkflowLifecycleRecord<TState = Record<string, unknown>> {
  executionId: string;
  workflowName: string;
  workflowVersion: string;
  status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'compensating' | 'compensated' | 'timed-out' | 'dead-lettered';
  state: TState;
  currentStep?: string | null;
  attempt: number;
  lease?: ExecutionLease | null;
  timeoutAt?: string | null;
  updatedAt: string;
}

export interface WorkflowLifecycleStorePort<TState = Record<string, unknown>> {
  load(executionId: string): Promise<WorkflowLifecycleRecord<TState> | null>;
  persist(record: WorkflowLifecycleRecord<TState>, context: RuntimeCorrelationContext): Promise<void>;
  recordRecovery(executionId: string, decision: WorkflowRecoveryDecision, context: RuntimeCorrelationContext): Promise<void>;
}

export interface WorkflowCompensationPlan {
  executionId: string;
  workflowName: string;
  steps: string[];
  reason: string;
  idempotencyKey: string;
}

export interface WorkflowTimeoutDecision {
  action: 'continue' | 'timeout' | 'compensate' | 'dead-letter';
  reason: string;
}

export function decideWorkflowTimeout<TState>(
  record: WorkflowLifecycleRecord<TState>,
  definition: WorkflowDefinition<TState>,
  now = new Date(),
): WorkflowTimeoutDecision {
  if (!record.timeoutAt || new Date(record.timeoutAt) > now) {
    return { action: 'continue', reason: 'workflow timeout has not elapsed' };
  }

  if (definition.steps.some((step) => step.compensate)) {
    return { action: 'compensate', reason: 'workflow timed out and compensation is available' };
  }

  return { action: 'dead-letter', reason: 'workflow timed out without compensation' };
}

export function planWorkflowCompensation<TState>(
  snapshot: WorkflowExecutionSnapshot<TState>,
  definition: WorkflowDefinition<TState>,
  reason: string,
): WorkflowCompensationPlan {
  return {
    executionId: snapshot.executionId,
    workflowName: snapshot.workflowName,
    steps: definition.steps
      .filter((step) => Boolean(step.compensate))
      .map((step) => step.name)
      .reverse(),
    reason,
    idempotencyKey: `workflow.compensate:${snapshot.executionId}:${snapshot.attempts}`,
  };
}

export class DurableWorkflowRecoveryRuntime<TState = Record<string, unknown>> {
  constructor(
    private readonly lifecycle: WorkflowLifecycleStorePort<TState>,
    private readonly checkpoints: CheckpointStorageRuntime<TState>,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  async snapshot(record: WorkflowLifecycleRecord<TState>, context: RuntimeCorrelationContext): Promise<void> {
    await this.lifecycle.persist(record, context);
    await this.checkpoints.record({
      checkpointId: `${record.executionId}:${record.currentStep || record.status}:${record.attempt}`,
      ownerRuntime: 'orchestration',
      kind: 'workflow',
      executionId: record.executionId,
      stepName: record.currentStep || record.status,
      state: record.state,
      attempt: record.attempt,
      fencingToken: record.lease?.fencingToken || null,
      correlation: context,
    });
  }

  async recover(
    executionId: string,
    definition: WorkflowDefinition<TState>,
    context: RuntimeCorrelationContext,
  ): Promise<WorkflowRecoveryDecision> {
    const checkpoint = await this.checkpoints.latest(executionId, 'workflow');
    if (!checkpoint) return { action: 'ignore', reason: 'workflow checkpoint not found' };

    const snapshot: WorkflowExecutionSnapshot<TState> = {
      workflowName: definition.name,
      workflowVersion: definition.version,
      executionId,
      status: checkpoint.stepName === 'completed' ? 'completed' : 'failed',
      currentStep: checkpoint.stepName || undefined,
      state: checkpoint.state,
      attempts: checkpoint.attempt,
      updatedAt: checkpoint.recordedAt,
    };
    const decision = decideWorkflowRecovery(snapshot, definition, this.retryPolicy);
    await this.lifecycle.recordRecovery(executionId, decision, context);
    return decision;
  }
}
