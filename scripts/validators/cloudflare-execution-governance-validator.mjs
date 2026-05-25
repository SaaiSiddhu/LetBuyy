import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Cloudflare execution governance validator");

const executionManifest = readJson("config/runtime/distributed-execution-contract.json");
const cloudflare = executionManifest?.cloudflareExecutionGovernance || {};
const ownership = readJson(cloudflare.bindingOwnershipManifest || "config/runtime/cloudflare-binding-ownership.json");

reporter.assert(executionManifest?.mode === "governance-contract-not-live-evidence", "Cloudflare execution governance must not claim live evidence");
reporter.assert(executionManifest?.failurePolicy === "fail-closed", "Cloudflare execution governance must fail closed");
reporter.assert(cloudflare.engineSource === "packages/distributed-runtime/src/cloudflare-execution-governance-runtime.ts", "Cloudflare execution engine must live in distributed-runtime");
reporter.assert(cloudflare.compiler === "compileCloudflareExecutionLineage", "Cloudflare execution must name lineage compiler");
reporter.assert(cloudflare.assertionFunction === "assertCloudflareExecutionLineage", "Cloudflare execution must name lineage assertion");
reporter.assert(cloudflare.bindingOwnershipManifest === "config/runtime/cloudflare-binding-ownership.json", "Cloudflare execution must bind ownership manifest");
reporter.assert(ownership?.mode === "governance-contract-not-live-evidence", "Cloudflare binding ownership must not claim live evidence");

for (const key of ["vars", "kv_namespaces", "r2_buckets", "queues", "durable_objects", "services", "secrets"]) {
  reporter.assert((cloudflare.nonInheritableBindings || []).includes(key), `Cloudflare execution non-inheritable key missing: ${key}`);
  reporter.assert((ownership?.nonInheritableKeys || []).includes(key), `Cloudflare binding ownership non-inheritable key missing: ${key}`);
}

const source = readFile(cloudflare.engineSource || "");
for (const fragment of [
  "compileCloudflareExecutionLineage",
  "assertCloudflareExecutionLineage",
  "queue producer-consumer causality",
  "owns-durable-object",
  "binds-service",
  "binds-kv",
  "binds-r2",
]) {
  reporter.assert(source.includes(fragment), `Cloudflare execution source missing fragment: ${fragment}`);
}

reporter.finish("Cloudflare execution lineage, queue causality, and non-inheritable binding governance checked");
