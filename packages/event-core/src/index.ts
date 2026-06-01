import { z } from 'zod';

export const DispatchOutboxSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  webhook_limit: z.number().int().min(1).max(100).optional(),
});

export const DispatchWebhookDeliveriesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export const ConsumeQueueJobsSchema = z.object({
  queue_name: z.enum(['analytics-events', 'search-indexing', 'payment-events']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const OperationsListQuerySchema = z.object({
  status: z.string().max(40).optional(),
  site_id: z.string().uuid().optional(),
  queue_name: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const MarketplaceReviewListQuerySchema = z.object({
  status: z.enum(['pending', 'in_review', 'approved', 'rejected', 'changes_requested']).optional(),
  submission_type: z.enum(['app', 'theme']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const MarketplaceReviewDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'changes_requested']),
  reason: z.string().trim().max(2000).optional(),
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

const UuidSchema = z.string().uuid();
const InrMinorUnitsSchema = z.object({
  amount_minor: z.number().int().nonnegative(),
  currency: z.literal('INR').default('INR'),
});

export const DOMAIN_EVENT_TYPES = [
  'store.created',
  'product.created',
  'product.updated',
  'product.deleted',
  'order.created',
  'order.paid',
  'order.fulfilled',
  'order.cancelled',
  'order.refunded',
  'app.installed',
  'app.uninstalled',
  'app.submitted',
  'app.approved',
  'app.rejected',
  'app.charge.created',
  'app.charge.activated',
  'theme.submitted',
  'theme.approved',
  'theme.rejected',
  'theme.installed',
  'payout.ledger_entry.created',
  'payout.released',
  'payout.failed',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export type DomainEventProducer =
  | 'api-gateway'
  | 'identity-platform'
  | 'platform-console'
  | 'platform-operations-portal'
  | 'app-marketplace'
  | 'theme-marketplace'
  | 'storefront-runtime'
  | 'queue-workers'
  | 'webhook-service';

export type DomainEventConsumer =
  | 'analytics'
  | 'search-indexing'
  | 'notifications'
  | 'payout-ledger'
  | 'webhook-service';

export interface DomainEventContract {
  eventType: DomainEventType;
  schemaVersion: 1;
  producer: DomainEventProducer;
  consumers: readonly DomainEventConsumer[];
  aggregateType: 'store' | 'product' | 'order' | 'app' | 'app_charge' | 'theme' | 'payout';
  payloadSchema: z.ZodType<unknown>;
}

const StoreCreatedPayloadSchema = z.object({
  site_id: UuidSchema,
  store_slug: z.string().trim().min(1).max(120),
  owner_user_id: UuidSchema,
  plan_code: z.string().trim().min(1).max(80).optional(),
});

const ProductPayloadSchema = z.object({
  site_id: UuidSchema,
  product_id: UuidSchema,
  handle: z.string().trim().min(1).max(160).optional(),
  status: z.enum(['draft', 'active', 'archived', 'deleted']).optional(),
});

const OrderPayloadSchema = z.object({
  site_id: UuidSchema,
  order_id: UuidSchema,
  order_number: z.string().trim().min(1).max(120).optional(),
  customer_id: UuidSchema.optional(),
  total: InrMinorUnitsSchema.optional(),
});

const AppInstallationPayloadSchema = z.object({
  site_id: UuidSchema,
  app_id: UuidSchema,
  installation_id: UuidSchema,
  partner_id: UuidSchema.optional(),
  scopes: z.array(z.string().trim().min(1).max(80)).default([]),
});

const AppReviewPayloadSchema = z.object({
  app_id: UuidSchema,
  partner_id: UuidSchema,
  review_id: UuidSchema.optional(),
  reviewer_id: UuidSchema.optional(),
});

const AppChargePayloadSchema = z.object({
  site_id: UuidSchema,
  app_id: UuidSchema,
  installation_id: UuidSchema,
  charge_id: UuidSchema,
  billing_mode: z.enum(['recurring', 'usage']),
  amount: InrMinorUnitsSchema,
  payout_rail: z.enum(['razorpay_route', 'razorpayx', 'upi', 'manual']).default('razorpay_route'),
  revenue_share_bps: z.number().int().min(0).max(10000).default(8000),
  partner_gst_bps: z.number().int().min(0).max(10000).default(1800),
  partner_gst_minor: z.number().int().nonnegative().default(0),
});

const ThemeReviewPayloadSchema = z.object({
  theme_package_id: UuidSchema,
  theme_version_id: UuidSchema,
  partner_id: UuidSchema,
  review_id: UuidSchema.optional(),
  reviewer_id: UuidSchema.optional(),
});

const ThemeInstalledPayloadSchema = z.object({
  site_id: UuidSchema,
  theme_package_id: UuidSchema,
  theme_version_id: UuidSchema,
  installation_id: UuidSchema,
});

const PayoutPayloadSchema = z.object({
  partner_id: UuidSchema,
  payout_id: UuidSchema,
  ledger_entry_id: UuidSchema.optional(),
  amount: InrMinorUnitsSchema,
  rail: z.enum(['razorpay_route', 'razorpayx', 'upi', 'manual']).default('manual'),
});

export const DOMAIN_EVENT_CONTRACTS = {
  'store.created': {
    eventType: 'store.created',
    schemaVersion: 1,
    producer: 'identity-platform',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'store',
    payloadSchema: StoreCreatedPayloadSchema,
  },
  'product.created': {
    eventType: 'product.created',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'search-indexing', 'webhook-service'],
    aggregateType: 'product',
    payloadSchema: ProductPayloadSchema,
  },
  'product.updated': {
    eventType: 'product.updated',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'search-indexing', 'webhook-service'],
    aggregateType: 'product',
    payloadSchema: ProductPayloadSchema,
  },
  'product.deleted': {
    eventType: 'product.deleted',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'search-indexing', 'webhook-service'],
    aggregateType: 'product',
    payloadSchema: ProductPayloadSchema,
  },
  'order.created': {
    eventType: 'order.created',
    schemaVersion: 1,
    producer: 'storefront-runtime',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.paid': {
    eventType: 'order.paid',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.fulfilled': {
    eventType: 'order.fulfilled',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.cancelled': {
    eventType: 'order.cancelled',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.refunded': {
    eventType: 'order.refunded',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'app.installed': {
    eventType: 'app.installed',
    schemaVersion: 1,
    producer: 'app-marketplace',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppInstallationPayloadSchema,
  },
  'app.uninstalled': {
    eventType: 'app.uninstalled',
    schemaVersion: 1,
    producer: 'app-marketplace',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppInstallationPayloadSchema,
  },
  'app.submitted': {
    eventType: 'app.submitted',
    schemaVersion: 1,
    producer: 'platform-console',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppReviewPayloadSchema,
  },
  'app.approved': {
    eventType: 'app.approved',
    schemaVersion: 1,
    producer: 'platform-operations-portal',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppReviewPayloadSchema,
  },
  'app.rejected': {
    eventType: 'app.rejected',
    schemaVersion: 1,
    producer: 'platform-operations-portal',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppReviewPayloadSchema,
  },
  'app.charge.created': {
    eventType: 'app.charge.created',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app_charge',
    payloadSchema: AppChargePayloadSchema,
  },
  'app.charge.activated': {
    eventType: 'app.charge.activated',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'payout-ledger', 'webhook-service'],
    aggregateType: 'app_charge',
    payloadSchema: AppChargePayloadSchema,
  },
  'theme.submitted': {
    eventType: 'theme.submitted',
    schemaVersion: 1,
    producer: 'platform-console',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'theme',
    payloadSchema: ThemeReviewPayloadSchema,
  },
  'theme.approved': {
    eventType: 'theme.approved',
    schemaVersion: 1,
    producer: 'platform-operations-portal',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'theme',
    payloadSchema: ThemeReviewPayloadSchema,
  },
  'theme.rejected': {
    eventType: 'theme.rejected',
    schemaVersion: 1,
    producer: 'platform-operations-portal',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'theme',
    payloadSchema: ThemeReviewPayloadSchema,
  },
  'theme.installed': {
    eventType: 'theme.installed',
    schemaVersion: 1,
    producer: 'theme-marketplace',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'theme',
    payloadSchema: ThemeInstalledPayloadSchema,
  },
  'payout.ledger_entry.created': {
    eventType: 'payout.ledger_entry.created',
    schemaVersion: 1,
    producer: 'queue-workers',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'payout',
    payloadSchema: PayoutPayloadSchema,
  },
  'payout.released': {
    eventType: 'payout.released',
    schemaVersion: 1,
    producer: 'queue-workers',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'payout',
    payloadSchema: PayoutPayloadSchema,
  },
  'payout.failed': {
    eventType: 'payout.failed',
    schemaVersion: 1,
    producer: 'queue-workers',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'payout',
    payloadSchema: PayoutPayloadSchema,
  },
} satisfies Record<DomainEventType, DomainEventContract>;

export const DOMAIN_EVENT_PRODUCER_CONSUMER_CONTRACTS = DOMAIN_EVENT_TYPES.map((eventType) => {
  const contract = DOMAIN_EVENT_CONTRACTS[eventType];
  return {
    event_type: eventType,
    schema_version: contract.schemaVersion,
    producer: contract.producer,
    consumers: contract.consumers,
    aggregate_type: contract.aggregateType,
  };
});

export const DomainEventEnvelopeSchema = z.object({
  event_id: z.string().trim().min(8).max(160),
  event_type: z.enum(DOMAIN_EVENT_TYPES),
  source_runtime: z.string().trim().min(1).max(120),
  site_id: UuidSchema.optional(),
  aggregate_type: z.string().trim().min(1).max(80),
  aggregate_id: z.string().trim().min(1).max(160),
  occurred_at: z.string().datetime(),
  payload: JsonRecordSchema,
  request_id: z.string().trim().min(1).max(160).optional(),
  idempotency_key: z.string().trim().min(1).max(240).optional(),
  schema_version: z.number().int().positive().default(1),
});

export function getDomainEventContract(eventType: string): DomainEventContract | null {
  return DOMAIN_EVENT_TYPES.includes(eventType as DomainEventType)
    ? DOMAIN_EVENT_CONTRACTS[eventType as DomainEventType]
    : null;
}

export function parseDomainEventPayload(eventType: DomainEventType, payload: unknown): Record<string, unknown> {
  const parsed = DOMAIN_EVENT_CONTRACTS[eventType].payloadSchema.parse(payload);
  return JsonRecordSchema.parse(parsed);
}

export function validateDomainEventEnvelope(input: unknown): RuntimeEventEnvelope {
  const base = DomainEventEnvelopeSchema.parse(input);
  const contract = DOMAIN_EVENT_CONTRACTS[base.event_type];

  if (base.schema_version !== contract.schemaVersion) {
    throw new Error(`Unsupported schema version ${base.schema_version} for ${base.event_type}`);
  }

  if (base.aggregate_type !== contract.aggregateType) {
    throw new Error(`Invalid aggregate type ${base.aggregate_type} for ${base.event_type}`);
  }

  return {
    event_id: base.event_id,
    event_type: base.event_type,
    source_runtime: base.source_runtime,
    site_id: base.site_id,
    aggregate_type: base.aggregate_type,
    aggregate_id: base.aggregate_id,
    occurred_at: base.occurred_at,
    payload: parseDomainEventPayload(base.event_type, base.payload),
    request_id: base.request_id,
    idempotency_key: base.idempotency_key,
  };
}

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

export const RecordOperationalCertificationReportSchema = z.object({
  certification_id: z.string().trim().min(8).max(120),
  environment: z.enum(['staging', 'production']),
  certification_mode: z.enum(['plan', 'execute']),
  status: z.enum(['credential-gated', 'certified', 'failed', 'expired']),
  repository_maturity_score: z.number().min(0).max(10),
  live_maturity_score: z.number().min(0).max(10),
  evidence_summary: JsonRecordSchema.default({}),
  missing_capabilities: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  expires_at: z.string().datetime().nullable().optional(),
  report: JsonRecordSchema.default({}),
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
export type MarketplaceReviewListQuery = z.infer<typeof MarketplaceReviewListQuerySchema>;
export type MarketplaceReviewDecisionInput = z.infer<typeof MarketplaceReviewDecisionSchema>;
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
export type RecordOperationalCertificationReportInput = z.infer<typeof RecordOperationalCertificationReportSchema>;
