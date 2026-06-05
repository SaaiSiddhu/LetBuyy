import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime topology validator");

const deploymentTopology = readJson("config/runtime/deployment-topology.json");
const productionTopology = readJson("config/runtime/production-topology.json");
const claudeContext = readFile("CLAUDE.md");
const runtimeBoundaries = readFile("docs/governance/runtime-boundaries.md");

reporter.assert(deploymentTopology?.generatedFrom === "runtime-manifests", "Deployment topology must be generated from runtime manifests");
reporter.assert(Array.isArray(deploymentTopology?.nodes) && deploymentTopology.nodes.length > 0, "Deployment topology must declare runtime nodes");
reporter.assert(Array.isArray(deploymentTopology?.dependencies), "Deployment topology must declare runtime dependencies");

const nodesByName = new Map((deploymentTopology?.nodes || []).map((node) => [node.runtimeName, node]));
const roots = new Set((deploymentTopology?.nodes || []).map((node) => node.runtimeRoot));

for (const runtimeRoot of canonicalRuntimeRoots) {
  reporter.assert(exists(`${runtimeRoot}/runtime.manifest.json`), `Canonical runtime is missing manifest: ${runtimeRoot}`);
  reporter.assert(roots.has(runtimeRoot), `Deployment topology missing canonical runtime root: ${runtimeRoot}`);
  reporter.assert(claudeContext.includes(`\`${runtimeRoot}\``), `CLAUDE.md canonical runtime map missing ${runtimeRoot}`);
  reporter.assert(runtimeBoundaries.includes(`\`${runtimeRoot}\``), `Runtime boundaries doc missing canonical runtime root ${runtimeRoot}`);
}

for (const node of deploymentTopology?.nodes || []) {
  reporter.assert(typeof node.runtimeName === "string" && node.runtimeName.length > 0, `Topology node missing runtimeName: ${node.runtimeRoot}`);
  reporter.assert(typeof node.runtimeRoot === "string" && node.runtimeRoot.length > 0, `Topology node missing runtimeRoot: ${node.runtimeName}`);
  reporter.assert(Array.isArray(node.regions) && node.regions.length > 0, `Topology node missing regions: ${node.runtimeName}`);
  reporter.assert(node.scaling?.maxInstances >= node.scaling?.minInstances, `Topology node scaling bounds invalid: ${node.runtimeName}`);
  reporter.assert(node.health?.checkName && node.health?.timeoutMs > 0, `Topology node missing health contract: ${node.runtimeName}`);

  if (node.platform === "cloudflare-workers" || node.deploymentKind === "queue-worker") {
    reporter.assert(exists(`${node.runtimeRoot}/wrangler.toml`), `Cloudflare runtime topology node missing wrangler config: ${node.runtimeRoot}`);
  }
}

for (const edge of deploymentTopology?.dependencies || []) {
  const from = nodesByName.get(edge.fromRuntime);
  const to = nodesByName.get(edge.toRuntime);
  reporter.assert(Boolean(from), `Topology dependency references unknown source runtime: ${edge.fromRuntime}`);
  reporter.assert(Boolean(to), `Topology dependency references unknown target runtime: ${edge.toRuntime}`);
  if (from && to && edge.requiredForStartup) {
    reporter.assert(
      from.startupOrder >= to.startupOrder,
      `Startup dependency order invalid: ${edge.fromRuntime} depends on ${edge.toRuntime}`,
    );
  }
}

reporter.assert(productionTopology?.environment === "production", "Production topology must declare production environment");
reporter.assert(productionTopology?.queueProvider?.producerConfig === "services/api-gateway/wrangler.toml", "Production topology must bind API Gateway as queue producer");
reporter.assert(productionTopology?.queueProvider?.consumerConfig === "services/queue-workers/wrangler.toml", "Production topology must bind Queue Workers as queue consumers");
reporter.assert(productionTopology?.eventStoreProvider?.provider === "supabase-postgres-append-only", "Production event store must be append-only Supabase/Postgres");
reporter.assert(productionTopology?.regions?.replayIntegrity?.failClosedOnDivergence === true, "Production topology must fail closed on replay divergence");

for (const queue of [
  "letbuyy-events-production",
  "letbuyy-analytics-queue-production",
  "letbuyy-search-queue-production",
  "letbuyy-notifications-queue-production",
  "letbuyy-dead-letters-production",
]) {
  reporter.assert(productionTopology?.queueProvider?.queues?.includes(queue), `Production topology missing queue: ${queue}`);
}

reporter.finish(`${canonicalRuntimeRoots.length} canonical runtime roots and ${deploymentTopology?.dependencies?.length || 0} topology edges checked`);
