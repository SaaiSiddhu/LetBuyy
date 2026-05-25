import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Distributed conflict validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const conflict = manifest?.distributedConflictArbitration || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Distributed conflict arbitration must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Distributed conflict arbitration must fail closed");
reporter.assert(conflict.engineSource === "packages/distributed-runtime/src/distributed-conflict-arbitration-runtime.ts", "Distributed conflict engine must live in distributed-runtime");
reporter.assert(conflict.arbitrationFunction === "arbitrateDistributedConflicts", "Distributed conflict must name arbitration function");
reporter.assert(conflict.assertionFunction === "assertDistributedConflictArbitration", "Distributed conflict must name assertion function");
reporter.assert(conflict.authorityPolicy === "lowest-authority-rank-then-highest-version-wins", "Distributed conflict authority hierarchy must be deterministic");
reporter.assert(conflict.staleAuthorityPolicy === "selected-owner-removes-stale-authorities", "Distributed conflict stale authority policy must evict stale writers");
reporter.assert(conflict.replayPolicy === "conflict-lineage-checksum-required", "Distributed conflict replay lineage must be checksummed");
reporter.assert(conflict.mergePolicy === "deterministic-arbitration-dag-before-reconciliation", "Distributed conflict merge policy must be deterministic");

const source = readFile(conflict.engineSource || "");
for (const fragment of [
  "arbitrateDistributedConflicts",
  "assertDistributedConflictArbitration",
  "conflict ownership ambiguous",
  "stale authority survives",
  "replay conflict divergence exists",
  "convergence arbitration unstable",
]) {
  reporter.assert(source.includes(fragment), `Distributed conflict source missing fragment: ${fragment}`);
}

reporter.finish("distributed conflict arbitration, stale authority eviction, and replay lineage checked");
