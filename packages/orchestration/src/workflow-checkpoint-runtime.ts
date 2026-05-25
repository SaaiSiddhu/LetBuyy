import type { CorrelationContext } from './index';
import type { WorkflowExecutionSnapshot, WorkflowExecutionStatus } from './workflow-recovery-runtime';

export interface WorkflowCheckpoint<TState = Record<string, unknown>> {
  executionId: string;
  workflowName: string;
  workflowVersion: string;
  stepName: string;
  status: WorkflowExecutionStatus;
  state: TState;
  attempts: number;
  correlation: CorrelationContext;
  recordedAt: string;
}

export interface WorkflowCheckpointStorePort<TState = Record<string, unknown>> {
  persist(checkpoint: WorkflowCheckpoint<TState>): Promise<void>;
  latest(executionId: string): Promise<WorkflowCheckpoint<TState> | null>;
}

export class WorkflowCheckpointRuntime<TState = Record<string, unknown>> {
  constructor(private readonly store: WorkflowCheckpointStorePort<TState>) {}

  async checkpoint(input: Omit<WorkflowCheckpoint<TState>, 'recordedAt'>): Promise<WorkflowCheckpoint<TState>> {
    const checkpoint: WorkflowCheckpoint<TState> = {
      ...input,
      recordedAt: new Date().toISOString(),
    };
    await this.store.persist(checkpoint);
    return checkpoint;
  }

  async snapshot(executionId: string): Promise<WorkflowExecutionSnapshot<TState> | null> {
    const checkpoint = await this.store.latest(executionId);
    if (!checkpoint) return null;

    return {
      workflowName: checkpoint.workflowName,
      workflowVersion: checkpoint.workflowVersion,
      executionId: checkpoint.executionId,
      status: checkpoint.status,
      currentStep: checkpoint.stepName,
      state: checkpoint.state,
      attempts: checkpoint.attempts,
      updatedAt: checkpoint.recordedAt,
    };
  }
}
