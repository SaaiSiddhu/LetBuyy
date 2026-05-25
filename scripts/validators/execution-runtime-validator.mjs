import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Execution runtime validator");

const manifestPath = "config/runtime/distributed-execution-contract.json";
const schemaPath = "config/runtime/distributed-execution-contract.schema.json";
const manifest = readJson(manifestPath);
const execution = manifest?.executionEngine || {};

reporter.assert(exists(manifestPath), `Missing distributed execution contract: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing distributed execution schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Distributed execution contract must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Distributed execution must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Distributed execution must fail closed");
reporter.assert(execution.engineSource === "packages/distributed-runtime/src/distributed-execution-runtime.ts", "Execution engine must live in distributed-runtime");
reporter.assert(execution.planner === "planDistributedExecution", "Execution contract must name planner");
reporter.assert(execution.resumeEngine === "resumeDistributedExecution", "Execution contract must name resume engine");
reporter.assert(execution.journalFunction === "createExecutionJournalEntry", "Execution contract must name journal function");
reporter.assert(execution.replaySafetyAssertion === "assertExecutionReplaySafe", "Execution contract must name replay safety assertion");

for (const state of ["PLANNED", "EXECUTING", "PARTIAL_FAILURE", "COMPENSATING", "RECOVERED", "VERIFIED"]) {
  reporter.assert((execution.states || []).includes(state), `Execution lifecycle state missing: ${state}`);
}

const source = readFile(execution.engineSource || "");
for (const fragment of [
  "planDistributedExecution",
  "resumeDistributedExecution",
  "createExecutionJournalEntry",
  "assertExecutionReplaySafe",
  "DistributedExecutionCheckpoint",
  "executionLineageChecksum",
  "deterministic-operation-sequencing",
  "orchestration-convergence-executor",
  "execution-causality-chain",
]) {
  reporter.assert(source.includes(fragment), `Execution runtime source missing fragment: ${fragment}`);
}

reporter.finish("distributed execution lifecycle, journaling, checkpoints, and replay safety checked");
