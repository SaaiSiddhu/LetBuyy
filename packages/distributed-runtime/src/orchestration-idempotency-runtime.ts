import { replayPayloadChecksum } from './event-envelope-runtime';
import type { DistributedExecutionOperation } from './distributed-execution-runtime';

export interface IdempotentExecutionRecord {
  operationId: string;
  operationIdempotencyKey: string;
  executionHash: string;
  retryFingerprint: string;
  compensationHash: string;
  executionChecksum: string;
  applied: boolean;
}

export interface IdempotentExecutionRegistry {
  records: IdempotentExecutionRecord[];
  registryChecksum: string;
}

export interface RetryLineageNode {
  retryFingerprint: string;
  operationId: string;
  attempt: number;
  previousRetryFingerprint: string | null;
  lineageChecksum: string;
}

export function createIdempotentExecutionRegistry(operations: DistributedExecutionOperation[]): IdempotentExecutionRegistry {
  const records = operations
    .map((operation) => ({
      operationId: operation.operationId,
      operationIdempotencyKey: operation.operationIdempotencyKey,
      executionHash: operation.executionHash,
      retryFingerprint: operation.retryFingerprint,
      compensationHash: operation.compensationHash,
      executionChecksum: operation.executionChecksum,
      applied: false,
    }))
    .sort((left, right) => left.operationId.localeCompare(right.operationId));

  return {
    records,
    registryChecksum: replayPayloadChecksum(records),
  };
}

export function registerIdempotentOperation(
  registry: IdempotentExecutionRegistry,
  operation: DistributedExecutionOperation,
): IdempotentExecutionRegistry {
  const existing = registry.records.find((record) => record.operationIdempotencyKey === operation.operationIdempotencyKey);
  if (existing && existing.executionChecksum !== operation.executionChecksum) {
    throw new Error(`Idempotency key replay divergence exists: ${operation.operationIdempotencyKey}`);
  }
  if (existing?.applied) {
    return registry;
  }

  const records = registry.records
    .filter((record) => record.operationIdempotencyKey !== operation.operationIdempotencyKey)
    .concat({
      operationId: operation.operationId,
      operationIdempotencyKey: operation.operationIdempotencyKey,
      executionHash: operation.executionHash,
      retryFingerprint: operation.retryFingerprint,
      compensationHash: operation.compensationHash,
      executionChecksum: operation.executionChecksum,
      applied: true,
    })
    .sort((left, right) => left.operationId.localeCompare(right.operationId));

  return {
    records,
    registryChecksum: replayPayloadChecksum(records),
  };
}

export function buildRetryLineage(operation: DistributedExecutionOperation, attempts: number): RetryLineageNode[] {
  const lineage: RetryLineageNode[] = [];
  let previousRetryFingerprint: string | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const retryFingerprint = replayPayloadChecksum({
      operationId: operation.operationId,
      baseRetryFingerprint: operation.retryFingerprint,
      attempt,
    });
    const node = {
      retryFingerprint,
      operationId: operation.operationId,
      attempt,
      previousRetryFingerprint,
      lineageChecksum: '',
    };
    lineage.push({
      ...node,
      lineageChecksum: replayPayloadChecksum(node),
    });
    previousRetryFingerprint = retryFingerprint;
  }
  return lineage;
}

export function assertNoDuplicateExecution(registry: IdempotentExecutionRegistry): void {
  const keys = new Set<string>();
  const checksums = new Set<string>();
  for (const record of registry.records) {
    if (keys.has(record.operationIdempotencyKey)) {
      throw new Error(`Duplicate execution possible for idempotency key: ${record.operationIdempotencyKey}`);
    }
    keys.add(record.operationIdempotencyKey);
    if (checksums.has(record.executionChecksum)) {
      throw new Error(`Duplicate execution checksum possible: ${record.executionChecksum}`);
    }
    checksums.add(record.executionChecksum);
    if (!record.executionHash || !record.retryFingerprint || !record.compensationHash || !record.executionChecksum) {
      throw new Error(`Idempotent execution record missing hash fields: ${record.operationId}`);
    }
  }
}
