import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Cloudflare resource lineage validator");

const intelligence = readJson("config/runtime/runtime-survivability-intelligence.json");
const lineage = intelligence?.cloudflareResourceLineage || {};
const ownership = readJson(lineage.bindingOwnershipManifest || "config/runtime/cloudflare-binding-ownership.json");

reporter.assert(intelligence?.mode === "governance-contract-not-live-evidence", "Cloudflare resource lineage must not claim live evidence");
reporter.assert(lineage.engineSource === "packages/distributed-runtime/src/cloudflare-resource-lineage-runtime.ts", "Cloudflare lineage engine must live in distributed-runtime");
reporter.assert(lineage.bindingOwnershipManifest === "config/runtime/cloudflare-binding-ownership.json", "Cloudflare lineage must bind ownership manifest");
reporter.assert(lineage.compiler === "compileCloudflareResourceLineage", "Cloudflare lineage must name compiler");
reporter.assert(lineage.assertionFunction === "assertCloudflareResourceLineage", "Cloudflare lineage must name assertion");
reporter.assert(lineage.remoteBindingReconciliation === "plan-only-until-execute-mode-credentials-exist", "Cloudflare remote reconciliation must remain plan-only without credentials");

const source = readFile(lineage.engineSource || "");
for (const fragment of [
  "compileCloudflareResourceLineage",
  "assertCloudflareResourceLineage",
  "durable-object",
  "service-binding",
  "queue-producer",
  "queue-consumer",
  "lineageChecksum",
]) {
  reporter.assert(source.includes(fragment), `Cloudflare resource lineage engine missing fragment: ${fragment}`);
}

for (const key of ["vars", "kv_namespaces", "r2_buckets", "queues", "durable_objects", "services", "secrets"]) {
  reporter.assert((lineage.nonInheritableBindings || []).includes(key), `Cloudflare lineage missing non-inheritable binding: ${key}`);
  reporter.assert((ownership?.nonInheritableKeys || []).includes(key), `Cloudflare ownership manifest missing non-inheritable key: ${key}`);
}
for (const kind of ["worker", "var", "queue-producer", "queue-consumer", "kv", "r2", "durable-object", "service-binding", "telemetry"]) {
  reporter.assert((lineage.resourceKinds || []).includes(kind), `Cloudflare lineage missing resource kind: ${kind}`);
}

const workerNames = new Set();
for (const worker of ownership?.workers || []) {
  for (const environment of ["dev", "staging", "production"]) {
    const env = worker.environments?.[environment];
    reporter.assert(Boolean(env?.workerName), `Cloudflare lineage missing Worker name: ${worker.runtimeRoot}/${environment}`);
    const key = `${environment}:${env?.workerName}`;
    reporter.assert(!workerNames.has(key), `Cloudflare Worker name collision: ${key}`);
    workerNames.add(key);
    if (environment !== "production") {
      reporter.assert(env?.workerName?.endsWith(`-${environment}`), `Lower environment Worker name must include env suffix: ${env?.workerName}`);
    }
  }
}

reporter.finish(`${ownership?.workers?.length || 0} Cloudflare worker resource lineages checked`);
