import {
  createReporter,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Topology drift validator");

const deploymentTopology = readJson("config/runtime/deployment-topology.json");
const productionTopology = readJson("config/runtime/production-topology.json");
const queueManifest = readJson("config/runtime/queue-lifecycle-manifest.json");
const replayManifest = readJson("config/runtime/replay-evolution-manifest.json");
const projectionManifest = readJson("config/runtime/projection-recovery-manifest.json");
const deploymentLineage = readJson("config/runtime/deployment-lineage-manifest.json");

const topologyRoots = new Set((deploymentTopology?.nodes || []).map((node) => node.runtimeRoot));
for (const root of [
  queueManifest?.producerRuntime,
  queueManifest?.consumerRuntime,
  ...((deploymentLineage?.rollbackManifests || []).map((manifest) => manifest.runtimeRoot)),
]) {
  reporter.assert(topologyRoots.has(root), `Runtime manifest topology drift: ${root} not present in deployment topology`);
}

const productionQueues = new Set(productionTopology?.queueProvider?.queues || []);
for (const queue of queueManifest?.queues || []) {
  reporter.assert(productionQueues.has(queue.names.production), `Production topology missing governed queue: ${queue.names.production}`);
  reporter.assert(productionQueues.has(queue.deadLetterNames.production), `Production topology missing governed DLQ: ${queue.deadLetterNames.production}`);
}

const replayEvents = new Set((replayManifest?.eventFamilies || []).map((family) => family.eventType));
for (const projection of projectionManifest?.projections || []) {
  reporter.assert(topologyRoots.has(projection.ownerRuntime), `Projection owner runtime not present in deployment topology: ${projection.ownerRuntime}`);
  for (const eventType of projection.sourceEvents || []) {
    reporter.assert(replayEvents.has(eventType), `Projection topology references ungoverned replay event: ${projection.projectionName} -> ${eventType}`);
  }
}

const topologyRuntimeNames = new Set((deploymentTopology?.nodes || []).map((node) => node.runtimeName));
for (const required of ["API Gateway", "Webhook Service", "Queue Workers", "Event Bus", "Supabase Database"]) {
  reporter.assert(topologyRuntimeNames.has(required), `Runtime topology missing survivability node: ${required}`);
}

reporter.finish(`${topologyRoots.size} topology roots checked for queue/replay/projection/rollback drift`);
