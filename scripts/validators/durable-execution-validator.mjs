import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Durable execution validator");

const manifestPath = "config/runtime/durable-execution-contract.json";
const schemaPath = "config/runtime/durable-execution-contract.schema.json";
const manifest = readJson(manifestPath);
const durable = manifest?.durableExecution || {};
const baseExecution = readJson(durable.baseExecutionContract || "config/runtime/distributed-execution-contract.json");

reporter.assert(exists(manifestPath), `Missing durable execution contract: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing durable execution schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Durable execution contract must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Durable execution must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Durable execution must fail closed");
reporter.assert(baseExecution?.durableExecutionContract === manifestPath, "Distributed execution contract must bind durable execution contract");
reporter.assert(durable.engineSource === "packages/distributed-runtime/src/durable-execution-runtime.ts", "Durable execution engine must live in distributed-runtime");
reporter.assert(durable.walFactory === "createExecutionWal", "Durable execution must name WAL factory");
reporter.assert(durable.walAppender === "appendExecutionWalEntry", "Durable execution must name WAL appender");
reporter.assert(durable.restoreFunction === "restoreExecutionFromWal", "Durable execution must name WAL restore function");
reporter.assert(durable.crashRecoveryFunction === "recoverExecutionAfterInterruption", "Durable execution must name crash recovery function");
reporter.assert(durable.integrityAssertion === "assertExecutionWalIntegrity", "Durable execution must name WAL integrity assertion");
reporter.assert(durable.walPolicy === "append-only-execution-journal", "Durable execution WAL must be append-only");
reporter.assert(durable.checkpointLineagePolicy === "previousWalChecksum-links-every-entry", "Durable execution must chain WAL checksums");

for (const field of ["executionId", "orchestrationId", "executionSequence", "executionCheckpoint", "executionJournalEntry", "executionCausalityReference", "executionChecksum"]) {
  reporter.assert((durable.requiredStepFields || []).includes(field), `Durable execution required field missing: ${field}`);
}
for (const survivalCase of ["process-restart", "runtime-interruption", "partial-execution-failure", "replay-reconstruction"]) {
  reporter.assert((durable.survives || []).includes(survivalCase), `Durable execution survival case missing: ${survivalCase}`);
}

const source = readFile(durable.engineSource || "");
for (const fragment of [
  "createExecutionWal",
  "appendExecutionWalEntry",
  "buildExecutionWalFromPlan",
  "restoreExecutionFromWal",
  "recoverExecutionAfterInterruption",
  "assertExecutionWalIntegrity",
  "Execution WAL corruption possible",
  "appendOnly",
]) {
  reporter.assert(source.includes(fragment), `Durable execution source missing fragment: ${fragment}`);
}

reporter.finish("WAL-backed durable execution, restoration, and checkpoint lineage checked");
