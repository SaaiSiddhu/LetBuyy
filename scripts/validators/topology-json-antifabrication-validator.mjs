import {
  createReporter,
  readJson,
  reservedServiceRoots,
} from "./governance-common.mjs";

const reporter = createReporter("Topology JSON anti-fabrication validator");
const productionTopology = readJson("config/runtime/production-topology.json");
const deploymentTopology = readJson("config/runtime/deployment-topology.json");

reporter.assert(productionTopology?.environment === "production", "Production topology must be production-scoped");
reporter.assert(productionTopology?.canonicalDomain === "letbuyy.com", "Production topology must declare letbuyy.com canonical domain");

const productionRuntimeByRoot = new Map((productionTopology?.runtimes || []).map((runtime) => [runtime.runtimeRoot, runtime]));
const deploymentNodeByRoot = new Map((deploymentTopology?.nodes || []).map((node) => [node.runtimeRoot, node]));

for (const runtimeRoot of reservedServiceRoots) {
  const productionRuntime = productionRuntimeByRoot.get(runtimeRoot);
  reporter.assert(productionRuntime, `Reserved runtime missing from production topology: ${runtimeRoot}`);
  reporter.assert(
    productionRuntime?.environment === "reserved" && productionRuntime?.status === "reserved",
    `Reserved runtime must not be represented as production: ${runtimeRoot}`,
  );

  const deploymentNode = deploymentNodeByRoot.get(runtimeRoot);
  reporter.assert(deploymentNode, `Reserved runtime missing from deployment topology: ${runtimeRoot}`);
  reporter.assert(
    deploymentNode?.platform === "reserved" && deploymentNode?.scaling?.maxInstances === 0,
    `Reserved runtime must not have deployable topology capacity: ${runtimeRoot}`,
  );
}

for (const runtimeRoot of [
  "apps/frozen/app-store",
  "apps/frozen/developer-portal",
  "apps/frozen/theme-store",
  "apps/frozen/operations-portal",
]) {
  const productionRuntime = productionRuntimeByRoot.get(runtimeRoot);
  reporter.assert(productionRuntime, `Frozen app missing explicit production topology status: ${runtimeRoot}`);
  reporter.assert(
    productionRuntime?.environment === "frozen" && productionRuntime?.status === "frozen",
    `Frozen app must not be represented as production: ${runtimeRoot}`,
  );
}

for (const runtime of productionTopology?.runtimes || []) {
  reporter.assert(
    !JSON.stringify(runtime).includes("helm/letbuyy-production"),
    `Production topology must not reference Helm fantasy deployment manifests: ${runtime.runtimeRoot}`,
  );
  reporter.assert(
    !JSON.stringify(runtime).includes("packages/distributed-runtime"),
    `Production topology must not cite distributed-runtime as event-store authority: ${runtime.runtimeRoot}`,
  );
}

reporter.finish("reserved/frozen production topology statuses checked");
