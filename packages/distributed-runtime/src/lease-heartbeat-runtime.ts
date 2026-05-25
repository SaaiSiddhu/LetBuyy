import { replayPayloadChecksum } from './event-envelope-runtime';
import type { OrchestrationLease } from './lease-fencing-runtime';

export interface LeaseHeartbeat {
  orchestrationId: string;
  ownerWorkerId: string;
  workerEpoch: number;
  fencingToken: number;
  heartbeatSequence: number;
  observedAtMs: number;
  heartbeatChecksum: string;
}

export interface LeaseHeartbeatDecision {
  orchestrationId: string;
  authoritativeOwner: string;
  evictedWorkers: string[];
  takeoverRequired: boolean;
  decisionChecksum: string;
}

export interface SplitBrainSimulationResult {
  orchestrationId: string;
  splitBrainPrevented: boolean;
  authoritativeOwner: string;
  rejectedOwners: string[];
  simulationChecksum: string;
}

export function recordLeaseHeartbeat(input: Omit<LeaseHeartbeat, 'heartbeatChecksum'>): LeaseHeartbeat {
  return {
    ...input,
    heartbeatChecksum: replayPayloadChecksum(input),
  };
}

export function reconcileLeaseHeartbeats(input: {
  lease: OrchestrationLease;
  heartbeats: LeaseHeartbeat[];
  nowMs: number;
  heartbeatTtlMs: number;
}): LeaseHeartbeatDecision {
  const relevant = input.heartbeats
    .filter((heartbeat) => heartbeat.orchestrationId === input.lease.orchestrationId)
    .sort((left, right) => {
      if (right.workerEpoch !== left.workerEpoch) return right.workerEpoch - left.workerEpoch;
      if (right.fencingToken !== left.fencingToken) return right.fencingToken - left.fencingToken;
      return right.heartbeatSequence - left.heartbeatSequence;
    });
  const authoritative = relevant.find((heartbeat) => input.nowMs - heartbeat.observedAtMs <= input.heartbeatTtlMs);
  const authoritativeOwner = authoritative?.ownerWorkerId || input.lease.ownerWorkerId;
  const evictedWorkers = relevant
    .filter((heartbeat) => heartbeat.ownerWorkerId !== authoritativeOwner || input.nowMs - heartbeat.observedAtMs > input.heartbeatTtlMs)
    .map((heartbeat) => heartbeat.ownerWorkerId)
    .sort();
  const takeoverRequired = authoritativeOwner !== input.lease.ownerWorkerId || input.lease.expiresAtMs <= input.nowMs;
  return {
    orchestrationId: input.lease.orchestrationId,
    authoritativeOwner,
    evictedWorkers: [...new Set(evictedWorkers)],
    takeoverRequired,
    decisionChecksum: replayPayloadChecksum({
      orchestrationId: input.lease.orchestrationId,
      authoritativeOwner,
      evictedWorkers,
      takeoverRequired,
    }),
  };
}

export function simulateSplitBrain(input: {
  orchestrationId: string;
  heartbeats: LeaseHeartbeat[];
}): SplitBrainSimulationResult {
  const ordered = [...input.heartbeats].sort((left, right) => {
    if (right.workerEpoch !== left.workerEpoch) return right.workerEpoch - left.workerEpoch;
    if (right.fencingToken !== left.fencingToken) return right.fencingToken - left.fencingToken;
    return left.ownerWorkerId.localeCompare(right.ownerWorkerId);
  });
  const authoritative = ordered[0];
  if (!authoritative) {
    throw new Error(`split-brain possible: no authoritative heartbeat for ${input.orchestrationId}`);
  }
  const rejectedOwners = ordered
    .slice(1)
    .map((heartbeat) => heartbeat.ownerWorkerId)
    .sort();
  return {
    orchestrationId: input.orchestrationId,
    splitBrainPrevented: new Set(ordered.map((heartbeat) => heartbeat.ownerWorkerId)).size === rejectedOwners.length + 1,
    authoritativeOwner: authoritative.ownerWorkerId,
    rejectedOwners,
    simulationChecksum: replayPayloadChecksum({
      orchestrationId: input.orchestrationId,
      authoritativeOwner: authoritative.ownerWorkerId,
      rejectedOwners,
    }),
  };
}

export function assertLeaseHeartbeatSafe(decisions: LeaseHeartbeatDecision[], simulations: SplitBrainSimulationResult[]): void {
  for (const decision of decisions) {
    if (!decision.decisionChecksum) {
      throw new Error(`heartbeat drift validation missing for ${decision.orchestrationId}`);
    }
  }
  for (const simulation of simulations) {
    if (!simulation.splitBrainPrevented || simulation.rejectedOwners.includes(simulation.authoritativeOwner)) {
      throw new Error(`split-brain possible for ${simulation.orchestrationId}`);
    }
    if (!simulation.simulationChecksum) {
      throw new Error(`fencing replay ambiguous for ${simulation.orchestrationId}`);
    }
  }
}
