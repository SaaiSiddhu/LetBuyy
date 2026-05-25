import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Replay recovery validator");

const manifest = readJson("config/runtime/runtime-orchestration-manifest.json");
const recovery = manifest?.replayRecovery || {};
const evolution = readJson(recovery.evolutionManifest || "config/runtime/replay-evolution-manifest.json");

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Replay recovery must not claim live evidence");
reporter.assert(recovery.engineSource === "packages/distributed-runtime/src/replay-recovery-runtime.ts", "Replay recovery must use package-owned engine");
reporter.assert(recovery.evolutionManifest === "config/runtime/replay-evolution-manifest.json", "Replay recovery must bind replay evolution manifest");
reporter.assert(recovery.orderingPolicy === "global-position-and-stream-position-strictly-increasing", "Replay recovery must enforce deterministic ordering");
reporter.assert(recovery.checksumPolicy === "event-checksum-must-match-replay-evolution-fixture", "Replay recovery must enforce event fixture checksums");

const source = readFile(recovery.engineSource || "");
for (const fragment of [
  "buildReplayRecoveryPlan",
  "global ordering drift",
  "stream ordering drift",
  "eventCount",
  "expectedProjectionChecksum",
]) {
  reporter.assert(source.includes(fragment), `Replay recovery engine missing fragment: ${fragment}`);
}

const eventFixtureChecksums = new Map();
for (const family of evolution?.eventFamilies || []) {
  for (const version of family.versions || []) {
    eventFixtureChecksums.set(`${family.eventType}:${version.version}`, version.fixture?.checksum);
  }
}

const snapshotByStream = new Map((evolution?.deterministicSnapshots || []).map((snapshot) => [snapshot.streamName, snapshot]));
for (const plan of recovery.recoveryPlans || []) {
  const snapshot = snapshotByStream.get(plan.streamName);
  reporter.assert(Boolean(snapshot), `Replay recovery plan must match deterministic replay snapshot: ${plan.recoveryId}`);
  reporter.assert(plan.expectedProjectionChecksum === snapshot?.expectedProjection?.stateChecksum, `Replay recovery projection checksum drift: ${plan.recoveryId}`);

  let previousGlobal = 0;
  let previousStream = 0;
  for (const event of plan.events || []) {
    reporter.assert(event.globalPosition > previousGlobal, `Replay recovery global ordering drift: ${plan.recoveryId}/${event.eventId}`);
    reporter.assert(event.streamPosition > previousStream, `Replay recovery stream ordering drift: ${plan.recoveryId}/${event.eventId}`);
    reporter.assert(event.checksum === eventFixtureChecksums.get(`${event.eventType}:${event.schemaVersion}`), `Replay recovery checksum drift: ${plan.recoveryId}/${event.eventId}`);
    previousGlobal = event.globalPosition;
    previousStream = event.streamPosition;
  }
}

reporter.finish(`${recovery.recoveryPlans?.length || 0} replay recovery plans checked`);
