export interface RollbackOrchestrationStep {
  runtimeRoot: string;
  workerName: string;
  order: number;
  requiredGates: string[];
  preserves: Array<'replay' | 'projection' | 'queue' | 'migration' | 'deployment-lineage'>;
}

export interface RollbackOrchestrationPlan {
  environment: 'dev' | 'staging' | 'production';
  reason: string;
  previousVersionId: string;
  steps: RollbackOrchestrationStep[];
}

export function buildRollbackOrchestrationPlan(input: {
  environment: RollbackOrchestrationPlan['environment'];
  reason: string;
  previousVersionId: string;
  steps: RollbackOrchestrationStep[];
}): RollbackOrchestrationPlan {
  if (!input.previousVersionId) {
    throw new Error('Rollback orchestration requires previousVersionId');
  }
  if (!input.reason) {
    throw new Error('Rollback orchestration requires a reason');
  }

  const steps = [...input.steps].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.runtimeRoot.localeCompare(right.runtimeRoot);
  });

  for (const step of steps) {
    for (const required of ['replay', 'projection', 'queue', 'migration', 'deployment-lineage'] as const) {
      if (!step.preserves.includes(required)) {
        throw new Error(`Rollback step ${step.runtimeRoot} does not preserve ${required}`);
      }
    }
    if (step.requiredGates.length === 0) {
      throw new Error(`Rollback step ${step.runtimeRoot} requires fail-closed gates`);
    }
  }

  return {
    environment: input.environment,
    reason: input.reason,
    previousVersionId: input.previousVersionId,
    steps,
  };
}
