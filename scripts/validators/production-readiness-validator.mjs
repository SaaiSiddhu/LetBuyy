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
  "config/runtime/live-production-certification.schema.json",
  "config/runtime/live-production-certification.json",
  "infrastructure/cloudflare/queues.tf",
  "infrastructure/cloudflare/storage.tf",
  "infrastructure/cloudflare/workers-topology.md",
  ".github/workflows/dev-runtime-deployment.yml",
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
  "infrastructure/scripts/cloudflare/materialize-wrangler-config.mjs",
  "infrastructure/scripts/database/verify-supabase-operations.mjs",
  "infrastructure/scripts/deploy/production-deploy.mjs",
  "infrastructure/scripts/deploy/production-rollback.mjs",
  "infrastructure/scripts/deploy/verify-health-gates.mjs",
  "infrastructure/scripts/observability/verify-observability-rollout.mjs",
  "infrastructure/scripts/operations/phase4-ultimate-validate.mjs",
  "infrastructure/scripts/operations/phase4-live-certify.mjs",
  "infrastructure/scripts/operations/verify-live-operations.mjs",
  "infrastructure/scripts/operations/run-live-drills.mjs",
  "infrastructure/scripts/operations/generate-certification-report.mjs",
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
  "database/supabase/migrations/064_live_production_certification.sql",
  "database/supabase/verification/063_absolute_production_operationalization.sql",
  "database/supabase/verification/064_live_production_certification.sql",
  "apps/platform-console/src/app/(dashboard)/operations/page.tsx",
  "docs/runbooks/incident-sev1.md",
  "docs/runbooks/queue-dlq-redrive.md",
  "docs/runbooks/event-replay.md",
  "docs/runbooks/regional-failover.md",
  "docs/runbooks/deployment-rollback.md",
  "docs/runbooks/secret-rotation.md",
  "docs/runbooks/chaos-drill.md",
  "docs/runbooks/live-certification-execute.md",
  "docs/operations/production-certification.md",
  "docs/operations/dev-environment-operationalization-report.md",
  "docs/operations/phase4-live-execution-evidence.md",
  "docs/governance/live-rollout-governance.md",
  "docs/governance/production-certification-governance.md",
  "docs/governance/operational-evidence-governance.md",
  "docs/governance/deployment-execution-governance.md",
  "docs/governance/failover-certification-governance.md",
  "docs/governance/chaos-certification-governance.md",
  "docs/governance/observability-certification-governance.md",
  "docs/governance/security-certification-governance.md",
  "docs/governance/sre-certification-governance.md",
  "docs/governance/global-operations-governance.md",
  "docs/governance/operational-certification-governance.md",
  "docs/governance/deployment-readiness-governance.md",
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
const liveCertification = readJson("config/runtime/live-production-certification.json");
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
  productionTopology?.liveCertification?.workflow,
  productionTopology?.liveCertification?.certificationConfig,
  productionTopology?.liveCertification?.certificationScript,
  productionTopology?.liveCertification?.operationsVerificationScript,
  productionTopology?.liveCertification?.drillScript,
  productionTopology?.liveCertification?.reportScript,
  productionTopology?.liveCertification?.certificationDoc,
  productionTopology?.chaosEngineering?.runner,
  productionTopology?.loadTesting?.runner,
  ...(productionTopology?.observabilityStack?.dashboards || []),
  ...(productionTopology?.operationalDashboards || []),
  ...(productionTopology?.runbooks || []),
  ...(productionTopology?.liveCertification?.evidenceGovernanceDocs || []),
  ...(productionTopology?.loadTesting?.scripts || []),
  ...(productionTopology?.eventStoreProvider?.migrations || []),
].filter(Boolean)) {
  reporter.assert(exists(file), `Production topology references missing source file: ${file}`);
}

for (const liveFile of [
  liveCertification?.workflow,
  liveCertification?.modeDetection?.script,
  liveCertification?.scripts?.certification,
  liveCertification?.scripts?.deployment,
  liveCertification?.scripts?.operationsVerification,
  liveCertification?.scripts?.drills,
  liveCertification?.scripts?.report,
  liveCertification?.scripts?.security,
  liveCertification?.scripts?.observability,
  liveCertification?.scripts?.database,
  liveCertification?.scripts?.cloudflare,
  liveCertification?.scripts?.load,
].filter(Boolean)) {
  reporter.assert(exists(liveFile), `Live certification references missing source file: ${liveFile}`);
}

for (const certificationRuntimeFile of [
  liveCertification?.certificationRuntime?.reportScript,
].filter(Boolean)) {
  reporter.assert(exists(certificationRuntimeFile), `Live certification runtime references missing source file: ${certificationRuntimeFile}`);
}

reporter.assert(
  liveCertification?.certificationRuntime?.reportApi === "/v1/operations/runtime/certification-reports",
  "Live certification runtime must declare the certification report API",
);

reporter.assert(
  liveCertification?.certificationRuntime?.reportProjection === "operational_certification_reports",
  "Live certification runtime must declare operational_certification_reports projection",
);

reporter.assert(
  Number(liveCertification?.certificationRuntime?.evidenceExpirationHours) > 0,
  "Live certification runtime must declare positive evidence expiration hours",
);

reporter.assert(
  liveCertification?.certificationMode === "credential-gated-plan-ready" || liveCertification?.certificationMode === "live-certified",
  "Live certification mode must be credential-gated-plan-ready or live-certified",
);

const requiredLiveEvidenceCategories = [
  "deployment",
  "cloudflare",
  "supabase",
  "observability",
  "incident",
  "failover",
  "chaos",
  "load",
  "security",
  "dashboards",
  "control-plane",
  "sre",
  "event-store",
  "multi-region",
];

for (const category of requiredLiveEvidenceCategories) {
  const evidence = liveCertification?.evidenceCategories?.[category];
  reporter.assert(evidence?.required === true, `Live certification evidence category must be required: ${category}`);
  reporter.assert(
    typeof evidence?.planMode === "string" && evidence.planMode.length > 0,
    `Live certification evidence category must define planMode: ${category}`,
  );
  reporter.assert(
    typeof evidence?.executeMode === "string" && evidence.executeMode.length > 0,
    `Live certification evidence category must define executeMode: ${category}`,
  );
  reporter.assert(
    typeof evidence?.source === "string" && evidence.source.length > 0,
    `Live certification evidence category must define source: ${category}`,
  );

  if (liveCertification?.certificationMode === "live-certified") {
    reporter.assert(
      typeof evidence?.lastVerifiedAt === "string" && typeof evidence?.evidenceId === "string",
      `Live-certified mode requires concrete evidence timestamp and id: ${category}`,
    );
  }
}

const apiWrangler = readFile("services/api-gateway/wrangler.toml");
const queueWrangler = readFile("services/queue-workers/wrangler.toml");
const webhookWrangler = readFile("services/webhook-service/wrangler.toml");
const queueTerraform = readFile("infrastructure/cloudflare/queues.tf");
const storageTerraform = readFile("infrastructure/cloudflare/storage.tf");

function tableBlock(toml, table) {
  const marker = `[${table}]`;
  const start = toml.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length;
  const next = toml.indexOf("\n[", bodyStart);
  return toml.slice(bodyStart, next >= 0 ? next : toml.length);
}

function arrayTableBlocks(toml, table) {
  const marker = `[[${table}]]`;
  const blocks = [];
  let index = toml.indexOf(marker);
  while (index >= 0) {
    const start = index + marker.length;
    const nextArray = toml.indexOf("[[", start);
    const nextTable = toml.indexOf("\n[", start);
    const candidates = [nextArray, nextTable].filter((candidate) => candidate >= 0);
    const end = candidates.length > 0 ? Math.min(...candidates) : toml.length;
    blocks.push(toml.slice(start, end));
    index = toml.indexOf(marker, end);
  }
  return blocks;
}

function stringValue(block, key) {
  return block.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "m"))?.[1] || "";
}

function environmentQueueName(queueName, environment) {
  return environment === "production" ? queueName : `${queueName}-${environment}`;
}

function terraformStringAssignmentExists(key, value) {
  return new RegExp(`\\b${key}\\s*=\\s*"${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(storageTerraform);
}

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

for (const wranglerEnv of ["env.dev", "env.staging", "env.production"]) {
  reporter.assert(
    apiWrangler.includes(`[${wranglerEnv}]`) && queueWrangler.includes(`[${wranglerEnv}]`) && webhookWrangler.includes(`[${wranglerEnv}]`),
    `Wrangler config must define ${wranglerEnv} for API, webhook, and queue workers`,
  );
}

const baseRuntimeQueues = [
  "letbuyy-events",
  "letbuyy-analytics",
  "letbuyy-search-indexing",
  "letbuyy-notifications",
  "letbuyy-dead-letters",
];
const environmentRoutes = {
  dev: {
    api: "api-dev.letbuyy.store",
    webhooks: "webhooks-dev.letbuyy.store",
    cache: "letbuyy-runtime-cache-dev",
    r2: "letbuyy-dev-storage",
  },
  staging: {
    api: "api.staging.letbuyy.store",
    webhooks: "webhooks.staging.letbuyy.store",
    cache: "letbuyy-runtime-cache-staging",
    r2: "letbuyy-staging-storage",
  },
  production: {
    api: "api.letbuyy.store",
    webhooks: "webhooks.letbuyy.store",
    cache: "letbuyy-runtime-cache",
    r2: "letbuyy-production-storage",
  },
};

const seenQueueNames = new Map();
const seenRoutes = new Map();
const seenStorageNames = new Map();

for (const [environmentName, isolation] of Object.entries(environmentRoutes)) {
  const apiEnvBlock = tableBlock(apiWrangler, `env.${environmentName}`);
  const webhookEnvBlock = tableBlock(webhookWrangler, `env.${environmentName}`);
  reporter.assert(
    stringValue(apiEnvBlock, "name") === (environmentName === "production" ? "letbuyy-api" : `letbuyy-api-${environmentName}`),
    `API Gateway Worker name must be isolated for ${environmentName}`,
  );
  reporter.assert(
    stringValue(webhookEnvBlock, "name") === (environmentName === "production" ? "letbuyy-webhooks" : `letbuyy-webhooks-${environmentName}`),
    `Webhook Worker name must be isolated for ${environmentName}`,
  );
  reporter.assert(apiWrangler.includes(isolation.api), `API Gateway route missing for ${environmentName}: ${isolation.api}`);
  reporter.assert(webhookWrangler.includes(isolation.webhooks), `Webhook route missing for ${environmentName}: ${isolation.webhooks}`);
  for (const route of [isolation.api, isolation.webhooks]) {
    reporter.assert(!seenRoutes.has(route), `Cloudflare route is shared by ${seenRoutes.get(route)} and ${environmentName}: ${route}`);
    seenRoutes.set(route, environmentName);
  }

  reporter.assert(terraformStringAssignmentExists("title", isolation.cache), `Cloudflare KV namespace missing for ${environmentName}: ${isolation.cache}`);
  reporter.assert(terraformStringAssignmentExists("name", isolation.r2), `Cloudflare R2 bucket missing for ${environmentName}: ${isolation.r2}`);
  for (const storageName of [isolation.cache, isolation.r2]) {
    reporter.assert(!seenStorageNames.has(storageName), `Cloudflare storage name is shared by ${seenStorageNames.get(storageName)} and ${environmentName}: ${storageName}`);
    seenStorageNames.set(storageName, environmentName);
  }

  const producerQueues = arrayTableBlocks(apiWrangler, `env.${environmentName}.queues.producers`).map((block) => stringValue(block, "queue"));
  const consumerQueues = arrayTableBlocks(queueWrangler, `env.${environmentName}.queues.consumers`).map((block) => stringValue(block, "queue"));
  for (const baseQueue of baseRuntimeQueues) {
    const queueName = environmentQueueName(baseQueue, environmentName);
    reporter.assert(queueTerraform.includes(queueName), `Cloudflare Terraform missing ${environmentName} queue ${queueName}`);
    reporter.assert(consumerQueues.includes(queueName), `Queue worker missing ${environmentName} consumer ${queueName}`);
    if (!baseQueue.includes("dead-letters")) {
      reporter.assert(producerQueues.includes(queueName), `API Gateway missing ${environmentName} producer ${queueName}`);
    }
    reporter.assert(!seenQueueNames.has(queueName), `Cloudflare queue is shared by ${seenQueueNames.get(queueName)} and ${environmentName}: ${queueName}`);
    seenQueueNames.set(queueName, environmentName);
  }
}

const devVars = tableBlock(apiWrangler, "env.dev.vars");
for (const devVar of [
  'APP_ENV = "development"',
  'NODE_ENV = "development"',
  'DEPLOYMENT_ENV = "dev"',
  'TELEMETRY_ENV = "development"',
]) {
  reporter.assert(devVars.includes(devVar), `API Gateway dev vars must include ${devVar}`);
}
reporter.assert(
  apiWrangler.includes('binding = "CACHE"') && apiWrangler.includes("__LETBUYY_RUNTIME_CACHE_DEV_NAMESPACE_ID__"),
  "API Gateway dev Worker must declare an isolated CACHE KV binding resolved from Terraform output during deploy",
);

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
const certificationMigration = readFile("database/supabase/migrations/064_live_production_certification.sql");
const certificationVerification = readFile("database/supabase/verification/064_live_production_certification.sql");
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

for (const certificationFragment of [
  "CREATE TABLE IF NOT EXISTS operational_certification_reports",
  "ALTER TABLE operational_certification_reports ENABLE ROW LEVEL SECURITY",
  "CREATE OR REPLACE FUNCTION record_operational_certification_report",
]) {
  reporter.assert(
    certificationMigration.includes(certificationFragment),
    `Phase 4 live certification migration must include ${certificationFragment}`,
  );
}

for (const certificationVerificationFragment of [
  "operational_certification_reports",
  "record_operational_certification_report",
  "pg_policies",
]) {
  reporter.assert(
    certificationVerification.includes(certificationVerificationFragment),
    `Phase 4 live certification verification SQL must include ${certificationVerificationFragment}`,
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
  "/runtime/certification-reports",
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

const gitignore = readFile(".gitignore");
for (const ignoredArtifact of [
  "phase4-live-certification-report.json",
  "artifacts/live-certification/",
]) {
  reporter.assert(
    gitignore.includes(ignoredArtifact),
    `Gitignore must exclude generated certification artifact: ${ignoredArtifact}`,
  );
}

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

const liveCi = readFile(".github/workflows/live-production-certification.yml");
for (const ciFragment of [
  "phase4-live-certify.mjs",
  "phase4-live-certification-report.json",
  "Setup k6",
  "ROTATE_SECRET_SUPABASE_SERVICE_ROLE_KEY",
  "LETBUYY_OPERATIONS_TOKEN",
  "attest-build-provenance",
  "Generate SBOM",
]) {
  reporter.assert(
    liveCi.includes(ciFragment),
    `Live production certification workflow must include ${ciFragment}`,
  );
}

const devCi = readFile(".github/workflows/dev-runtime-deployment.yml");
for (const ciFragment of [
  "--environment=dev",
  "production-deploy.mjs",
  "phase4-ultimate-validate.mjs",
  "validate:governance",
  "validate:lifecycle",
  "typecheck",
  "LETBUYY_RUNTIME_CACHE_DEV_NAMESPACE_ID",
]) {
  reporter.assert(
    devCi.includes(ciFragment),
    `Dev runtime deployment workflow must include ${ciFragment}`,
  );
}

const deployScript = readFile("infrastructure/scripts/deploy/production-deploy.mjs");
for (const deployFragment of [
  "phase4-ultimate-validate.mjs",
  "--execute",
  "--skip-validation",
  "WRANGLER_LOG_PATH",
  "materialize-wrangler-config.mjs",
  '"dev"',
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
  "verify-live-operations.mjs",
  "run-live-drills.mjs",
  "LETBUYY_OPERATIONS_TOKEN",
]) {
  reporter.assert(
    ultimateScript.includes(ultimateFragment),
    `Phase 4 ultimate validation must include ${ultimateFragment}`,
  );
}

const liveScript = readFile("infrastructure/scripts/operations/phase4-live-certify.mjs");
for (const liveFragment of [
  "requestedMode",
  "credential",
  "cloudflare",
  "supabase",
  "observability",
  "secret-rotation",
  "production-deploy.mjs",
  "verify-live-operations.mjs",
  "run-live-drills.mjs",
  "generate-certification-report.mjs",
]) {
  reporter.assert(
    liveScript.includes(liveFragment),
    `Live certification script must include ${liveFragment}`,
  );
}

const reportScript = readFile("infrastructure/scripts/operations/generate-certification-report.mjs");
for (const reportFragment of [
  "operational_certification_reports",
  "evidence_expiration_hours",
  "live_certified",
  "/runtime/certification-reports",
  "--record",
]) {
  reporter.assert(
    reportScript.includes(reportFragment),
    `Operational certification report generator must include ${reportFragment}`,
  );
}

reporter.finish(`${requiredFiles.length} Phase 4 files, ${canonicalRuntimeRoots.length} manifests, and production topology checked`);
