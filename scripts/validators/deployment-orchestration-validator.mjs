import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Deployment orchestration validator");

const manifest = readJson("config/runtime/runtime-orchestration-manifest.json");
const orchestration = manifest?.deploymentOrchestration || {};

reporter.assert(exists("config/runtime/runtime-orchestration-manifest.json"), "Missing runtime orchestration manifest");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Deployment orchestration must not claim live evidence");
reporter.assert(orchestration.engineSource === "packages/distributed-runtime/src/deployment-orchestration-runtime.ts", "Deployment orchestration must use package-owned engine");
reporter.assert(orchestration.topologyManifest === "config/runtime/deployment-topology.json", "Deployment orchestration must bind deployment topology");
reporter.assert(orchestration.activationSource === "buildRuntimeStartupPlan", "Deployment orchestration must reuse runtime startup ordering");
reporter.assert(orchestration.stageGatePolicy === "each-stage-must-have-fail-closed-gates", "Deployment stages must be fail-closed");
reporter.assert((orchestration.promotionOrder || []).join(">") === "local>dev>staging>production", "Deployment promotion order must be local>dev>staging>production");

const source = readFile(orchestration.engineSource || "");
for (const fragment of [
  "buildDeploymentOrchestrationPlan",
  "assertDeploymentActivationOrdered",
  "buildRuntimeStartupPlan",
  "Deployment stage",
  "references unknown runtime root",
]) {
  reporter.assert(source.includes(fragment), `Deployment orchestration engine missing fragment: ${fragment}`);
}

const topology = readJson("config/runtime/deployment-topology.json");
const topologyRoots = new Set((topology?.nodes || []).map((node) => node.runtimeRoot));
const stages = orchestration.stages || [];
const stageByEnvironment = new Map(stages.map((stage) => [stage.environment, stage]));

let previousOrder = 0;
for (const environment of ["local", "dev", "staging", "production"]) {
  const stage = stageByEnvironment.get(environment);
  reporter.assert(Boolean(stage), `Missing deployment orchestration stage for ${environment}`);
  reporter.assert(stage?.order > previousOrder, `Deployment orchestration order must increase at ${environment}`);
  previousOrder = stage?.order || previousOrder;
  reporter.assert((stage?.requiredGates || []).length > 0, `Deployment orchestration stage must declare gates: ${environment}`);
  for (const runtimeRoot of stage?.runtimeRoots || []) {
    reporter.assert(topologyRoots.has(runtimeRoot), `Deployment orchestration references unknown runtime root: ${runtimeRoot}`);
  }
}

const production = stageByEnvironment.get("production") || {};
for (const gate of ["validate:governance", "validate:reconciliation", "validate:runtime", "validate:replay", "validate:rollback", "validate:queues", "validate:deployment", "validate:cloudflare"]) {
  reporter.assert((production.requiredGates || []).includes(gate), `Production deployment stage missing gate: ${gate}`);
}

for (const workflow of [
  ".github/workflows/architecture-governance.yml",
  ".github/workflows/production-rollout.yml",
  ".github/workflows/live-production-certification.yml",
]) {
  const text = readFile(workflow);
  reporter.assert(text.includes("pnpm run validate:reconciliation"), `CI workflow must gate reconciliation before deployment: ${workflow}`);
}

reporter.finish(`${stages.length} deployment orchestration stages checked`);
