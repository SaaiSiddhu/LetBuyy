import path from "node:path";
import {
  canonicalRuntimeRoots,
  activeSupabaseSchemaMigrationPath,
  createReporter,
  exists,
  extractSpecifiers,
  getTrackedFiles,
  hasSqlFunction,
  hasSqlRls,
  hasSqlTable,
  listWorkspaceFiles,
  readFile,
  readActiveSupabaseSchemaMigration,
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
  "packages/distributed-runtime/src/deployment-topology-runtime.ts",
  "packages/distributed-runtime/src/queue-operations-runtime.ts",
  "packages/distributed-runtime/src/replay-operations-runtime.ts",
  "packages/distributed-runtime/src/telemetry-operations-runtime.ts",
  "packages/distributed-runtime/src/observability-operations-runtime.ts",
  "packages/distributed-runtime/src/tenant-operations-runtime.ts",
  "packages/distributed-runtime/src/cache-operations-runtime.ts",
  "packages/distributed-runtime/src/coordination-operations-runtime.ts",
  "packages/distributed-runtime/src/regional-operations-runtime.ts",
  "packages/distributed-runtime/src/control-plane-runtime.ts",
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
  "packages/projection-runtime/src/projection-operations-runtime.ts",
  "packages/orchestration/src/workflow-continuation-runtime.ts",
  "packages/orchestration/src/workflow-operations-runtime.ts",
  "packages/infrastructure/provider-resilience-adapter/index.ts",
  "config/runtime/deployment-topology.schema.json",
  "config/runtime/deployment-topology.json",
  activeSupabaseSchemaMigrationPath,
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
  "operationalOwnership",
  "telemetryExecutionOwnership",
  "replayExecutionOwnership",
  "queueExecutionOwnership",
  "resilienceExecutionOwnership",
  "regionalExecutionOwnership",
  "auditExecutionOwnership",
  "cacheExecutionOwnership",
  "coordinationExecutionOwnership",
  "diagnosticsOwnership",
  "operationalControlPlaneOwnership",
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

const migration = readActiveSupabaseSchemaMigration();
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
    hasSqlTable(migration, tableName),
    `Phase 3 migration must create ${tableName}`,
  );
  reporter.assert(
    hasSqlRls(migration, tableName),
    `Phase 3 table must enable RLS: ${tableName}`,
  );
}

const finalMigration = migration;
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
    hasSqlTable(finalMigration, tableName),
    `Phase 3 finalization migration must create ${tableName}`,
  );
  reporter.assert(
    hasSqlRls(finalMigration, tableName),
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
    hasSqlFunction(finalMigration, functionName),
    `Phase 3 finalization migration must create durable helper function ${functionName}`,
  );
}

const operationalMigration = migration;
for (const tableName of [
  "runtime_deployment_topology_records",
  "runtime_diagnostics",
  "queue_operation_snapshots",
  "queue_recovery_operations",
  "replay_operation_schedules",
  "replay_dry_run_results",
  "workflow_operation_snapshots",
  "runtime_alert_evaluations",
  "tenant_operation_projections",
  "cache_operation_snapshots",
  "coordination_operation_diagnostics",
  "regional_execution_diagnostics",
  "projection_operation_snapshots",
  "provider_recovery_plans",
]) {
  reporter.assert(
    hasSqlTable(operationalMigration, tableName),
    `Phase 3 operations migration must create ${tableName}`,
  );
  reporter.assert(
    hasSqlRls(operationalMigration, tableName),
    `Phase 3 operations table must enable RLS: ${tableName}`,
  );
}

for (const functionName of [
  "inspect_distributed_queue",
  "recover_stuck_distributed_queue_leases",
  "redrive_distributed_dead_letters",
  "schedule_runtime_replay_operation",
  "authorize_runtime_replay_operation",
  "record_runtime_diagnostic",
  "record_projection_operation_snapshot",
  "record_tenant_operation_projection",
  "record_provider_recovery_plan",
  "claim_operational_control_command",
]) {
  reporter.assert(
    hasSqlFunction(operationalMigration, functionName),
    `Phase 3 operations migration must create operational helper function ${functionName}`,
  );
}

const deploymentTopology = readJson("config/runtime/deployment-topology.json");
const topologyRoots = new Set((deploymentTopology?.nodes || []).map((node) => node.runtimeRoot));
for (const runtimeRoot of canonicalRuntimeRoots) {
  reporter.assert(
    topologyRoots.has(runtimeRoot),
    `Deployment topology must include canonical runtime root: ${runtimeRoot}`,
  );
}

const topologyNames = new Set((deploymentTopology?.nodes || []).map((node) => node.runtimeName));
for (const node of deploymentTopology?.nodes || []) {
  reporter.assert(
    node.health?.checkName && node.scaling?.scaleMetric && Array.isArray(node.regions) && node.regions.length > 0,
    `Deployment topology node must declare health, scaling, and regions: ${node.runtimeRoot}`,
  );
}
for (const edge of deploymentTopology?.dependencies || []) {
  reporter.assert(
    topologyNames.has(edge.fromRuntime) && topologyNames.has(edge.toRuntime),
    `Deployment topology dependency references unknown runtime: ${edge.fromRuntime} -> ${edge.toRuntime}`,
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
      !/\b(?:interface|class)\s+\w*(?:DeploymentTopology|QueueOperations|ReplayOperations|TelemetryOperations|ObservabilityOperations|TenantOperations|CacheOperations|CoordinationOperations|RegionalOperations|OperationalControlPlane)\b/.test(content),
      `Operational runtime execution contracts must live in packages/distributed-runtime: ${file}`,
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
    reporter.assert(
      !/\b(?:interface|class)\s+\w*(?:WorkflowOperations|WorkflowOperational|WorkflowDiagnostic)\b/.test(content),
      `Workflow operational recovery contracts must live in packages/orchestration: ${file}`,
    );
  }

  if (root !== "packages/projection-runtime") {
    reporter.assert(
      !/\b(?:interface|class)\s+\w*(?:ProjectionOperations|ProjectionOperational|ProjectionDrift|ProjectionRepair)\b/.test(content),
      `CQRS projection operations contracts must live in packages/projection-runtime: ${file}`,
    );
  }

  if (root !== "packages/infrastructure") {
    reporter.assert(
      !/\b(?:interface|class)\s+\w*(?:ProviderResilienceOperations|ProviderRecoveryPlan)\b/.test(content),
      `Provider resilience operations contracts must live in packages/infrastructure: ${file}`,
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
