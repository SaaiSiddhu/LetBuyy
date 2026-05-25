import { replayPayloadChecksum } from './event-envelope-runtime';

export interface LamportClock {
  runtimeId: string;
  counter: number;
  clockChecksum: string;
}

export interface VectorClock {
  runtimeId: string;
  counters: Record<string, number>;
  vectorChecksum: string;
}

export interface TemporalOrderingDecision {
  causalityTimestamp: string;
  lamport: LamportClock;
  vector: VectorClock;
  decisionChecksum: string;
}

export function tickLamportClock(clock: LamportClock): LamportClock {
  const next = {
    runtimeId: clock.runtimeId,
    counter: clock.counter + 1,
  };
  return {
    ...next,
    clockChecksum: replayPayloadChecksum(next),
  };
}

export function mergeLamportClock(local: LamportClock, remote: LamportClock): LamportClock {
  const next = {
    runtimeId: local.runtimeId,
    counter: Math.max(local.counter, remote.counter) + 1,
  };
  return {
    ...next,
    clockChecksum: replayPayloadChecksum(next),
  };
}

export function mergeVectorClock(local: VectorClock, remote: VectorClock): VectorClock {
  const counters: Record<string, number> = {};
  for (const key of [...new Set([...Object.keys(local.counters), ...Object.keys(remote.counters)])].sort()) {
    counters[key] = Math.max(local.counters[key] || 0, remote.counters[key] || 0);
  }
  counters[local.runtimeId] = (counters[local.runtimeId] || 0) + 1;
  return {
    runtimeId: local.runtimeId,
    counters,
    vectorChecksum: replayPayloadChecksum({ runtimeId: local.runtimeId, counters }),
  };
}

export function arbitrateCausalityTimestamp(input: {
  runtimeId: string;
  producerTimestamp: string;
  lamport: LamportClock;
  vector: VectorClock;
}): TemporalOrderingDecision {
  if (Number.isNaN(Date.parse(input.producerTimestamp))) {
    throw new Error('Distributed clock requires producer-supplied deterministic timestamp');
  }
  const lamport = tickLamportClock(input.lamport);
  const vector = mergeVectorClock(input.vector, input.vector);
  return {
    causalityTimestamp: input.producerTimestamp,
    lamport,
    vector,
    decisionChecksum: replayPayloadChecksum({
      runtimeId: input.runtimeId,
      producerTimestamp: input.producerTimestamp,
      lamport,
      vector,
    }),
  };
}

export function assertTemporalOrderingStable(decisions: TemporalOrderingDecision[]): void {
  let previousCounter = -1;
  for (const decision of decisions) {
    if (decision.lamport.counter <= previousCounter) {
      throw new Error('Logical clock instability exists');
    }
    previousCounter = decision.lamport.counter;
    if (!decision.decisionChecksum || !decision.vector.vectorChecksum || !decision.lamport.clockChecksum) {
      throw new Error('Distributed temporal lineage incomplete');
    }
  }
}
