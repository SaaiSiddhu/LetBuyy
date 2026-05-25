import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Production readiness validator");

const requiredFiles = [
  "config/runtime/production-topology.schema.json",
  "config/runtime/production-topology.json",
  "infrastructure/cloudflare/queues.tf",
  "infrastructure/cloudflare/storage.tf",
  "infrastructure/cloudflare/workers-topology.md",
  "infrastructure/deployment/kubernetes/namespace.yaml",
  "infrastructure/deployment/kubernetes/runtime-health-probes.yaml",
  "infrastructure/deployment/helm/letbuyy-production/Chart.yaml",
  "infrastructure/deployment/helm/letbuyy-production/values.yaml",
  "infrastructure/deployment/release-promotion.yaml",
  "infrastructure/deployment/migration-orchestration.yaml",
  "infrastructure/observability/otel-collector.yaml",
  "infrastructure/observability/prometheus-rules.yaml",
  "infrastructure/observability/grafana-runtime-dashboard.json",
  "infrastructure/observability/grafana-queue-dashboard.json",
  "infrastructure/observability/grafana-replay-dashboard.json",
  "infrastructure/observability/grafana-incident-dashboard.json",
  "infrastructure/observability/grafana-deployment-dashboard.json",
  "infrastructure/observability/grafana-sre-dashboard.json",
  "infrastructure/security/production-security-controls.yaml",
  "infrastructure/monitoring/slo-catalog.yaml",
  "infrastructure/scripts/cloudflare/verify-provider-contracts.mjs",
  "infrastructure/scripts/database/verify-supabase-operations.mjs",
  "infrastructure/scripts/deploy/production-deploy.mjs",
  "infrastructure/scripts/deploy/production-rollback.mjs",
  "infrastructure/scripts/deploy/verify-health-gates.mjs",
  "infrastructure/scripts/observability/verify-observability-rollout.mjs",
  "infrastructure/scripts/operations/phase4-ultimate-validate.mjs",
  "infrastructure/scripts/security/verify-security-gates.mjs",
  "infrastructure/scripts/security/rotate-secrets.mjs",
  "infrastructure/scripts/chaos/queue-outage.mjs",
  "infrastructure/scripts/chaos/provider-outage.mjs",
  "infrastructure/scripts/chaos/run-chaos-experiment.mjs",
  "infrastructure/scripts/load/k6-checkout-concurrency.js",
  "infrastructure/scripts/load/k6-queue-throughput.js",
  "infrastructure/scripts/load/k6-replay-stress.js",
  "infrastructure/scripts/load/run-load-suite.mjs",
  "services/queue-workers/package.json",
  "services/queue-workers/wrangler.toml",
  "services/queue-workers/src/index.ts",
  "database/supabase/migrations/062_production_rollout_operations.sql",
  "database/supabase/migrations/063_absolute_production_operationalization.sql",
  "database/supabase/verification/063_absolute_production_operationalization.sql",
  "apps/platform-console/src/app/(dashboard)/operations/page.tsx",
  "docs/runbooks/incident-sev1.md",
  "docs/runbooks/queue-dlq-redrive.md",
  "docs/runbooks/event-replay.md",
  "docs/runbooks/regional-failover.md",
  "docs/runbooks/deployment-rollback.md",
  "docs/runbooks/secret-rotation.md",
  "docs/runbooks/chaos-drill.md",
  "docs/governance/production-runtime-governance.md",
  "docs/governance/deployment-governance.md",
  "docs/governance/observability-infrastructure-governance.md",
  "docs/governance/incident-response-governance.md",
  "docs/governance/failover-governance.md",
  "docs/governance/chaos-engineering-governance.md",
  "docs/governance/sre-governance.md",
  "docs/governance/queue-provider-governance.md",
  "docs/governance/event-store-governance.md",
  "docs/governance/security-operations-governance.md",
  "docs/governance/multi-region-runtime-governance.md",
  "docs/governance/deployment-pipeline-governance.md",
  "docs/governance/runtime-observability-governance.md",
  "docs/governance/operational-dashboard-governance.md",
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing Phase 4 production readiness file: ${file}`);
}

const phase4ManifestFields = [
  "productionOwnership",
  "deploymentOwnership",
  "deploymentPipelineOwnership",
  "telemetryInfrastructureOwnership",
  "dashboardOwnership",
  "operationalDashboardOwnership",
  "sreOwnership",
  "replayOperationsOwnership",
  "observabilityInfrastructureOwnership",
  "queueProviderOwnership",
  "eventStoreOwnership",
  "failoverOwnership",
  "incidentOwnership",
  "deploymentTopologyOwnership",
  "securityOwnership",
  "chaosOwnership",
  "loadTestingOwnership",
  "controlPlaneOwnership",
  "regionalRoutingOwnership",
];

for (const runtimeRoot of canonicalRuntimeRoots) {
  const manifestPath = `${runtimeRoot}/runtime.manifest.json`;
  const manifest = readJson(manifestPath);

  for (const field of phase4ManifestFields) {
    reporter.assert(
      typeof manifest?.[field] === "string" && manifest[field].trim().length > 0,
      `Runtime manifest missing Phase 4 production ownership field ${field}: ${manifestPath}`,
    );
  }
}

const productionTopology = readJson("config/runtime/production-topology.json");
const productionRuntimeRoots = new Set((productionTopology?.runtimes || []).map((runtime) => runtime.runtimeRoot));

for (const runtimeRoot of canonicalRuntimeRoots) {
  reporter.assert(
    productionRuntimeRoots.has(runtimeRoot),
    `Production topology must include canonical runtime root: ${runtimeRoot}`,
  );
}

for (const runtime of productionTopology?.runtimes || []) {
  reporter.assert(
    Array.isArray(runtime.deploymentManifests) && runtime.deploymentManifests.length > 0,
    `Production topology runtime must declare deployment manifests: ${runtime.runtimeRoot}`,
  );

  for (const manifestPath of runtime.deploymentManifests || []) {
    reporter.assert(
      exists(manifestPath),
      `Production topology references missing deployment manifest for ${runtime.runtimeRoot}: ${manifestPath}`,
    );
  }
}

for (const file of [
  productionTopology?.queueProvider?.terraform,
  productionTopology?.queueProvider?.producerConfig,
  productionTopology?.queueProvider?.consumerConfig,
  productionTopology?.queueProvider?.validationScript,
  productionTopology?.eventStoreProvider?.verificationSql,
  productionTopology?.eventStoreProvider?.verificationScript,
  productionTopology?.observabilityStack?.collector,
  productionTopology?.observabilityStack?.alerts,
  productionTopology?.observabilityStack?.validationScript,
  productionTopology?.deploymentPipeline?.workflow,
  productionTopology?.deploymentPipeline?.releasePromotion,
  productionTopology?.deploymentPipeline?.deployScript,
  productionTopology?.deploymentPipeline?.rollbackScript,
  productionTopology?.deploymentPipeline?.healthGateScript,
  productionTopology?.deploymentPipeline?.ultimateValidationScript,
  productionTopology?.securityOperations?.controls,
  productionTopology?.securityOperations?.securityGateScript,
  productionTopology?.securityOperations?.secretRotationScript,
  productionTopology?.securityOperations?.secretRotationRunbook,
  productionTopology?.chaosEngineering?.runner,
  productionTopology?.loadTesting?.runner,
  ...(productionTopology?.observabilityStack?.dashboards || []),
  ...(productionTopology?.operationalDashboards || []),
  ...(productionTopology?.runbooks || []),
  ...(productionTopology?.loadTesting?.scripts || []),
  ...(productionTopology?.eventStoreProvider?.migrations || []),
].filter(Boolean)) {
  reporter.assert(exists(file), `Production topology references missing source file: ${file}`);
}

const apiWrangler = readFile("services/api-gateway/wrangler.toml");
const queueWrangler = readFile("services/queue-workers/wrangler.toml");
const queueTerraform = readFile("infrastructure/cloudflare/queues.tf");

for (const queueName of [
  "letbuyy-events",
  "letbuyy-analytics",
  "letbuyy-search-indexing",
  "letbuyy-notifications",
  "letbuyy-dead-letters",
]) {
  reporter.assert(
    queueTerraform.includes(queueName) && queueWrangler.includes(queueName),
    `Cloudflare Queue must be declared in Terraform and consumer config: ${queueName}`,
  );
}

for (const producerBinding of ["EVENT_QUEUE", "ANALYTICS_QUEUE", "SEARCH_QUEUE", "NOTIFICATION_QUEUE"]) {
  reporter.assert(
    apiWrangler.includes(producerBinding),
    `API Gateway must declare Cloudflare Queue producer binding: ${producerBinding}`,
  );
}

for (const wranglerEnv of ["env.staging", "env.production"]) {
  reporter.assert(
    apiWrangler.includes(`[${wranglerEnv}]`) && queueWrangler.includes(`[${wranglerEnv}]`),
    `Wrangler config must define ${wranglerEnv} for API and queue workers`,
  );
}

for (const requiredQueueSetting of ["max_concurrency", "retry_delay", "dead_letter_queue"]) {
  reporter.assert(
    queueWrangler.includes(requiredQueueSetting),
    `Queue worker config must include production queue setting: ${requiredQueueSetting}`,
  );
}

reporter.assert(
  /resource\s+"cloudflare_queue"\s+"runtime"/.test(queueTerraform) &&
    /resource\s+"cloudflare_queue_consumer"\s+"runtime"/.test(queueTerraform),
  "Cloudflare queue Terraform must create queues and worker consumers",
);

const migration = readFile("database/supabase/migrations/062_production_rollout_operations.sql");
for (const tableName of [
  "production_db_rollout_plans",
  "database_operation_snapshots",
  "production_incidents",
  "production_incident_events",
  "failover_drill_runs",
  "chaos_experiment_runs",
  "load_test_runs",
  "deployment_promotion_runs",
  "runtime_secret_rotation_events",
  "runtime_slo_definitions",
]) {
  reporter.assert(
    migration.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`),
    `Phase 4 migration must create ${tableName}`,
  );
  reporter.assert(
    new RegExp(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`).test(migration),
    `Phase 4 table must enable RLS: ${tableName}`,
  );
}

const finalMigration = readFile("database/supabase/migrations/063_absolute_production_operationalization.sql");
const finalVerification = readFile("database/supabase/verification/063_absolute_production_operationalization.sql");
for (const tableName of [
  "production_readiness_gate_runs",
  "deployment_health_gate_results",
  "event_store_integrity_checks",
  "runtime_event_retention_policies",
  "operational_dashboard_snapshots",
  "sre_error_budget_snapshots",
  "security_enforcement_events",
  "regional_routing_overrides",
]) {
  reporter.assert(
    finalMigration.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`),
    `Phase 4.final migration must create ${tableName}`,
  );
  reporter.assert(
    new RegExp(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`).test(finalMigration),
    `Phase 4.final table must enable RLS: ${tableName}`,
  );
}

for (const functionName of [
  "record_production_readiness_gate_run",
  "record_deployment_health_gate_result",
  "validate_event_stream_consistency",
  "archive_distributed_events",
  "record_operational_dashboard_snapshot",
  "record_sre_error_budget_snapshot",
  "record_security_enforcement_event",
  "record_regional_routing_override",
]) {
  reporter.assert(
    new RegExp(`CREATE OR REPLACE FUNCTION ${functionName}\\b`).test(finalMigration),
    `Phase 4.final migration must create operational helper function ${functionName}`,
  );
}

for (const verificationFragment of [
  "validate_event_stream_consistency",
  "pg_policies",
  "production_readiness_gate_runs",
  "regional_routing_overrides",
]) {
  reporter.assert(
    finalVerification.includes(verificationFragment),
    `Phase 4 ultimate verification SQL must include ${verificationFragment}`,
  );
}

for (const functionName of [
  "record_production_incident",
  "update_production_incident_status",
  "record_failover_drill_run",
  "record_chaos_experiment_run",
  "record_load_test_run",
  "record_deployment_promotion_run",
]) {
  reporter.assert(
    new RegExp(`CREATE OR REPLACE FUNCTION ${functionName}\\b`).test(migration),
    `Phase 4 migration must create operational helper function ${functionName}`,
  );
}

const operationsRoute = readFile("services/api-gateway/src/routes/operations.ts");
for (const routeFragment of [
  "/runtime/overview",
  "/runtime/queues/:queueName",
  "/runtime/replays",
  "/runtime/control-commands",
  "/runtime/incidents",
  "/runtime/failover-drills",
  "/runtime/chaos-experiments",
  "/runtime/load-tests",
  "/runtime/deployments",
  "/runtime/readiness-gates",
  "/runtime/deployment-health-gates",
  "/runtime/event-store/integrity",
  "/runtime/event-store/archive",
  "/runtime/dashboards",
  "/runtime/sre/error-budgets",
  "/runtime/security/enforcement-events",
  "/runtime/regional-routing-overrides",
]) {
  reporter.assert(
    operationsRoute.includes(routeFragment),
    `Operations API must expose production control-plane route: ${routeFragment}`,
  );
}

const securityMiddleware = readFile("services/api-gateway/src/middleware/security.ts");
for (const securityFragment of ["csrfProtection", "CSRF_TOKEN_INVALID", "Strict-Transport-Security", "errorResponseSanitizer"]) {
  reporter.assert(
    securityMiddleware.includes(securityFragment),
    `API security middleware must include ${securityFragment}`,
  );
}

const webhookService = readFile("services/webhook-service/src/index.ts");
for (const webhookFragment of ["RAZORPAY_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET", "timingSafeEqual", "signature_valid: true"]) {
  reporter.assert(
    webhookService.includes(webhookFragment),
    `Webhook service must enforce provider signature evidence: ${webhookFragment}`,
  );
}

const ci = readFile(".github/workflows/architecture-governance.yml");
reporter.assert(
  ci.includes("production-readiness-validator.mjs"),
  "CI must run the production readiness validator",
);

const rolloutCi = readFile(".github/workflows/production-rollout.yml");
for (const ciFragment of [
  "verify-security-gates.mjs",
  "phase4-ultimate-validate.mjs",
  "npm audit --audit-level=high --omit=dev",
  "production-deploy.mjs",
  "validate:governance",
  "typecheck",
  "Generate SBOM",
]) {
  reporter.assert(
    rolloutCi.includes(ciFragment),
    `Production rollout workflow must include ${ciFragment}`,
  );
}

const deployScript = readFile("infrastructure/scripts/deploy/production-deploy.mjs");
for (const deployFragment of [
  "phase4-ultimate-validate.mjs",
  "--execute",
  "WRANGLER_LOG_PATH",
]) {
  reporter.assert(
    deployScript.includes(deployFragment),
    `Production deploy script must include ${deployFragment}`,
  );
}

const ultimateScript = readFile("infrastructure/scripts/operations/phase4-ultimate-validate.mjs");
for (const ultimateFragment of [
  "verify-provider-contracts.mjs",
  "verify-supabase-operations.mjs",
  "verify-observability-rollout.mjs",
  "verify-security-gates.mjs",
  "LETBUYY_OPERATIONS_TOKEN",
]) {
  reporter.assert(
    ultimateScript.includes(ultimateFragment),
    `Phase 4 ultimate validation must include ${ultimateFragment}`,
  );
}

reporter.finish(`${requiredFiles.length} Phase 4 files, ${canonicalRuntimeRoots.length} manifests, and production topology checked`);
