import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Recovery simulation validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const recovery = manifest?.recoverySimulation || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Recovery simulation must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Recovery simulation must fail closed");
reporter.assert(recovery.engineSource === "packages/distributed-runtime/src/recovery-simulation-runtime.ts", "Recovery simulation engine must live in distributed-runtime");
reporter.assert(recovery.simulationFunction === "simulateRecoveryPlayback", "Recovery simulation must name playback function");
reporter.assert(recovery.assertionFunction === "assertRecoverySimulationStable", "Recovery simulation must name assertion");
reporter.assert(recovery.playbackPolicy === "expected-checksum-must-match-deterministic-playback", "Recovery simulation must require checksum playback");
reporter.assert(recovery.equilibriumPolicy === "all-recovery-paths-converge-before-execute-mode", "Recovery simulation must converge before execute mode");
for (const kind of ["orchestration-recovery", "replay-restoration", "compensation-recovery", "checkpoint-restoration", "lease-failover", "wal-replay", "execution-continuation"]) {
  reporter.assert((recovery.simulationKinds || []).includes(kind), `Recovery simulation kind missing: ${kind}`);
}

const source = readFile(recovery.engineSource || "");
for (const fragment of [
  "simulateRecoveryPlayback",
  "assertRecoverySimulationStable",
  "Recovery replay divergence exists",
  "Recovery lineage validation missing checksum",
]) {
  reporter.assert(source.includes(fragment), `Recovery simulation source missing fragment: ${fragment}`);
}

reporter.finish("deterministic recovery simulation and playback convergence checked");
