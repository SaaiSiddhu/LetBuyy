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
  "infrastructure/security/production-security-controls.yaml",
  "infrastructure/monitoring/slo-catalog.yaml",
  "infrastructure/scripts/chaos/queue-outage.mjs",
  "infrastructure/scripts/chaos/provider-outage.mjs",
  "infrastructure/scripts/load/k6-checkout-concurrency.js",
  "infrastructure/scripts/load/k6-queue-throughput.js",
  "services/queue-workers/package.json",
  "services/queue-workers/wrangler.toml",
  "services/queue-workers/src/index.ts",
  "database/supabase/migrations/062_production_rollout_operations.sql",
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
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing Phase 4 production readiness file: ${file}`);
}

const phase4ManifestFields = [
  "deploymentOwnership",
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
  productionTopology?.observabilityStack?.collector,
  productionTopology?.observabilityStack?.alerts,
  ...(productionTopology?.observabilityStack?.dashboards || []),
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
]) {
  reporter.assert(
    operationsRoute.includes(routeFragment),
    `Operations API must expose production control-plane route: ${routeFragment}`,
  );
}

const ci = readFile(".github/workflows/architecture-governance.yml");
reporter.assert(
  ci.includes("production-readiness-validator.mjs"),
  "CI must run the production readiness validator",
);

reporter.finish(`${requiredFiles.length} Phase 4 files, ${canonicalRuntimeRoots.length} manifests, and production topology checked`);
