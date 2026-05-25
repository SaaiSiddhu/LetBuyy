import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Distributed consistency validator");

const manifestPath = "config/runtime/distributed-consistency-contract.json";
const schemaPath = "config/runtime/distributed-consistency-contract.schema.json";
const manifest = readJson(manifestPath);
const consistency = manifest?.consistencyModel || {};
const arbitration = manifest?.arbitrationEngine || {};

reporter.assert(exists(manifestPath), `Missing distributed consistency contract: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing distributed consistency schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Distributed consistency contract must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Distributed consistency must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Distributed consistency must fail closed");
reporter.assert(consistency.engineSource === "packages/distributed-runtime/src/distributed-consistency-runtime.ts", "Consistency engine must live in distributed-runtime");
reporter.assert(arbitration.function === "arbitrateDistributedConsistency", "Consistency contract must name arbitration engine");
reporter.assert(arbitration.assertionFunction === "assertConsistencyConverges", "Consistency contract must name convergence assertion");
reporter.assert(consistency.staleStateArbitration === "highest-precedence-wins-with-checksum-match", "Consistency stale-state arbitration must be deterministic");
reporter.assert(consistency.eventualConsistencyGovernance === "deterministic-fixed-point-required", "Consistency must require deterministic fixed point");
reporter.assert(consistency.replayConflictArbitration === "event-store-precedes-derived-state", "Replay conflict arbitration must prioritize event store");

for (const owner of ["event-store", "replay-runtime", "queue-runtime", "projection-runtime", "deployment-runtime", "reconciliation-runtime"]) {
  reporter.assert((consistency.precedenceHierarchy || []).includes(owner), `Consistency precedence missing owner: ${owner}`);
  reporter.assert((consistency.reconciliationAuthorityOrdering || []).includes(owner), `Reconciliation authority missing owner: ${owner}`);
  reporter.assert(Array.isArray(consistency.authoritativeOwnershipRules?.[owner]), `Consistency ownership rules missing owner: ${owner}`);
}

const source = readFile(consistency.engineSource || "");
for (const fragment of [
  "arbitrateDistributedConsistency",
  "assertConsistencyConverges",
  "DistributedConsistencyContract",
  "staleStateArbitration",
  "deterministic fixed-point governance",
  "Replay conflict arbitration",
]) {
  reporter.assert(source.includes(fragment), `Distributed consistency source missing fragment: ${fragment}`);
}

reporter.finish("distributed consistency ownership, arbitration, and convergence authority checked");
