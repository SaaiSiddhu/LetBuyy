import { replayPayloadChecksum } from './event-envelope-runtime';

export interface CompensationStep {
  stepId: string;
  compensatesOperationId: string;
  sequence: number;
  action: string;
  irreversible: boolean;
  requiresOperatorApproval: boolean;
  dependsOn: string[];
  compensationChecksum: string;
}

export interface CompensationDag {
  steps: CompensationStep[];
  orderedStepIds: string[];
  irreversibleStepIds: string[];
  dagChecksum: string;
}

function topoSortCompensation(steps: CompensationStep[]): string[] {
  const ids = steps.map((step) => step.stepId).sort();
  const incoming = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  for (const step of steps) {
    for (const dependency of step.dependsOn) {
      if (!incoming.has(dependency)) throw new Error(`Compensation DAG unresolved dependency: ${step.stepId} -> ${dependency}`);
      incoming.set(step.stepId, (incoming.get(step.stepId) || 0) + 1);
      outgoing.get(dependency)?.push(step.stepId);
    }
  }
  const ready = ids.filter((id) => incoming.get(id) === 0).sort();
  const ordered: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift();
    if (!id) break;
    ordered.push(id);
    for (const target of (outgoing.get(id) || []).sort()) {
      incoming.set(target, (incoming.get(target) || 0) - 1);
      if (incoming.get(target) === 0) ready.push(target);
      ready.sort();
    }
  }
  if (ordered.length !== ids.length) {
    throw new Error('Compensation DAG cycles exist');
  }
  return ordered;
}

export function createCompensationStep(input: Omit<CompensationStep, 'compensationChecksum'>): CompensationStep {
  return {
    ...input,
    dependsOn: [...input.dependsOn].sort(),
    compensationChecksum: replayPayloadChecksum({
      stepId: input.stepId,
      compensatesOperationId: input.compensatesOperationId,
      sequence: input.sequence,
      action: input.action,
      irreversible: input.irreversible,
      requiresOperatorApproval: input.requiresOperatorApproval,
      dependsOn: [...input.dependsOn].sort(),
    }),
  };
}

export function compileCompensationDag(steps: CompensationStep[]): CompensationDag {
  const orderedSteps = [...steps].sort((left, right) => {
    if (left.sequence !== right.sequence) return left.sequence - right.sequence;
    return left.stepId.localeCompare(right.stepId);
  });
  const orderedStepIds = topoSortCompensation(orderedSteps);
  const irreversibleStepIds = orderedSteps
    .filter((step) => step.irreversible)
    .map((step) => step.stepId)
    .sort();
  return {
    steps: orderedSteps,
    orderedStepIds,
    irreversibleStepIds,
    dagChecksum: replayPayloadChecksum({ orderedSteps, orderedStepIds, irreversibleStepIds }),
  };
}

export function assertCompensationDagSafe(dag: CompensationDag): void {
  if (dag.orderedStepIds.length !== dag.steps.length) {
    throw new Error('Compensation ordering ambiguous');
  }
  for (const step of dag.steps) {
    if (step.irreversible && !step.requiresOperatorApproval) {
      throw new Error(`Irreversible operation untracked by approval: ${step.stepId}`);
    }
    if (!step.compensationChecksum) {
      throw new Error(`Compensation step missing checksum: ${step.stepId}`);
    }
  }
}
