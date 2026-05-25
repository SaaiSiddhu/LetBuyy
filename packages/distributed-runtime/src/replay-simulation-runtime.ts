import { replayPayloadChecksum } from './event-envelope-runtime';
import type { ReplayRecoveryEvent } from './replay-recovery-runtime';

export interface ReplaySimulationBranch {
  branchName: string;
  baseCheckpoint: string;
  scenario: 'schema-evolution' | 'deployment-rollback' | 'checkpoint-recovery' | 'replay-branch';
  events: ReplayRecoveryEvent[];
  expectedProjectionChecksum: string;
}

export interface ReplayTimelineGraph {
  branches: ReplaySimulationBranch[];
  branchChecksums: Record<string, string>;
  timelineChecksum: string;
}

export function simulateReplayTimelines(branches: ReplaySimulationBranch[]): ReplayTimelineGraph {
  const orderedBranches = [...branches].sort((left, right) => left.branchName.localeCompare(right.branchName));
  const branchChecksums: Record<string, string> = {};

  for (const branch of orderedBranches) {
    let previousGlobal = 0;
    let previousStream = 0;
    for (const event of branch.events) {
      if (event.globalPosition <= previousGlobal || event.streamPosition <= previousStream) {
        throw new Error(`Replay branch ordering nondeterministic: ${branch.branchName}`);
      }
      if (!event.checksum) {
        throw new Error(`Replay branch event lacks checksum: ${branch.branchName}/${event.eventId}`);
      }
      previousGlobal = event.globalPosition;
      previousStream = event.streamPosition;
    }
    branchChecksums[branch.branchName] = replayPayloadChecksum({
      baseCheckpoint: branch.baseCheckpoint,
      scenario: branch.scenario,
      events: branch.events,
      expectedProjectionChecksum: branch.expectedProjectionChecksum,
    });
  }

  return {
    branches: orderedBranches,
    branchChecksums,
    timelineChecksum: replayPayloadChecksum(branchChecksums),
  };
}

export function assertReplayTimelineStable(graph: ReplayTimelineGraph): void {
  if (graph.branches.length === 0) {
    throw new Error('Replay timeline simulation requires at least one branch');
  }
  for (const branch of graph.branches) {
    if (!graph.branchChecksums[branch.branchName]) {
      throw new Error(`Replay timeline branch checksum missing: ${branch.branchName}`);
    }
  }
}
