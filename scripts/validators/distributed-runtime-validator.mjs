import path from "node:path";
import {
  canonicalRuntimeRoots,
  createReporter,
  exists,
  extractSpecifiers,
  getTrackedFiles,
  listWorkspaceFiles,
  readFile,
  readJson,
  rootForFile,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Distributed runtime validator");
const workspaceFiles = [...new Set([...getTrackedFiles(), ...listWorkspaceFiles()])].sort();

const requiredFiles = [
  "packages/distributed-runtime/package.json",
  "packages/distributed-runtime/AGENTS.md",
  "packages/distributed-runtime/src/event-store-runtime.ts",
  "packages/distributed-runtime/src/event-persistence-runtime.ts",
  "packages/distributed-runtime/src/replay-storage-runtime.ts",
  "packages/distributed-runtime/src/checkpoint-storage-runtime.ts",
  "packages/distributed-runtime/src/event-envelope-runtime.ts",
  "packages/distributed-runtime/src/event-versioning-runtime.ts",
  "packages/distributed-runtime/src/event-retention-runtime.ts",
  "packages/distributed-runtime/src/queue-runtime.ts",
  "packages/distributed-runtime/src/queue-partitioning.ts",
  "packages/distributed-runtime/src/consumer-coordination-runtime.ts",
  "packages/distributed-runtime/src/distributed-coordination-runtime.ts",
  "packages/distributed-runtime/src/cqrs-runtime.ts",
  "packages/distributed-runtime/src/tenant-scalability-runtime.ts",
  "packages/distributed-runtime/src/resilience-runtime.ts",
  "packages/distributed-runtime/src/telemetry-runtime.ts",
  "packages/distributed-runtime/src/operations-runtime.ts",
  "packages/distributed-runtime/src/cache-runtime.ts",
  "packages/distributed-runtime/src/global-execution-runtime.ts",
  "packages/distributed-runtime/src/security-runtime.ts",
  "packages/projection-runtime/package.json",
  "packages/projection-runtime/AGENTS.md",
  "packages/projection-runtime/src/projection-store.ts",
  "packages/projection-runtime/src/aggregation-store.ts",
  "packages/projection-runtime/src/projection-cache-runtime.ts",
  "packages/projection-runtime/src/projection-rebuild-runtime.ts",
  "packages/projection-runtime/src/projection-replay-runtime.ts",
  "packages/projection-runtime/src/query-snapshot-runtime.ts",
  "packages/projection-runtime/src/read-model-hydration-runtime.ts",
  "packages/projection-runtime/src/projection-invalidation-runtime.ts",
  "packages/projection-runtime/src/projection-lifecycle-runtime.ts",
  "packages/projection-runtime/src/projection-checkpoint-runtime.ts",
  "packages/projection-runtime/src/projection-consistency-runtime.ts",
  "packages/orchestration/src/workflow-continuation-runtime.ts",
  "packages/infrastructure/provider-resilience-adapter/index.ts",
  "database/supabase/migrations/059_distributed_runtime_operations_foundation.sql",
  "database/supabase/migrations/060_operational_runtime_finalization.sql",
];

for (const file of requiredFiles) {
  reporter.assert(exists(file), `Missing Phase 3 distributed runtime foundation file: ${file}`);
}

const distributedPackage = readJson("packages/distributed-runtime/package.json");
reporter.assert(distributedPackage?.name === "@letbuyy/distributed-runtime", "Distributed runtime package must be named @letbuyy/distributed-runtime");
reporter.assert(Boolean(distributedPackage?.scripts?.typecheck), "Distributed runtime package must expose a typecheck script");

const projectionPackage = readJson("packages/projection-runtime/package.json");
reporter.assert(projectionPackage?.name === "@letbuyy/projection-runtime", "Projection runtime package must be named @letbuyy/projection-runtime");
reporter.assert(Boolean(projectionPackage?.scripts?.typecheck), "Projection runtime package must expose a typecheck script");

const phase3ManifestFields = [
  "distributedExecutionOwnership",
  "queueOwnership",
  "checkpointOwnership",
  "cacheOwnership",
  "telemetryOwnership",
  "resilienceOwnership",
  "regionalOwnership",
  "tenantScalingOwnership",
  "auditOwnership",
  "recoveryOwnership",
  "coordinationOwnership",
  "cqrsOwnership",
];

for (const runtimeRoot of canonicalRuntimeRoots) {
  const manifestPath = `${runtimeRoot}/runtime.manifest.json`;
  const manifest = readJson(manifestPath);
  for (const field of phase3ManifestFields) {
    reporter.assert(
      typeof manifest?.[field] === "string" && manifest[field].trim().length > 0,
      `Runtime manifest missing Phase 3 field ${field}: ${manifestPath}`,
    );
  }
}

const migration = readFile("database/supabase/migrations/059_distributed_runtime_operations_foundation.sql");
for (const tableName of [
  "distributed_event_store",
  "distributed_queue_messages",
  "runtime_checkpoints",
  "runtime_leases",
  "projection_store",
  "tenant_execution_quotas",
  "provider_health_snapshots",
  "cache_invalidation_events",
  "execution_audit_trail",
]) {
  reporter.assert(
    migration.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`),
    `Phase 3 migration must create ${tableName}`,
  );
  reporter.assert(
    new RegExp(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`).test(migration),
    `Phase 3 table must enable RLS: ${tableName}`,
  );
}

const finalMigration = readFile("database/supabase/migrations/060_operational_runtime_finalization.sql");
for (const tableName of [
  "runtime_command_journal",
  "event_stream_snapshots",
  "projection_checkpoints",
  "query_snapshots",
  "workflow_lifecycle",
  "workflow_heartbeats",
  "distributed_queue_heartbeats",
  "runtime_telemetry_spans",
  "runtime_telemetry_metrics",
  "runtime_structured_logs",
  "runtime_health_projections",
  "provider_outage_events",
  "runtime_control_commands",
]) {
  reporter.assert(
    finalMigration.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`),
    `Phase 3 finalization migration must create ${tableName}`,
  );
  reporter.assert(
    new RegExp(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`).test(finalMigration),
    `Phase 3 finalization table must enable RLS: ${tableName}`,
  );
}

for (const functionName of [
  "claim_distributed_queue_messages",
  "heartbeat_distributed_queue_message",
  "complete_distributed_queue_message",
  "retry_distributed_queue_message",
  "dead_letter_distributed_queue_message",
  "claim_runtime_lease",
]) {
  reporter.assert(
    new RegExp(`CREATE OR REPLACE FUNCTION ${functionName}\\b`).test(finalMigration),
    `Phase 3 finalization migration must create durable helper function ${functionName}`,
  );
}

const sourceFiles = workspaceFiles.filter((file) => sourceExtensions.has(path.extname(file)));

for (const file of sourceFiles) {
  const root = rootForFile(file);
  const content = readFile(file);

  for (const specifier of extractSpecifiers(content)) {
    if (root.startsWith("apps/") && (specifier === "@letbuyy/distributed-runtime" || specifier === "@letbuyy/projection-runtime")) {
      reporter.errors.push(`Apps must not import distributed execution packages directly: ${file} -> ${specifier}`);
    }

    if (root === "packages/application-services" && (specifier === "@letbuyy/distributed-runtime" || specifier === "@letbuyy/projection-runtime")) {
      reporter.errors.push(`Application services must not own distributed runtime or projection persistence: ${file} -> ${specifier}`);
    }
  }

  if (root !== "packages/distributed-runtime") {
    reporter.assert(
      !/\b(?:interface|class)\s+\w*(?:EventStore|EventPersistence|DistributedEventEnvelope|QueueRuntimeStore|DistributedQueueMessage)\b/.test(content),
      `Event persistence and distributed queue contracts must live in packages/distributed-runtime: ${file}`,
    );
  }

  if (root !== "packages/projection-runtime" && root !== "packages/runtime-composition") {
    reporter.assert(
      !/\b(?:interface|class)\s+\w*(?:ProjectionStore|ProjectionRebuild|ProjectionReplay|QuerySnapshot|ReadModelHydration)\b/.test(content),
      `Projection persistence/rebuild/replay contracts must live in packages/projection-runtime: ${file}`,
    );
  }

  if (root !== "packages/distributed-runtime" && root !== "packages/infrastructure") {
    reporter.assert(
      !/\b(?:interface|class)\s+\w*(?:CircuitBreaker|ProviderHealth|ResilienceRuntime|TelemetryPipeline|RuntimeAudit)\b/.test(content),
      `Resilience, telemetry, and audit runtime contracts must live in distributed-runtime or infrastructure adapters: ${file}`,
    );
  }

  if (root !== "packages/distributed-runtime") {
    reporter.assert(
      !/\b(?:interface|class)\s+\w*(?:DistributedCoordination|ExecutionLease|ExecutionHeartbeat|TenantScalability|CacheOrchestration)\b/.test(content),
      `Coordination, tenant scalability, and cache orchestration contracts must live in packages/distributed-runtime: ${file}`,
    );
  }

  if (root !== "packages/orchestration") {
    reporter.assert(
      !/\b(?:interface|class)\s+\w*(?:WorkflowContinuation|WorkflowHeartbeat|WorkflowLifecycle)\b/.test(content),
      `Workflow recovery and continuation contracts must live in packages/orchestration: ${file}`,
    );
  }

  if (root.startsWith("services/")) {
    reporter.assert(
      !/\bdefineExecutionPipelines\s*\(/.test(content),
      `Services must not define workflow pipelines while wiring distributed runtime execution: ${file}`,
    );
  }
}

reporter.finish(`${requiredFiles.length} Phase 3 files and ${canonicalRuntimeRoots.length} manifests checked`);
