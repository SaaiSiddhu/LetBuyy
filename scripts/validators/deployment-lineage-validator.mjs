import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Deployment lineage validator");

const manifest = readJson("config/runtime/deployment-lineage-manifest.json");
const releasePromotion = readFile("infrastructure/deployment/release-promotion.yaml");
const packageJson = readJson("package.json");

for (const wrapper of manifest?.deploymentWrappers || []) {
  reporter.assert(readFile(wrapper.script).length > 0, `Deployment wrapper missing source: ${wrapper.script}`);
  if (wrapper.requiresExplicitEnv) {
    reporter.assert(readFile(wrapper.script).includes("--env"), `Deployment wrapper must enforce explicit env: ${wrapper.script}`);
  }
}

for (const gate of ["rollback-integrity-validator", "deployment-lineage-validator", "topology-drift-validator", "deployment-safety-validator"]) {
  reporter.assert(manifest?.lineageGates?.includes(gate), `Deployment lineage manifest missing gate: ${gate}`);
}

for (const scriptName of ["validate:rollback", "validate:queues", "validate:topology", "validate:deployment", "validate:replay"]) {
  reporter.assert(Boolean(packageJson?.scripts?.[scriptName]), `Root package scripts missing deployment lineage gate: ${scriptName}`);
}

for (const environment of manifest?.promotionOrder || []) {
  reporter.assert(releasePromotion.includes(`${environment}:`), `Release promotion missing environment: ${environment}`);
}

for (const rollback of manifest?.rollbackManifests || []) {
  reporter.assert(releasePromotion.includes(rollback.runtimeRoot.split("/").pop().replace("api-gateway", "apiGateway").replace("webhook-service", "webhookService").replace("queue-workers", "queueWorkers")), `Release promotion rollback missing runtime ownership for ${rollback.runtimeRoot}`);
}

reporter.finish(`${manifest?.deploymentWrappers?.length || 0} deployment wrappers and ${manifest?.rollbackManifests?.length || 0} rollback lineages checked`);
