import { replayPayloadChecksum } from './event-envelope-runtime';

export interface OrchestrationLease {
  orchestrationId: string;
  ownerWorkerId: string;
  workerEpoch: number;
  fencingToken: number;
  leaseVersion: number;
  expiresAtMs: number;
  checkpointChecksum: string;
  leaseChecksum: string;
}

export interface LeaseArbitrationInput {
  orchestrationId: string;
  candidateWorkerId: string;
  candidateEpoch: number;
  nowMs: number;
  ttlMs: number;
  existingLease?: OrchestrationLease | null;
}

export interface LeaseArbitrationDecision {
  acquired: boolean;
  lease: OrchestrationLease;
  reason: 'new-lease' | 'renewed-owner' | 'expired-takeover' | 'active-owner-rejected';
  decisionChecksum: string;
}

function leaseChecksum(input: Omit<OrchestrationLease, 'leaseChecksum'>): string {
  return replayPayloadChecksum(input);
}

export function createFencingToken(previousToken: number | null): number {
  return (previousToken ?? 0) + 1;
}

export function validateFencingToken(lease: OrchestrationLease, presentedToken: number): void {
  if (presentedToken !== lease.fencingToken) {
    throw new Error(`Fencing validation missing or stale for orchestration ${lease.orchestrationId}`);
  }
}

export function arbitrateOrchestrationLease(input: LeaseArbitrationInput): LeaseArbitrationDecision {
  const existing = input.existingLease || null;
  const canAcquire = !existing
    || existing.ownerWorkerId === input.candidateWorkerId
    || existing.expiresAtMs <= input.nowMs;
  const reason: LeaseArbitrationDecision['reason'] = !existing
    ? 'new-lease'
    : existing.ownerWorkerId === input.candidateWorkerId
      ? 'renewed-owner'
      : existing.expiresAtMs <= input.nowMs
        ? 'expired-takeover'
        : 'active-owner-rejected';
  const fencingToken = canAcquire ? createFencingToken(existing?.fencingToken ?? null) : existing.fencingToken;
  const leaseBody = {
    orchestrationId: input.orchestrationId,
    ownerWorkerId: canAcquire ? input.candidateWorkerId : existing?.ownerWorkerId || input.candidateWorkerId,
    workerEpoch: canAcquire ? input.candidateEpoch : existing?.workerEpoch || input.candidateEpoch,
    fencingToken,
    leaseVersion: canAcquire ? (existing?.leaseVersion || 0) + 1 : existing?.leaseVersion || 1,
    expiresAtMs: canAcquire ? input.nowMs + input.ttlMs : existing?.expiresAtMs || input.nowMs,
    checkpointChecksum: replayPayloadChecksum({
      orchestrationId: input.orchestrationId,
      ownerWorkerId: canAcquire ? input.candidateWorkerId : existing?.ownerWorkerId,
      workerEpoch: canAcquire ? input.candidateEpoch : existing?.workerEpoch,
      fencingToken,
      reason,
    }),
  };
  const lease = {
    ...leaseBody,
    leaseChecksum: leaseChecksum(leaseBody),
  };

  return {
    acquired: canAcquire,
    lease,
    reason,
    decisionChecksum: replayPayloadChecksum({ acquired: canAcquire, lease, reason }),
  };
}

export function reconcileLeaseCheckpoint(lease: OrchestrationLease, checkpointChecksum: string): OrchestrationLease {
  const leaseBody = {
    ...lease,
    leaseVersion: lease.leaseVersion + 1,
    checkpointChecksum,
  };
  return {
    ...leaseBody,
    leaseChecksum: leaseChecksum(leaseBody),
  };
}

export function revokeOrchestrationLease(lease: OrchestrationLease, revocationEpoch: number): OrchestrationLease {
  const leaseBody = {
    ...lease,
    workerEpoch: revocationEpoch,
    leaseVersion: lease.leaseVersion + 1,
    expiresAtMs: 0,
    checkpointChecksum: replayPayloadChecksum({
      orchestrationId: lease.orchestrationId,
      revokedOwner: lease.ownerWorkerId,
      revocationEpoch,
      previousLeaseChecksum: lease.leaseChecksum,
    }),
  };
  return {
    ...leaseBody,
    leaseChecksum: leaseChecksum(leaseBody),
  };
}

export function assertSingleAuthoritativeExecutor(leases: OrchestrationLease[]): void {
  const activeByOrchestration = new Map<string, OrchestrationLease>();
  for (const lease of leases) {
    const existing = activeByOrchestration.get(lease.orchestrationId);
    if (existing && existing.expiresAtMs > 0 && lease.expiresAtMs > 0 && existing.ownerWorkerId !== lease.ownerWorkerId) {
      throw new Error(`Split-brain possible for orchestration ${lease.orchestrationId}`);
    }
    if (!lease.fencingToken || lease.fencingToken < 1) {
      throw new Error(`Fencing validation missing for orchestration ${lease.orchestrationId}`);
    }
    activeByOrchestration.set(lease.orchestrationId, lease);
  }
}
