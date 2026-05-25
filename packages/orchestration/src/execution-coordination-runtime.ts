import type {
  DistributedCoordinationRuntime,
  ExecutionLease,
  ExecutionLockRequest,
  RuntimeCorrelationContext,
} from '@letbuyy/distributed-runtime';

export interface IdempotentExecutionClaim {
  executionId: string;
  idempotencyKey: string;
  ownerId: string;
  lease: ExecutionLease;
  correlation: RuntimeCorrelationContext;
}

export interface ExecutionOwnershipClaimInput {
  executionId: string;
  idempotencyKey: string;
  ownerId: string;
  ttlSeconds: number;
  correlation: RuntimeCorrelationContext;
}

export class OrchestrationExecutionCoordinator {
  constructor(private readonly coordination: DistributedCoordinationRuntime) {}

  async claim(input: ExecutionOwnershipClaimInput): Promise<IdempotentExecutionClaim> {
    const request: ExecutionLockRequest = {
      resourceType: 'workflow-execution',
      resourceId: input.executionId,
      ownerId: input.ownerId,
      ttlSeconds: input.ttlSeconds,
      correlation: input.correlation,
    };

    const lease = await this.coordination.acquire(request);
    if (!lease) {
      throw new Error(`Execution claim failed for ${input.executionId}`);
    }

    return {
      executionId: input.executionId,
      idempotencyKey: input.idempotencyKey,
      ownerId: input.ownerId,
      lease,
      correlation: input.correlation,
    };
  }
}
