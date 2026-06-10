import {
  activeSupabaseSchemaMigrationPath,
  canonicalRuntimeRoots,
  createReporter,
  exists,
  hasSqlFunction,
  hasSqlRls,
  hasSqlTable,
  readFile,
  readActiveSupabaseSchemaMigration,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Operational lifecycle validator");

const requiredFiles = [
  "config/runtime/environment-lifecycle.schema.json",
  "config/runtime/environment-lifecycle.json",
  "config/runtime/rollout-lifecycle.schema.json",
  "config/runtime/rollout-lifecycle.json",
  "config/runtime/operational-certification-policy.schema.json",
  "config/runtime/operational-certification-policy.json",
  "scripts/staging/seed.mjs",
  activeSupabaseSchemaMigrationPath,
  "database/supabase/verification/065_enterprise_sdlc_lifecycle.sql",
  ".github/workflows/environment-lifecycle.yml",
  "docs/governance/enterprise-engineering-model.md",
  "docs/governance/production-engineering-principles.md",
  "docs/governance/environment-lifecycle-governance.md",
  "docs/governance/feature-flag-governance.md",
  "docs/governance/shadow-traffic-governance.md",
  "docs/governance/sandbox-provider-governance.md",
  "docs/runbooks/staging-rehearsal.md",
  "docs/runbooks/feature-flag-rollback.md",
  "docs/operations/phase4-enterprise-final-report.md",
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing enterprise SDLC lifecycle file: ${file}`);
}

const packageJson = readJson("package.json");
for (const scriptName of ["validate:lifecycle"]) {
  reporter.assert(Boolean(packageJson?.scripts?.[scriptName]), `package.json must define ${scriptName}`);
}

const validateGovernance = readFile("scripts/validate-governance.mjs");
reporter.assert(
  validateGovernance.includes("operational-lifecycle-validator.mjs"),
  "Governance validation must run operational-lifecycle-validator.mjs",
);

const envLifecycle = readJson("config/runtime/environment-lifecycle.json");
const environments = new Map((envLifecycle?.environments || []).map((environment) => [environment.name, environment]));
for (const environmentName of ["staging", "production"]) {
  reporter.assert(environments.has(environmentName), `Environment lifecycle must define ${environmentName}`);
}

for (const separated of [
  "secrets",
  "databases",
  "queues",
  "telemetry backends",
  "feature flag stores",
  "provider accounts",
  "certification evidence",
]) {
  reporter.assert(
    envLifecycle?.isolationRules?.mustSeparate?.includes(separated),
    `Environment lifecycle must require isolated ${separated}`,
  );
}

reporter.assert(
  environments.get("staging")?.topology?.mirrorProductionTopology === true,
  "Staging lifecycle must mirror production topology",
);
for (const environmentName of ["staging", "production"]) {
  const regions = environments.get(environmentName)?.regions || [];
  reporter.assert(
    regions.length === 1 && regions[0] === "ap-south-1",
    `${environmentName} lifecycle must declare the one-region ap-south-1 data plane`,
  );
}

const rolloutLifecycle = readJson("config/runtime/rollout-lifecycle.json");
for (const scope of ["tenant", "percentage", "internal", "environment"]) {
  reporter.assert(
    rolloutLifecycle?.featureFlags?.scopes?.includes(scope),
    `Feature flag lifecycle must support ${scope} scope`,
  );
}
reporter.assert(
  !rolloutLifecycle?.featureFlags?.scopes?.includes("region"),
  "Feature flag lifecycle must not reintroduce region-scoped rollout authority",
);
for (const step of [1, 5, 25, 50, 100]) {
  reporter.assert(rolloutLifecycle?.canary?.steps?.includes(step), `Canary lifecycle must include ${step}% rollout`);
}
for (const rolloutFragment of ["runtime-compatibility", "schema-compatibility", "shadow-consistency", "rollback-switchback"]) {
  reporter.assert(
    rolloutLifecycle?.blueGreen?.requiredChecks?.includes(rolloutFragment),
    `Blue/green lifecycle must require ${rolloutFragment}`,
  );
}
for (const provider of ["stripe", "razorpay", "paypal", "email", "sms", "queues"]) {
  reporter.assert(
    typeof rolloutLifecycle?.sandboxProviders?.[provider] === "string",
    `Sandbox provider lifecycle must define ${provider}`,
  );
}

const certificationPolicy = readJson("config/runtime/operational-certification-policy.json");
reporter.assert(certificationPolicy?.hardFail === true, "Operational certification policy must hard-fail");
reporter.assert(
  certificationPolicy?.minimumScores?.repository === 10 && certificationPolicy?.minimumScores?.live === 10,
  "Operational certification policy must require 10/10 repository and live scores",
);
for (const category of [
  "deployment",
  "cloudflare",
  "supabase",
  "observability",
  "security",
  "incident",
  "dashboards",
  "control-plane",
]) {
  reporter.assert(
    certificationPolicy?.requiredCategories?.includes(category),
    `Operational certification policy must require ${category}`,
  );
}
for (const retiredCategory of ["failover", "chaos", "load", "sre", "event-store", "multi-region", "replay-runtime"]) {
  reporter.assert(
    !certificationPolicy?.requiredCategories?.includes(retiredCategory),
    `Operational certification policy must not require retired category ${retiredCategory}`,
  );
}

const liveCertification = readJson("config/runtime/live-production-certification.json");
const maxAgeHours =
  Number(certificationPolicy?.evidenceExpirationHours) ||
  Number(liveCertification?.certificationRuntime?.evidenceExpirationHours) ||
  24;

reporter.assert(
  Number(liveCertification?.certificationRuntime?.evidenceExpirationHours) === maxAgeHours,
  "Live certification evidence expiration must match operational certification policy",
);

if (liveCertification?.certificationMode === "live-certified") {
  const expiresBefore = Date.now() - maxAgeHours * 60 * 60 * 1000;
  for (const [category, evidence] of Object.entries(liveCertification?.evidenceCategories || {})) {
    const verifiedAt = Date.parse(evidence?.lastVerifiedAt || "");
    reporter.assert(Number.isFinite(verifiedAt), `Live-certified category is missing lastVerifiedAt: ${category}`);
    reporter.assert(verifiedAt >= expiresBefore, `Live-certified category has stale evidence: ${category}`);
    reporter.assert(
      typeof evidence?.evidenceId === "string" && evidence.evidenceId.length > 0,
      `Live-certified category is missing evidenceId: ${category}`,
    );
  }
} else {
  reporter.assert(
    liveCertification?.certificationMode === "credential-gated-plan-ready",
    "Live certification must be credential-gated-plan-ready unless fresh evidence makes it live-certified",
  );
}

const sharedTypes = readFile("packages/shared-types/src/index.ts");
for (const sdkFragment of [
  "FeatureFlagDefinitionSchema",
  "FeatureFlagContextSchema",
  "evaluateFeatureFlag",
  "featureFlagExposureTelemetry",
  "kill_switch",
]) {
  reporter.assert(sharedTypes.includes(sdkFragment), `Feature flag SDK must include ${sdkFragment}`);
}

const migration = readActiveSupabaseSchemaMigration();
for (const tableName of [
  "operational_feature_flags",
  "operational_feature_flag_audit_events",
  "operational_feature_flag_exposures",
  "rollout_stage_evidence",
  "shadow_traffic_comparison_runs",
  "sandbox_provider_contracts",
]) {
  reporter.assert(
    hasSqlTable(migration, tableName),
    `Enterprise SDLC migration must create ${tableName}`,
  );
  reporter.assert(
    hasSqlRls(migration, tableName),
    `Enterprise SDLC migration must enable RLS for ${tableName}`,
  );
  reporter.assert(
    migration.includes(`CREATE POLICY ${tableName}_service_all`),
    `Enterprise SDLC migration must create service policy for ${tableName}`,
  );
}

for (const functionName of ["record_operational_feature_flag_exposure", "record_rollout_stage_evidence"]) {
  reporter.assert(
    hasSqlFunction(migration, functionName),
    `Enterprise SDLC migration must create ${functionName}`,
  );
}

const productionTopology = readJson("config/runtime/production-topology.json");
reporter.assert(
  productionTopology?.outboxProvider?.migrations?.includes(activeSupabaseSchemaMigrationPath),
  "Production topology must include the active Supabase baseline migration for the transactional outbox",
);

const environmentWorkflow = readFile(".github/workflows/environment-lifecycle.yml");
for (const workflowFragment of [
  "operational-lifecycle-validator.mjs",
  "staging",
  "validate:governance",
  "typecheck",
]) {
  reporter.assert(
    environmentWorkflow.includes(workflowFragment),
    `Environment lifecycle workflow must include ${workflowFragment}`,
  );
}

for (const workflowFile of [
  ".github/workflows/production-rollout.yml",
  ".github/workflows/live-production-certification.yml",
]) {
  reporter.assert(
    readFile(workflowFile).includes("validate:lifecycle"),
    `${workflowFile} must run operational lifecycle gates`,
  );
}

for (const runtimeRoot of canonicalRuntimeRoots) {
  reporter.assert(exists(`${runtimeRoot}/runtime.manifest.json`), `Runtime manifest missing for ${runtimeRoot}`);
}

reporter.finish(`${requiredFiles.length} SDLC lifecycle files, ${environments.size} environments, and rollout contracts checked`);
