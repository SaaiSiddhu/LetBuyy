import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Execution reconciliation validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const reconciliation = manifest?.executionReconciliation || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Execution reconciliation must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Execution reconciliation must fail closed");
reporter.assert(reconciliation.engineSource === "packages/distributed-runtime/src/execution-reconciliation-runtime.ts", "Execution reconciliation engine must live in distributed-runtime");
reporter.assert(reconciliation.reconciliationFunction === "reconcileExecutionState", "Execution reconciliation must name reconciliation function");
reporter.assert(reconciliation.assertionFunction === "assertExecutionReconciliationStable", "Execution reconciliation must name assertion");
reporter.assert(reconciliation.fixedPointPolicy === "wal-runtime-lease-saga-fixed-point-required", "Execution reconciliation must require fixed point");
reporter.assert(reconciliation.oscillationPolicy === "duplicate-reconciliation-actions-hard-fail", "Execution reconciliation must fail on oscillation");
for (const input of ["runtime-state", "execution-wal", "lease", "saga"]) {
  reporter.assert((reconciliation.inputs || []).includes(input), `Execution reconciliation input missing: ${input}`);
}

const source = readFile(reconciliation.engineSource || "");
for (const fragment of [
  "reconcileExecutionState",
  "assertExecutionReconciliationStable",
  "Execution equilibrium unstable",
  "Execution reconciliation checksum missing",
  "Execution reconciliation oscillation exists",
]) {
  reporter.assert(source.includes(fragment), `Execution reconciliation source missing fragment: ${fragment}`);
}

reporter.finish("execution WAL, lease, saga, and runtime reconciliation fixed point checked");
