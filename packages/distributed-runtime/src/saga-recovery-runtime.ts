import { replayPayloadChecksum } from './event-envelope-runtime';
import type { CompensationStep } from './compensation-saga-runtime';

export type SagaRecoveryState =
  | 'SAGA_PLANNED'
  | 'COMPENSATION_RUNNING'
  | 'PARTIAL_COMPENSATION'
  | 'COMPENSATION_RECOVERED'
  | 'SAGA_CONVERGED';

export interface SagaWalEntry {
  sagaId: string;
  sequence: number;
  state: SagaRecoveryState;
  compensationStepId?: string;
  previousChecksum: string | null;
  checkpointChecksum: string;
  compensationChecksum: string;
}

export interface SagaRecoveryCheckpoint {
  sagaId: string;
  state: SagaRecoveryState;
  completedCompensationStepIds: string[];
  irreversibleOperationIds: string[];
  checkpointChecksum: string;
}

export interface PersistentSagaRecoveryPlan {
  sagaId: string;
  compensationWal: SagaWalEntry[];
  checkpoints: SagaRecoveryCheckpoint[];
  remainingSteps: CompensationStep[];
  recoveryChecksum: string;
}

export function appendSagaWalEntry(
  entries: SagaWalEntry[],
  entry: Omit<SagaWalEntry, 'previousChecksum' | 'checkpointChecksum'>,
): SagaWalEntry[] {
  const previousChecksum = entries.at(-1)?.checkpointChecksum || null;
  const next = {
    ...entry,
    previousChecksum,
    checkpointChecksum: replayPayloadChecksum({ ...entry, previousChecksum }),
  };
  return [...entries, next];
}

export function recoverPersistentSaga(input: {
  sagaId: string;
  steps: CompensationStep[];
  wal: SagaWalEntry[];
}): PersistentSagaRecoveryPlan {
  assertSagaRecoverySafe(input.wal);
  const completed = new Set(input.wal.filter((entry) => entry.compensationStepId).map((entry) => entry.compensationStepId as string));
  const remainingSteps = input.steps
    .filter((step) => !completed.has(step.stepId))
    .sort((left, right) => {
      if (left.sequence !== right.sequence) return left.sequence - right.sequence;
      return left.stepId.localeCompare(right.stepId);
    });
  const state: SagaRecoveryState = remainingSteps.length === 0 ? 'SAGA_CONVERGED' : 'PARTIAL_COMPENSATION';
  const checkpoint = {
    sagaId: input.sagaId,
    state,
    completedCompensationStepIds: [...completed].sort(),
    irreversibleOperationIds: input.steps
      .filter((step) => step.irreversible)
      .map((step) => step.stepId)
      .sort(),
    checkpointChecksum: replayPayloadChecksum({
      sagaId: input.sagaId,
      state,
      completed: [...completed].sort(),
      wal: input.wal.map((entry) => entry.checkpointChecksum),
    }),
  };

  return {
    sagaId: input.sagaId,
    compensationWal: input.wal,
    checkpoints: [checkpoint],
    remainingSteps,
    recoveryChecksum: replayPayloadChecksum({
      sagaId: input.sagaId,
      checkpoint,
      remainingSteps: remainingSteps.map((step) => step.compensationChecksum),
    }),
  };
}

export function assertSagaRecoverySafe(wal: SagaWalEntry[]): void {
  let previousChecksum: string | null = null;
  const sequences = new Set<number>();
  for (const entry of wal) {
    if (sequences.has(entry.sequence)) {
      throw new Error(`Compensation WAL duplicate sequence: ${entry.sequence}`);
    }
    sequences.add(entry.sequence);
    if (entry.previousChecksum !== previousChecksum) {
      throw new Error(`Compensation replay unsafe at sequence ${entry.sequence}`);
    }
    if (!entry.compensationChecksum || !entry.checkpointChecksum) {
      throw new Error(`Compensation lineage recovery incomplete at sequence ${entry.sequence}`);
    }
    previousChecksum = entry.checkpointChecksum;
  }
}
