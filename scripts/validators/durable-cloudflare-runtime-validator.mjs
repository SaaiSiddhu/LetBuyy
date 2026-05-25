import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Durable Cloudflare runtime validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const cloudflare = manifest?.cloudflareDurableRuntime || {};
const ownership = readJson(cloudflare.bindingOwnershipManifest || "config/runtime/cloudflare-binding-ownership.json");

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Durable Cloudflare runtime must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Durable Cloudflare runtime must fail closed");
reporter.assert(cloudflare.engineSource === "packages/distributed-runtime/src/durable-cloudflare-runtime.ts", "Durable Cloudflare engine must live in distributed-runtime");
reporter.assert(cloudflare.bindingOwnershipManifest === "config/runtime/cloudflare-binding-ownership.json", "Durable Cloudflare runtime must bind ownership manifest");
reporter.assert(cloudflare.compiler === "compileCloudflareDurableExecutionLineage", "Durable Cloudflare runtime must name compiler");
reporter.assert(cloudflare.assertionFunction === "assertCloudflareDurableExecutionLineage", "Durable Cloudflare runtime must name assertion");
reporter.assert(cloudflare.durableObjectPolicy === "namespace-and-migration-owned-per-environment", "Durable Object policy must be per environment");
reporter.assert(cloudflare.executionLeaseOwnership === "durable-object-namespace-per-worker-environment", "Execution lease ownership must map to DO namespace per environment");
reporter.assert(cloudflare.remoteReconciliationPolicy === "plan-only-until-execute-mode-credentials-exist", "Remote reconciliation must remain plan-only without credentials");
for (const key of ["vars", "kv_namespaces", "r2_buckets", "queues", "durable_objects", "services", "telemetry"]) {
  reporter.assert((cloudflare.requiredExplicitBindings || []).includes(key), `Durable Cloudflare explicit binding missing: ${key}`);
  if (key !== "telemetry") {
    reporter.assert((ownership?.nonInheritableKeys || []).includes(key), `Cloudflare ownership non-inheritable key missing: ${key}`);
  }
}

const source = readFile(cloudflare.engineSource || "");
for (const fragment of [
  "compileCloudflareDurableExecutionLineage",
  "assertCloudflareDurableExecutionLineage",
  "Durable Object ownership ambiguous",
  "Worker execution lineage incomplete",
  "Execution lease ownership missing",
]) {
  reporter.assert(source.includes(fragment), `Durable Cloudflare source missing fragment: ${fragment}`);
}

reporter.finish("Cloudflare Durable Object, lease ownership, and execution lineage governance checked");
