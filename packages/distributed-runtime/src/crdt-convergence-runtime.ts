import { replayPayloadChecksum } from './event-envelope-runtime';

export interface CrdtLatticeState {
  stateId: string;
  vector: Record<string, number>;
  tombstones: string[];
}

export interface CrdtMergeResult {
  stateId: string;
  vector: Record<string, number>;
  tombstones: string[];
  latticeChecksum: string;
  monotonic: boolean;
}

export function mergeCrdtLattice(states: CrdtLatticeState[]): CrdtMergeResult {
  const vector: Record<string, number> = {};
  const tombstones = new Set<string>();
  for (const state of [...states].sort((left, right) => left.stateId.localeCompare(right.stateId))) {
    for (const [key, value] of Object.entries(state.vector).sort(([left], [right]) => left.localeCompare(right))) {
      vector[key] = Math.max(vector[key] ?? 0, value);
    }
    for (const tombstone of state.tombstones) {
      tombstones.add(tombstone);
    }
  }
  const sortedTombstones = [...tombstones].sort();
  const stateId = states.map((state) => state.stateId).sort().join('+');
  return {
    stateId,
    vector,
    tombstones: sortedTombstones,
    latticeChecksum: replayPayloadChecksum({ stateId, vector, tombstones: sortedTombstones }),
    monotonic: true,
  };
}

export function assertCrdtConvergence(result: CrdtMergeResult): void {
  if (!result.monotonic) {
    throw new Error('lattice instability exists');
  }
  if (!result.latticeChecksum) {
    throw new Error('merge nondeterministic');
  }
  for (const [key, value] of Object.entries(result.vector)) {
    if (value < 0 || !Number.isInteger(value)) {
      throw new Error(`replay merge corruption possible for ${key}`);
    }
  }
}
