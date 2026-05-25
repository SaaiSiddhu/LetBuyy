import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Orchestration idempotency validator");

const manifest = readJson("config/runtime/distributed-execution-contract.json");
const idempotency = manifest?.idempotencyEngine || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Idempotency governance must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Idempotency governance must fail closed");
reporter.assert(idempotency.engineSource === "packages/distributed-runtime/src/orchestration-idempotency-runtime.ts", "Idempotency engine must live in distributed-runtime");
reporter.assert(idempotency.registryFactory === "createIdempotentExecutionRegistry", "Idempotency must name registry factory");
reporter.assert(idempotency.registrationFunction === "registerIdempotentOperation", "Idempotency must name registration function");
reporter.assert(idempotency.retryLineageFunction === "buildRetryLineage", "Idempotency must name retry lineage function");
reporter.assert(idempotency.assertionFunction === "assertNoDuplicateExecution", "Idempotency must name duplicate execution assertion");
reporter.assert(idempotency.retryPolicy === "same-idempotency-key-must-replay-same-execution-checksum", "Idempotency retry policy must fail on checksum divergence");

for (const field of ["operationId", "operationIdempotencyKey", "executionHash", "retryFingerprint", "compensationHash", "executionChecksum"]) {
  reporter.assert((idempotency.requiredFields || []).includes(field), `Idempotency required field missing: ${field}`);
}

const source = readFile(idempotency.engineSource || "");
for (const fragment of [
  "IdempotentExecutionRegistry",
  "createIdempotentExecutionRegistry",
  "registerIdempotentOperation",
  "buildRetryLineage",
  "assertNoDuplicateExecution",
  "Duplicate execution possible",
  "Idempotency key replay divergence exists",
]) {
  reporter.assert(source.includes(fragment), `Orchestration idempotency source missing fragment: ${fragment}`);
}

reporter.finish("orchestration idempotency registry, retry lineage, and duplicate prevention checked");
