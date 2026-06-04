import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Rollback integrity validator");

const manifestPath = "config/runtime/deployment-lineage-manifest.json";
const schemaPath = "config/runtime/deployment-lineage-manifest.schema.json";
const manifest = readJson(manifestPath);

reporter.assert(exists(manifestPath), `Missing deployment lineage manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing deployment lineage schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Deployment lineage manifest must reference its checked-in schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Deployment lineage manifest must not claim live evidence");
reporter.assert(manifest?.promotionOrder?.join(">") === "staging>production", "Deployment promotion order must be staging>production");
reporter.assert(manifest?.integrityRules?.rollbackRequiresPriorDeploymentVersion === true, "Rollback must require an approved prior deployment version");
reporter.assert(manifest?.integrityRules?.rollbackMustNotMutateEventStore === true, "Rollback must not mutate event store");
reporter.assert(manifest?.integrityRules?.rollbackMustPreserveQueueNames === true, "Rollback must preserve queue names");
reporter.assert(manifest?.integrityRules?.rollbackMustPreserveProjectionVersionCompatibility === true, "Rollback must preserve projection compatibility");

const rollbackSource = readFile("infrastructure/scripts/deploy/production-rollback.mjs");
for (const fragment of [
  "--worker is required",
  "--version-id is required for deterministic Worker rollback lineage",
  "validate:rollback",
  "CLOUDFLARE_API_TOKEN is required for Worker rollback",
  "\"wrangler\", \"rollback\"",
  "\"--env\", environment",
  "deployment-lineage-manifest.json",
]) {
  reporter.assert(rollbackSource.includes(fragment), `Rollback wrapper missing deterministic integrity fragment: ${fragment}`);
}

const releasePromotion = readFile("infrastructure/deployment/release-promotion.yaml");

for (const rollback of manifest?.rollbackManifests || []) {
  reporter.assert(exists(`${rollback.runtimeRoot}/wrangler.toml`), `Rollback runtime missing wrangler config: ${rollback.runtimeRoot}`);
  reporter.assert(rollback.rollbackCommand?.includes("--version-id=$APPROVED_PREVIOUS_VERSION_ID"), `Rollback command must require approved prior version: ${rollback.runtimeRoot}`);
  reporter.assert(rollback.rollbackCommand?.includes("--reason=$ROLLBACK_REASON"), `Rollback command must require reason lineage: ${rollback.runtimeRoot}`);
  reporter.assert(rollback.replayValidation === "validate:replay", `Rollback must gate replay validation: ${rollback.runtimeRoot}`);
  reporter.assert(rollback.queueValidation === "validate:queues", `Rollback must gate queue validation: ${rollback.runtimeRoot}`);
  reporter.assert(rollback.migrationCompatibility === "forward-compatible-or-forward-fix-only", `Rollback migration policy must be forward-compatible: ${rollback.runtimeRoot}`);
  reporter.assert(rollback.rollbackCorruptionPolicy?.startsWith("block-if-"), `Rollback corruption policy must be fail-closed: ${rollback.runtimeRoot}`);

  for (const [environment, workerName] of Object.entries(rollback.workerNames || {})) {
    const wrangler = readFile(rollback.config);
    reporter.assert(wrangler.includes(`name = "${workerName}"`), `Rollback worker name missing from wrangler config: ${workerName}`);
    if (environment !== "production") {
      reporter.assert(workerName.endsWith(`-${environment}`), `Lower-env Worker rollback name must include env suffix: ${workerName}`);
    }
  }
}

reporter.assert(releasePromotion.includes("rollback:"), "Release promotion manifest must define rollback section");
reporter.assert(releasePromotion.includes("queueWorkers:"), "Release promotion rollback must include queue worker rollback ownership");
reporter.assert(releasePromotion.includes("replayCompatibility:"), "Release promotion rollback must include replay compatibility gate");
reporter.assert(releasePromotion.includes("projectionRecovery:"), "Release promotion rollback must include projection recovery gate");
reporter.assert(releasePromotion.includes("queueLifecycle:"), "Release promotion rollback must include queue lifecycle gate");

reporter.finish(`${manifest?.rollbackManifests?.length || 0} rollback manifests checked`);
