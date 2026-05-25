import type { RuntimeCorrelationContext } from '@letbuyy/distributed-runtime';
import type { RetryPolicy, WorkflowDefinition } from './index';
import type { WorkflowContinuationPlan, WorkflowContinuationRuntime } from './workflow-continuation-runtime';
import type { WorkflowLifecycleRecord, WorkflowLifecycleStorePort } from './workflow-durability-runtime';

export interface WorkflowOperationalSnapshot {
  workflowName: string;
  running: number;
  waiting: number;
  failed: number;
  timedOut: number;
  deadLettered: number;
  oldestUpdatedAt?: string | null;
  sampledAt: string;
}

export interface WorkflowDiagnostic {
  executionId: string;
  workflowName: string;
  status: 'healthy' | 'stuck' | 'timed-out' | 'failed' | 'dead-lettered';
  currentStep?: string | null;
  reason: string;
}

export interface WorkflowOperationsPort<TState = Record<string, unknown>> {
  listStuck(workflowName: string, olderThan: string, limit: number): Promise<Array<WorkflowLifecycleRecord<TState>>>;
  snapshot(workflowName: string): Promise<WorkflowOperationalSnapshot>;
  recordDiagnostic(diagnostic: WorkflowDiagnostic, context: RuntimeCorrelationContext): Promise<void>;
}

export function diagnoseWorkflowRecord<TState>(record: WorkflowLifecycleRecord<TState>, now = new Date()): WorkflowDiagnostic {
  const timeoutAt = record.timeoutAt ? new Date(record.timeoutAt).getTime() : Number.POSITIVE_INFINITY;
  const status =
    record.status === 'dead-lettered'
      ? 'dead-lettered'
      : record.status === 'failed'
        ? 'failed'
        : timeoutAt <= now.getTime()
          ? 'timed-out'
          : record.status === 'running' || record.status === 'waiting'
            ? 'stuck'
            : 'healthy';

  return {
    executionId: record.executionId,
    workflowName: record.workflowName,
    status,
    currentStep: record.currentStep || null,
    reason: status === 'healthy' ? 'workflow is not recoverable' : `workflow requires ${status} recovery inspection`,
  };
}

export class WorkflowOperationsRuntime<TState = Record<string, unknown>> {
  constructor(
    private readonly operations: WorkflowOperationsPort<TState>,
    private readonly lifecycle: WorkflowLifecycleStorePort<TState>,
    private readonly continuation: WorkflowContinuationRuntime<TState>,
  ) {}

  snapshot(workflowName: string): Promise<WorkflowOperationalSnapshot> {
    return this.operations.snapshot(workflowName);
  }

  async diagnoseStuck(workflowName: string, olderThan: string, context: RuntimeCorrelationContext): Promise<WorkflowDiagnostic[]> {
    const records = await this.operations.listStuck(workflowName, olderThan, 250);
    const diagnostics = records.map((record) => diagnoseWorkflowRecord(record));
    for (const diagnostic of diagnostics) {
      await this.operations.recordDiagnostic(diagnostic, context);
    }
    return diagnostics;
  }

  async continueWorkflow(
    executionId: string,
    definition: WorkflowDefinition<TState>,
    retryPolicy: RetryPolicy,
    context: RuntimeCorrelationContext,
  ): Promise<WorkflowContinuationPlan> {
    void retryPolicy;
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
    return this.continuation.planContinuation(executionId, definition, context);
  }
}
