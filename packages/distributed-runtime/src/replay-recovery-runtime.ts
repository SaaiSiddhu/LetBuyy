export interface ReplayRecoveryEvent {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  globalPosition: number;
  streamPosition: number;
  checksum: string;
}

export interface ReplayRecoveryManifest {
  recoveryId: string;
  streamName: string;
  expectedProjectionChecksum: string;
  events: ReplayRecoveryEvent[];
}

export interface ReplayRecoveryPlan {
  recoveryId: string;
  streamName: string;
  startGlobalPosition: number;
  endGlobalPosition: number;
  eventCount: number;
  expectedProjectionChecksum: string;
}

export function buildReplayRecoveryPlan(manifest: ReplayRecoveryManifest): ReplayRecoveryPlan {
  if (manifest.events.length === 0) {
    throw new Error(`Replay recovery ${manifest.recoveryId} requires events`);
  }

  let previousGlobal = 0;
  let previousStream = 0;
  for (const event of manifest.events) {
    if (event.globalPosition <= previousGlobal) {
      throw new Error(`Replay recovery ${manifest.recoveryId} has global ordering drift`);
    }
    if (event.streamPosition <= previousStream) {
      throw new Error(`Replay recovery ${manifest.recoveryId} has stream ordering drift`);
    }
    if (!event.checksum) {
      throw new Error(`Replay recovery ${manifest.recoveryId} event ${event.eventId} lacks checksum`);
    }
    previousGlobal = event.globalPosition;
    previousStream = event.streamPosition;
  }

  return {
    recoveryId: manifest.recoveryId,
    streamName: manifest.streamName,
    startGlobalPosition: manifest.events[0].globalPosition,
    endGlobalPosition: manifest.events[manifest.events.length - 1].globalPosition,
    eventCount: manifest.events.length,
    expectedProjectionChecksum: manifest.expectedProjectionChecksum,
  };
}
