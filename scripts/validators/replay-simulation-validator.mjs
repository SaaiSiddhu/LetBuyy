import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Replay simulation validator");

const intelligence = readJson("config/runtime/runtime-survivability-intelligence.json");
const simulation = intelligence?.replaySimulation || {};
const evolution = readJson(simulation.replayEvolutionManifest || "config/runtime/replay-evolution-manifest.json");

reporter.assert(intelligence?.mode === "governance-contract-not-live-evidence", "Replay simulation must not claim live evidence");
reporter.assert(simulation.engineSource === "packages/distributed-runtime/src/replay-simulation-runtime.ts", "Replay simulation engine must live in distributed-runtime");
reporter.assert(simulation.replayEvolutionManifest === "config/runtime/replay-evolution-manifest.json", "Replay simulation must bind replay evolution manifest");
reporter.assert(simulation.timelineFunction === "simulateReplayTimelines", "Replay simulation must name timeline function");
reporter.assert(simulation.assertionFunction === "assertReplayTimelineStable", "Replay simulation must name assertion");
reporter.assert(simulation.branchingPolicy === "branch-checksum-must-remain-stable", "Replay simulation must define branch checksum policy");

const source = readFile(simulation.engineSource || "");
for (const fragment of [
  "simulateReplayTimelines",
  "assertReplayTimelineStable",
  "Replay branch ordering nondeterministic",
  "branchChecksums",
  "timelineChecksum",
]) {
  reporter.assert(source.includes(fragment), `Replay simulation engine missing fragment: ${fragment}`);
}

const requiredScenarios = ["schema-evolution", "deployment-rollback", "checkpoint-recovery", "replay-branch"];
for (const scenario of requiredScenarios) {
  reporter.assert((simulation.branches || []).some((branch) => branch.scenario === scenario), `Replay simulation missing scenario: ${scenario}`);
}
const snapshots = new Map((evolution?.deterministicSnapshots || []).map((snapshot) => [snapshot.snapshotId, snapshot]));
for (const branch of simulation.branches || []) {
  const snapshot = snapshots.get(branch.baseCheckpoint);
  reporter.assert(Boolean(snapshot), `Replay simulation branch missing base checkpoint: ${branch.branchName}`);
  reporter.assert(branch.expectedProjectionChecksum === snapshot?.expectedProjection?.stateChecksum, `Replay simulation branch projection checksum drift: ${branch.branchName}`);
}

reporter.finish(`${simulation.branches?.length || 0} replay simulation branches checked`);
