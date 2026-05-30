import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Operational lifecycle validator");

const requiredFiles = [
  "config/env/templates/local.env.example",
  "config/runtime/environment-lifecycle.schema.json",
  "config/runtime/environment-lifecycle.json",
  "config/runtime/rollout-lifecycle.schema.json",
  "config/runtime/rollout-lifecycle.json",
  "config/runtime/operational-certification-policy.schema.json",
  "config/runtime/operational-certification-policy.json",
  "infrastructure/local/docker-compose.yml",
  "infrastructure/local/otel-collector.yaml",
  "infrastructure/local/prometheus.yml",
  "infrastructure/local/tempo.yaml",
  "infrastructure/local/grafana/provisioning/datasources/datasources.yml",
  "infrastructure/local/postgres/init/001-local-operational-schema.sql",
  "infrastructure/local/postgres/seed/001-local-seed.sql",
  "infrastructure/local/replay-runtime.mjs",
  "infrastructure/local/wiremock/mappings/provider-sandbox-health.json",
  "infrastructure/local/wiremock/mappings/provider-sandbox-payment.json",
  "infrastructure/local/wiremock/mappings/provider-sandbox-sms.json",
  "infrastructure/scripts/local/common.mjs",
  "infrastructure/scripts/local/bootstrap-local.mjs",
  "infrastructure/scripts/local/start-local-stack.mjs",
  "infrastructure/scripts/local/health-local-stack.mjs",
  "infrastructure/scripts/local/reset-local-stack.mjs",
  "infrastructure/scripts/local/seed-local-data.mjs",
  "infrastructure/scripts/load/locust-checkout-concurrency.py",
  "infrastructure/scripts/load/gatling/CheckoutConcurrencySimulation.scala",
  "database/supabase/migrations/065_enterprise_sdlc_lifecycle.sql",
  "database/supabase/verification/065_enterprise_sdlc_lifecycle.sql",
  ".github/workflows/environment-lifecycle.yml",
  "docs/governance/enterprise-engineering-model.md",
  "docs/governance/production-engineering-principles.md",
  "docs/governance/local-development-governance.md",
  "docs/governance/environment-lifecycle-governance.md",
  "docs/governance/feature-flag-governance.md",
  "docs/governance/shadow-traffic-governance.md",
  "docs/governance/sandbox-provider-governance.md",
  "docs/governance/chaos-governance.md",
  "docs/runbooks/local-development-lifecycle.md",
  "docs/runbooks/staging-rehearsal.md",
  "docs/runbooks/feature-flag-rollback.md",
  "docs/operations/phase4-enterprise-final-report.md",
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing enterprise SDLC lifecycle file: ${file}`);
}

const packageJson = readJson("package.json");
for (const scriptName of [
  "local:bootstrap",
  "local:up",
  "local:health",
  "local:reset",
  "local:seed",
  "validate:lifecycle",
]) {
  reporter.assert(Boolean(packageJson?.scripts?.[scriptName]), `package.json must define ${scriptName}`);
}

const validateGovernance = readFile("scripts/validate-governance.mjs");
reporter.assert(
  validateGovernance.includes("operational-lifecycle-validator.mjs"),
  "Governance validation must run operational-lifecycle-validator.mjs",
);

const compose = readFile("infrastructure/local/docker-compose.yml");
for (const serviceName of [
  "postgres",
  "redis",
  "queue-emulator",
  "mail-sandbox",
  "provider-sandbox",
  "feature-flags",
  "replay-runtime",
  "otel-collector",
  "prometheus",
  "grafana",
  "loki",
  "tempo",
]) {
  reporter.assert(compose.includes(`${serviceName}:`), `Local Docker Compose must define ${serviceName}`);
}

for (const localFragment of [
  "local_event_store",
  "local_queue_messages",
  "local_replay_checkpoints",
  "local_feature_flag_exposures",
  "local_provider_sandbox_events",
]) {
  reporter.assert(
    readFile("infrastructure/local/postgres/init/001-local-operational-schema.sql").includes(localFragment),
    `Local operational schema must include ${localFragment}`,
  );
}

const envLifecycle = readJson("config/runtime/environment-lifecycle.json");
const environments = new Map((envLifecycle?.environments || []).map((environment) => [environment.name, environment]));
for (const environmentName of ["local", "development", "staging", "production"]) {
  reporter.assert(environments.has(environmentName), `Environment lifecycle must define ${environmentName}`);
}

for (const separated of [
  "secrets",
  "databases",
  "queues",
  "event stores",
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
  environments.get("local")?.evidence?.certifiableAsLive === false,
  "Local lifecycle must not be certifiable as live execution",
);
reporter.assert(
  environments.get("development")?.stability?.includes("unstable"),
  "Development lifecycle must be explicitly unstable",
);
reporter.assert(
  environments.get("development")?.topology?.cloudflareEnvironment === "dev",
  "Development lifecycle must map to the Cloudflare Wrangler dev environment",
);
for (const developmentResource of [
  "api-dev.letbuyy.store",
  "letbuyy-api-dev",
  "letbuyy-events-dev",
  "letbuyy-dead-letters-dev",
  "letbuyy-dev-kv",
  "letbuyy-dev-r2",
  "letbuyy-dev-d1",
  "letbuyy-dev-queue",
]) {
  reporter.assert(
    JSON.stringify(environments.get("development")?.topology || {}).includes(developmentResource),
    `Development lifecycle topology must declare isolated ${developmentResource}`,
  );
}
reporter.assert(
  environments.get("staging")?.topology?.mirrorProductionTopology === true,
  "Staging lifecycle must mirror production topology",
);
for (const region of ["ap-south-1", "ap-southeast-1", "us-east-1", "eu-west-1"]) {
  reporter.assert(
    environments.get("staging")?.regions?.includes(region) && environments.get("production")?.regions?.includes(region),
    `Staging and production lifecycle must declare regional readiness contract for ${region}`,
  );
}

const rolloutLifecycle = readJson("config/runtime/rollout-lifecycle.json");
for (const scope of ["tenant", "percentage", "internal", "region", "environment"]) {
  reporter.assert(
    rolloutLifecycle?.featureFlags?.scopes?.includes(scope),
    `Feature flag lifecycle must support ${scope} scope`,
  );
}
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
  "observability",
  "failover",
  "chaos",
  "load",
  "security",
  "sre",
  "event-store",
  "multi-region",
  "replay-runtime",
]) {
  reporter.assert(
    certificationPolicy?.requiredCategories?.includes(category),
    `Operational certification policy must require ${category}`,
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

const migration = readFile("database/supabase/migrations/065_enterprise_sdlc_lifecycle.sql");
for (const tableName of [
  "operational_feature_flags",
  "operational_feature_flag_audit_events",
  "operational_feature_flag_exposures",
  "rollout_stage_evidence",
  "shadow_traffic_comparison_runs",
  "sandbox_provider_contracts",
]) {
  reporter.assert(
    migration.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`),
    `Enterprise SDLC migration must create ${tableName}`,
  );
  reporter.assert(
    new RegExp(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`).test(migration),
    `Enterprise SDLC migration must enable RLS for ${tableName}`,
  );
  reporter.assert(
    migration.includes(`CREATE POLICY ${tableName}_service_all`),
    `Enterprise SDLC migration must create service policy for ${tableName}`,
  );
}

for (const functionName of ["record_operational_feature_flag_exposure", "record_rollout_stage_evidence"]) {
  reporter.assert(
    new RegExp(`CREATE OR REPLACE FUNCTION ${functionName}\\b`).test(migration),
    `Enterprise SDLC migration must create ${functionName}`,
  );
}

const productionTopology = readJson("config/runtime/production-topology.json");
reporter.assert(
  productionTopology?.eventStoreProvider?.migrations?.includes("database/supabase/migrations/065_enterprise_sdlc_lifecycle.sql"),
  "Production topology must include the enterprise SDLC lifecycle migration",
);

const loadSuite = readFile("infrastructure/scripts/load/run-load-suite.mjs");
for (const tool of ["k6", "locust", "gatling"]) {
  reporter.assert(loadSuite.includes(tool), `Load suite must support ${tool}`);
}

const environmentWorkflow = readFile(".github/workflows/environment-lifecycle.yml");
for (const workflowFragment of [
  "operational-lifecycle-validator.mjs",
  "local-stack-smoke",
  "bootstrap-local.mjs",
  "start-local-stack.mjs",
  "health-local-stack.mjs",
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
