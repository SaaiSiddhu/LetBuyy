import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Saturation governance validator");

const manifestPath = "config/runtime/runtime-saturation-contract.json";
const schemaPath = "config/runtime/runtime-saturation-contract.schema.json";
const manifest = readJson(manifestPath);
const engine = manifest?.engine || {};

reporter.assert(exists(manifestPath), `Missing runtime saturation contract: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing runtime saturation schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Runtime saturation contract must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Runtime saturation must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Runtime saturation must fail closed");
reporter.assert(engine.engineSource === "packages/distributed-runtime/src/saturation-governance-runtime.ts", "Saturation engine must live in distributed-runtime");
reporter.assert(engine.decisionFunction === "decideSaturation", "Saturation contract must name decision function");
reporter.assert(engine.assertionFunction === "assertSaturationGovernance", "Saturation contract must name assertion");
reporter.assert(engine.throttlePolicy === "token-bucket-with-stable-ordering", "Saturation throttling must be deterministic");

for (const kind of ["orchestration", "rollback", "replay", "queue-rebuild", "reconciliation", "dag-execution", "projection-rebuild", "queue-recovery"]) {
  const budget = (manifest?.budgets || []).find((item) => item.kind === kind);
  reporter.assert(Boolean(budget), `Saturation budget missing: ${kind}`);
  reporter.assert(budget?.maxConcurrency > 0, `Saturation budget maxConcurrency invalid: ${kind}`);
  reporter.assert(budget?.rateLimitPerMinute > 0, `Saturation budget rate limit invalid: ${kind}`);
  reporter.assert(budget?.deterministicThrottle === "token-bucket-with-stable-ordering", `Saturation budget must use stable ordering: ${kind}`);
}

const source = readFile(engine.engineSource || "");
for (const fragment of [
  "decideSaturation",
  "assertSaturationGovernance",
  "token-bucket-with-stable-ordering",
  "Runtime saturation uncontrolled",
]) {
  reporter.assert(source.includes(fragment), `Saturation governance source missing fragment: ${fragment}`);
}

reporter.finish("runtime saturation budgets and deterministic throttling checked");
