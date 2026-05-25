import { replayPayloadChecksum } from './event-envelope-runtime';
import type {
  DistributedExecutionCheckpoint,
  DistributedExecutionJournalEntry,
  DistributedExecutionOperation,
  DistributedExecutionPlan,
  DistributedExecutionState,
} from './distributed-execution-runtime';

export type ExecutionWalEntryKind =
  | 'execution-started'
  | 'step-planned'
  | 'step-applied'
  | 'checkpoint-written'
  | 'partial-failure-recorded'
  | 'compensation-started'
  | 'execution-recovered'
  | 'execution-verified';

export interface ExecutionWalEntry {
  executionId: string;
  orchestrationId: string;
  executionSequence: number;
  kind: ExecutionWalEntryKind;
  operationId?: string;
  executionCheckpoint: string;
  executionJournalEntry: string;
  executionCausalityReference: string;
  previousWalChecksum: string | null;
  executionChecksum: string;
}

export interface DurableExecutionWal {
  executionId: string;
  orchestrationId: string;
  appendOnly: true;
  entries: ExecutionWalEntry[];
  walChecksum: string;
}

export interface DurableExecutionRestoration {
  executionId: string;
  restoredState: DistributedExecutionState;
  restoredCheckpoint: DistributedExecutionCheckpoint;
  restoredJournal: DistributedExecutionJournalEntry[];
  remainingOperations: DistributedExecutionOperation[];
  restorationChecksum: string;
}

export function appendExecutionWalEntry(
  wal: DurableExecutionWal,
  entry: Omit<ExecutionWalEntry, 'previousWalChecksum' | 'executionChecksum'>,
): DurableExecutionWal {
  const previousWalChecksum = wal.entries.at(-1)?.executionChecksum || null;
  const nextSequence = wal.entries.length + 1;
  if (entry.executionSequence !== nextSequence) {
    throw new Error(`Execution WAL sequence drift: expected ${nextSequence}, received ${entry.executionSequence}`);
  }
  const nextEntry = {
    ...entry,
    previousWalChecksum,
    executionChecksum: replayPayloadChecksum({
      ...entry,
      previousWalChecksum,
    }),
  };
  const entries = [...wal.entries, nextEntry];
  return {
    ...wal,
    entries,
    walChecksum: replayPayloadChecksum({
      executionId: wal.executionId,
      orchestrationId: wal.orchestrationId,
      entries: entries.map((item) => item.executionChecksum),
    }),
  };
}

export function createExecutionWal(input: {
  executionId: string;
  orchestrationId: string;
}): DurableExecutionWal {
  return {
    executionId: input.executionId,
    orchestrationId: input.orchestrationId,
    appendOnly: true,
    entries: [],
    walChecksum: replayPayloadChecksum({
      executionId: input.executionId,
      orchestrationId: input.orchestrationId,
      entries: [],
    }),
  };
}

export function buildExecutionWalFromPlan(input: {
  plan: DistributedExecutionPlan;
  orchestrationId: string;
}): DurableExecutionWal {
  let wal = createExecutionWal({
    executionId: input.plan.executionId,
    orchestrationId: input.orchestrationId,
  });

  wal = appendExecutionWalEntry(wal, {
    executionId: input.plan.executionId,
    orchestrationId: input.orchestrationId,
    executionSequence: 1,
    kind: 'execution-started',
    executionCheckpoint: input.plan.checkpoints[0]?.checkpointChecksum || input.plan.executionLineageChecksum,
    executionJournalEntry: input.plan.journal[0]?.checkpointChecksum || input.plan.executionLineageChecksum,
    executionCausalityReference: input.plan.executionLineageChecksum,
  });

  input.plan.operations.forEach((operation, index) => {
    wal = appendExecutionWalEntry(wal, {
      executionId: input.plan.executionId,
      orchestrationId: input.orchestrationId,
      executionSequence: index + 2,
      kind: 'step-applied',
      operationId: operation.operationId,
      executionCheckpoint: input.plan.executionLineageChecksum,
      executionJournalEntry: input.plan.journal[index + 1]?.checkpointChecksum || operation.executionChecksum,
      executionCausalityReference: operation.executionChecksum,
    });
  });

  return appendExecutionWalEntry(wal, {
    executionId: input.plan.executionId,
    orchestrationId: input.orchestrationId,
    executionSequence: input.plan.operations.length + 2,
    kind: 'execution-verified',
    executionCheckpoint: input.plan.checkpoints.at(-1)?.checkpointChecksum || input.plan.executionLineageChecksum,
    executionJournalEntry: input.plan.journal.at(-1)?.checkpointChecksum || input.plan.executionLineageChecksum,
    executionCausalityReference: input.plan.executionLineageChecksum,
  });
}

export function restoreExecutionFromWal(input: {
  plan: DistributedExecutionPlan;
  wal: DurableExecutionWal;
}): DurableExecutionRestoration {
  assertExecutionWalIntegrity(input.wal);
  const completedOperationIds = input.wal.entries
    .filter((entry) => entry.kind === 'step-applied' && entry.operationId)
    .map((entry) => entry.operationId as string)
    .sort();
  const completed = new Set(completedOperationIds);
  const remainingOperations = input.plan.operations
    .filter((operation) => !completed.has(operation.operationId))
    .sort((left, right) => {
      if (left.sequence !== right.sequence) return left.sequence - right.sequence;
      return left.operationId.localeCompare(right.operationId);
    });
  const verified = input.wal.entries.some((entry) => entry.kind === 'execution-verified');
  const failed = input.wal.entries.some((entry) => entry.kind === 'partial-failure-recorded');
  const restoredState: DistributedExecutionState = verified
    ? 'VERIFIED'
    : failed
      ? 'PARTIAL_FAILURE'
      : remainingOperations.length === 0
        ? 'RECOVERED'
        : 'EXECUTING';
  const restoredCheckpoint = {
    checkpointId: `${input.plan.executionId}:wal-restored`,
    state: restoredState,
    completedOperationIds,
    failedOperationIds: input.wal.entries
      .filter((entry) => entry.kind === 'partial-failure-recorded' && entry.operationId)
      .map((entry) => entry.operationId as string)
      .sort(),
    checkpointChecksum: replayPayloadChecksum({
      executionId: input.plan.executionId,
      restoredState,
      completedOperationIds,
      walChecksum: input.wal.walChecksum,
    }),
  };

  return {
    executionId: input.plan.executionId,
    restoredState,
    restoredCheckpoint,
    restoredJournal: input.plan.journal,
    remainingOperations,
    restorationChecksum: replayPayloadChecksum({
      executionId: input.plan.executionId,
      restoredState,
      restoredCheckpoint,
      remainingOperations: remainingOperations.map((operation) => operation.executionChecksum),
      walChecksum: input.wal.walChecksum,
    }),
  };
}

export function recoverExecutionAfterInterruption(input: {
  plan: DistributedExecutionPlan;
  wal: DurableExecutionWal;
}): DurableExecutionRestoration {
  return restoreExecutionFromWal(input);
}

export function assertExecutionWalIntegrity(wal: DurableExecutionWal): void {
  if (wal.appendOnly !== true) {
    throw new Error('Execution WAL must be append-only');
  }
  let previousWalChecksum: string | null = null;
  const sequences = new Set<number>();
  for (const entry of wal.entries) {
    if (sequences.has(entry.executionSequence)) {
      throw new Error(`Execution WAL duplicate sequence: ${entry.executionSequence}`);
    }
    sequences.add(entry.executionSequence);
    if (entry.previousWalChecksum !== previousWalChecksum) {
      throw new Error(`Execution WAL corruption possible at sequence ${entry.executionSequence}`);
    }
    if (!entry.executionId || !entry.orchestrationId || !entry.executionCheckpoint || !entry.executionJournalEntry || !entry.executionCausalityReference || !entry.executionChecksum) {
      throw new Error(`Execution WAL entry missing durable fields at sequence ${entry.executionSequence}`);
    }
    previousWalChecksum = entry.executionChecksum;
  }
}
