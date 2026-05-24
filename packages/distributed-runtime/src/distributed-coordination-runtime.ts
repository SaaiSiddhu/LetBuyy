import type { RuntimeCorrelationContext } from './event-envelope-runtime';

export interface ExecutionLease {
  leaseId: string;
  resourceType: string;
  resourceId: string;
  ownerId: string;
  fencingToken: string;
  acquiredAt: string;
  expiresAt: string;
  correlation: RuntimeCorrelationContext;
}

export interface ExecutionLockRequest {
  resourceType: string;
  resourceId: string;
  ownerId: string;
  ttlSeconds: number;
  correlation: RuntimeCorrelationContext;
}

export interface DistributedCoordinationPort {
  acquire(request: ExecutionLockRequest): Promise<ExecutionLease | null>;
  renew(lease: ExecutionLease, ttlSeconds: number): Promise<ExecutionLease>;
  release(lease: ExecutionLease): Promise<void>;
  assertFence(resourceType: string, resourceId: string, fencingToken: string): Promise<boolean>;
}

export interface ExecutionHeartbeat {
  leaseId: string;
  ownerId: string;
  resourceType: string;
  resourceId: string;
  fencingToken: string;
  heartbeatAt: string;
  expiresAt: string;
}

export interface ExecutionHeartbeatPort {
  recordHeartbeat(heartbeat: ExecutionHeartbeat): Promise<void>;
  latestHeartbeat(leaseId: string): Promise<ExecutionHeartbeat | null>;
}

export interface LeaderElectionCandidate {
  runtimeName: string;
  candidateId: string;
  priority: number;
  region?: string | null;
}

export interface LeaderElectionResult {
  leaderId: string;
  term: number;
  fencingToken: string;
  electedAt: string;
}

export function createFencingToken(input: {
  resourceType: string;
  resourceId: string;
  ownerId: string;
  term: number;
}): string {
  return [input.resourceType, input.resourceId, input.ownerId, input.term].map(encodeURIComponent).join(':');
}

export function electLeader(
  candidates: LeaderElectionCandidate[],
  input: { resourceType: string; resourceId: string; term: number },
): LeaderElectionResult {
  if (candidates.length === 0) throw new Error('Leader election requires at least one candidate');
  const leader = [...candidates].sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.candidateId.localeCompare(right.candidateId);
  })[0];

  return {
    leaderId: leader.candidateId,
    term: input.term,
    fencingToken: createFencingToken({
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ownerId: leader.candidateId,
      term: input.term,
    }),
    electedAt: new Date().toISOString(),
  };
}

export class DistributedCoordinationRuntime {
  constructor(private readonly coordination: DistributedCoordinationPort) {}

  acquire(request: ExecutionLockRequest): Promise<ExecutionLease | null> {
    return this.coordination.acquire(request);
  }

  renew(lease: ExecutionLease, ttlSeconds: number): Promise<ExecutionLease> {
    return this.coordination.renew(lease, ttlSeconds);
  }

  release(lease: ExecutionLease): Promise<void> {
    return this.coordination.release(lease);
  }

  assertFence(resourceType: string, resourceId: string, fencingToken: string): Promise<boolean> {
    return this.coordination.assertFence(resourceType, resourceId, fencingToken);
  }

  async withLease<T>(
    request: ExecutionLockRequest,
    execute: (lease: ExecutionLease) => Promise<T>,
  ): Promise<T> {
    const lease = await this.coordination.acquire(request);
    if (!lease) throw new Error(`Execution lease unavailable for ${request.resourceType}:${request.resourceId}`);

    try {
      return await execute(lease);
    } finally {
      await this.coordination.release(lease);
    }
  }
}

export class DistributedExecutionHeartbeatRuntime {
  constructor(private readonly heartbeats: ExecutionHeartbeatPort) {}

  async beat(lease: ExecutionLease): Promise<ExecutionHeartbeat> {
    const heartbeat: ExecutionHeartbeat = {
      leaseId: lease.leaseId,
      ownerId: lease.ownerId,
      resourceType: lease.resourceType,
      resourceId: lease.resourceId,
      fencingToken: lease.fencingToken,
      heartbeatAt: new Date().toISOString(),
      expiresAt: lease.expiresAt,
    };
    await this.heartbeats.recordHeartbeat(heartbeat);
    return heartbeat;
  }

  async isExpired(leaseId: string, now = new Date()): Promise<boolean> {
    const heartbeat = await this.heartbeats.latestHeartbeat(leaseId);
    if (!heartbeat) return true;
    return new Date(heartbeat.expiresAt) <= now;
  }
}
