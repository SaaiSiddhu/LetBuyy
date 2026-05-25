import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Deployment intelligence validator");

const intelligence = readJson("config/runtime/runtime-survivability-intelligence.json");
const deployment = intelligence?.deploymentIntelligence || {};
const topology = readJson(deployment.topologyManifest || "config/runtime/deployment-topology.json");

reporter.assert(intelligence?.mode === "governance-contract-not-live-evidence", "Deployment intelligence must not claim live evidence");
reporter.assert(deployment.engineSource === "packages/distributed-runtime/src/deployment-intelligence-runtime.ts", "Deployment intelligence engine must live in distributed-runtime");
reporter.assert(deployment.topologyManifest === "config/runtime/deployment-topology.json", "Deployment intelligence must bind topology manifest");
reporter.assert(deployment.dagCompiler === "compileDeploymentDag", "Deployment intelligence must name DAG compiler");
reporter.assert(deployment.deterministicAssertion === "assertDeploymentDagDeterministic", "Deployment intelligence must name deterministic assertion");
reporter.assert(deployment.convergencePolicy === "dependency-dag-before-runtime-activation", "Deployment intelligence must compile DAG before activation");
reporter.assert(deployment.blastRadiusPolicy === "runtime-dependencies-compiled-before-activation", "Deployment intelligence must compile blast radius before activation");

const source = readFile(deployment.engineSource || "");
for (const fragment of [
  "compileDeploymentDag",
  "assertDeploymentDagDeterministic",
  "Deployment dependency cycle exists",
  "blastRadiusByRuntime",
  "dagChecksum",
]) {
  reporter.assert(source.includes(fragment), `Deployment intelligence engine missing fragment: ${fragment}`);
}

const topologyRoots = new Set((topology?.nodes || []).map((node) => node.runtimeRoot));
for (const runtimeRoot of deployment.targetRuntimeRoots || []) {
  reporter.assert(topologyRoots.has(runtimeRoot), `Deployment intelligence target missing topology root: ${runtimeRoot}`);
}
reporter.assert((deployment.targetRuntimeRoots || []).includes("services/queue-workers"), "Deployment intelligence must include queue worker activation root");
reporter.assert((deployment.targetRuntimeRoots || []).includes("services/api-gateway"), "Deployment intelligence must include API gateway activation root");

reporter.finish(`${deployment.targetRuntimeRoots?.length || 0} deployment intelligence targets checked`);
