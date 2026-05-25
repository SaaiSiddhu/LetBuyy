import { replayPayloadChecksum } from './event-envelope-runtime';

export type DistributedExecutionState =
  | 'PLANNED'
  | 'EXECUTING'
  | 'PARTIAL_FAILURE'
  | 'COMPENSATING'
  | 'RECOVERED'
  | 'VERIFIED';

export interface DistributedExecutionOperation {
  operationId: string;
  sequence: number;
  command: string;
  targetRuntime: string;
  dependsOn: string[];
  reversible: boolean;
  operationIdempotencyKey: string;
  executionHash: string;
  retryFingerprint: string;
  compensationHash: string;
  executionChecksum: string;
}

export interface DistributedExecutionCheckpoint {
  checkpointId: string;
  state: DistributedExecutionState;
  completedOperationIds: string[];
  failedOperationIds: string[];
  checkpointChecksum: string;
}

export interface DistributedExecutionJournalEntry {
  sequence: number;
  state: DistributedExecutionState;
  operationId?: string;
  previousChecksum: string | null;
  checkpointChecksum: string;
  causalityChain: string[];
}

export interface DistributedExecutionPlan {
  executionId: string;
  state: DistributedExecutionState;
  operations: DistributedExecutionOperation[];
  checkpoints: DistributedExecutionCheckpoint[];
  journal: DistributedExecutionJournalEntry[];
  executionLineageChecksum: string;
}

const executionStateOrder: DistributedExecutionState[] = [
  'PLANNED',
  'EXECUTING',
  'PARTIAL_FAILURE',
  'COMPENSATING',
  'RECOVERED',
  'VERIFIED',
];

function compareOperation(left: DistributedExecutionOperation, right: DistributedExecutionOperation): number {
  if (left.sequence !== right.sequence) return left.sequence - right.sequence;
  return left.operationId.localeCompare(right.operationId);
}

function checksumOperation(input: Omit<DistributedExecutionOperation, 'executionChecksum'>): DistributedExecutionOperation {
  return {
    ...input,
    executionChecksum: replayPayloadChecksum({
      operationId: input.operationId,
      sequence: input.sequence,
      command: input.command,
      targetRuntime: input.targetRuntime,
      dependsOn: [...input.dependsOn].sort(),
      reversible: input.reversible,
      operationIdempotencyKey: input.operationIdempotencyKey,
      executionHash: input.executionHash,
      retryFingerprint: input.retryFingerprint,
      compensationHash: input.compensationHash,
    }),
  };
}

export function createDistributedExecutionOperation(input: Omit<DistributedExecutionOperation, 'executionChecksum'>): DistributedExecutionOperation {
  return checksumOperation({
    ...input,
    dependsOn: [...input.dependsOn].sort(),
  });
}

export function createExecutionJournalEntry(input: Omit<DistributedExecutionJournalEntry, 'checkpointChecksum'>): DistributedExecutionJournalEntry {
  return {
    ...input,
    causalityChain: [...input.causalityChain],
    checkpointChecksum: replayPayloadChecksum({
      sequence: input.sequence,
      state: input.state,
      operationId: input.operationId || null,
      previousChecksum: input.previousChecksum,
      causalityChain: input.causalityChain,
    }),
  };
}

export function planDistributedExecution(input: {
  executionId: string;
  operations: Array<Omit<DistributedExecutionOperation, 'executionChecksum'> | DistributedExecutionOperation>;
}): DistributedExecutionPlan {
  const operations = input.operations
    .map((operation) => {
      if ('executionChecksum' in operation && operation.executionChecksum) {
        return {
          ...operation,
          dependsOn: [...operation.dependsOn].sort(),
        };
      }
      return createDistributedExecutionOperation(operation);
    })
    .sort(compareOperation);

  const operationIds = new Set<string>();
  for (const operation of operations) {
    if (operationIds.has(operation.operationId)) {
      throw new Error(`Distributed execution duplicate operation-id: ${operation.operationId}`);
    }
    operationIds.add(operation.operationId);
    for (const dependency of operation.dependsOn) {
      if (!operationIds.has(dependency) && !operations.some((candidate) => candidate.operationId === dependency)) {
        throw new Error(`Distributed execution operation has unresolved dependency: ${operation.operationId} -> ${dependency}`);
      }
    }
  }

  const journal: DistributedExecutionJournalEntry[] = [];
  let previousChecksum: string | null = null;
  const planned = createExecutionJournalEntry({
    sequence: 1,
    state: 'PLANNED',
    previousChecksum,
    causalityChain: [input.executionId, 'deterministic-operation-sequencing'],
  });
  journal.push(planned);
  previousChecksum = planned.checkpointChecksum;

  operations.forEach((operation, index) => {
    const entry = createExecutionJournalEntry({
      sequence: index + 2,
      state: 'EXECUTING',
      operationId: operation.operationId,
      previousChecksum,
      causalityChain: [input.executionId, operation.operationId, operation.executionChecksum],
    });
    journal.push(entry);
    previousChecksum = entry.checkpointChecksum;
  });

  const verified = createExecutionJournalEntry({
    sequence: operations.length + 2,
    state: 'VERIFIED',
    previousChecksum,
    causalityChain: [input.executionId, 'orchestration-convergence-executor', 'execution-causality-chain'],
  });
  journal.push(verified);

  const checkpoints: DistributedExecutionCheckpoint[] = [
    {
      checkpointId: `${input.executionId}:planned`,
      state: 'PLANNED',
      completedOperationIds: [],
      failedOperationIds: [],
      checkpointChecksum: planned.checkpointChecksum,
    },
    {
      checkpointId: `${input.executionId}:verified`,
      state: 'VERIFIED',
      completedOperationIds: operations.map((operation) => operation.operationId),
      failedOperationIds: [],
      checkpointChecksum: verified.checkpointChecksum,
    },
  ];

  return {
    executionId: input.executionId,
    state: 'VERIFIED',
    operations,
    checkpoints,
    journal,
    executionLineageChecksum: replayPayloadChecksum({
      executionId: input.executionId,
      operations: operations.map((operation) => operation.executionChecksum),
      checkpoints: checkpoints.map((checkpoint) => checkpoint.checkpointChecksum),
      journal: journal.map((entry) => entry.checkpointChecksum),
    }),
  };
}

export function resumeDistributedExecution(plan: DistributedExecutionPlan, checkpoint: DistributedExecutionCheckpoint): DistributedExecutionOperation[] {
  const completed = new Set(checkpoint.completedOperationIds);
  return plan.operations.filter((operation) => !completed.has(operation.operationId)).sort(compareOperation);
}

export function assertExecutionReplaySafe(plan: DistributedExecutionPlan): void {
  const expectedOperations = [...plan.operations].sort(compareOperation);
  if (JSON.stringify(expectedOperations.map((operation) => operation.operationId)) !== JSON.stringify(plan.operations.map((operation) => operation.operationId))) {
    throw new Error('Distributed execution ordering nondeterministic');
  }

  const seenSequences = new Set<number>();
  const seenOperationIds = new Set<string>();
  for (const operation of plan.operations) {
    if (seenSequences.has(operation.sequence)) {
      throw new Error(`Distributed execution sequence drift: ${operation.sequence}`);
    }
    seenSequences.add(operation.sequence);
    if (seenOperationIds.has(operation.operationId)) {
      throw new Error(`Distributed execution duplicate operation-id: ${operation.operationId}`);
    }
    seenOperationIds.add(operation.operationId);
    if (!operation.operationIdempotencyKey || !operation.executionHash || !operation.retryFingerprint || !operation.compensationHash || !operation.executionChecksum) {
      throw new Error(`Distributed execution operation lacks idempotency or checksum fields: ${operation.operationId}`);
    }
  }

  for (let index = 1; index < plan.journal.length; index += 1) {
    if (plan.journal[index]?.previousChecksum !== plan.journal[index - 1]?.checkpointChecksum) {
      throw new Error('Distributed execution journal lineage incomplete');
    }
  }

  for (const entry of plan.journal) {
    if (!executionStateOrder.includes(entry.state)) {
      throw new Error(`Distributed execution has invalid state: ${entry.state}`);
    }
  }
}
