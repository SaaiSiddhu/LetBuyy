import { replayPayloadChecksum } from './event-envelope-runtime';

export type RecoverySimulationKind =
  | 'orchestration-recovery'
  | 'replay-restoration'
  | 'compensation-recovery'
  | 'checkpoint-restoration'
  | 'lease-failover'
  | 'wal-replay'
  | 'execution-continuation';

export interface RecoverySimulationNode {
  simulationId: string;
  kind: RecoverySimulationKind;
  inputChecksum: string;
  expectedChecksum: string;
}

export interface RecoverySimulationResult {
  simulationId: string;
  kind: RecoverySimulationKind;
  converged: boolean;
  playbackChecksum: string;
}

export function simulateRecoveryPlayback(nodes: RecoverySimulationNode[]): RecoverySimulationResult[] {
  return [...nodes]
    .sort((left, right) => left.simulationId.localeCompare(right.simulationId))
    .map((node) => {
      const playbackChecksum = replayPayloadChecksum({
        simulationId: node.simulationId,
        kind: node.kind,
        inputChecksum: node.inputChecksum,
      });
      return {
        simulationId: node.simulationId,
        kind: node.kind,
        converged: playbackChecksum === node.expectedChecksum,
        playbackChecksum,
      };
    });
}

export function assertRecoverySimulationStable(results: RecoverySimulationResult[]): void {
  for (const result of results) {
    if (!result.converged) {
      throw new Error(`Recovery replay divergence exists: ${result.simulationId}`);
    }
    if (!result.playbackChecksum) {
      throw new Error(`Recovery lineage validation missing checksum: ${result.simulationId}`);
    }
  }
}
