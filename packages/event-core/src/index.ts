import { z } from 'zod';

export const DispatchOutboxSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  webhook_limit: z.number().int().min(1).max(100).optional(),
});

export const DispatchWebhookDeliveriesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export const ConsumeQueueJobsSchema = z.object({
  queue_name: z.enum(['analytics-events', 'search-indexing']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const OperationsListQuerySchema = z.object({
  status: z.string().max(40).optional(),
  site_id: z.string().uuid().optional(),
  queue_name: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const CreateWebhookSubscriptionSchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  target_url: z.string().url().refine((value) => value.startsWith('https://'), {
    message: 'target_url must use HTTPS',
  }),
  event_types: z.array(z.string().trim().min(1).max(120)).min(1).max(100).default(['*']),
  signing_secret: z.string().min(32).max(256),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateWebhookSubscriptionSchema = z.object({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  event_types: z.array(z.string().trim().min(1).max(120)).min(1).max(100).optional(),
  target_url: z.string().url().refine((value) => value.startsWith('https://'), {
    message: 'target_url must use HTTPS',
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const RecordUsageSchema = z.object({
  site_id: z.string().uuid(),
  meter_name: z.string().trim().min(1).max(120),
  amount: z.number().finite(),
  idempotency_key: z.string().trim().min(8).max(200),
  source: z.string().trim().min(1).max(80).optional(),
  resource_type: z.string().trim().min(1).max(80).optional(),
  resource_id: z.string().trim().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const JsonRecordSchema = z.record(z.string(), z.unknown());

export const RuntimeQueueRecoverySchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  reason: z.string().trim().min(8).max(500),
});

export const RuntimeDeadLetterRedriveSchema = z.object({
  message_ids: z.array(z.string().trim().min(1).max(200)).max(500).default([]),
  reason: z.string().trim().min(8).max(500),
});

export const ScheduleRuntimeReplaySchema = z.object({
  replay_id: z.string().trim().min(8).max(120),
  owner_runtime: z.string().trim().min(1).max(120),
  site_id: z.string().uuid().nullable().optional(),
  event_types: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  cursor: JsonRecordSchema.default({}),
  batch_size: z.number().int().min(1).max(1000).default(100),
  dry_run: z.boolean().default(true),
  reason: z.string().trim().min(8).max(500),
});

export const AuthorizeRuntimeReplaySchema = z.object({
  expires_at: z.string().datetime(),
});

export const SubmitRuntimeControlCommandSchema = z.object({
  command_id: z.string().trim().min(8).max(120),
  operation: z.enum([
    'pause-queue',
    'resume-queue',
    'replay-events',
    'redrive-dead-letter',
    'cancel-workflow',
    'retry-workflow',
    'drain-worker',
    'invalidate-cache',
    'throttle-tenant',
    'release-tenant-throttle',
    'failover-region',
    'restore-region',
    'pause-provider',
    'restore-provider',
    'promote-deployment',
    'rollback-deployment',
  ]),
  target_type: z.enum([
    'queue',
    'event-stream',
    'workflow',
    'dead-letter',
    'worker',
    'cache',
    'tenant-runtime',
    'region',
    'provider',
    'deployment',
  ]),
  target_id: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(8).max(500),
});

export const RecordProductionIncidentSchema = z.object({
  incident_id: z.string().trim().min(8).max(120),
  title: z.string().trim().min(4).max(200),
  severity: z.enum(['sev1', 'sev2', 'sev3', 'sev4']),
  affected_runtimes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  affected_regions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  customer_impact: z.string().trim().min(8).max(1000),
  metadata: JsonRecordSchema.default({}),
});

export const UpdateProductionIncidentStatusSchema = z.object({
  status: z.enum(['open', 'mitigating', 'resolved', 'closed']),
  summary: z.string().trim().min(4).max(500),
  details: JsonRecordSchema.default({}),
});

export const RecordFailoverDrillSchema = z.object({
  drill_id: z.string().trim().min(8).max(120),
  drill_type: z.enum(['regional', 'provider', 'queue', 'cache', 'telemetry', 'database']),
  source_region: z.string().trim().min(1).max(80).nullable().optional(),
  target_region: z.string().trim().min(1).max(80).nullable().optional(),
  affected_runtimes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  status: z.enum(['planned', 'running', 'passed', 'failed', 'cancelled']),
  rto_seconds: z.number().int().min(0).nullable().optional(),
  rpo_seconds: z.number().int().min(0).nullable().optional(),
  result: JsonRecordSchema.default({}),
});

export const RecordChaosExperimentSchema = z.object({
  experiment_id: z.string().trim().min(8).max(120),
  experiment_type: z.enum(['queue-outage', 'provider-outage', 'replay-corruption', 'cache-failure', 'regional-outage', 'workflow-recovery', 'dlq-flood', 'telemetry-outage']),
  environment: z.enum(['staging', 'production']),
  blast_radius: z.enum(['single-tenant', 'single-runtime', 'single-region', 'global-readonly']),
  status: z.enum(['planned', 'approved', 'running', 'passed', 'failed', 'aborted']),
  guardrails: JsonRecordSchema.default({}),
  result: JsonRecordSchema.default({}),
});

export const RecordLoadTestRunSchema = z.object({
  run_id: z.string().trim().min(8).max(120),
  test_type: z.enum(['queue', 'replay', 'projection-rebuild', 'tenant-isolation', 'cache-throughput', 'checkout-concurrency', 'workflow-concurrency', 'multi-region-latency']),
  environment: z.enum(['staging', 'production']),
  status: z.enum(['planned', 'running', 'passed', 'failed', 'cancelled']),
  tool: z.enum(['k6', 'gatling', 'locust']),
  target_rps: z.number().int().min(0).nullable().optional(),
  p95_latency_ms: z.number().int().min(0).nullable().optional(),
  error_rate: z.number().min(0).max(1).nullable().optional(),
  report_url: z.string().url().nullable().optional(),
  result: JsonRecordSchema.default({}),
});

export const RecordDeploymentPromotionSchema = z.object({
  promotion_id: z.string().trim().min(8).max(120),
  runtime_name: z.string().trim().min(1).max(120),
  runtime_root: z.string().trim().min(1).max(200),
  environment: z.enum(['dev', 'staging', 'production']),
  strategy: z.enum(['preview', 'canary', 'blue-green', 'rollback']),
  version: z.string().trim().min(1).max(120),
  status: z.enum(['planned', 'running', 'blocked', 'promoted', 'rolled-back', 'failed']),
  health_gates: z.array(JsonRecordSchema).default([]),
});

export const RecordProductionReadinessGateSchema = z.object({
  gate_run_id: z.string().trim().min(8).max(120),
  environment: z.enum(['staging', 'production']),
  version: z.string().trim().min(1).max(120),
  status: z.enum(['planned', 'running', 'passed', 'failed', 'blocked']),
  gates: z.array(JsonRecordSchema).default([]),
  failure_summary: z.string().trim().min(1).max(1000).nullable().optional(),
});

export const RecordDeploymentHealthGateSchema = z.object({
  gate_id: z.string().trim().min(8).max(120),
  promotion_id: z.string().trim().min(1).max(120).nullable().optional(),
  runtime_root: z.string().trim().min(1).max(200),
  environment: z.enum(['staging', 'production']),
  gate_name: z.string().trim().min(1).max(120),
  status: z.enum(['passed', 'failed', 'skipped', 'blocked']),
  observed_value: JsonRecordSchema.default({}),
  threshold: JsonRecordSchema.default({}),
  evidence_url: z.string().url().nullable().optional(),
});

export const ValidateEventStoreIntegritySchema = z.object({
  stream_name: z.string().trim().min(1).max(160),
  environment: z.enum(['staging', 'production']).default('production'),
  limit: z.number().int().min(1).max(100000).default(10000),
});

export const ArchiveDistributedEventsSchema = z.object({
  before: z.string().datetime(),
  limit: z.number().int().min(1).max(100000).default(10000),
});

export const RecordOperationalDashboardSnapshotSchema = z.object({
  snapshot_id: z.string().trim().min(8).max(120),
  dashboard_name: z.string().trim().min(1).max(120),
  environment: z.enum(['staging', 'production']),
  status: z.enum(['healthy', 'degraded', 'unavailable']),
  source_api: z.string().trim().min(1).max(240),
  source_projection: z.string().trim().min(1).max(160),
  panels: z.array(JsonRecordSchema).default([]),
});

export const RecordSreErrorBudgetSnapshotSchema = z.object({
  budget_id: z.string().trim().min(8).max(120),
  runtime_name: z.string().trim().min(1).max(120),
  slo_id: z.string().trim().min(1).max(120),
  environment: z.enum(['staging', 'production']),
  window: z.string().trim().min(1).max(80),
  target_percent: z.number().min(0).max(100),
  observed_percent: z.number().min(0).max(100),
  remaining_budget_percent: z.number().min(0).max(100),
  burn_rate: z.number().min(0).default(0),
  status: z.enum(['healthy', 'watch', 'freeze', 'exhausted']),
});

export const RecordSecurityEnforcementEventSchema = z.object({
  enforcement_id: z.string().trim().min(8).max(120),
  environment: z.enum(['staging', 'production']),
  control_name: z.string().trim().min(1).max(160),
  runtime_root: z.string().trim().min(1).max(200),
  status: z.enum(['passed', 'failed', 'waived', 'remediated']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  evidence: JsonRecordSchema.default({}),
});

export const RecordRegionalRoutingOverrideSchema = z.object({
  override_id: z.string().trim().min(8).max(120),
  environment: z.enum(['staging', 'production']),
  tenant_site_id: z.string().uuid().nullable().optional(),
  runtime_root: z.string().trim().min(1).max(200),
  source_region: z.string().trim().min(1).max(80),
  target_region: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(8).max(500),
  status: z.enum(['planned', 'active', 'restored', 'cancelled']),
  expires_at: z.string().datetime().nullable().optional(),
  metadata: JsonRecordSchema.default({}),
});

export interface DomainOutboxEvent {
  id: string;
  store_id?: string | null;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: 'queued' | 'processing' | 'processed' | 'failed' | 'dead';
  attempts: number;
  available_at: string;
  request_id?: string | null;
  actor_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditActivityEvent {
  id: string;
  store_id?: string | null;
  actor_id?: string | null;
  actor_type: 'user' | 'customer' | 'employee' | 'system' | 'webhook';
  action: string;
  resource_type: string;
  resource_id?: string | null;
  request_id?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RuntimeEventEnvelope<TPayload = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  source_runtime: string;
  site_id?: string;
  aggregate_type?: string;
  aggregate_id?: string;
  occurred_at: string;
  payload: TPayload;
  request_id?: string;
  idempotency_key?: string;
}

export type DispatchOutboxInput = z.infer<typeof DispatchOutboxSchema>;
export type DispatchWebhookDeliveriesInput = z.infer<typeof DispatchWebhookDeliveriesSchema>;
export type ConsumeQueueJobsInput = z.infer<typeof ConsumeQueueJobsSchema>;
export type OperationsListQuery = z.infer<typeof OperationsListQuerySchema>;
export type RecordUsageInput = z.infer<typeof RecordUsageSchema>;
export type CreateWebhookSubscriptionInput = z.infer<typeof CreateWebhookSubscriptionSchema>;
export type UpdateWebhookSubscriptionInput = z.infer<typeof UpdateWebhookSubscriptionSchema>;
export type RuntimeQueueRecoveryInput = z.infer<typeof RuntimeQueueRecoverySchema>;
export type RuntimeDeadLetterRedriveInput = z.infer<typeof RuntimeDeadLetterRedriveSchema>;
export type ScheduleRuntimeReplayInput = z.infer<typeof ScheduleRuntimeReplaySchema>;
export type AuthorizeRuntimeReplayInput = z.infer<typeof AuthorizeRuntimeReplaySchema>;
export type SubmitRuntimeControlCommandInput = z.infer<typeof SubmitRuntimeControlCommandSchema>;
export type RecordProductionIncidentInput = z.infer<typeof RecordProductionIncidentSchema>;
export type UpdateProductionIncidentStatusInput = z.infer<typeof UpdateProductionIncidentStatusSchema>;
export type RecordFailoverDrillInput = z.infer<typeof RecordFailoverDrillSchema>;
export type RecordChaosExperimentInput = z.infer<typeof RecordChaosExperimentSchema>;
export type RecordLoadTestRunInput = z.infer<typeof RecordLoadTestRunSchema>;
export type RecordDeploymentPromotionInput = z.infer<typeof RecordDeploymentPromotionSchema>;
export type RecordProductionReadinessGateInput = z.infer<typeof RecordProductionReadinessGateSchema>;
export type RecordDeploymentHealthGateInput = z.infer<typeof RecordDeploymentHealthGateSchema>;
export type ValidateEventStoreIntegrityInput = z.infer<typeof ValidateEventStoreIntegritySchema>;
export type ArchiveDistributedEventsInput = z.infer<typeof ArchiveDistributedEventsSchema>;
export type RecordOperationalDashboardSnapshotInput = z.infer<typeof RecordOperationalDashboardSnapshotSchema>;
export type RecordSreErrorBudgetSnapshotInput = z.infer<typeof RecordSreErrorBudgetSnapshotSchema>;
export type RecordSecurityEnforcementEventInput = z.infer<typeof RecordSecurityEnforcementEventSchema>;
export type RecordRegionalRoutingOverrideInput = z.infer<typeof RecordRegionalRoutingOverrideSchema>;
