import type { CorrelationContext, RetryPolicy, WorkflowDefinition } from './index';

export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';

export interface WorkflowExecutionSnapshot<TState = Record<string, unknown>> {
  workflowName: string;
  workflowVersion: string;
  executionId: string;
  status: WorkflowExecutionStatus;
  currentStep?: string;
  state: TState;
  attempts: number;
  lastError?: string;
  updatedAt: string;
}

export interface WorkflowRecoveryDecision {
  action: 'resume' | 'retry-step' | 'compensate' | 'dead-letter' | 'ignore';
  reason: string;
}

export interface WorkflowRecoveryStorePort<TState = Record<string, unknown>> {
  loadSnapshot(executionId: string): Promise<WorkflowExecutionSnapshot<TState> | null>;
  recordDecision(executionId: string, decision: WorkflowRecoveryDecision, context: CorrelationContext): Promise<void>;
  persistSnapshot(snapshot: WorkflowExecutionSnapshot<TState>): Promise<void>;
}

export function decideWorkflowRecovery<TState>(
  snapshot: WorkflowExecutionSnapshot<TState>,
  definition: WorkflowDefinition<TState>,
  retryPolicy: RetryPolicy,
): WorkflowRecoveryDecision {
  if (snapshot.status === 'completed' || snapshot.status === 'compensated') {
    return { action: 'ignore', reason: 'workflow is already terminal' };
  }

  if (!definition.replayable && snapshot.status === 'failed') {
    return { action: 'compensate', reason: 'non-replayable workflow failed' };
  }

  if (snapshot.attempts >= retryPolicy.maxAttempts) {
    return definition.steps.some((step) => step.compensate)
      ? { action: 'compensate', reason: 'retry attempts exhausted' }
      : { action: 'dead-letter', reason: 'retry attempts exhausted and no compensations exist' };
  }

  if (snapshot.currentStep) {
    return { action: 'retry-step', reason: `retry current step ${snapshot.currentStep}` };
  }

  return { action: 'resume', reason: 'workflow can resume from latest snapshot' };
}

export class WorkflowRecoveryRuntime<TState = Record<string, unknown>> {
  constructor(
    private readonly store: WorkflowRecoveryStorePort<TState>,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  async planRecovery(
    executionId: string,
    definition: WorkflowDefinition<TState>,
    context: CorrelationContext,
  ): Promise<WorkflowRecoveryDecision> {
    const snapshot = await this.store.loadSnapshot(executionId);
    if (!snapshot) return { action: 'ignore', reason: 'workflow snapshot not found' };

    const decision = decideWorkflowRecovery(snapshot, definition, this.retryPolicy);
    await this.store.recordDecision(executionId, decision, context);
    return decision;
  }
}
