import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Replay branch validator");

const manifestPath = "config/runtime/replay-branch-registry.json";
const schemaPath = "config/runtime/replay-branch-registry.schema.json";
const manifest = readJson(manifestPath);
const engine = manifest?.engine || {};

reporter.assert(exists(manifestPath), `Missing replay branch registry: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing replay branch registry schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Replay branch registry must reference its schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Replay branch registry must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Replay branch registry must fail closed");
reporter.assert(engine.engineSource === "packages/distributed-runtime/src/replay-branch-governance-runtime.ts", "Replay branch engine must live in distributed-runtime");
reporter.assert(engine.registryCompiler === "compileReplayBranchRegistry", "Replay branch registry must name compiler");
reporter.assert(engine.mergeValidator === "validateReplayBranchMerge", "Replay branch registry must name merge validator");
reporter.assert(engine.assertionFunction === "assertReplayBranchRegistry", "Replay branch registry must name assertion");

for (const branch of manifest?.branches || []) {
  reporter.assert(Boolean(branch.owner), `Replay branch ownership ambiguous: ${branch.branchId}`);
  reporter.assert(branch.isolated === true, `Replay branch must be isolated: ${branch.branchId}`);
  reporter.assert(branch.ttlSeconds > 0, `Replay branch TTL invalid: ${branch.branchId}`);
  reporter.assert(branch.mergePolicy === "checksum-compatible-only", `Replay branch merge policy unsafe: ${branch.branchId}`);
  reporter.assert(Boolean(branch.expectedProjectionChecksum), `Replay branch expected checksum missing: ${branch.branchId}`);
}

const source = readFile(engine.engineSource || "");
for (const fragment of [
  "compileReplayBranchRegistry",
  "validateReplayBranchMerge",
  "assertReplayBranchRegistry",
  "Replay branch leakage exists",
  "Replay branch lineage incomplete",
  "branch-merge-corruption-possible",
]) {
  reporter.assert(source.includes(fragment), `Replay branch source missing fragment: ${fragment}`);
}

reporter.finish(`${manifest?.branches?.length || 0} replay branch contracts checked`);
