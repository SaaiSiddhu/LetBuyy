import { replayPayloadChecksum } from './event-envelope-runtime';

export type RecoveryDrillKind =
  | 'replay-restoration'
  | 'wal-corruption'
  | 'checkpoint-corruption'
  | 'lease-failover'
  | 'compensation-interruption'
  | 'queue-reconstruction'
  | 'orchestration-replay';

export interface RecoveryDrillScenario {
  drillId: string;
  kind: RecoveryDrillKind;
  fixtureChecksum: string;
  expectedRecoveryChecksum: string;
}

export interface RecoveryDrillResult {
  drillId: string;
  kind: RecoveryDrillKind;
  deterministic: boolean;
  recoveryChecksum: string;
  drillLineageChecksum: string;
}

export function replayRecoveryDrill(scenario: RecoveryDrillScenario): RecoveryDrillResult {
  const recoveryChecksum = replayPayloadChecksum({
    drillId: scenario.drillId,
    kind: scenario.kind,
    fixtureChecksum: scenario.fixtureChecksum,
  });
  return {
    drillId: scenario.drillId,
    kind: scenario.kind,
    deterministic: recoveryChecksum === scenario.expectedRecoveryChecksum,
    recoveryChecksum,
    drillLineageChecksum: replayPayloadChecksum({
      drillId: scenario.drillId,
      recoveryChecksum,
      expectedRecoveryChecksum: scenario.expectedRecoveryChecksum,
    }),
  };
}

export function assertRecoveryDrillLineage(results: RecoveryDrillResult[]): void {
  for (const result of results) {
    if (!result.deterministic) {
      throw new Error(`recovery drill nondeterministic: ${result.drillId}`);
    }
    if (!result.drillLineageChecksum || !result.recoveryChecksum) {
      throw new Error(`drill lineage incomplete: ${result.drillId}`);
    }
  }
}
