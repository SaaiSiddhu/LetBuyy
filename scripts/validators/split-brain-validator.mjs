import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Split-brain validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const splitBrain = manifest?.splitBrainPrevention || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Split-brain prevention must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Split-brain prevention must fail closed");
reporter.assert(splitBrain.engineSource === "packages/distributed-runtime/src/lease-heartbeat-runtime.ts", "Split-brain engine must use lease heartbeat runtime");
reporter.assert(splitBrain.simulationFunction === "simulateSplitBrain", "Split-brain prevention must name simulation function");
reporter.assert(splitBrain.assertionFunction === "assertLeaseHeartbeatSafe", "Split-brain prevention must name assertion function");
reporter.assert(splitBrain.authorityPolicy === "single-authoritative-owner-after-fencing-replay", "Split-brain authority policy must be single-owner");
reporter.assert(splitBrain.conflictPolicy === "higher-epoch-then-higher-fencing-token-wins", "Split-brain conflict policy must be deterministic");
reporter.assert(splitBrain.recoveryPolicy === "reject-stale-executor-and-replay-authoritative-heartbeat", "Split-brain recovery must reject stale executors");
reporter.assert(splitBrain.failurePolicy === "hard-fail-if-concurrent-authority-survives", "Split-brain failure policy must hard fail");

const source = readFile(splitBrain.engineSource || "");
for (const fragment of [
  "simulateSplitBrain",
  "splitBrainPrevented",
  "split-brain possible",
  "fencing replay ambiguous",
  "authoritativeOwner",
  "rejectedOwners",
]) {
  reporter.assert(source.includes(fragment), `Split-brain source missing fragment: ${fragment}`);
}

reporter.finish("split-brain simulation, authority selection, and stale executor rejection checked");
