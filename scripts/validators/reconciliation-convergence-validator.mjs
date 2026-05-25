import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Reconciliation convergence validator");

const manifestPath = "config/runtime/runtime-survivability-intelligence.json";
const schemaPath = "config/runtime/runtime-survivability-intelligence.schema.json";
const manifest = readJson(manifestPath);
const convergence = manifest?.reconciliationIntelligence || {};

reporter.assert(exists(manifestPath), `Missing runtime survivability intelligence manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing runtime survivability intelligence schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Runtime survivability intelligence manifest must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Runtime survivability intelligence must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Runtime survivability intelligence must fail closed");

reporter.assert(convergence.engineSource === "packages/distributed-runtime/src/reconciliation-convergence-runtime.ts", "Convergence engine must live in distributed-runtime");
reporter.assert(convergence.baseReconciliationEngine === "packages/distributed-runtime/src/runtime-reconciliation-runtime.ts", "Convergence must build on base reconciliation engine");
reporter.assert(convergence.graphCompiler === "compileRuntimeResourceGraph", "Convergence manifest must name graph compiler");
reporter.assert(convergence.convergencePlanner === "planRuntimeConvergence", "Convergence manifest must name convergence planner");
reporter.assert(convergence.orphanRecoveryPolicy === "quarantine-orphan-before-activation", "Convergence must quarantine orphans before activation");
reporter.assert(convergence.checksumGovernance === "convergenceChecksum-per-step-and-planChecksum", "Convergence must checksum steps and plan");

const source = readFile(convergence.engineSource || "");
for (const fragment of [
  "compileRuntimeResourceGraph",
  "planRuntimeConvergence",
  "assertRuntimeConvergenceDeterministic",
  "quarantine-orphan",
  "convergenceChecksum",
  "planChecksum",
  "Runtime resource graph contains unresolved edge",
]) {
  reporter.assert(source.includes(fragment), `Reconciliation convergence engine missing fragment: ${fragment}`);
}

for (const action of ["create-missing", "update-drift", "quarantine-orphan"]) {
  reporter.assert((convergence.actions || []).includes(action), `Convergence action missing: ${action}`);
}
for (const dimension of ["environment", "resourceKind", "resourceName"]) {
  reporter.assert((convergence.deterministicOrdering || []).includes(dimension), `Convergence ordering missing: ${dimension}`);
}

const orchestration = readJson("config/runtime/runtime-orchestration-manifest.json");
reporter.assert(orchestration?.runtimeReconciliation?.driftPolicy === "fail-closed-before-activation", "Base runtime reconciliation must block activation on drift");
reporter.assert(orchestration?.runtimeReconciliation?.orphanPolicy === "quarantine-orphan", "Base runtime reconciliation must quarantine orphan resources");

reporter.finish("runtime convergence graph, planner, and checksum governance checked");
