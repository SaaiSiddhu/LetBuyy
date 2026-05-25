import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Recovery drill validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const drills = manifest?.recoveryDrillGovernance || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Recovery drill governance must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Recovery drill governance must fail closed");
reporter.assert(drills.engineSource === "packages/distributed-runtime/src/recovery-drill-runtime.ts", "Recovery drill runtime must live in distributed-runtime");
reporter.assert(drills.runtimeFunction === "replayRecoveryDrill", "Recovery drill governance must name replay runtime");
reporter.assert(drills.assertionFunction === "assertRecoveryDrillLineage", "Recovery drill governance must name assertion function");
for (const kind of ["replay-restoration", "wal-corruption", "checkpoint-corruption", "lease-failover", "compensation-interruption", "queue-reconstruction", "orchestration-replay"]) {
  reporter.assert((drills.drillKinds || []).includes(kind), `Recovery drill kind missing: ${kind}`);
}
reporter.assert(drills.lineagePolicy === "deterministic-drill-lineage-checksum-required", "Recovery drill lineage must be checksummed");
reporter.assert(drills.evidencePolicy === "governance-drills-are-not-live-operational-evidence", "Recovery drill governance must not claim live evidence");

const source = readFile(drills.engineSource || "");
for (const fragment of [
  "replayRecoveryDrill",
  "assertRecoveryDrillLineage",
  "recovery drill nondeterministic",
  "drill lineage incomplete",
  "expectedRecoveryChecksum",
]) {
  reporter.assert(source.includes(fragment), `Recovery drill source missing fragment: ${fragment}`);
}

reporter.finish("deterministic recovery drill matrices and lineage governance checked");
