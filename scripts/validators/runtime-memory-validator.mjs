import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime memory validator");

const manifestPath = "config/runtime/runtime-memory-model.json";
const schemaPath = "config/runtime/runtime-memory-model.schema.json";
const manifest = readJson(manifestPath);
const engine = manifest?.engine || {};

reporter.assert(exists(manifestPath), `Missing runtime memory model: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing runtime memory schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Runtime memory model must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Runtime memory model must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Runtime memory model must fail closed");
reporter.assert(engine.engineSource === "packages/distributed-runtime/src/runtime-memory-model-runtime.ts", "Runtime memory engine must live in distributed-runtime");
reporter.assert(engine.compiler === "compileRuntimeMemoryModel", "Runtime memory model must name compiler");
reporter.assert(engine.assertionFunction === "assertRuntimeMemoryModel", "Runtime memory model must name assertion");
reporter.assert(engine.overlapPolicy === "resource-owned-by-exactly-one-authority", "Runtime memory overlap policy must be deterministic");

for (const memoryClass of ["durable-state", "ephemeral-state", "replay-owned-state", "projection-owned-state", "queue-owned-state", "orchestration-owned-state", "reconciliation-owned-state"]) {
  reporter.assert((manifest?.ownership || []).some((owner) => owner.memoryClass === memoryClass), `Runtime memory class missing: ${memoryClass}`);
}

const source = readFile(engine.engineSource || "");
for (const fragment of [
  "compileRuntimeMemoryModel",
  "assertRuntimeMemoryModel",
  "Runtime memory ownership overlap exists",
  "Runtime memory lifecycle ambiguous",
  "memoryChecksum",
]) {
  reporter.assert(source.includes(fragment), `Runtime memory source missing fragment: ${fragment}`);
}

reporter.finish("runtime memory ownership classes and lifecycle governance checked");
