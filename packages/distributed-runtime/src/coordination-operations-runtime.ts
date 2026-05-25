import type { ExecutionHeartbeat, ExecutionLease } from './distributed-coordination-runtime';

export interface CoordinationDiagnostic {
  resourceType: string;
  resourceId: string;
  ownerId?: string | null;
  status: 'owned' | 'expired' | 'contended' | 'unowned';
  fencingToken?: string | null;
  reason: string;
}

export interface CoordinationFailoverPlan {
  resourceType: string;
  resourceId: string;
  fromOwner?: string | null;
  toOwner: string;
  action: 'transfer' | 'wait' | 'force-release';
  reason: string;
}

export interface CoordinationOperationsPort {
  listLeases(resourceType?: string): Promise<ExecutionLease[]>;
  listHeartbeats(resourceType?: string): Promise<ExecutionHeartbeat[]>;
  transferOwnership(plan: CoordinationFailoverPlan): Promise<void>;
}

export function diagnoseLease(lease: ExecutionLease | null, heartbeat: ExecutionHeartbeat | null, now = new Date()): CoordinationDiagnostic {
  if (!lease) {
    return {
      resourceType: heartbeat?.resourceType || 'unknown',
      resourceId: heartbeat?.resourceId || 'unknown',
      ownerId: heartbeat?.ownerId || null,
      status: 'unowned',
      fencingToken: heartbeat?.fencingToken || null,
      reason: 'no active lease exists',
    };
  }

  const leaseExpired = new Date(lease.expiresAt) <= now;
  const heartbeatExpired = !heartbeat || new Date(heartbeat.expiresAt) <= now;
  return {
    resourceType: lease.resourceType,
    resourceId: lease.resourceId,
    ownerId: lease.ownerId,
    status: leaseExpired || heartbeatExpired ? 'expired' : 'owned',
    fencingToken: lease.fencingToken,
    reason: leaseExpired ? 'lease expired' : heartbeatExpired ? 'heartbeat expired' : 'lease is actively owned',
  };
}

export function planCoordinationFailover(input: {
  diagnostic: CoordinationDiagnostic;
  candidateOwner: string;
}): CoordinationFailoverPlan {
  return {
    resourceType: input.diagnostic.resourceType,
    resourceId: input.diagnostic.resourceId,
    fromOwner: input.diagnostic.ownerId || null,
    toOwner: input.candidateOwner,
    action: input.diagnostic.status === 'expired' || input.diagnostic.status === 'unowned' ? 'transfer' : 'wait',
    reason: input.diagnostic.reason,
  };
}

export class CoordinationOperationsRuntime {
  constructor(private readonly operations: CoordinationOperationsPort) {}

  async diagnose(resourceType?: string): Promise<CoordinationDiagnostic[]> {
    const [leases, heartbeats] = await Promise.all([
      this.operations.listLeases(resourceType),
      this.operations.listHeartbeats(resourceType),
    ]);
    return leases.map((lease) =>
      diagnoseLease(
        lease,
        heartbeats.find((heartbeat) => heartbeat.resourceType === lease.resourceType && heartbeat.resourceId === lease.resourceId) || null,
      ),
    );
  }

  failover(plan: CoordinationFailoverPlan): Promise<void> {
    if (plan.action !== 'transfer' && plan.action !== 'force-release') {
      throw new Error(`Coordination failover cannot run while action is ${plan.action}`);
    }
    return this.operations.transferOwnership(plan);
  }
}
