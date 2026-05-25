import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime reconciliation validator");

const manifestPath = "config/runtime/runtime-orchestration-manifest.json";
const schemaPath = "config/runtime/runtime-orchestration-manifest.schema.json";
const manifest = readJson(manifestPath);

reporter.assert(exists(manifestPath), `Missing runtime orchestration manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing runtime orchestration schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Runtime orchestration manifest must reference its checked-in schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Runtime orchestration manifest must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Runtime orchestration must fail closed");

const reconciliation = manifest?.runtimeReconciliation || {};
reporter.assert(reconciliation.engineSource === "packages/distributed-runtime/src/runtime-reconciliation-runtime.ts", "Runtime reconciliation must use the package-owned engine source");
reporter.assert(reconciliation.topologyManifest === "config/runtime/deployment-topology.json", "Runtime reconciliation must bind deployment topology");
reporter.assert(reconciliation.orphanPolicy === "quarantine-orphan", "Runtime reconciliation must quarantine orphan resources");
reporter.assert(reconciliation.driftPolicy === "fail-closed-before-activation", "Runtime reconciliation must block activation on drift");
reporter.assert(reconciliation.cleanAssertion === "assertRuntimeReconciliationClean", "Runtime reconciliation must expose clean assertion");

const source = readFile(reconciliation.engineSource || "");
for (const fragment of [
  "reconcileRuntimeResources",
  "assertRuntimeReconciliationClean",
  "create-missing",
  "update-drift",
  "quarantine-orphan",
  "runtime resource matches manifest",
]) {
  reporter.assert(source.includes(fragment), `Runtime reconciliation engine missing fragment: ${fragment}`);
}

const expectedActions = ["noop", "create-missing", "update-drift", "quarantine-orphan"];
for (const action of expectedActions) {
  reporter.assert((reconciliation.requiredActions || []).includes(action), `Runtime reconciliation missing required action: ${action}`);
}

const desiredSources = reconciliation.desiredResourceSources || [];
const sourceByKind = new Map(desiredSources.map((sourceConfig) => [sourceConfig.kind, sourceConfig]));
for (const kind of ["worker", "queue", "projection", "replay-stream"]) {
  const sourceConfig = sourceByKind.get(kind);
  reporter.assert(Boolean(sourceConfig), `Runtime reconciliation missing desired resource source for ${kind}`);
  reporter.assert(exists(sourceConfig?.manifest || ""), `Runtime reconciliation source manifest missing for ${kind}: ${sourceConfig?.manifest}`);
  for (const environment of ["dev", "staging", "production"]) {
    reporter.assert((sourceConfig?.environments || []).includes(environment), `Runtime reconciliation ${kind} source missing ${environment}`);
  }
}

const topology = readJson("config/runtime/deployment-topology.json");
const topologyRoots = new Set((topology?.nodes || []).map((node) => node.runtimeRoot));
const cloudflare = readJson("config/runtime/cloudflare-binding-ownership.json");
for (const worker of cloudflare?.workers || []) {
  reporter.assert(topologyRoots.has(worker.runtimeRoot), `Cloudflare worker root missing from topology: ${worker.runtimeRoot}`);
  for (const environment of ["dev", "staging", "production"]) {
    reporter.assert(Boolean(worker.environments?.[environment]?.workerName), `Cloudflare worker missing env ownership for ${worker.runtimeRoot}/${environment}`);
  }
}

const queues = readJson("config/runtime/queue-lifecycle-manifest.json");
for (const queue of queues?.queues || []) {
  reporter.assert(topologyRoots.has(queue.consumerRoot), `Queue consumer root missing from topology: ${queue.consumerRoot}`);
  reporter.assert(topologyRoots.has(queue.producerRoot), `Queue producer root missing from topology: ${queue.producerRoot}`);
  for (const environment of ["dev", "staging", "production"]) {
    reporter.assert(Boolean(queue.names?.[environment]), `Queue missing environment name: ${queue.logicalName}/${environment}`);
  }
}

const projections = readJson("config/runtime/projection-recovery-manifest.json");
for (const projection of projections?.projections || []) {
  reporter.assert(topologyRoots.has(projection.ownerRuntime), `Projection owner runtime missing from topology: ${projection.projectionName}`);
}

const replay = readJson("config/runtime/replay-evolution-manifest.json");
reporter.assert((replay?.eventFamilies || []).length > 0, "Runtime reconciliation requires replay event family ownership input");

reporter.finish(`${desiredSources.length} desired resource source families checked`);
