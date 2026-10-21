import { z } from 'zod';

export * from './brand';
export * from './console-overview';
export * from './contact';
export * from './app-platform';
export * from './foundation-execution-contracts';
export * from './reel-review';
// Canonical, exhaustive, React-free status presentation per domain.
export * from './status-presentation';
import {
  SITE_STATUS_VALUES,
  ORDER_STATUS_VALUES,
  SUBSCRIPTION_STATUS_VALUES,
  GIFT_CARD_STATUS_VALUES,
  MERCHANT_PAYOUT_STATUS_VALUES,
  PAGE_STATUS_VALUES,
  REVIEW_MODERATION_STATUS_VALUES,
  CUSTOM_DOMAIN_STATUS_VALUES,
} from './status-presentation';
export {
  AiChatSchema,
  CheckCreditsSchema,
  GenerateContentSchema,
  GenerateImageSchema,
} from './app-platform';

export const UuidSchema = z.string().uuid('Must be a valid UUID');

export const ProductCsvImportSchema = z.object({
  store_id: UuidSchema,
  // Keep quoted field whitespace and line breaks intact.
  csv: z.string().min(1).max(1_048_576).refine(value => value.trim().length > 0, 'A product CSV is required'),
});
export type ProductCsvImportInput = z.infer<typeof ProductCsvImportSchema>;

export const QueryBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'string') return ['1', 'true', 'yes'].includes(value.toLowerCase());
  return value;
}, z.boolean()).default(false);

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
  withCount: QueryBooleanSchema,
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const IdParam = z.object({
  id: UuidSchema,
});

export const SlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only');

export const EmailSchema = z.string().email().max(320).toLowerCase();

export const PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164 format: +XXXXXXXXXXX')
  .optional();

export const UrlSchema = z.string().url().max(2000);

export const JsonRecordSchema = z.record(z.string(), z.unknown());

export const MoneySchema = z
  .number()
  .min(0, 'Amount cannot be negative')
  .max(99_999_999.99, 'Amount exceeds maximum');

export const CurrencySchema = z.string().length(3).toUpperCase().default('INR');

export const CommerceChannelSchema = z.enum(['web', 'whatsapp', 'instagram', 'pos', 'api']).default('web');
export type CommerceChannel = z.infer<typeof CommerceChannelSchema>;

export const GstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    'GSTIN must be a valid 15 character Indian GSTIN',
  );

export const IndianStateCodeSchema = z
  .string()
  .trim()
  .regex(/^(0[1-9]|[12][0-9]|3[0-8]|97)$/, 'GST state code must be 01-38 or 97');

export const HsnCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, 'HSN code must be 4 to 8 digits');

export const AddressSchema = z.object({
  name: z.string().max(200).optional(),
  line1: z.string().min(1).max(500),
  line2: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  state_code: IndianStateCodeSchema.optional(),
  zip: z.string().min(3).max(20),
  country: z.string().length(2).toUpperCase().default('IN'),
  phone: z.string().max(30).optional(),
  gstin: GstinSchema.optional(),
});

export const BusinessEntityTypeSchema = z.enum([
  'proprietorship',
  'partnership',
  'llp',
  'private_limited',
  'public_limited',
  'individual',
  'other',
]);

export const BusinessProfileSchema = z.object({
  legal_name: z.string().min(1).max(200).optional(),
  trade_name: z.string().max(200).optional(),
  entity_type: BusinessEntityTypeSchema.optional(),
  gstin: GstinSchema.optional(),
  gst_state_code: IndianStateCodeSchema.optional(),
  pan_last4: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4}$/).optional(),
  email: EmailSchema.optional(),
  phone: z.string().max(30).optional(),
  website: UrlSchema.optional(),
}).passthrough();

export const InvoiceAddressSchema = AddressSchema.partial().passthrough();

export const RobotsDirectiveSchema = z.enum([
  'index,follow',
  'index,nofollow',
  'noindex,follow',
  'noindex,nofollow',
]);

export const StructuredDataTypeSchema = z.enum([
  'Product',
  'Article',
  'BlogPosting',
  'WebPage',
  'CollectionPage',
  'FAQPage',
  'LocalBusiness',
  'Organization',
  'BreadcrumbList',
  'Service',
  'None',
]);

/**
 * Canonical per-entity SEO contract. All fields beyond title/description/og_image
 * are optional and additive: existing payloads continue to validate unchanged.
 * Merchant-facing surfaces (storefront pages, products, collections, CMS pages,
 * themes, apps) should persist and round-trip these through the API gateway.
 */
export const SeoSchema = z.object({
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(160).optional(),
  og_image_url: UrlSchema.optional(),
  og_title: z.string().max(70).optional(),
  og_description: z.string().max(200).optional(),
  canonical_url: UrlSchema.optional(),
  robots_directive: RobotsDirectiveSchema.optional(),
  focus_keyword: z.string().max(120).optional(),
  structured_data_type: StructuredDataTypeSchema.optional(),
  alternate_name: z.string().max(120).optional(),
  twitter_handle: z.string().max(40).optional(),
});

export type SeoInput = z.infer<typeof SeoSchema>;
export type RobotsDirective = z.infer<typeof RobotsDirectiveSchema>;
export type StructuredDataType = z.infer<typeof StructuredDataTypeSchema>;

export type PaginationQueryInput = z.infer<typeof PaginationQuery>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type CurrencyCode = z.infer<typeof CurrencySchema>;
export type Gstin = z.infer<typeof GstinSchema>;
export type IndianStateCode = z.infer<typeof IndianStateCodeSchema>;
export type HsnCode = z.infer<typeof HsnCodeSchema>;

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  state_code?: string;
  postal_code: string;
  country: string;
  phone?: string;
  gstin?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
  next_cursor?: string | null;
  total_is_exact?: boolean;
}

export type EntityId = string;
export type IsoDateTime = string;
export type JsonRecord = Record<string, unknown>;
export type MoneyMinorUnit = number;

export const InternalPermissionTierSchema = z.enum(['viewer', 'operator', 'lead', 'admin']);
export const InternalPermissionScopeSchema = z.enum([
  'rbac:view',
  'rbac:manage',
  'audit:read',
  'risk:view',
  'risk:decide',
  'risk:rules',
  'ts:view',
  'ts:enforce',
  'ts:appeal',
  'support:view',
  'support:reply',
  'support:manage',
  'merchant:view',
  'merchant:pii',
  'merchant:impersonate',
  'merchant:suspend',
  'review:view',
  'review:decide',
  'review:assign',
  'incident:view',
  'incident:command',
  'payout:view',
  'payout:release',
  'money:reconcile',
  'exec:view',
  'exec:pii',
  'compliance:view',
  'compliance:manage',
  'developer:view',
  'developer:manage',
]);

export type InternalPermissionTier = z.infer<typeof InternalPermissionTierSchema>;
export type InternalPermissionScope = z.infer<typeof InternalPermissionScopeSchema>;
export type InternalEffectivePermissionScope = InternalPermissionScope | '*';

export const INTERNAL_PERMISSION_SCOPES = InternalPermissionScopeSchema.options;

export const INTERNAL_PERMISSION_TIERS: Record<InternalPermissionTier, readonly InternalPermissionScope[]> = {
  viewer: [
    'audit:read',
    'risk:view',
    'ts:view',
    'support:view',
    'merchant:view',
    'review:view',
    'incident:view',
    'payout:view',
    'exec:view',
    'compliance:view',
    'developer:view',
  ],
  operator: [
    'audit:read',
    'risk:view',
    'risk:decide',
    'ts:view',
    'support:view',
    'support:reply',
    'merchant:view',
    'merchant:pii',
    'review:view',
    'incident:view',
    'payout:view',
    'compliance:view',
    'developer:view',
  ],
  lead: [
    'audit:read',
    'risk:view',
    'risk:decide',
    'risk:rules',
    'ts:view',
    'ts:enforce',
    'ts:appeal',
    'support:view',
    'support:reply',
    'support:manage',
    'merchant:view',
    'merchant:pii',
    'merchant:impersonate',
    'merchant:suspend',
    'review:view',
    'review:decide',
    'review:assign',
    'incident:view',
    'incident:command',
    'payout:view',
    'compliance:view',
    'developer:view',
    'developer:manage',
  ],
  admin: InternalPermissionScopeSchema.options,
};

export const INTERNAL_EMPLOYEE_ROLE_DEFAULT_TIERS: Record<string, InternalPermissionTier> = {
  viewer: 'viewer',
  staff: 'operator',
  support: 'operator',
  sales: 'operator',
  marketing: 'operator',
  fulfillment: 'operator',
  editor: 'operator',
  operations: 'lead',
  manager: 'lead',
  admin: 'admin',
};

/** Same ten-minute bound as canonical sensitive-action step-up verification. */
export const INTERNAL_APPROVAL_WINDOW_SECONDS = 600;
export const InternalMerchantApprovalRequestSchema = z.object({
  action: z.enum(['merchant.suspend', 'merchant.restore']),
  resource_id: z.string().uuid(), reason: z.string().trim().min(8).max(1000), request_key: z.string().uuid(),
}).strict();
/** Operator review annotates a break; it never adjusts the canonical journal. */
export const InternalMoneyResolutionDetailsSchema = z.object({
  resolution: z.enum(['acknowledge_suspense', 'provider_explained', 'request_recheck']),
  provider_reference: z.string().trim().max(160).nullable().optional().transform(value => value || null),
  suspense_ledger_transaction_id: z.string().uuid().nullable().optional().transform(value => value || null),
}).strict();
export const InternalMoneyApprovalRequestSchema = z.object({
  action: z.literal('money.reconciliation.resolve'), resource_id: z.string().uuid(),
  reason: z.string().trim().min(8).max(1000), request_key: z.string().uuid(), payload: InternalMoneyResolutionDetailsSchema,
}).strict();
export const InternalTrustSafetyNoteMetadataSchema = z.record(z.string(),z.unknown()).refine(value => {
  try { return new TextEncoder().encode(JSON.stringify(value)).length <= 4096; } catch { return false; }
}, 'Keep additional notes within4KB.').default({});
export const InternalTrustReinstatementRequestSchema = z.object({ action:z.literal('ts.reinstate'),resource_id:z.string().uuid(),
  reason:z.string().trim().min(8).max(1000),request_key:z.string().uuid(),metadata:InternalTrustSafetyNoteMetadataSchema }).strict();
export const InternalTrustReinstatementExecuteSchema = z.object({approval_id:z.string().uuid().optional(),reason:z.string().trim().min(8).max(1000),
  secondary_approver_id:z.string().uuid().optional(),metadata:InternalTrustSafetyNoteMetadataSchema}).strict();
export const InternalTrustSiteEnforcementSchema = z.object({action:z.enum(['suspend_site','takedown_theme','disable_app','freeze_payouts','platform_disable']),
  reason:z.string().trim().min(8).max(1000),idempotency_key:z.string().uuid().optional(),notify_subject:z.boolean().default(true),
  metadata:InternalTrustSafetyNoteMetadataSchema}).strict();
export const InternalOperatorMfaResetRequestSchema = z.object({action:z.literal('operator.mfa.reset'),resource_id:z.string().uuid(),
 reason:z.string().trim().min(8).max(1000),request_key:z.string().uuid(),configured_fingerprint:z.string().regex(/^[0-9a-f]{64}$/)}).strict();
/** Minimal operator projection; private queue payloads/errors/results never cross this boundary. */
export const InternalPlatformJobSchema = z.object({
  id:z.string().uuid(),site_id:z.string().uuid().nullable(),queue_name:z.literal('loyalty-refunds'),job_type:z.literal('loyalty.restore_redeemed'),
  status:z.enum(['queued','running','succeeded','failed','dead','cancelled']),attempts:z.number().int(),max_attempts:z.number().int(),
  order_id:z.string().uuid().nullable(),redeemed_entry_id:z.string().uuid().nullable(),points:z.string().regex(/^\d+$/).nullable(),
  point_value_minor:z.string().nullable(),value_minor:z.string().nullable(),created_at:z.string(),failed_at:z.string().nullable(),completed_at:z.string().nullable(),
  eligible:z.boolean(),source_valid:z.boolean(),reason_code:z.enum(['eligible','source_unavailable','debt_not_owed','lease_present','not_exhausted','attempt_limit']),
  source_identity:z.string().regex(/^[0-9a-f]{64}$/),source_fingerprint:z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type InternalPlatformJob = z.infer<typeof InternalPlatformJobSchema>;
export const InternalPlatformJobQuerySchema = z.object({site_id:z.string().uuid().optional(),job_id:z.string().uuid().optional(),
  page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(50).default(25)}).strict();
export const InternalPlatformJobRecoveryRequestSchema = z.object({site_id:z.string().uuid(),source_fingerprint:z.string().regex(/^[0-9a-f]{64}$/),
  reason:z.string().trim().min(8).max(1000),request_key:z.string().uuid(),expected_session_id:z.string().uuid()}).strict();
export const InternalPlatformJobRecoveryExecuteSchema = z.object({approval_id:z.string().uuid(),site_id:z.string().uuid(),
  reason:z.string().trim().min(8).max(1000),request_key:z.string().uuid()}).strict();
export const InternalPlatformJobRecoveryResultSchema = z.object({operation:z.literal('retry_authorized'),operation_id:z.string().uuid(),
  job_id:z.string().uuid(),site_id:z.string().uuid(),event_id:z.string().uuid(),previous_attempts:z.number().int().nonnegative(),
  max_attempts:z.number().int().positive(),retry_budget:z.literal(1),queued_at:z.string(),replayed:z.boolean()}).strict();
export const InternalProtectedApprovalRequestSchema = z.discriminatedUnion('action', [
  InternalMerchantApprovalRequestSchema, InternalMoneyApprovalRequestSchema, InternalTrustReinstatementRequestSchema, InternalOperatorMfaResetRequestSchema,
]);
export const InternalMoneyResolutionExecuteSchema = InternalMoneyResolutionDetailsSchema.extend({
  approval_id: z.string().uuid().optional(), reason: z.string().trim().min(8).max(1000),
  // Legacy transport fields are optional and never grant authority.
  actor_id: z.string().uuid().optional(), actor_email: z.string().email().nullable().optional(),
  secondary_approver_id: z.string().uuid().optional(),
}).strict();
export const InternalMoneyReconciliationRowSchema = z.object({
  site_id: z.string().uuid(), status: z.enum(['verified', 'mismatch']),
  wallet_available_minor: z.union([z.number().int(), z.string().regex(/^-?\d+$/)]),
  ledger_merchant_payable_minor: z.union([z.number().int(), z.string().regex(/^-?\d+$/)]),
  variance_minor: z.union([z.number().int(), z.string().regex(/^-?\d+$/)]),
  verified_at: z.string().nullable(), updated_at: z.string().nullable(),
  sites: z.object({ id: z.string().optional(), name: z.string().nullable().optional(),
    store_name: z.string().nullable().optional(), subdomain: z.string().nullable().optional() }).nullable().optional(),
}).passthrough();
export type InternalMoneyReconciliationRow = z.infer<typeof InternalMoneyReconciliationRowSchema>;
export const InternalApprovalDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'cancel']), payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export const InternalSensitiveApprovalSchema = z.object({
  id: z.string().uuid(), protocol_version: z.literal(1), site_id: z.string().uuid().nullable(),
  action: z.enum(['refund.approve', 'payout.release', 'customer.dsr.erase', 'merchant.suspend', 'merchant.restore',
    'developer.suspend', 'money.reconciliation.resolve', 'ts.reinstate', 'runtime.control-command', 'operator.mfa.reset', 'platform.job.redrive']),
  resource_type: z.string(), resource_id: z.string(), maker_actor_id: z.string().uuid(),
  checker_actor_id: z.string().uuid().nullable(), requester_session_id: z.string().uuid(),
  approver_session_id: z.string().uuid().nullable(), request_key: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']), reason: z.string(),
  payload: z.record(z.string(), z.unknown()), payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
  expires_at: z.string(), approved_at: z.string().nullable(), consumed_at: z.string().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(), created_at: z.string(),
  notification_delivery:z.object({status:z.enum(['queued','running','succeeded','failed','dead','cancelled']),attempts:z.number().int().nonnegative(),completed_at:z.string().nullable()}).nullable().optional(),
}).refine(value=>value.action==='operator.mfa.reset'
 ? value.site_id===null&&value.resource_type==='platform_operator'
 : value.site_id!==null,{message:'The protected action scope does not match its resource.'});
export type InternalSensitiveApproval = z.infer<typeof InternalSensitiveApprovalSchema>;

export const RiskEntityTypeSchema = z.enum(['signup', 'merchant', 'site', 'payment', 'app', 'theme', 'developer']);
export const RiskSignalTypeSchema = z.enum([
  'signup_velocity',
  'store_creation_velocity',
  'disposable_email',
  'shared_banned_instrument',
  'shared_banned_device',
  'failed_auth_burst',
  'chargeback_rate_breach',
  'country_ip_mismatch',
  'vpn_tor',
  'manual_review',
]);
export const RiskSignalSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const RiskBandSchema = z.enum(['low', 'medium', 'high']);
export const RiskScoreStatusSchema = z.enum(['open', 'confirmed', 'dismissed', 'restricted']);
export const RiskDecisionSchema = z.enum(['confirm', 'dismiss', 'manual_block']);

export type RiskEntityType = z.infer<typeof RiskEntityTypeSchema>;
export type RiskSignalType = z.infer<typeof RiskSignalTypeSchema>;
export type RiskSignalSeverity = z.infer<typeof RiskSignalSeveritySchema>;
export type RiskBand = z.infer<typeof RiskBandSchema>;
export type RiskScoreStatus = z.infer<typeof RiskScoreStatusSchema>;
export type RiskDecision = z.infer<typeof RiskDecisionSchema>;

export const RISK_SCORE_BANDS = {
  low: { min: 0, max: 39 },
  medium: { min: 40, max: 74 },
  high: { min: 75, max: 100 },
} as const satisfies Record<RiskBand, { min: number; max: number }>;

export const RISK_AUTO_RESTRICT_SCORE = RISK_SCORE_BANDS.high.min;

export const RISK_DEFAULT_RULE_WEIGHTS: Record<RiskSignalType, number> = {
  signup_velocity: 35,
  store_creation_velocity: 35,
  disposable_email: 25,
  shared_banned_instrument: 55,
  shared_banned_device: 45,
  failed_auth_burst: 25,
  chargeback_rate_breach: 45,
  country_ip_mismatch: 20,
  vpn_tor: 20,
  manual_review: 15,
};

const RISK_SEVERITY_MULTIPLIER: Record<RiskSignalSeverity, number> = {
  low: 0.5,
  medium: 1,
  high: 1.2,
  critical: 1.5,
};

export interface RiskSignalForScoring {
  id?: string | null;
  rule_id?: string | null;
  signal_type: RiskSignalType | string;
  severity?: RiskSignalSeverity | string | null;
  weight?: number | null;
  evidence?: JsonRecord | null;
  metadata?: JsonRecord | null;
}

export interface RiskScoreBreakdownEntry {
  signal_type: string;
  severity: string;
  weight: number;
  score_contribution: number;
  rule_id?: string | null;
  signal_id?: string | null;
  evidence?: JsonRecord | null;
}

export interface RiskScoreComputation {
  score: number;
  band: RiskBand;
  auto_restrict: boolean;
  breakdown: {
    bands: typeof RISK_SCORE_BANDS;
    threshold: { auto_restrict: number };
    signals: RiskScoreBreakdownEntry[];
  };
}

export function resolveRiskBand(score: number): RiskBand {
  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  if (normalized >= RISK_SCORE_BANDS.high.min) return 'high';
  if (normalized >= RISK_SCORE_BANDS.medium.min) return 'medium';
  return 'low';
}

export function scoreRiskSignals(signals: readonly RiskSignalForScoring[]): RiskScoreComputation {
  const entries = signals.map((signal) => {
    const signalType = RiskSignalTypeSchema.safeParse(signal.signal_type).success
      ? signal.signal_type as RiskSignalType
      : 'manual_review';
    const severity = RiskSignalSeveritySchema.safeParse(signal.severity).success
      ? signal.severity as RiskSignalSeverity
      : 'medium';
    const baseWeight = typeof signal.weight === 'number' && Number.isFinite(signal.weight)
      ? signal.weight
      : RISK_DEFAULT_RULE_WEIGHTS[signalType];
    const scoreContribution = Math.max(0, Math.min(100, Math.round(baseWeight * RISK_SEVERITY_MULTIPLIER[severity])));

    return {
      signal_type: signal.signal_type,
      severity,
      weight: baseWeight,
      score_contribution: scoreContribution,
      rule_id: signal.rule_id || null,
      signal_id: signal.id || null,
      evidence: signal.evidence || null,
    } satisfies RiskScoreBreakdownEntry;
  });
  const score = Math.max(0, Math.min(100, entries.reduce((sum, entry) => sum + entry.score_contribution, 0)));
  const band = resolveRiskBand(score);

  return {
    score,
    band,
    auto_restrict: score >= RISK_AUTO_RESTRICT_SCORE,
    breakdown: {
      bands: RISK_SCORE_BANDS,
      threshold: { auto_restrict: RISK_AUTO_RESTRICT_SCORE },
      signals: entries,
    },
  };
}

export const TrustSafetySubjectTypeSchema = z.enum(['site', 'merchant', 'app', 'theme', 'developer', 'payment', 'order', 'custom']);
export const TrustSafetyCaseCategorySchema = z.enum([
  'fraud',
  'illegal_goods',
  'counterfeit',
  'phishing',
  'abuse_report',
  'copyright',
  'trademark',
  'payments',
  'platform_integrity',
  'other',
]);
export const TrustSafetySeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const TrustSafetyCaseStatusSchema = z.enum(['open', 'under_review', 'actioned', 'appealed', 'reinstated', 'closed', 'finalized']);
export const TrustSafetyDecisionSchema = z.enum(['no_violation', 'violation', 'needs_more_info']);
export const TrustSafetyEnforcementActionSchema = z.enum(['none', ...InternalTrustSiteEnforcementSchema.shape.action.options]);
export const TrustSafetyAppealStatusSchema = z.enum(['filed', 'under_review', 'upheld', 'overturned', 'rejected', 'expired']);
export const TrustSafetyTakedownStatusSchema = z.enum(['pending', 'active', 'reversed']);

export type TrustSafetySubjectType = z.infer<typeof TrustSafetySubjectTypeSchema>;
export type TrustSafetyCaseCategory = z.infer<typeof TrustSafetyCaseCategorySchema>;
export type TrustSafetySeverity = z.infer<typeof TrustSafetySeveritySchema>;
export type TrustSafetyCaseStatus = z.infer<typeof TrustSafetyCaseStatusSchema>;
export type TrustSafetyDecision = z.infer<typeof TrustSafetyDecisionSchema>;
export type TrustSafetyEnforcementAction = z.infer<typeof TrustSafetyEnforcementActionSchema>;
export type TrustSafetyAppealStatus = z.infer<typeof TrustSafetyAppealStatusSchema>;
export type TrustSafetyTakedownStatus = z.infer<typeof TrustSafetyTakedownStatusSchema>;

export const TRUST_SAFETY_DEFAULT_APPEAL_WINDOW_BUSINESS_DAYS = 7;
export const TRUST_SAFETY_RETENTION_EXEMPT_TABLES = [
  'ts_cases',
  'ts_case_events',
  'ts_evidence',
  'ts_appeals',
  'ts_takedowns',
] as const;

export const ComplianceDataSubjectRequestTypeSchema = z.enum(['access', 'erasure']);
export const ComplianceDataSubjectSubjectTypeSchema = z.enum(['customer', 'shop', 'merchant', 'developer', 'employee', 'other']);
export const ComplianceDataSubjectSourceSchema = z.enum([
  'manual',
  'customers/data_request',
  'customers/redact',
  'shop/redact',
  'support',
  'trust_safety',
  'system',
]);
export const ComplianceDataSubjectStatusSchema = z.enum([
  'open',
  'verifying',
  'in_progress',
  'fulfilled',
  'rejected',
  'cancelled',
  'expired',
]);
export const ComplianceAuditExportStatusSchema = z.enum(['idle', 'running', 'completed', 'failed']);
export const ComplianceAuditExportSinkTypeSchema = z.enum(['local_dry_run', 'siem', 'worm']);

export type ComplianceDataSubjectRequestType = z.infer<typeof ComplianceDataSubjectRequestTypeSchema>;
export type ComplianceDataSubjectSubjectType = z.infer<typeof ComplianceDataSubjectSubjectTypeSchema>;
export type ComplianceDataSubjectSource = z.infer<typeof ComplianceDataSubjectSourceSchema>;
export type ComplianceDataSubjectStatus = z.infer<typeof ComplianceDataSubjectStatusSchema>;
export type ComplianceAuditExportStatus = z.infer<typeof ComplianceAuditExportStatusSchema>;
export type ComplianceAuditExportSinkType = z.infer<typeof ComplianceAuditExportSinkTypeSchema>;

export const COMPLIANCE_DATA_REQUEST_DUE_DAYS = 30;
export const COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK: ComplianceAuditExportSinkType = 'local_dry_run';
export const COMPLIANCE_RETENTION_POLICY_VERSION = 'internal_compliance_v1';
export const COMPLIANCE_RETENTION_POLICY = [
  {
    key: 'trust_safety_enforcement',
    label: 'Trust & Safety enforcement records',
    disposition: 'retention_exempt',
    tables: TRUST_SAFETY_RETENTION_EXEMPT_TABLES,
    erasure_behavior: 'retain enforcement record, redact purgeable PII fields only after legal review',
  },
  {
    key: 'customer_commerce_pii',
    label: 'Customer commerce PII',
    disposition: 'purgeable_or_redactable',
    tables: ['store_customers', 'customer_addresses', 'customer_credentials', 'customer_wishlist', 'orders'],
    erasure_behavior: 'redact direct identifiers while preserving transactional integrity and audit references',
  },
  {
    key: 'merchant_account_pii',
    label: 'Merchant account PII',
    disposition: 'purgeable_or_redactable',
    tables: ['users_custom', 'sites', 'subscriptions', 'support_tickets', 'ticket_messages'],
    erasure_behavior: 'route through data-subject workflow with site ownership and billing/legal hold checks',
  },
  {
    key: 'audit_spine',
    label: 'Audit spine',
    disposition: 'append_only_exported',
    tables: ['audit_logs', 'execution_audit_trail', 'runtime_control_commands'],
    erasure_behavior: 'retain immutable audit rows; export through tamper-evident sink and redact direct PII where lawful',
  },
] as const;

export const SupportTicketStatusSchema = z.enum(['open', 'pending_customer', 'pending_internal', 'escalated', 'resolved', 'closed']);
export const SupportTicketPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export const SupportTicketChannelSchema = z.enum(['email', 'in_app', 'chat', 'phone', 'api']);
export const SupportTicketTopicSchema = z.enum(['billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps', 'general']);
// What a ticket in the platform queue can carry, so what the queue can be filtered by: every topic above plus 'privacy'
// (migration 261). Only the buyer's privacy intake writes a privacy ticket. An operator creates tickets and macros with
// SupportTicketTopicSchema, which leaves 'privacy' out on purpose: filter with this schema, create with that one.
export const SupportTicketQueueTopicSchema = z.enum(['billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps', 'general', 'privacy']);
export const SupportTicketMessageAuthorSchema = z.enum(['requester', 'agent', 'system']);
export const SupportTicketMessageVisibilitySchema = z.enum(['public', 'internal']);
export const SupportTicketEscalationTargetSchema = z.enum(['risk', 'trust_safety', 'incident', 'finance', 'engineering']);
export const SupportTicketSlaClockTypeSchema = z.enum(['first_response', 'resolution']);

export type SupportTicketStatus = z.infer<typeof SupportTicketStatusSchema>;
export type SupportTicketPriority = z.infer<typeof SupportTicketPrioritySchema>;
export type SupportTicketChannel = z.infer<typeof SupportTicketChannelSchema>;
export type SupportTicketTopic = z.infer<typeof SupportTicketTopicSchema>;
export type SupportTicketQueueTopic = z.infer<typeof SupportTicketQueueTopicSchema>;
export type SupportTicketMessageAuthor = z.infer<typeof SupportTicketMessageAuthorSchema>;
export type SupportTicketMessageVisibility = z.infer<typeof SupportTicketMessageVisibilitySchema>;
export type SupportTicketEscalationTarget = z.infer<typeof SupportTicketEscalationTargetSchema>;
export type SupportTicketSlaClockType = z.infer<typeof SupportTicketSlaClockTypeSchema>;

export const SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS = 8;
export const SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS = 3;
export const SUPPORT_DEFAULT_CSAT_SCALE = { min: 1, max: 5 } as const;
export const SUPPORT_ESCALATION_KEYWORDS = [
  'fraud',
  'chargeback',
  'abuse',
  'phishing',
  'counterfeit',
  'illegal',
  'scam',
  'stolen',
] as const;

export interface TimestampedEntity {
  id: EntityId;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  deleted_at?: IsoDateTime | null;
}

export interface AuditedEntity extends TimestampedEntity {
  created_by?: EntityId | null;
  updated_by?: EntityId | null;
  deleted_by?: EntityId | null;
}

export const MetadataSchema = z.record(z.string(), z.unknown());

export const TimestampedEntitySchema = z.object({
  id: UuidSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().optional().nullable(),
});

export const AuditedEntitySchema = TimestampedEntitySchema.extend({
  created_by: UuidSchema.optional().nullable(),
  updated_by: UuidSchema.optional().nullable(),
  deleted_by: UuidSchema.optional().nullable(),
});

export const SiteTypeSchema = z.enum(['store', 'portfolio', 'resume', 'blog', 'landing']);
// ── Status vocabularies are DERIVED, not restated ──────────────────────────
// Each of these schemas is built from the canonical value tuple in
// ./status-presentation, which mirrors the live CHECK constraint. Restating the
// values here is how they drifted: five schemas disagreed with the database,
// including merchant statements confused with provider payouts. Deriving makes the
// schema, the TS union and the presentation map one source by construction.
export const StoreStatusSchema = z.enum(SITE_STATUS_VALUES);
export const CustomDomainStatusSchema = z.enum(CUSTOM_DOMAIN_STATUS_VALUES);
export const StoreAccessModeSchema = z.enum(['public', 'password', 'preview_only', 'offline']);
export const StoreHealthPillarStatusSchema = z.enum(['ready', 'attention', 'blocked', 'unknown']);
export const ProductStatusSchema = z.enum(['draft', 'active', 'archived']);
export const InventoryPolicySchema = z.enum(['deny', 'continue']);
export const InventoryAdjustmentReasonSchema = z.enum([
  'received',
  'sold',
  'returned',
  'damaged',
  'correction',
  'transfer',
  'sale',
  'return',
  'adjustment',
  'recount',
]);
export const CollectionStatusSchema = z.enum(['draft', 'active', 'archived']);
export const GiftCardStatusSchema = z.enum(GIFT_CARD_STATUS_VALUES);
export const ReviewModerationStatusSchema = z.enum(REVIEW_MODERATION_STATUS_VALUES);
export const CustomerStatusSchema = z.enum(['active', 'disabled', 'invited']);
export const CartStatusSchema = z.enum(['active', 'converted', 'abandoned', 'expired']);
export const OrderStatusSchema = z.enum(ORDER_STATUS_VALUES);
export const DraftOrderStatusSchema = z.enum(['draft', 'converted', 'discarded']);
export const PaymentStatusSchema = z.enum([
  'pending',
  'requires_action',
  'authorized',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
  'voided',
]);
export const FulfillmentStatusSchema = z.enum([
  'unfulfilled',
  'partial',
  'fulfilled',
  'returned',
  'cancelled',
]);
// Phase M1 (DOC 03 row 11 "Payments"): Razorpay + COD are the only live
// money-in rails; 'upi'/'card'/'netbanking'/'wallet' are Razorpay
// instruments, not separate aggregators, and 'manual' is offline
// reconciliation, not a third-party provider -- both are kept.
export const PaymentProviderSchema = z.enum([
  'razorpay',
  'upi',
  'cod',
  'manual',
]);
export const PaymentMethodSchema = z.enum([
  'upi',
  'card',
  'netbanking',
  'wallet',
  'cod',
  'manual',
]);
export const SubscriptionBillingPeriodSchema = z.enum(['monthly', 'yearly']);
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUS_VALUES);
export const DiscountTypeSchema = z.enum(['percentage', 'fixed', 'free_shipping']);
export const PageStatusSchema = z.enum(PAGE_STATUS_VALUES);
export const PolicyTypeSchema = z.enum(['privacy', 'refund', 'shipping', 'terms', 'contact', 'custom']);
export const BlogPostStatusSchema = z.enum(['draft', 'published', 'scheduled', 'archived']);
export const BlogCommentStatusSchema = z.enum(['pending', 'approved', 'spam', 'rejected']);
export const FormSubmissionStatusSchema = z.enum([
  'new',
  'read',
  'replied',
  'contacted',
  'converted',
  'archived',
  'spam',
]);
export const MediaTypeSchema = z.enum(['image', 'video', 'audio', 'document', 'other']);
export const AnalyticsPeriodSchema = z.enum(['7d', '30d', '90d', '12m']);
export const AIGenerationStatusSchema = z.enum(['pending', 'completed', 'failed']);
export const ResumeContentSectionSchema = z.enum([
  'skills',
  'education',
  'work_experience',
  'certifications',
  'testimonials',
  'projects',
]);
export const ThemeCategorySchema = z.enum(['store', 'portfolio', 'resume', 'blog', 'landing', 'saas']);
export const ThemePricingTypeSchema = z.enum(['free', 'one_time', 'subscription']);
export const ShippingRateTypeSchema = z.enum(['flat', 'weight_based', 'price_based', 'free']);
export const TaxAppliesToSchema = z.enum(['all', 'shipping', 'products']);

export const MoneyAmountSchema = z.object({
  amount: MoneySchema,
  amount_minor: z.number().int().min(0).optional(),
  currency: CurrencySchema,
});

export const MerchantPayoutStatusSchema = z.enum(MERCHANT_PAYOUT_STATUS_VALUES);
export const MerchantPayoutRailSchema = z.enum(['razorpay_route', 'upi', 'manual']);
export const MerchantPayoutModeSchema = z.enum(['sandbox', 'live']);
export const WalletLedgerEntryTypeSchema = z.enum(['payout_credit', 'payout_debit', 'adjustment', 'hold', 'release', 'cod_remittance_credit']);
export const WalletLedgerDirectionSchema = z.enum(['credit', 'debit']);
export const WalletLedgerStatusSchema = z.enum(['pending', 'posted', 'held', 'reversed']);
export const CommissionReconciliationStatusSchema = z.enum(['pending', 'included_in_payout', 'reconciled', 'reversed']);
export const CodReconciliationStatusSchema = z.enum(['pending', 'collected', 'reconciled', 'short', 'over', 'reversed']);
export const MerchantKycDocumentTypeSchema = z.enum([
  'business_pan',
  'gst_certificate',
  'bank_proof',
  'address_proof',
  'identity_proof',
]);
export const MerchantKycDocumentStatusSchema = z.enum([
  'draft',
  'submitted',
  'needs_review',
  'verified',
  'rejected',
]);
export const MerchantKycProviderModeSchema = z.enum(['sandbox', 'live']);
export const MerchantKycOverallStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'needs_review',
  'verified',
  'rejected',
]);
export const MerchantTwoFactorTypeSchema = z.enum(['totp', 'passkey']);
export const MerchantTwoFactorStatusSchema = z.enum(['pending', 'active', 'disabled']);

export const MerchantPayoutStatementSchema = AuditedEntitySchema.extend({
  // Gateway preserves PostgREST's timestamp offsets in statement readback.
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  deleted_at: z.string().datetime({ offset: true }).optional().nullable(),
  site_id: UuidSchema,
  statement_number: z.string().min(1).max(120),
  status: MerchantPayoutStatusSchema,
  provider: z.string().min(1).max(80),
  provider_mode: MerchantPayoutModeSchema,
  rail: MerchantPayoutRailSchema,
  currency: CurrencySchema,
  gross_amount_minor: z.number().int().nonnegative(),
  platform_fee_minor: z.number().int().nonnegative(),
  tax_minor: z.number().int().nonnegative(),
  net_amount_minor: z.number().int().nonnegative(),
  period_start: z.string().optional().nullable(),
  period_end: z.string().optional().nullable(),
  available_on: z.string().optional().nullable(),
  processing_at: z.string().datetime({ offset: true }).optional().nullable(),
  released_at: z.string().datetime({ offset: true }).optional().nullable(),
  failed_at: z.string().datetime({ offset: true }).optional().nullable(),
  utr: z.string().optional().nullable(),
  provider_reference: z.string().optional().nullable(),
  failure_reason: z.string().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const WalletLedgerEntrySchema = AuditedEntitySchema.extend({
  site_id: UuidSchema,
  payout_statement_id: UuidSchema.optional().nullable(),
  entry_type: WalletLedgerEntryTypeSchema,
  direction: WalletLedgerDirectionSchema,
  status: WalletLedgerStatusSchema,
  currency: CurrencySchema,
  amount_minor: z.number().int().nonnegative(),
  available_on: z.string().optional().nullable(),
  reference_type: z.string().optional().nullable(),
  reference_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const WalletBalanceSchema = z.object({
  site_id: UuidSchema,
  currency: CurrencySchema,
  available_minor: z.number().int(),
  pending_minor: z.number().int(),
  held_minor: z.number().int(),
  released_minor: z.number().int(),
  ledger: z.array(WalletLedgerEntrySchema).default([]),
});

export const CommissionScheduleSchema = AuditedEntitySchema.extend({
  site_id: UuidSchema,
  name: z.string().min(1).max(160),
  status: z.enum(['draft', 'active', 'archived']),
  currency: CurrencySchema,
  commission_bps: z.number().int().min(0).max(10000),
  gst_bps: z.number().int().min(0).max(2800),
  effective_from: z.string(),
  effective_to: z.string().optional().nullable(),
  source: z.string().min(1).max(120),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const CommissionReconciliationEntrySchema = AuditedEntitySchema.extend({
  site_id: UuidSchema,
  order_id: UuidSchema.optional().nullable(),
  payout_statement_id: UuidSchema.optional().nullable(),
  commission_schedule_id: UuidSchema.optional().nullable(),
  status: CommissionReconciliationStatusSchema,
  currency: CurrencySchema,
  gross_amount_minor: z.number().int().nonnegative(),
  commission_bps: z.number().int().min(0).max(10000),
  commission_amount_minor: z.number().int().nonnegative(),
  gst_bps: z.number().int().min(0).max(2800),
  gst_amount_minor: z.number().int().nonnegative(),
  net_payable_minor: z.number().int().nonnegative(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const CodReconciliationEntrySchema = AuditedEntitySchema.extend({
  site_id: UuidSchema,
  order_id: UuidSchema,
  status: CodReconciliationStatusSchema,
  currency: CurrencySchema,
  expected_amount_minor: z.number().int().nonnegative(),
  collected_amount_minor: z.number().int().nonnegative(),
  deposited_amount_minor: z.number().int().nonnegative(),
  difference_amount_minor: z.number().int(),
  collected_at: z.string().datetime().optional().nullable(),
  deposited_at: z.string().datetime().optional().nullable(),
  reconciled_at: z.string().datetime().optional().nullable(),
  collection_idempotency_key: z.string().optional().nullable(),
  reconciliation_idempotency_key: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const MerchantPayoutListSchema = z.object({
  payouts: z.array(MerchantPayoutStatementSchema).default([]),
  summary: z.object({
    site_id: UuidSchema,
    currency: CurrencySchema,
    pending_minor: z.number().int().nonnegative(),
    processing_minor: z.number().int().nonnegative(),
    released_minor: z.number().int().nonnegative(),
    failed_minor: z.number().int().nonnegative(),
    next_payout: MerchantPayoutStatementSchema.optional().nullable(),
  }),
});

export const CommissionOverviewSchema = z.object({
  site_id: UuidSchema,
  currency: CurrencySchema,
  schedule: CommissionScheduleSchema,
  entries: z.array(CommissionReconciliationEntrySchema).default([]),
  summary: z.object({
    gross_amount_minor: z.number().int().nonnegative(),
    commission_amount_minor: z.number().int().nonnegative(),
    gst_amount_minor: z.number().int().nonnegative(),
    net_payable_minor: z.number().int().nonnegative(),
  }),
});

export const CodReconciliationOverviewSchema = z.object({
  site_id: UuidSchema,
  currency: CurrencySchema,
  entries: z.array(CodReconciliationEntrySchema).default([]),
  summary: z.object({
    site_id: UuidSchema,
    currency: CurrencySchema,
    expected_amount_minor: z.number().int().nonnegative(),
    collected_amount_minor: z.number().int().nonnegative(),
    deposited_amount_minor: z.number().int().nonnegative(),
    difference_amount_minor: z.number().int(),
    counts: z.record(CodReconciliationStatusSchema, z.number().int().nonnegative()),
  }),
});

export const MerchantKycDocumentSchema = AuditedEntitySchema.extend({
  site_id: UuidSchema,
  document_type: MerchantKycDocumentTypeSchema,
  status: MerchantKycDocumentStatusSchema,
  provider: z.string().min(1).max(80),
  provider_mode: MerchantKycProviderModeSchema,
  provider_reference: z.string().optional().nullable(),
  document_number_last4: z.string().optional().nullable(),
  file_url: UrlSchema.optional().nullable(),
  file_name: z.string().optional().nullable(),
  rejection_reason: z.string().optional().nullable(),
  metadata: MetadataSchema.default({}),
  submitted_at: z.string().datetime().optional().nullable(),
  verified_at: z.string().datetime().optional().nullable(),
  rejected_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MerchantKycRequirementSchema = z.object({
  document_type: MerchantKycDocumentTypeSchema,
  title: z.string().min(1),
  required: z.boolean(),
  status: MerchantKycDocumentStatusSchema.optional().nullable(),
});

export const MerchantKycOverviewSchema = z.object({
  site_id: UuidSchema,
  overall_status: MerchantKycOverallStatusSchema,
  provider_mode: MerchantKycProviderModeSchema,
  required_documents: z.array(MerchantKycRequirementSchema).default([]),
  documents: z.array(MerchantKycDocumentSchema).default([]),
  next_action: z.string().optional().nullable(),
});

export const MerchantTwoFactorSchema = AuditedEntitySchema.extend({
  custom_user_id: UuidSchema,
  factor_type: MerchantTwoFactorTypeSchema,
  status: MerchantTwoFactorStatusSchema,
  issuer: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  last_verified_at: z.string().datetime().optional().nullable(),
  enrolled_at: z.string().datetime().optional().nullable(),
  disabled_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const MerchantSessionInventoryItemSchema = z.object({
  id: UuidSchema,
  device_id: z.string().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  last_active: z.string().datetime().optional().nullable(),
}).passthrough();

export const MerchantTwoFactorOverviewSchema = z.object({
  custom_user_id: UuidSchema,
  email: EmailSchema,
  mfa_enabled: z.boolean(),
  factors: z.array(MerchantTwoFactorSchema).default([]),
  sessions: z.array(MerchantSessionInventoryItemSchema).default([]),
});

export const MerchantTwoFactorEnrollmentSchema = z.object({
  factor: MerchantTwoFactorSchema,
  secret: z.string().min(16),
  otpauth_uri: z.string().min(1),
});

export const AuthSessionUserSchema = z.object({
  id: UuidSchema,
  email: EmailSchema,
  fullName: z.string().max(200).optional().nullable(),
  avatarUrl: UrlSchema.optional().nullable(),
}).passthrough();

export const AuthSessionResponseSchema = z.object({
  authenticated: z.boolean(),
  user: AuthSessionUserSchema.optional().nullable(),
}).passthrough();

export const StoreSchema = AuditedEntitySchema.extend({
  user_id: UuidSchema,
  name: z.string().min(1).max(100),
  subdomain: z.string().min(3).max(63),
  custom_domain: z.string().max(255).optional().nullable(),
  custom_domain_status: CustomDomainStatusSchema.default('none').optional(),
  custom_domain_verification_token: z.string().max(255).optional().nullable(),
  access_mode: StoreAccessModeSchema.default('public'),
  access_message: z.string().max(1000).optional().nullable(),
  published: z.boolean().default(false),
  site_type: SiteTypeSchema,
  status: StoreStatusSchema,
  theme_id: z.string().max(120).optional().nullable(),
  current_theme_release_id: UuidSchema.optional().nullable(),
  storefront_release_version: z.number().int().min(0).optional().nullable(),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  currency: CurrencySchema,
  locale: z.string().min(2).max(16).default('en-IN'),
  timezone: z.string().min(1).max(80).default('Asia/Kolkata'),
  logo_url: UrlSchema.optional().nullable(),
  favicon_url: UrlSchema.optional().nullable(),
  legal_name: z.string().max(200).optional().nullable(),
  gstin: GstinSchema.optional().nullable(),
  gst_state_code: IndianStateCodeSchema.optional().nullable(),
  invoice_prefix: z.string().min(1).max(20).optional().nullable(),
  business_profile: BusinessProfileSchema.optional().nullable(),
  invoice_address: InvoiceAddressSchema.optional().nullable(),
  invoice_footer: z.string().max(1000).optional().nullable(),
  invoice_number_next: z.number().int().positive().optional().nullable(),
  theme_config: MetadataSchema.default({}),
  settings: MetadataSchema.default({}),
  navigation: MetadataSchema.default({}),
  tax_inclusive: z.boolean().default(false),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
});

export const StoreSummarySchema = StoreSchema.pick({
  id: true,
  name: true,
  subdomain: true,
  site_type: true,
  status: true,
  theme_id: true,
  custom_domain: true,
  custom_domain_status: true,
  access_mode: true,
  access_message: true,
  published: true,
}).extend({
  store_name: z.string().max(100).optional().nullable(),
  trial_ends_at: z.string().datetime().optional().nullable(),
  trial_status: z.string().max(80).optional().nullable(),
  theme_settings: MetadataSchema.optional().nullable(),
}).passthrough();

export const DomainHealthRecordSchema = z.object({
  type: z.string().min(1).max(16),
  host: z.string().min(1).max(255),
  value: z.string().min(1).max(1000),
  status: z.enum(['verified', 'pending', 'mismatch', 'unknown']),
  actual: z.array(z.string().min(1).max(1000)).default([]),
  message: z.string().max(500).optional().nullable(),
});

export const CustomDomainHealthSchema = z.object({
  site_id: UuidSchema,
  domain: z.string().min(3).max(255),
  status: CustomDomainStatusSchema,
  txt_verified: z.boolean(),
  cname_verified: z.boolean(),
  ssl_active: z.boolean(),
  // DNS host detected live from the apex nameservers (e.g. "Cloudflare", "GoDaddy").
  // Re-detected on every health check so a registrar/NS change is reflected, not stale.
  provider: z.string().max(120).nullable().optional(),
  provider_status: z.enum(['configured', 'unavailable']).default('configured'),
  configured_by: z.string().max(255).optional().nullable(),
  misconfigured: z.boolean().default(false),
  apex_mx_warning: z.boolean().default(false),
  renewal_status: z.enum(['managed', 'action_required', 'unknown']).default('unknown'),
  renewal_date: z.string().datetime().optional().nullable(),
  checked_at: z.string().datetime(),
  records: z.array(DomainHealthRecordSchema).min(1).max(6),
  vercel: MetadataSchema.default({}),
});

export const DomainRegistrarProviderSchema = z.enum(['resellerclub', 'opensrs', 'sandbox']);

export const DomainAvailabilityQuoteSchema = z.object({
  domain: z.string().min(3).max(255),
  available: z.boolean(),
  currency: CurrencySchema,
  amountMinor: z.number().int().min(0),
  provider: DomainRegistrarProviderSchema,
  premium: z.boolean().default(false),
  reasons: z.array(z.string().max(120)).default([]),
}).passthrough();

export const DomainCheckoutSchema = z.object({
  mode: z.enum(['sandbox', 'external_reference']),
  status: z.enum(['verified', 'reference_recorded']),
  payment_reference: z.string().min(3).max(180),
  amount_minor: z.number().int().min(0),
  currency: CurrencySchema,
}).passthrough();

export const DomainPurchaseResultSchema = z.object({
  order_id: UuidSchema.or(z.string().min(1).max(120)),
  domain: z.string().min(3).max(255),
  provider: DomainRegistrarProviderSchema,
  status: CustomDomainStatusSchema.or(z.enum(['provisioning', 'failed'])),
  registrar_order_id: z.string().max(255).optional().nullable(),
  dns_configured: z.boolean().default(false),
  checkout: DomainCheckoutSchema,
}).passthrough();

export const StoreHealthPillarSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  score: z.number().int().min(0).max(100),
  status: StoreHealthPillarStatusSchema,
  summary: z.string().min(1).max(500),
  action_label: z.string().min(1).max(120).optional().nullable(),
  route: z.string().min(1).max(200).optional().nullable(),
  metrics: MetadataSchema.default({}),
});

export const StoreHealthSchema = z.object({
  store_id: UuidSchema,
  score: z.number().int().min(0).max(100),
  generated_at: z.string().datetime(),
  pillars: z.array(StoreHealthPillarSchema).min(1).max(12),
  metadata: MetadataSchema.default({}),
});

export const StorefrontLocaleStatusSchema = z.enum(['draft', 'published', 'archived']);
export const StorefrontTranslationResourceTypeSchema = z.enum([
  'store',
  'product',
  'collection',
  'page',
  'policy',
  'theme',
  'navigation',
]);
export const StorefrontTranslationStatusSchema = z.enum(['draft', 'published', 'needs_review']);
export const StoreMarketRoundingModeSchema = z.enum(['standard', 'up', 'down', 'none']);

export const StoreMarketSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  name: z.string().min(1).max(120),
  country_code: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/).default('INR'),
  locale: z.string().min(2).max(16).default('en-IN'),
  is_primary: z.boolean().default(false),
  is_active: z.boolean().default(true),
  price_adjustment_bps: z.number().int().min(-10000).max(10000).default(0),
  rounding_mode: StoreMarketRoundingModeSchema.default('standard'),
  metadata: MetadataSchema.default({}),
});

export const StorefrontLocaleSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  locale: z.string().min(2).max(16),
  name: z.string().min(1).max(120),
  status: StorefrontLocaleStatusSchema.default('draft'),
  is_default: z.boolean().default(false),
  published_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const StorefrontTranslationSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  locale: z.string().min(2).max(16),
  resource_type: StorefrontTranslationResourceTypeSchema,
  resource_id: z.string().min(1).max(200),
  field: z.string().min(1).max(120),
  source_text: z.string().max(5000).optional().nullable(),
  translated_text: z.string().min(1).max(5000),
  status: StorefrontTranslationStatusSchema.default('draft'),
  published_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const StoreLocalizationSummarySchema = z.object({
  store_id: UuidSchema,
  default_locale: z.string().min(2).max(16),
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string().min(1).max(80),
  markets: z.array(StoreMarketSchema).default([]),
  locales: z.array(StorefrontLocaleSchema).default([]),
  translations: z.array(StorefrontTranslationSchema).default([]),
  schema_ready: z.boolean().default(true),
  metadata: MetadataSchema.default({}),
});

export const StoreMetafieldOwnerTypeSchema = z.enum([
  'store',
  'product',
  'variant',
  'collection',
  'customer',
  'order',
  'page',
  'theme',
]);
export const StoreMetafieldValueTypeSchema = z.enum([
  'single_line_text',
  'multi_line_text',
  'number_integer',
  'number_decimal',
  'boolean',
  'json',
  'date',
  'url',
]);
export const StoreMetafieldJsonValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  JsonRecordSchema,
  z.array(z.unknown()),
]);

export const StoreMetafieldDefinitionSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  owner_type: StoreMetafieldOwnerTypeSchema,
  namespace: z.string().min(1).max(80).default('custom'),
  key: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  value_type: StoreMetafieldValueTypeSchema,
  validation_rules: MetadataSchema.default({}),
  is_required: z.boolean().default(false),
  is_public: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  metadata: MetadataSchema.default({}),
});

export const StoreMetafieldValueSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  definition_id: UuidSchema,
  owner_type: StoreMetafieldOwnerTypeSchema,
  owner_id: z.string().min(1).max(200),
  value: StoreMetafieldJsonValueSchema,
  metadata: MetadataSchema.default({}),
});

export const StoreMetafieldsSummarySchema = z.object({
  store_id: UuidSchema,
  owner_type: StoreMetafieldOwnerTypeSchema,
  owner_id: z.string().min(1).max(200),
  definitions: z.array(StoreMetafieldDefinitionSchema).default([]),
  values: z.array(StoreMetafieldValueSchema).default([]),
  schema_ready: z.boolean().default(true),
  metadata: MetadataSchema.default({}),
});

export const ProductOptionSchema = z.object({
  id: UuidSchema.optional(),
  product_id: UuidSchema.optional(),
  name: z.string().min(1).max(100),
  position: z.number().int().min(0).default(0),
  values: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const VariantSchema = AuditedEntitySchema.extend({
  product_id: UuidSchema,
  title: z.string().min(1).max(200),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  price: MoneySchema.optional().nullable(),
  compare_price: MoneySchema.optional().nullable(),
  cost_price: MoneySchema.optional().nullable(),
  stock: z.number().int().min(0).default(0),
  inventory_quantity: z.number().int().min(0).default(0),
  options: z.record(z.string(), z.string()).default({}),
  image_url: UrlSchema.optional().nullable(),
  weight: z.number().min(0).optional().nullable(),
  weight_unit: z.string().max(20).default('kg'),
});

export const ProductSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  version: z.number().int().positive(),
  name: z.string().min(1).max(256),
  slug: SlugSchema,
  description: z.string().max(10000).optional().nullable(),
  status: ProductStatusSchema.default('draft'),
  price: MoneySchema,
  compare_price: MoneySchema.optional().nullable(),
  cost_price: MoneySchema.optional().nullable(),
  currency: CurrencySchema,
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  stock: z.number().int().min(0).default(0),
  track_inventory: z.boolean().default(true),
  inventory_policy: InventoryPolicySchema.default('deny'),
  images: z.array(UrlSchema).max(50).default([]),
  category: z.string().max(100).optional().nullable(),
  product_type: z.string().max(100).optional().nullable(),
  vendor: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).max(50).default([]),
  options: z.array(ProductOptionSchema).max(10).default([]),
  variants: z.array(VariantSchema).max(250).default([]),
  is_active: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  is_physical: z.boolean().default(true),
  charge_tax: z.boolean().default(true),
  hs_code: z.string().max(30).optional().nullable(),
  hsn_code: HsnCodeSchema.optional().nullable(),
  country_of_origin: z.string().trim().max(100).optional().nullable(),
  importer_details: z.string().trim().max(1000).optional().nullable(),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const ProductBarcodeLookupSchema = z.object({
  store_id: UuidSchema,
  barcode: z.string().min(1).max(100),
  product: ProductSchema,
  variant: VariantSchema.optional().nullable(),
  matched_field: z.enum(['product.barcode', 'variant.barcode']),
}).strict();

export const ProductCategorySchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  name: z.string().min(1).max(100),
  slug: SlugSchema,
  description: z.string().max(500).optional().nullable(),
  image_url: UrlSchema.optional().nullable(),
  parent_id: UuidSchema.optional().nullable(),
  display_order: z.number().int().min(0).default(0),
  is_visible: z.boolean().default(true),
  level: z.number().int().min(0).default(0),
  path: z.string().max(500).optional().nullable(),
  products_count: z.number().int().min(0).optional(),
  children: z.array(z.unknown()).optional(),
});

export const CollectionRuleSchema = z.object({
  field: z.string().min(1).max(80),
  relation: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const CollectionSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  title: z.string().min(1).max(160),
  slug: SlugSchema,
  description: z.string().max(1000).optional().nullable(),
  image_url: UrlSchema.optional().nullable(),
  status: CollectionStatusSchema.default('draft'),
  is_manual: z.boolean().default(true),
  sort_order: z.enum(['manual', 'best_selling', 'title_asc', 'title_desc', 'price_asc', 'price_desc', 'created_desc']).default('manual'),
  product_ids: z.array(UuidSchema).max(1000).default([]),
  rules: z.array(CollectionRuleSchema).max(50).default([]),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
});

// Complete manual membership and an explicit ordered replacement intent. These
// contracts do not change the metadata Collection shape or public projections.
export const CollectionMembershipProductSchema = ProductSchema.pick({id: true, name: true, price: true, is_active: true}).extend({
  thumbnail_url: UrlSchema.optional().nullable(),
});
export const CollectionMembershipIdsSchema = z.array(UuidSchema).max(500).refine(ids => new Set(ids).size === ids.length, 'Product IDs must be unique');
export const ReplaceCollectionMembershipSchema = z.object({
  product_ids: CollectionMembershipIdsSchema,
  expected_version: z.number().int().positive(),
  idempotency_key: UuidSchema,
}).strict();
export const CollectionMembershipSnapshotSchema = z.object({
  collection_id: UuidSchema,
  store_id: UuidSchema,
  membership_version: z.number().int().positive(),
  product_ids: CollectionMembershipIdsSchema,
  products: z.array(CollectionMembershipProductSchema).max(500),
  unavailable_product_ids: CollectionMembershipIdsSchema,
}).strict().superRefine((data, ctx) => {
  const ids = new Set(data.product_ids), products = new Set<string>();
  for (const product of data.products) {
    if (!ids.has(product.id) || products.has(product.id)) ctx.addIssue({code: 'custom', path: ['products'], message: 'Products must belong to the loaded membership'});
    products.add(product.id);
  }
  for (const id of data.unavailable_product_ids) {
    if (!ids.has(id) || products.has(id)) ctx.addIssue({code: 'custom', path: ['unavailable_product_ids'], message: 'Unavailable products must be an explicit disjoint part of membership'});
  }
  if (products.size + data.unavailable_product_ids.length !== ids.size) ctx.addIssue({code: 'custom', path: ['products'], message: 'Every assigned ID must have a product or an explicit unavailable representation'});
});
export type ReplaceCollectionMembershipInput = z.infer<typeof ReplaceCollectionMembershipSchema>;
export type CollectionMembershipSnapshot = z.infer<typeof CollectionMembershipSnapshotSchema>;

export const GiftCardSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  code: z.string().min(4).max(80),
  initial_value: MoneySchema,
  balance: MoneySchema,
  currency: CurrencySchema,
  status: GiftCardStatusSchema.default('active'),
  expires_at: z.string().datetime().optional().nullable(),
  redeemed_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const ProductReviewSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  product_id: UuidSchema.optional().nullable(),
  product_name: z.string().max(256).optional().nullable(),
  customer_id: UuidSchema.optional().nullable(),
  customer_name: z.string().max(200).optional().nullable(),
  customer_email: z.string().max(320).optional().nullable(),
  rating: z.number().int().min(1).max(5).default(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().max(10000).optional().nullable(),
  images: z.array(UrlSchema).max(20).default([]),
  is_verified: z.boolean().default(false),
  is_approved: z.boolean().default(false),
  helpful_count: z.number().int().min(0).default(0),
  status: ReviewModerationStatusSchema.default('pending'),
  merchant_reply: z.string().max(1000).optional().nullable(),
  merchant_reply_by: UuidSchema.optional().nullable(),
  merchant_reply_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const InventoryLevelSchema = z.object({
  id: z.string().min(1),
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  location_id: UuidSchema.optional().nullable(),
  product_name: z.string().min(1).max(256),
  variant_title: z.string().max(200).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  images: z.array(UrlSchema).default([]),
  location_name: z.string().max(200),
  available: z.number().int(),
  reserved: z.number().int(),
  incoming: z.number().int(),
  on_hand: z.number().int(),
  sellable: z.number().int(),
  track_inventory: z.boolean(),
  updated_at: z.string().datetime().optional().nullable(),
});

export const CustomerAddressSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  customer_id: UuidSchema.optional().nullable(),
  full_name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().nullable(),
  address_line1: z.string().min(1).max(500),
  address_line2: z.string().max(500).optional().nullable(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  state_code: IndianStateCodeSchema.optional().nullable(),
  postal_code: z.string().min(3).max(20),
  country: z.string().length(2).toUpperCase().default('IN'),
  gstin: GstinSchema.optional().nullable(),
  landmark: z.string().max(255).optional().nullable(),
  label: z.string().max(50).optional().nullable(),
  is_default: z.boolean().default(false),
});

export const CustomerSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  email: EmailSchema.optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  gstin: GstinSchema.optional().nullable(),
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
  display_name: z.string().max(200).optional().nullable(),
  status: CustomerStatusSchema.default('active'),
  accepts_marketing: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(50).default([]),
  notes: z.string().max(2000).optional().nullable(),
  default_address_id: UuidSchema.optional().nullable(),
  addresses: z.array(CustomerAddressSchema).default([]),
  order_count: z.number().int().min(0).default(0),
  total_spent: MoneySchema.default(0),
  last_order_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const CustomerNoteSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  customer_email: EmailSchema,
  note: z.string().min(1).max(2000),
});

export const WhatsAppTemplateKeySchema = z.enum([
  'order_update',
  'order_paid',
  'order_shipped',
  'order_delivered',
  'shipping_update',
  'cod_confirmation',
  'abandoned_cart',
  'custom_message',
]);
export const WhatsAppMessageDirectionSchema = z.enum(['outbound', 'inbound']);
export const WhatsAppMessageStatusSchema = z.enum(['queued', 'sent', 'delivered', 'read', 'failed', 'received']);

export const WhatsAppTemplateSchema = z.object({
  key: WhatsAppTemplateKeySchema,
  label: z.string().min(1).max(120),
  description: z.string().max(500),
  required_variables: z.array(z.string().min(1).max(80)).default([]),
}).passthrough();

export const WhatsAppMessageSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  customer_email: EmailSchema.optional().nullable(),
  customer_phone: z.string().min(5).max(40),
  direction: WhatsAppMessageDirectionSchema,
  template: WhatsAppTemplateKeySchema.optional().nullable(),
  message: z.string().min(1).max(2000),
  provider: z.string().min(1).max(80),
  provider_message_id: z.string().max(200).optional().nullable(),
  status: WhatsAppMessageStatusSchema.default('queued'),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const WhatsAppCapabilitySchema = z.object({
  store_id: UuidSchema,
  available: z.boolean(),
  provider: z.string().min(1).max(80),
  provider_mode: z.enum(['sandbox', 'live']).or(z.string().min(1).max(40)),
  unavailable_reason: z.string().max(500).optional().nullable(),
  templates: z.array(WhatsAppTemplateSchema).default([]),
}).passthrough();

export const WhatsAppSendInputSchema = z.object({
  store_id: UuidSchema,
  customer_email: EmailSchema.optional().nullable(),
  customer_phone: z.string().min(5).max(40).optional().nullable(),
  template: WhatsAppTemplateKeySchema,
  variables: MetadataSchema.default({}),
  message: z.string().min(1).max(1200).optional().nullable(),
  idempotency_key: z.string().min(8).max(160).optional().nullable(),
}).passthrough();

export const WhatsAppSendResultSchema = z.object({
  message: WhatsAppMessageSchema,
  provider_message_id: z.string().min(1).max(200),
  status: WhatsAppMessageStatusSchema,
  sandbox: z.boolean().default(false),
}).passthrough();

export const CustomerSegmentRulesSchema = z
  .object({
    status: CustomerStatusSchema.optional().nullable(),
    accepts_marketing: z.boolean().optional().nullable(),
    tags_any: z.array(z.string().min(1).max(50).trim()).max(20).default([]),
    min_order_count: z.number().int().min(0).optional().nullable(),
    min_total_spent: MoneySchema.optional().nullable(),
    last_order_after: z.string().datetime().optional().nullable(),
    last_order_before: z.string().datetime().optional().nullable(),
  })
  .default({ tags_any: [] });

export const CustomerSegmentSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  rules: CustomerSegmentRulesSchema,
  customer_count: z.number().int().min(0).default(0),
});

export const CustomerSegmentPreviewSchema = z.object({
  store_id: UuidSchema,
  rules: CustomerSegmentRulesSchema,
  customer_count: z.number().int().min(0),
  sample_customers: z.array(CustomerSchema).default([]),
});

export const MarketingEmailCampaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'sending',
  'sent',
  'failed',
  'cancelled',
]);

export const MarketingEmailAudienceTypeSchema = z.enum([
  'all_marketing',
  'segment',
  'manual',
]);

export const MarketingEmailDeliveryModeSchema = z.enum(['sandbox', 'live']);

export const MarketingEmailRecipientStatusSchema = z.enum([
  'queued',
  'sandbox_sent',
  'sent',
  'failed',
  'skipped',
]);

export const MarketingEmailAudienceSchema = z.object({
  type: MarketingEmailAudienceTypeSchema.default('all_marketing'),
  segment_id: UuidSchema.optional().nullable(),
  rules: CustomerSegmentRulesSchema.optional().nullable(),
  recipients: z.array(EmailSchema).max(500).default([]),
}).passthrough();

export const MarketingEmailCampaignSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  name: z.string().min(1).max(160),
  subject: z.string().min(1).max(180),
  preview_text: z.string().max(240).optional().nullable(),
  body_text: z.string().min(1).max(20000),
  body_html: z.string().max(50000).optional().nullable(),
  status: MarketingEmailCampaignStatusSchema.default('draft'),
  audience_type: MarketingEmailAudienceTypeSchema.default('all_marketing'),
  audience_segment_id: UuidSchema.optional().nullable(),
  audience_rules: CustomerSegmentRulesSchema.default({ tags_any: [] }),
  manual_recipients: z.array(EmailSchema).max(500).default([]),
  recipient_count: z.number().int().min(0).default(0),
  sent_count: z.number().int().min(0).default(0),
  failed_count: z.number().int().min(0).default(0),
  delivery_mode: MarketingEmailDeliveryModeSchema.default('sandbox'),
  provider: z.string().min(1).max(120).default('letbuyy_sandbox'),
  last_send_idempotency_key: z.string().max(200).optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
  sent_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const MarketingEmailRecipientSchema = z.object({
  id: UuidSchema,
  campaign_id: UuidSchema,
  store_id: UuidSchema,
  customer_email: EmailSchema,
  customer_id: UuidSchema.optional().nullable(),
  status: MarketingEmailRecipientStatusSchema.default('queued'),
  provider: z.string().min(1).max(120).default('letbuyy_sandbox'),
  provider_message_id: z.string().max(200).optional().nullable(),
  error_code: z.string().max(120).optional().nullable(),
  error_message: z.string().max(1000).optional().nullable(),
  sent_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const MarketingEmailAudiencePreviewSchema = z.object({
  store_id: UuidSchema,
  audience: MarketingEmailAudienceSchema,
  customer_count: z.number().int().min(0).default(0),
  sample_customers: z.array(CustomerSchema).max(20).default([]),
});

export const MarketingEmailSendResultSchema = z.object({
  campaign: MarketingEmailCampaignSchema,
  recipients: z.array(MarketingEmailRecipientSchema).default([]),
  delivery_mode: MarketingEmailDeliveryModeSchema,
  provider: z.string().min(1).max(120),
  sandbox: z.boolean().default(true),
  sent_count: z.number().int().min(0).default(0),
  failed_count: z.number().int().min(0).default(0),
}).passthrough();

export const CartLineSchema = z.object({
  id: z.string().min(1).max(120),
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  title: z.string().min(1).max(256),
  sku: z.string().max(100).optional().nullable(),
  image_url: UrlSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  unit_price: MoneySchema,
  compare_price: MoneySchema.optional().nullable(),
  currency: CurrencySchema,
  properties: MetadataSchema.default({}),
  line_total: MoneySchema,
});

export const CartSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  customer_id: UuidSchema.optional().nullable(),
  session_id: z.string().min(1).max(200).optional().nullable(),
  status: CartStatusSchema.default('active'),
  channel: CommerceChannelSchema,
  buyer_email: EmailSchema.optional().nullable(),
  currency: CurrencySchema,
  lines: z.array(CartLineSchema).max(250).default([]),
  subtotal: MoneySchema.default(0),
  discount_total: MoneySchema.default(0),
  shipping_total: MoneySchema.default(0),
  tax_total: MoneySchema.default(0),
  total: MoneySchema.default(0),
  coupon_codes: z.array(z.string().max(50)).max(20).default([]),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const LineItemSchema = z.object({
  id: UuidSchema.optional(),
  order_id: UuidSchema.optional(),
  product_id: UuidSchema.optional().nullable(),
  variant_id: UuidSchema.optional().nullable(),
  name: z.string().min(1).max(256),
  sku: z.string().max(100).optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  unit_price: MoneySchema,
  total: MoneySchema,
  currency: CurrencySchema,
  hsn_code: HsnCodeSchema.optional().nullable(),
  gst_rate: z.number().min(0).max(40).optional().nullable(),
  taxable_amount: MoneySchema.optional().nullable(),
  cgst_amount: MoneySchema.default(0).optional(),
  sgst_amount: MoneySchema.default(0).optional(),
  igst_amount: MoneySchema.default(0).optional(),
  image_url: UrlSchema.optional().nullable(),
  variant_title: z.string().max(200).optional().nullable(),
  properties: MetadataSchema.default({}),
});

export const DraftOrderLineSchema = z.object({
  id: UuidSchema.optional(),
  draft_order_id: UuidSchema.optional(),
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999),
});

export const GstInvoicePartySchema = z.object({
  name: z.string().min(1).max(200),
  gstin: GstinSchema.optional().nullable(),
  state: z.string().min(1).max(100).optional().nullable(),
  state_code: IndianStateCodeSchema,
  address: AddressSchema.partial().optional().nullable(),
}).passthrough();

export const GstInvoiceLineSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  product_id: UuidSchema.optional().nullable(),
  variant_id: UuidSchema.optional().nullable(),
  description: z.string().min(1).max(256),
  sku: z.string().max(100).optional().nullable(),
  hsn_code: HsnCodeSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  unit_amount_minor: z.number().int().min(0),
  discount_amount_minor: z.number().int().min(0).default(0),
  taxable_amount_minor: z.number().int().min(0),
  gst_rate_bps: z.number().int().min(0).max(4000),
  cgst_amount_minor: z.number().int().min(0).default(0),
  sgst_amount_minor: z.number().int().min(0).default(0),
  igst_amount_minor: z.number().int().min(0).default(0),
  tax_amount_minor: z.number().int().min(0),
  total_amount_minor: z.number().int().min(0),
}).strict();

export const GstInvoiceSchema = z.object({
  invoice_number: z.string().min(1).max(80),
  order_id: z.string().min(1).max(120),
  order_number: z.string().min(1).max(80),
  invoice_date: z.string().datetime(),
  currency: CurrencySchema,
  supplier: GstInvoicePartySchema,
  recipient: GstInvoicePartySchema,
  place_of_supply_state_code: IndianStateCodeSchema,
  supply_type: z.enum(['intra_state', 'inter_state']),
  lines: z.array(GstInvoiceLineSchema).min(1).max(250),
  taxable_amount_minor: z.number().int().min(0),
  cgst_amount_minor: z.number().int().min(0),
  sgst_amount_minor: z.number().int().min(0),
  igst_amount_minor: z.number().int().min(0),
  tax_amount_minor: z.number().int().min(0),
  total_amount_minor: z.number().int().min(0),
}).strict();

export const OrderSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  order_number: z.string().min(1).max(80),
  customer_id: UuidSchema.optional().nullable(),
  customer_email: EmailSchema.optional().nullable(),
  customer_phone: z.string().max(30).optional().nullable(),
  customer_name: z.string().max(200).optional().nullable(),
  customer_gstin: GstinSchema.optional().nullable(),
  status: OrderStatusSchema,
  payment_status: PaymentStatusSchema,
  fulfillment_status: FulfillmentStatusSchema,
  currency: CurrencySchema,
  subtotal: MoneySchema,
  discount_amount: MoneySchema.default(0),
  shipping_amount: MoneySchema.default(0),
  tax_amount: MoneySchema.default(0),
  total: MoneySchema,
  payment_method: PaymentMethodSchema.optional().nullable(),
  payment_provider: PaymentProviderSchema.optional().nullable(),
  payment_id: z.string().max(200).optional().nullable(),
  risk_score: z.number().int().min(0).max(100).optional().nullable(),
  risk_level: z.enum(['low', 'medium', 'high']).optional().nullable(),
  fulfillment_state: z.enum(['unfulfilled', 'hold', 'partial', 'fulfilled', 'delivered', 'returned', 'rto', 'cancelled']).optional().nullable(),
  cod_confirmation_status: z.enum(['not_required', 'requested', 'confirmed', 'rejected', 'expired']).optional().nullable(),
  rto_status: z.enum(['none', 'at_risk', 'in_transit', 'returned', 'resolved']).optional().nullable(),
  shipping_address: CustomerAddressSchema.partial().optional().nullable(),
  billing_address: CustomerAddressSchema.partial().optional().nullable(),
  place_of_supply_state: IndianStateCodeSchema.optional().nullable(),
  gst_invoice_number: z.string().max(80).optional().nullable(),
  gst_invoice: GstInvoiceSchema.optional().nullable(),
  shipping_method: z.string().max(100).optional().nullable(),
  tracking_number: z.string().max(100).optional().nullable(),
  tracking_url: UrlSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  coupon_code: z.string().max(50).optional().nullable(),
  idempotency_key: z.string().min(8).max(200).optional().nullable(),
  line_items: z.array(LineItemSchema).max(250).default([]),
  metadata: MetadataSchema.default({}),
});

export const DraftOrderSchema = AuditedEntitySchema.extend({
  site_id: UuidSchema,
  store_id: UuidSchema,
  customer_email: EmailSchema,
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(30).optional().nullable(),
  customer_gstin: GstinSchema.optional().nullable(),
  shipping_address: CustomerAddressSchema.partial().optional().nullable(),
  payment_method: PaymentMethodSchema.optional().nullable(),
  shipping_method: z.enum(['standard', 'express']).default('standard'),
  notes: z.string().max(2000).optional().nullable(),
  coupon_code: z.string().max(50).optional().nullable(),
  gift_card_code: z.string().max(100).optional().nullable(),
  status: DraftOrderStatusSchema,
  converted_order_id: UuidSchema.optional().nullable(),
  items: z.array(DraftOrderLineSchema).max(250).default([]),
  metadata: MetadataSchema.default({}),
});

export const PaymentSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  order_id: UuidSchema.optional().nullable(),
  customer_id: UuidSchema.optional().nullable(),
  provider: PaymentProviderSchema,
  method: PaymentMethodSchema,
  status: PaymentStatusSchema,
  currency: CurrencySchema,
  amount: MoneySchema,
  amount_minor: z.number().int().min(0),
  authorized_amount_minor: z.number().int().min(0).default(0),
  captured_amount_minor: z.number().int().min(0).default(0),
  refunded_amount_minor: z.number().int().min(0).default(0),
  provider_payment_id: z.string().max(200).optional().nullable(),
  provider_order_id: z.string().max(200).optional().nullable(),
  provider_signature: z.string().max(500).optional().nullable(),
  idempotency_key: z.string().min(8).max(200),
  failure_code: z.string().max(120).optional().nullable(),
  failure_message: z.string().max(500).optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const SubscriptionPlanSchema = z.object({
  id: UuidSchema.optional(),
  site_type: SiteTypeSchema.or(z.string().min(1)).default('store'),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  price_monthly_inr: z.number().min(0).default(0),
  price_yearly_inr: z.number().min(0).default(0),
  promo_price_inr: z.number().min(0).optional().nullable(),
  promo_months: z.number().int().min(0).optional().nullable(),
  promo_label: z.string().max(200).optional().nullable(),
  gmv_percentage: z.number().min(0).optional().nullable(),
  products_limit: z.number().int().min(0).optional().nullable(),
  orders_limit: z.number().int().min(0).optional().nullable(),
  storage_mb: z.number().int().min(0).optional().nullable(),
  staff_limit: z.number().int().min(0).optional().nullable(),
  ai_credits_monthly: z.number().int().min(0).optional().nullable(),
  requires_contact: z.boolean().default(false),
  trial_days: z.number().int().min(0).optional().nullable(),
  features: z.array(MetadataSchema).default([]),
  compare_features: z.array(MetadataSchema).default([]),
  limits: MetadataSchema.optional().nullable(),
  entitlements: MetadataSchema.optional().nullable(),
  razorpay_plan_id_monthly: z.string().max(200).optional().nullable(),
  razorpay_plan_id_yearly: z.string().max(200).optional().nullable(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().default(0),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const StoreSubscriptionSchema = z.object({
  id: UuidSchema.optional(),
  plan: z.string().min(1).max(120),
  status: SubscriptionStatusSchema.or(z.string().min(1).max(80)),
  billing_period: SubscriptionBillingPeriodSchema.or(z.string().min(1).max(80)).optional().nullable(),
  current_period_start: z.string().datetime().optional().nullable(),
  current_period_end: z.string().datetime().optional().nullable(),
  promo_ends_at: z.string().datetime().optional().nullable(),
  amount_paid: z.number().min(0).optional().nullable(),
  cancelled_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const StoreSubscriptionStateSchema = z.object({
  store: z.object({
    id: UuidSchema,
    trial_status: z.string().max(80).optional().nullable(),
    trial_ends_at: z.string().datetime().optional().nullable(),
    site_type: SiteTypeSchema.or(z.string().min(1)).default('store'),
  }).passthrough(),
  subscription: StoreSubscriptionSchema.nullable(),
}).passthrough();

// Public subscription money summary. Private supplier/recipient/source facts stay
// in the canonical Billing snapshot and never enter browser retry storage.
export const SubscriptionTaxSummarySchema=z.object({
  schema_version:z.literal(1),policy_version:z.literal('D-SUB-TAX-INCLUSIVE-V1'),basis:z.literal('inclusive'),currency:z.literal('INR'),
  supply_type:z.enum(['intra_state','inter_state']),
  gross_minor:z.number().int().safe().min(1).max(2147483647),taxable_minor:z.number().int().safe().min(0).max(2147483647),
  tax_minor:z.number().int().safe().min(0).max(2147483647),cgst_minor:z.number().int().safe().min(0).max(2147483647),
  sgst_minor:z.number().int().safe().min(0).max(2147483647),igst_minor:z.number().int().safe().min(0).max(2147483647),
}).strict().refine(s=>s.taxable_minor+s.tax_minor===s.gross_minor && s.cgst_minor+s.sgst_minor+s.igst_minor===s.tax_minor
  && (s.supply_type==='intra_state'?s.igst_minor===0&&s.cgst_minor===Math.floor(s.tax_minor/2)&&s.sgst_minor===s.tax_minor-s.cgst_minor:s.cgst_minor===0&&s.sgst_minor===0&&s.igst_minor===s.tax_minor),
  'Subscription tax summary does not conserve gross');
export type SubscriptionTaxSummary=z.infer<typeof SubscriptionTaxSummarySchema>;

export const BillingHistoryItemSchema = z.object({
  tax:SubscriptionTaxSummarySchema.optional().nullable(),
  id: UuidSchema,
  amount_paid: z.number().min(0).optional().nullable(),
  status: z.string().max(80).optional().nullable(),
  billing_period: SubscriptionBillingPeriodSchema.or(z.string().min(1).max(80)).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const SubscriptionCancelResultSchema = z.object({
  cancelled: z.boolean(),
  subscriptions: z.array(StoreSubscriptionSchema).default([]),
}).passthrough();

export const SubscriptionOrderResultSchema = z.object({
  tax:SubscriptionTaxSummarySchema.optional(),
  razorpay_order_id: z.string().min(1).optional().nullable(),
  razorpay_subscription_id: z.string().min(1).optional().nullable(),
  checkout_mode: z.enum(['free_activation', 'razorpay_order', 'razorpay_subscription']).default('razorpay_order'),
  amount: z.number().min(0),
  currency: CurrencySchema,
  key_id: z.string().min(1).optional().nullable(),
  plan: SubscriptionPlanSchema.partial().passthrough(),
  billing_period: SubscriptionBillingPeriodSchema,
  is_promo: z.boolean().default(false),
  recurring: z.boolean().default(false),
  activated: z.boolean().default(false),
  subscription: StoreSubscriptionSchema.extend({
    plan_name: z.string().max(200).optional().nullable(),
  }).optional().nullable(),
  short_url: UrlSchema.optional().nullable(),
}).passthrough();

export const SubscriptionRecoveryResultSchema = SubscriptionOrderResultSchema.extend({
  recovery: z.object({
    subscription_id: UuidSchema.or(z.string().min(1).max(120)),
    previous_status: z.string().min(1).max(80),
    plan_slug: z.string().min(1).max(120),
    next_step: z.enum(['checkout', 'activated']),
  }).passthrough(),
}).passthrough();

export const SubscriptionVerificationResultSchema = z.object({
  subscription: StoreSubscriptionSchema.extend({
    plan_name: z.string().max(200).optional().nullable(),
  }).passthrough(),
  message: z.string().max(500).optional(),
}).passthrough();

export const StorePaymentSettingsSchema = z.object({
  mode: z.enum(['shared', 'ownAccount']).default('shared'),
  gateways: z.array(z.string().min(1).max(80)).default(['razorpay']),
  razorpay: z.object({
    key_id: z.string().max(120).optional().nullable(),
    test_mode: z.boolean().default(true),
    verified: z.boolean().default(false),
    connected_at: z.string().datetime().optional().nullable(),
    updated_at: z.string().datetime().optional().nullable(),
    secret_configured: z.boolean().default(false),
  }).nullable().default(null),
}).passthrough();

export const StorePaymentConfigSchema = z.object({
  store_id: UuidSchema,
  online_payment_enabled: z.boolean().default(true),
  cod_enabled: z.boolean().default(true),
  provider_mode: z.enum(['sandbox', 'live']).default('sandbox'),
  payment_settings: StorePaymentSettingsSchema,
  schema_ready: z.boolean().optional(),
}).passthrough();

export const EmployeeStatusSchema = z.enum(['invited', 'active', 'inactive', 'removed', 'suspended']);

export const EmployeeSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  user_id: UuidSchema.optional().nullable(),
  email: EmailSchema,
  full_name: z.string().max(200).optional().nullable(),
  role: z.string().min(1).max(80).default('staff'),
  status: EmployeeStatusSchema.default('invited'),
  is_active: z.boolean().default(true),
  permissions: MetadataSchema.default({}),
  invited_by: UuidSchema.optional().nullable(),
  accepted_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MediaAssetSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  uploaded_by: UuidSchema.optional().nullable(),
  filename: z.string().min(1).max(500),
  original_name: z.string().max(500).optional().nullable(),
  url: z.string().min(1).max(200000),
  thumbnail_url: z.string().max(200000).optional().nullable(),
  mime_type: z.string().min(1).max(255),
  size_bytes: z.number().int().min(0).default(0),
  width: z.number().int().min(0).optional().nullable(),
  height: z.number().int().min(0).optional().nullable(),
  alt_text: z.string().max(500).optional().nullable(),
  caption: z.string().max(1000).optional().nullable(),
  folder: z.string().max(200).default('/'),
  media_type: MediaTypeSchema.default('other'),
  tags: z.array(z.string().max(50)).default([]),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const FileUploadResultSchema = z.object({
  url: z.string().min(1).max(200000),
  key: z.string().min(1).max(1000),
  size: z.number().int().min(0),
  content_type: z.string().max(255).optional().nullable(),
  media_type: MediaTypeSchema.optional().nullable(),
  storage: z.string().max(120).optional().nullable(),
}).passthrough();

export const AnalyticsMetricSchema = z.object({
  value: z.number().default(0),
  change_pct: z.number().default(0),
  prev: z.number().default(0),
}).passthrough();

export const AnalyticsPeriodWindowSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().max(80).optional(),
}).passthrough();

export const AnalyticsComparisonSchema = z.object({
  previous_period: AnalyticsPeriodWindowSchema,
  revenue: AnalyticsMetricSchema,
  orders: AnalyticsMetricSchema,
  average_order_value: AnalyticsMetricSchema,
}).passthrough();

export const AnalyticsDashboardSchema = z.object({
  period: z.string().default('30d'),
  summary: z.object({
    revenue: AnalyticsMetricSchema,
    orders: AnalyticsMetricSchema,
    products: z.number().int().min(0).default(0),
    customers: z.number().int().min(0).default(0),
    avg_order_value: z.number().min(0).default(0),
  }).passthrough(),
  comparison: AnalyticsComparisonSchema.optional(),
}).passthrough();

export const AnalyticsRevenuePointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revenue: z.number().min(0).default(0),
  orders: z.number().min(0).default(0),
}).passthrough();

export const AnalyticsRevenueSchema = z.object({
  period: z.string().default('30d'),
  chart: z.array(AnalyticsRevenuePointSchema).default([]),
  comparison: z.object({
    previous_period: AnalyticsPeriodWindowSchema,
    chart: z.array(AnalyticsRevenuePointSchema).default([]),
  }).passthrough().optional(),
}).passthrough();

export const AnalyticsOrdersBreakdownSchema = z.object({
  breakdown: z.record(z.string(), z.number().int().min(0)).default({}),
  total: z.number().int().min(0).default(0),
}).passthrough();

export const AnalyticsLiveViewEntrySchema = z.object({
  label: z.string().min(1).max(240),
  value: z.number().min(0).default(0),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
}).passthrough();

export const AnalyticsLiveViewSignalSchema = z.object({
  metric_name: z.string().min(1).max(160),
  label: z.string().min(1).max(240),
  value: z.number().min(0).default(0),
  seen_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AnalyticsLiveViewSchema = z.object({
  store_id: UuidSchema,
  available: z.boolean().default(false),
  window_minutes: z.number().int().min(1).max(120).default(15),
  active_sessions: z.number().int().min(0).default(0),
  visitors: z.number().int().min(0).default(0),
  page_views: z.number().int().min(0).default(0),
  cart_adds: z.number().int().min(0).default(0),
  checkouts_started: z.number().int().min(0).default(0),
  top_pages: z.array(AnalyticsLiveViewEntrySchema).default([]),
  traffic_sources: z.array(AnalyticsLiveViewEntrySchema).default([]),
  devices: z.array(AnalyticsLiveViewEntrySchema).default([]),
  countries: z.array(AnalyticsLiveViewEntrySchema).default([]),
  recent_signals: z.array(AnalyticsLiveViewSignalSchema).default([]),
  generated_at: z.string().datetime(),
  last_seen_at: z.string().datetime().optional().nullable(),
  refresh_after_seconds: z.number().int().min(10).max(300).default(30),
  pipeline: z.object({
    status: z.enum(['ready', 'waiting_for_events']),
    source: z.string().min(1).max(160),
    message: z.string().max(500).optional().nullable(),
  }).passthrough(),
}).passthrough();

export const StorefrontAnalyticsEventTypeSchema = z.enum([
  'session_started',
  'page_view',
  'product_view',
  'cart_add',
  'checkout_started',
]);

export const StorefrontAnalyticsBeaconSchema = z.object({
  event_id: UuidSchema.optional(),
  event_type: StorefrontAnalyticsEventTypeSchema.default('page_view'),
  session_id: z.string().trim().min(1).max(160),
  visitor_id: z.string().trim().min(1).max(160).optional().nullable(),
  path: z.string().trim().min(1).max(1000).optional().nullable(),
  page_title: z.string().trim().max(240).optional().nullable(),
  referrer: z.string().trim().max(2000).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
  medium: z.string().trim().max(120).optional().nullable(),
  campaign: z.string().trim().max(200).optional().nullable(),
  product_id: UuidSchema.optional().nullable(),
  product_slug: z.string().trim().max(180).optional().nullable(),
  cart_id: UuidSchema.optional().nullable(),
  checkout_id: UuidSchema.optional().nullable(),
  device: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).optional(),
  country: z.string().trim().min(2).max(2).optional().nullable(),
  occurred_at: z.string().datetime().optional(),
}).passthrough();

export const StorefrontAnalyticsBeaconResultSchema = z.object({
  accepted: z.boolean(),
  queued: z.boolean(),
  sampled: z.boolean(),
  event_id: UuidSchema,
  store_id: UuidSchema,
  source: z.string().min(1).max(120),
  generated_at: z.string().datetime(),
}).passthrough();

export const AnalyticsTrafficSourceEntrySchema = z.object({
  label: z.string().min(1).max(240),
  value: z.number().min(0).default(0),
  percentage: z.number().min(0).max(100).default(0),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
}).passthrough();

export const AnalyticsTrafficSourcesSchema = z.object({
  store_id: UuidSchema,
  period: z.string().default('30d'),
  available: z.boolean().default(false),
  total_sessions: z.number().int().min(0).default(0),
  total_page_views: z.number().int().min(0).default(0),
  sources: z.array(AnalyticsTrafficSourceEntrySchema).default([]),
  generated_at: z.string().datetime(),
  pipeline: z.object({
    status: z.enum(['ready', 'waiting_for_events']),
    source: z.string().min(1).max(160),
    message: z.string().max(500).optional().nullable(),
  }).passthrough(),
}).passthrough();

export const AICreditBalanceSchema = z.object({
  store_id: UuidSchema,
  balance: z.number().int().min(0).default(0),
  plan_credits: z.number().int().min(0).default(0),
  bonus_credits: z.number().int().min(0).default(0),
  total_used: z.number().int().min(0).default(0),
  total_purchased: z.number().int().min(0).default(0),
  purchase_available: z.boolean().default(false),
  purchase_mode: z.enum(['sandbox', 'live']).optional().nullable(),
  purchase_provider: z.string().max(120).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AICreditPurchaseSchema = z.object({
  id: z.string().min(1),
  store_id: UuidSchema,
  status: z.enum(['completed', 'pending_provider_payment', 'unavailable']),
  provider: z.string().max(120),
  provider_mode: z.enum(['sandbox', 'live']),
  credits: z.number().int().min(1),
  amount_minor: z.number().int().min(0),
  currency: z.string().length(3),
  provider_reference: z.string().optional().nullable(),
  checkout_url: z.string().url().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  metadata: JsonRecordSchema.optional().nullable(),
}).passthrough();

export const AIUsageRecordSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  user_id: UuidSchema.optional().nullable(),
  feature: z.string().min(1).max(120),
  prompt: z.string().max(20000).optional().nullable(),
  output: z.string().max(200000).optional().nullable(),
  tokens_input: z.number().int().min(0).default(0),
  tokens_output: z.number().int().min(0).default(0),
  credits_used: z.number().int().min(0).default(0),
  model: z.string().max(120).optional().nullable(),
  provider: z.string().max(120).optional().nullable(),
  latency_ms: z.number().int().min(0).optional().nullable(),
  status: AIGenerationStatusSchema.or(z.string().min(1).max(80)).default('completed'),
  error_message: z.string().max(1000).optional().nullable(),
  user_rating: z.number().int().min(1).max(5).optional().nullable(),
  user_feedback: z.string().max(2000).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AIOperatorToolSchema = z.enum([
  'answer_metrics',
  'create_product',
  'draft_discount',
  'draft_homepage_section',
]);

export const AIOperatorToolStatusSchema = z.enum([
  'ready',
  'completed',
  'requires_confirmation',
  'unavailable',
]);

export const AIOperatorRequestSchema = z.object({
  store_id: UuidSchema,
  message: z.string().min(2).max(2000),
  conversation_id: UuidSchema.optional().nullable(),
  execute: z.boolean().default(true),
  context: JsonRecordSchema.default({}),
}).passthrough();

export const AIOperatorToolCallSchema = z.object({
  id: z.string().min(1).max(120),
  tool: AIOperatorToolSchema,
  label: z.string().min(1).max(160),
  status: AIOperatorToolStatusSchema,
  summary: z.string().min(1).max(1000),
  payload: JsonRecordSchema.default({}),
  result: JsonRecordSchema.optional().nullable(),
}).passthrough();

export const AIOperatorResponseSchema = z.object({
  store_id: UuidSchema,
  conversation_id: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  tool_calls: z.array(AIOperatorToolCallSchema).max(10).default([]),
  created_at: z.string().datetime(),
}).passthrough();

export const AIHomepageGenerationRequestSchema = z.object({
  store_id: UuidSchema,
  prompt: z.string().trim().min(8).max(2000),
  theme_slug: z.string().trim().min(1).max(120).optional().nullable(),
  section_count: z.number().int().min(1).max(5).default(3),
  locale: z.string().trim().min(2).max(12).default('en'),
  template_config: JsonRecordSchema.default({}),
}).passthrough();

export const AIHomepageDraftSectionSchema = z.object({
  id: z.string().min(1).max(160),
  type: z.string().min(1).max(80),
  order: z.number().int().min(0),
  visible: z.boolean().default(true),
  settings: JsonRecordSchema.default({}),
  blocks: z.array(JsonRecordSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).passthrough();

export const AIHomepageGenerationResultSchema = z.object({
  store_id: UuidSchema,
  theme_slug: z.string().min(1).max(120),
  prompt: z.string().min(1).max(2000),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  template_config: JsonRecordSchema,
  sections: z.array(AIHomepageDraftSectionSchema).min(1).max(8),
  usage: AIUsageRecordSchema.optional().nullable(),
  generated_at: z.string().datetime(),
  provider: z.string().max(120).optional().nullable(),
  provider_mode: z.enum(['sandbox', 'live']).optional().nullable(),
  model: z.string().max(160).optional().nullable(),
}).passthrough();

export const CouponSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  code: z.string().min(3).max(50),
  description: z.string().max(500).optional().nullable(),
  type: DiscountTypeSchema,
  value: z.number().min(0),
  currency: CurrencySchema.optional(),
  minimum_order_amount: MoneySchema.optional().nullable(),
  maximum_discount: MoneySchema.optional().nullable(),
  usage_limit: z.number().int().min(1).optional().nullable(),
  used_count: z.number().int().min(0).default(0),
  per_customer_limit: z.number().int().min(1).default(1),
  applicable_product_ids: z.array(UuidSchema).max(1000).default([]),
  applicable_collection_ids: z.array(UuidSchema).max(1000).default([]),
  starts_at: z.string().datetime().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  is_active: z.boolean().default(true),
});

export const ShippingZoneSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  name: z.string().min(1).max(100),
  countries: z.array(z.string().min(2).max(100)).default([]),
  states: z.array(z.string().max(100)).default([]),
  zip_codes: z.array(z.string().max(20)).default([]),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const ShippingRateSchema = z.object({
  id: UuidSchema,
  zone_id: UuidSchema,
  name: z.string().min(1).max(100),
  type: ShippingRateTypeSchema.default('flat'),
  price: MoneySchema.default(0),
  min_weight_grams: z.number().int().min(0).optional().nullable(),
  max_weight_grams: z.number().int().min(0).optional().nullable(),
  min_order_amount: MoneySchema.optional().nullable(),
  max_order_amount: MoneySchema.optional().nullable(),
  estimated_days_min: z.number().int().min(0).optional().nullable(),
  estimated_days_max: z.number().int().min(0).optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const TaxRateSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  name: z.string().min(1).max(100),
  rate: z.number().min(0).max(100),
  country: z.string().length(2).default('IN'),
  state: z.string().max(100).optional().nullable(),
  hsn_code: z.string().max(20).optional().nullable(),
  applies_to: TaxAppliesToSchema.default('all'),
  is_compound: z.boolean().default(false),
  is_shipping: z.boolean().default(false),
  priority: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const PageSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  title: z.string().min(1).max(300),
  slug: SlugSchema,
  body: z.string().max(200000).default(''),
  body_html: z.string().max(250000).optional().nullable(),
  page_type: z.string().min(1).max(50).default('custom'),
  status: PageStatusSchema.default('draft'),
  show_in_nav: z.boolean().default(false),
  display_order: z.number().int().min(0).default(0),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
});

export const PolicySchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  policy_type: PolicyTypeSchema,
  slug: SlugSchema,
  title: z.string().min(1).max(300),
  body: z.string().max(200000).default(''),
  content: MetadataSchema.default({}),
  status: PageStatusSchema.default('draft'),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const NavigationMenuSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  handle: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  location: z.string().min(1).max(40),
}).passthrough();

export const NavigationItemSchema = z.object({
  id: UuidSchema,
  menu_id: UuidSchema,
  store_id: UuidSchema,
  parent_item_id: UuidSchema.optional().nullable(),
  label: z.string().min(1).max(160),
  url: z.string().min(1).max(500).default('#'),
  target_type: z.string().min(1).max(40).default('url'),
  target_resource_id: z.string().max(120).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
  is_visible: z.boolean().default(true),
  open_in_new_tab: z.boolean().default(false),
  metadata: MetadataSchema.default({}),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const NavigationResponseSchema = z.object({
  menu: NavigationMenuSchema.nullable(),
  items: z.array(NavigationItemSchema).default([]),
});

export const ReplaceNavigationResultSchema = z.object({
  replaced: z.boolean(),
  menu_id: UuidSchema,
  count: z.number().int().min(0),
});

export const BlogPostSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  author_id: UuidSchema.optional().nullable(),
  title: z.string().min(1).max(300),
  slug: SlugSchema,
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().max(100000).default(''),
  content_html: z.string().max(150000).optional().nullable(),
  featured_image: UrlSchema.optional().nullable(),
  category_id: UuidSchema.optional().nullable(),
  status: BlogPostStatusSchema.default('draft'),
  scheduled_at: z.string().datetime().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  og_image_url: UrlSchema.optional().nullable(),
  allow_comments: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
  reading_time_min: z.number().int().min(0).max(1000).optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const BlogCommentSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  post_id: UuidSchema.optional().nullable(),
  post_title: z.string().max(300).optional().nullable(),
  author_name: z.string().max(200).optional().nullable(),
  author_email: z.string().email().max(320).optional().nullable(),
  author_avatar: UrlSchema.optional().nullable(),
  content: z.string().max(10000).default(''),
  body: z.string().max(10000).optional().nullable(),
  status: BlogCommentStatusSchema.default('pending'),
  moderated_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const FormSubmissionSchema = AuditedEntitySchema.extend({
  store_id: UuidSchema,
  form_type: z.string().max(80).optional().nullable(),
  form_name: z.string().max(160).optional().nullable(),
  data: MetadataSchema.default({}),
  source_url: z.string().max(2000).optional().nullable(),
  status: FormSubmissionStatusSchema.default('new'),
  read_at: z.string().datetime().optional().nullable(),
  replied_at: z.string().datetime().optional().nullable(),
  internal_notes: z.string().max(5000).optional().nullable(),
  full_name: z.string().max(200).optional().nullable(),
  email: z.string().max(320).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  subject: z.string().max(300).optional().nullable(),
  message: z.string().max(10000).optional().nullable(),
  source: z.string().max(2000).optional().nullable(),
}).passthrough();

export const ResumeContentItemSchema = z.object({
  id: UuidSchema,
  store_id: UuidSchema,
  display_order: z.number().int().min(0).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const ThemeSettingFieldSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(['text', 'textarea', 'number', 'range', 'checkbox', 'select', 'color', 'image', 'url', 'font']),
  label: z.string().min(1).max(160),
  default: z.unknown().optional(),
  options: z.array(z.object({
    label: z.string().min(1).max(160),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  help_text: z.string().max(300).optional(),
});

export const ThemeSettingsSchema = z.object({
  primaryColor: z.string().default('#00B3B3'),
  secondaryColor: z.string().default('#008080'),
  accentColor: z.string().default('#A4E500'),
  backgroundColor: z.string().default('#FFFFFF'),
  textColor: z.string().default('#1A1A2E'),
  fontFamily: z.string().default('Inter'),
  headingFontFamily: z.string().default('Inter'),
  borderRadius: z.number().min(0).max(64).default(12),
  enableAnimations: z.boolean().default(true),
  enableShadows: z.boolean().default(true),
  isDark: z.boolean().default(false),
  surfaceColor: z.string().optional(),
});

export const ThemeBlockSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.string().min(1).max(120),
  order: z.number().int().min(0).default(0),
  renderer_key: z.string().max(120).optional(),
  settings: MetadataSchema.default({}),
  is_visible: z.boolean().default(true),
});

export const ThemeSectionSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.string().min(1).max(120),
  order: z.number().int().min(0).default(0),
  renderer_key: z.string().max(120).optional(),
  settings: MetadataSchema.default({}),
  blocks: z.array(ThemeBlockSchema).default([]),
  is_visible: z.boolean().default(true),
});

export const ThemeTemplateSchema = z.object({
  key: z.string().min(1).max(120),
  layout_key: z.string().max(120).optional(),
  sections: z.array(ThemeSectionSchema).default([]),
});

export const ThemeBundleSchema = z.object({
  schema_version: z.string().min(1).max(40).default('2026-05'),
  theme_id: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  settings_schema: z.array(ThemeSettingFieldSchema).default([]),
  settings_data: ThemeSettingsSchema.partial().and(MetadataSchema).default({}),
  templates: z.record(z.string(), ThemeTemplateSchema).default({}),
  section_definitions: z.record(z.string(), MetadataSchema).default({}),
  block_definitions: z.record(z.string(), MetadataSchema).default({}),
  locales: z.record(z.string(), MetadataSchema).default({}),
  assets: z.record(z.string(), z.string()).default({}),
});

export const ThemeSchema = AuditedEntitySchema.extend({
  slug: SlugSchema,
  name: z.string().min(1).max(160),
  description: z.string().max(1000).default(''),
  category: ThemeCategorySchema,
  pricing_type: ThemePricingTypeSchema.default('free'),
  price_inr: MoneySchema.default(0),
  version: z.string().min(1).max(40),
  is_active: z.boolean().default(true),
  thumbnail_url: UrlSchema.optional().nullable(),
  preview_url: UrlSchema.optional().nullable(),
  screenshots: z.array(UrlSchema).max(20).default([]),
  tags: z.array(z.string().max(50)).max(50).default([]),
  features: z.array(z.string().max(100)).max(100).default([]),
  rating: z.number().min(0).max(5).default(0),
  review_count: z.number().int().min(0).default(0),
  install_count: z.number().int().min(0).default(0),
  bundle: ThemeBundleSchema.optional(),
  published_at: z.string().datetime().optional().nullable(),
});

export const ThemeEditableSchemaResponseSchema = z.object({
  theme: z.object({
    id: UuidSchema,
    slug: SlugSchema,
    name: z.string().min(1).max(160),
    renderer_key: z.string().min(1).max(120),
    theme_package_id: UuidSchema.optional().nullable(),
    theme_package_version_id: UuidSchema.optional().nullable(),
    schema_manifest_version: z.string().optional().nullable(),
    schema_source: z.string().optional().nullable(),
  }).passthrough(),
  schemas: z.object({
    sections: z.record(z.string(), MetadataSchema).default({}),
    blocks: z.record(z.string(), MetadataSchema).default({}),
    settings: MetadataSchema.default({}),
    templates: MetadataSchema.default({}),
    layouts: MetadataSchema.default({}),
  }).passthrough(),
  renderer_manifest: MetadataSchema.optional().nullable(),
  approved_renderer_keys: z.array(z.string()).default([]),
});

export const ThemeEditorPayloadSchema = z.object({
  store: z.object({
    id: UuidSchema,
    name: z.string().optional(),
    subdomain: z.string().optional(),
    status: z.string().optional(),
  }).passthrough(),
  theme: ThemeEditableSchemaResponseSchema.shape.theme.extend({
    theme_instance_id: UuidSchema.optional().nullable(),
  }).passthrough(),
  template_key: z.string().min(1).max(80).default('index'),
  templates: z.array(z.object({
    key: z.string().min(1).max(80),
    label: z.string().min(1).max(160),
    type: z.string().min(1).max(80),
  }).passthrough()).default([]),
  template_config: MetadataSchema,
  draft: z.object({
    exists: z.boolean(),
    template_key: z.string().min(1).max(80).optional(),
    updated_at: z.string().datetime().optional().nullable(),
    version: z.number().int().nonnegative(),
  }).passthrough(),
  release: z.object({
    id: UuidSchema,
    version: z.number().int().positive(),
    published_at: z.string().datetime(),
  }).passthrough().nullable(),
  schemas: ThemeEditableSchemaResponseSchema.shape.schemas,
  renderer_manifest: MetadataSchema.optional().nullable(),
  approved_renderer_keys: z.array(z.string()).default([]),
  version: z.number().int().nonnegative(),
});

export const ThemeDraftSaveResultSchema = z.object({
  replayed: z.boolean(),
  current_version: z.number().int().positive(),
  saved_at: z.string().datetime(),
  version: z.number().int().positive(),
  template_key: z.string().min(1).max(80).default('index'),
  draft: z.object({
    id: UuidSchema,
    version: z.number().int().positive(),
    auto_saved_at: z.string().datetime(),
  }).passthrough(),
});

export const ThemePublishedReleaseSchema = z.object({
  release_id: UuidSchema,
  release_version: z.number().int().positive(),
  published_at: z.string().datetime(),
}).passthrough();

export const ThemePublishResultSchema = z.object({
  version: z.number().int().positive(),
  replayed: z.boolean(),
  current_version: z.number().int().positive(),
  store: z.object({
    id: UuidSchema,
    status: z.string(),
    theme_id: z.string(),
    current_theme_release_id: UuidSchema.optional().nullable(),
    storefront_release_version: z.number().int().positive().optional().nullable(),
    updated_at: z.string().datetime().optional().nullable(),
  }).passthrough().nullable(),
  theme: z.object({
    id: UuidSchema,
    slug: SlugSchema,
    name: z.string().min(1).max(160),
  }).passthrough(),
  release: ThemePublishedReleaseSchema,
  template_key: z.string().min(1).max(80).default('index'),
  published_at: z.string().datetime(),
});

export const ThemePreviewSessionResultSchema = z.object({
  preview_session_id: UuidSchema,
  preview_token: z.string().min(1),
  expires_at: z.string().datetime(),
  draft_version: z.number().int().positive(),
  template_key: z.string().min(1).max(80).default('index'),
});

export const ThemeReleaseSchema = z.object({
  id: UuidSchema,
  theme_id: z.string(),
  theme_instance_id: UuidSchema.optional().nullable(),
  theme_package_version_id: UuidSchema.optional().nullable(),
  release_version: z.number().int().positive(),
  release_status: z.string(),
  is_current: z.boolean(),
  publish_message: z.string().optional().nullable(),
  published_by: UuidSchema.optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  rollback_of_release_id: UuidSchema.optional().nullable(),
  schema_manifest_version: z.string().optional().nullable(),
  engine_version: z.string().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const ThemeRollbackResultSchema = z.object({
  rollback: ThemePublishedReleaseSchema,
  replayed: z.boolean(),
  current_release_id: UuidSchema,
  current_release_version: z.number().int().positive(),
  restored_release: z.object({
    id: UuidSchema,
    version: z.number().int().positive(),
    published_at: z.string().datetime().optional().nullable(),
  }).passthrough(),
  theme: z.object({
    id: UuidSchema,
    slug: SlugSchema,
    name: z.string().min(1).max(160),
  }).passthrough(),
});

export const AppInstallationStatusSchema = z.enum(['active', 'paused', 'uninstalled']);
export const MarketplaceAppTypeSchema = z.enum(['public', 'unlisted', 'custom', 'draft']);
export const MarketplaceAppStatusSchema = z.enum([
  'draft',
  'submitted',
  'in_review',
  'changes_needed',
  'approved',
  'published',
  'suspended',
  'removed',
  'rejected',
]);
export const MarketplaceAppPricingModelSchema = z.enum([
  'free',
  'freemium',
  'recurring',
  'one_time',
  'usage',
]);
export const AppBillingChargeModeSchema = z.enum(['recurring', 'one_time', 'usage']);
export const MarketplaceAppExtensionTypeSchema = z.enum([
  'storefront_block',
  'storefront_embed',
  'checkout_ui',
  'post_purchase',
  'admin_link',
  'admin_block',
]);
export const MarketplaceSubmissionTypeSchema = z.enum(['app', 'theme']);
export const MarketplaceReviewStatusSchema = z.enum([
  'pending',
  'in_review',
  'approved',
  'rejected',
  'changes_requested',
]);
export const ReviewCheckTypeSchema = z.enum([
  'app_scope_minimization',
  'app_webhook_signature',
  'app_oauth_pkce',
  'app_redirect_uri_allowlist',
  'app_data_collection',
  'app_secret_handling',
  'app_rate_limit_posture',
  'theme_performance_budget',
  'theme_accessibility',
  'theme_security',
  'theme_compatibility',
  'theme_code_quality',
  'post_publish_abuse_monitor',
]);
export const ReviewCheckResultSchema = z.enum(['passed', 'warning', 'failed']);

export const APP_REVIEW_REQUIRED_CHECK_TYPES = [
  'app_scope_minimization',
  'app_webhook_signature',
  'app_oauth_pkce',
  'app_redirect_uri_allowlist',
  'app_data_collection',
  'app_secret_handling',
  'app_rate_limit_posture',
] as const;

export const THEME_REVIEW_REQUIRED_CHECK_TYPES = [
  'theme_performance_budget',
  'theme_accessibility',
  'theme_security',
  'theme_compatibility',
  'theme_code_quality',
] as const;

export const THEME_REVIEW_PERFORMANCE_FLOOR = 60;
export const THEME_REVIEW_ACCESSIBILITY_FLOOR = 90;

export const ReviewCheckRunSchema = AuditedEntitySchema.extend({
  review_record_id: UuidSchema,
  submission_type: MarketplaceSubmissionTypeSchema,
  resource_id: UuidSchema,
  check_type: ReviewCheckTypeSchema,
  result: ReviewCheckResultSchema,
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1000),
  detail: JsonRecordSchema.default({}),
  evidence: JsonRecordSchema.default({}),
  hard_fail: z.boolean().default(false),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional().nullable(),
  actor_type: z.enum(['employee', 'super_admin', 'system', 'worker']).default('system'),
  actor_id: UuidSchema.optional().nullable(),
  request_id: z.string().max(160).optional().nullable(),
}).passthrough();

export const MarketplaceReviewAutomatedChecksSchema = z.object({
  status: z.enum(['passed', 'warning', 'failed']).default('warning'),
  checked_at: z.string().datetime(),
  source: z.string().min(1).max(120),
  checks: z.array(z.object({
    check_type: ReviewCheckTypeSchema,
    name: z.string().min(1).max(160),
    status: ReviewCheckResultSchema,
    message: z.string().min(1).max(1000),
    hard_fail: z.boolean().default(false),
  }).passthrough()).default([]),
  failed_count: z.number().int().nonnegative().default(0),
  warning_count: z.number().int().nonnegative().default(0),
  hard_fail_count: z.number().int().nonnegative().default(0),
  metadata: JsonRecordSchema.default({}),
}).passthrough();

export const EXECUTIVE_ANALYTICS_DEFINITION_VERSION = 'internal_exec_v1';
export const EXECUTIVE_ANALYTICS_STALE_AFTER_HOURS = 36;

export const EXECUTIVE_FUNNEL_STEPS = [
  { step_key: 'signup', step_index: 0, label: 'Signup' },
  { step_key: 'store_created', step_index: 1, label: 'Store created' },
  { step_key: 'store_published', step_index: 2, label: 'Store published' },
  { step_key: 'first_order', step_index: 3, label: 'First paid order' },
  { step_key: 'paying', step_index: 4, label: 'Paying' },
] as const;

export const EXECUTIVE_METRIC_DEFINITIONS = [
  {
    metric_key: 'mrr',
    label: 'MRR',
    unit: 'paise',
    formula: 'Active monthly subscription amount plus annual subscriptions normalized to one month.',
  },
  {
    metric_key: 'arr',
    label: 'ARR',
    unit: 'paise',
    formula: 'MRR multiplied by 12.',
  },
  {
    metric_key: 'activation_funnel',
    label: 'Activation funnel',
    unit: 'count',
    formula: 'Signup, store-created, store-published, first-paid-order, and paying counts by period.',
  },
  {
    metric_key: 'company_health',
    label: 'Company health',
    unit: 'mixed',
    formula: 'Support, risk, Trust & Safety, incident, and error-budget rollups from operating-system tables.',
  },
] as const;

export const ExecutiveMetricDefinitionSchema = z.object({
  metric_key: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  unit: z.string().min(1).max(40),
  formula: z.string().min(1).max(1000),
});

export const ExecutiveRollupFreshnessSchema = z.object({
  computed_at: z.string().datetime().optional().nullable(),
  stale: z.boolean(),
  stale_after_hours: z.number().int().positive().default(EXECUTIVE_ANALYTICS_STALE_AFTER_HOURS),
  stale_reason: z.string().max(400).optional().nullable(),
});

export const ExecutiveMrrRollupSchema = AuditedEntitySchema.extend({
  period_date: z.string(),
  mrr_paise: z.number().int().nonnegative().default(0),
  arr_paise: z.number().int().nonnegative().default(0),
  new_mrr_paise: z.number().int().default(0),
  expansion_mrr_paise: z.number().int().default(0),
  contraction_mrr_paise: z.number().int().default(0),
  churned_mrr_paise: z.number().int().default(0),
  active_subscriptions: z.number().int().nonnegative().default(0),
  logo_churn_count: z.number().int().nonnegative().default(0),
  subscription_revenue_paise: z.number().int().nonnegative().default(0),
  app_revenue_paise: z.number().int().nonnegative().default(0),
  theme_revenue_paise: z.number().int().nonnegative().default(0),
  partner_payout_liability_paise: z.number().int().nonnegative().default(0),
  definition_version: z.string().min(1).max(80).default(EXECUTIVE_ANALYTICS_DEFINITION_VERSION),
  computed_at: z.string().datetime(),
  metadata: JsonRecordSchema.default({}),
}).passthrough();

export const ExecutiveMetricRollupSchema = AuditedEntitySchema.extend({
  metric_key: z.string().min(1).max(120),
  dimension: JsonRecordSchema.default({}),
  period_date: z.string(),
  value: z.number().default(0),
  unit: z.string().min(1).max(40).default('count'),
  definition_version: z.string().min(1).max(80).default(EXECUTIVE_ANALYTICS_DEFINITION_VERSION),
  computed_at: z.string().datetime(),
  metadata: JsonRecordSchema.default({}),
}).passthrough();

export const ExecutiveCohortSnapshotSchema = AuditedEntitySchema.extend({
  cohort_month: z.string(),
  period_index: z.number().int().nonnegative(),
  metric_key: z.string().min(1).max(120).default('active_stores'),
  cohort_size: z.number().int().nonnegative().default(0),
  retained_count: z.number().int().nonnegative().default(0),
  conversion_count: z.number().int().nonnegative().default(0),
  definition_version: z.string().min(1).max(80).default(EXECUTIVE_ANALYTICS_DEFINITION_VERSION),
  computed_at: z.string().datetime(),
  metadata: JsonRecordSchema.default({}),
}).passthrough();

export const ExecutiveFunnelStepSchema = AuditedEntitySchema.extend({
  period_date: z.string(),
  step_key: z.enum(['signup', 'store_created', 'store_published', 'first_order', 'paying']),
  step_index: z.number().int().nonnegative(),
  count: z.number().int().nonnegative().default(0),
  conversion_rate_bps: z.number().int().min(0).max(10000).default(0),
  definition_version: z.string().min(1).max(80).default(EXECUTIVE_ANALYTICS_DEFINITION_VERSION),
  computed_at: z.string().datetime(),
  metadata: JsonRecordSchema.default({}),
}).passthrough();

export const ExecutiveMrrAnalyticsSchema = z.object({
  definition_version: z.string().min(1).max(80),
  definitions: z.array(ExecutiveMetricDefinitionSchema),
  freshness: ExecutiveRollupFreshnessSchema,
  latest: ExecutiveMrrRollupSchema.optional().nullable(),
  trend: z.array(ExecutiveMrrRollupSchema).default([]),
}).passthrough();

export const ExecutiveFunnelAnalyticsSchema = z.object({
  definition_version: z.string().min(1).max(80),
  freshness: ExecutiveRollupFreshnessSchema,
  latest_period_date: z.string().optional().nullable(),
  steps: z.array(ExecutiveFunnelStepSchema).default([]),
  history: z.array(ExecutiveFunnelStepSchema).default([]),
}).passthrough();

export const ExecutiveCohortAnalyticsSchema = z.object({
  definition_version: z.string().min(1).max(80),
  freshness: ExecutiveRollupFreshnessSchema,
  snapshots: z.array(ExecutiveCohortSnapshotSchema).default([]),
}).passthrough();

export const ExecutiveCompanyHealthSchema = z.object({
  definition_version: z.string().min(1).max(80),
  freshness: ExecutiveRollupFreshnessSchema,
  metrics: z.array(ExecutiveMetricRollupSchema).default([]),
}).passthrough();

export interface ReviewCheckEvaluation {
  check_type: z.infer<typeof ReviewCheckTypeSchema>;
  result: z.infer<typeof ReviewCheckResultSchema>;
  title: string;
  summary: string;
  detail: JsonRecord;
  evidence: JsonRecord;
  hard_fail: boolean;
}

export interface MarketplaceReviewCheckInput {
  submission_type: z.infer<typeof MarketplaceSubmissionTypeSchema>;
  metadata?: JsonRecord | null;
  automated_checks?: JsonRecord | null;
  resource?: JsonRecord | null;
}

function reviewRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function reviewArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function reviewStringArray(value: unknown): string[] {
  return reviewArray(value).map((item) => String(item || '').trim()).filter(Boolean);
}

function reviewBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return null;
}

function reviewNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function nestedReviewRecord(source: JsonRecord, ...keys: string[]): JsonRecord {
  let current: unknown = source;
  for (const key of keys) current = reviewRecord(current)[key];
  return reviewRecord(current);
}

function checkResult(input: Omit<ReviewCheckEvaluation, 'hard_fail'> & { hard_fail?: boolean }): ReviewCheckEvaluation {
  return { ...input, hard_fail: input.hard_fail ?? input.result === 'failed' };
}

function appReviewCheckEvaluations(input: MarketplaceReviewCheckInput): ReviewCheckEvaluation[] {
  const metadata = reviewRecord(input.metadata);
  const resource = reviewRecord(input.resource);
  const manifest = {
    ...nestedReviewRecord(metadata, 'manifest'),
    ...nestedReviewRecord(resource, 'manifest'),
  };
  const dataHandling = {
    ...nestedReviewRecord(metadata, 'data_handling'),
    ...nestedReviewRecord(resource, 'data_handling'),
  };
  const scopes = [
    ...reviewStringArray(resource.scopes),
    ...reviewStringArray(resource.api_scopes),
    ...reviewStringArray(manifest.scopes),
    ...reviewStringArray(metadata.scopes),
  ];
  const uniqueScopes = Array.from(new Set(scopes));
  const sensitiveScopes = uniqueScopes.filter((scope) => /(customer|payment|order|pii|write|admin)/i.test(scope));
  const redirectUris = [
    ...reviewStringArray(resource.redirect_uris),
    ...reviewStringArray(resource.oauth_redirect_uris),
    ...reviewStringArray(manifest.redirect_uris),
    ...reviewStringArray(manifest.oauth_redirect_uris),
    ...reviewStringArray(metadata.redirect_uris),
    ...reviewStringArray(metadata.oauth_redirect_uris),
  ];
  const hasWildcardScope = uniqueScopes.some((scope) => scope === '*' || scope.endsWith(':*') || scope.includes('all'));
  const invalidRedirects = redirectUris.filter((uri) => !uri.startsWith('https://') || uri.includes('*'));
  const webhookSignatureConfigured = reviewBoolean(
    metadata.webhook_signature_configured,
    metadata.signed_webhooks,
    manifest.webhook_signature_configured,
  );
  const pkceRequired = reviewBoolean(metadata.oauth_pkce_required, metadata.pkce_required, manifest.oauth_pkce_required, manifest.pkce_required);
  const rateLimitConfigured = reviewBoolean(metadata.rate_limit_configured, manifest.rate_limit_configured)
    ?? Boolean(reviewRecord(manifest.rate_limits).requests_per_minute || reviewRecord(metadata.rate_limits).requests_per_minute);
  const serialized = JSON.stringify({ metadata, resource, manifest }).toLowerCase();
  const secretExposure = reviewBoolean(metadata.secret_exposure_detected, manifest.secret_exposure_detected)
    ?? /\b(client_secret|api_secret|private_key|sk_live|rzp_live)\b/.test(serialized);
  const hasDataHandling = Object.keys(dataHandling).length > 0 || Boolean(metadata.data_collection_declared || manifest.data_collection_declared);

  return [
    checkResult({
      check_type: 'app_scope_minimization',
      result: hasWildcardScope ? 'failed' : sensitiveScopes.length > 0 || uniqueScopes.length > 8 ? 'warning' : 'passed',
      title: 'Scope minimization',
      summary: hasWildcardScope
        ? 'Requested wildcard or all-access scopes.'
        : sensitiveScopes.length > 0
          ? 'Sensitive scopes require senior reviewer attention.'
          : 'Requested scopes are bounded.',
      detail: { scopes: uniqueScopes, sensitive_scopes: sensitiveScopes },
      evidence: { source: 'manifest-and-listing' },
      hard_fail: hasWildcardScope,
    }),
    checkResult({
      check_type: 'app_webhook_signature',
      result: webhookSignatureConfigured === true ? 'passed' : 'warning',
      title: 'Webhook signature configuration',
      summary: webhookSignatureConfigured === true
        ? 'Webhook signature verification is declared.'
        : 'Webhook signature verification was not declared in submission metadata.',
      detail: { configured: webhookSignatureConfigured },
      evidence: { source: 'submission-metadata' },
      hard_fail: false,
    }),
    checkResult({
      check_type: 'app_oauth_pkce',
      result: pkceRequired === true ? 'passed' : 'warning',
      title: 'OAuth and PKCE posture',
      summary: pkceRequired === true ? 'PKCE requirement is declared.' : 'PKCE requirement was not declared.',
      detail: { pkce_required: pkceRequired },
      evidence: { source: 'submission-metadata' },
      hard_fail: false,
    }),
    checkResult({
      check_type: 'app_redirect_uri_allowlist',
      result: redirectUris.length === 0 ? 'warning' : invalidRedirects.length > 0 ? 'failed' : 'passed',
      title: 'Redirect URI allowlist',
      summary: invalidRedirects.length > 0
        ? 'Redirect allowlist contains wildcard or non-HTTPS entries.'
        : redirectUris.length === 0
          ? 'No redirect URI allowlist was provided.'
          : 'Redirect URI allowlist is HTTPS and specific.',
      detail: { redirect_uris: redirectUris, invalid_redirect_uris: invalidRedirects },
      evidence: { source: 'manifest-and-listing' },
      hard_fail: invalidRedirects.length > 0,
    }),
    checkResult({
      check_type: 'app_data_collection',
      result: !hasDataHandling && sensitiveScopes.length > 0 ? 'failed' : hasDataHandling ? 'passed' : 'warning',
      title: 'Data collection declaration',
      summary: !hasDataHandling && sensitiveScopes.length > 0
        ? 'Sensitive scopes were requested without a data-handling declaration.'
        : hasDataHandling
          ? 'Data-handling declaration is present.'
          : 'Data-handling declaration was not provided.',
      detail: { data_handling: dataHandling, sensitive_scopes: sensitiveScopes },
      evidence: { source: 'submission-metadata' },
      hard_fail: !hasDataHandling && sensitiveScopes.length > 0,
    }),
    checkResult({
      check_type: 'app_secret_handling',
      result: secretExposure ? 'failed' : 'passed',
      title: 'Secret handling scan',
      summary: secretExposure ? 'Submission metadata appears to contain secret material.' : 'No secret markers were detected in submitted metadata.',
      detail: { secret_marker_detected: secretExposure },
      evidence: { source: 'metadata-pattern-scan' },
      hard_fail: secretExposure,
    }),
    checkResult({
      check_type: 'app_rate_limit_posture',
      result: rateLimitConfigured ? 'passed' : 'warning',
      title: 'Rate-limit posture',
      summary: rateLimitConfigured ? 'Rate-limit posture is declared.' : 'Rate-limit posture was not declared.',
      detail: { configured: rateLimitConfigured },
      evidence: { source: 'submission-metadata' },
      hard_fail: false,
    }),
  ];
}

function themeReviewCheckEvaluations(input: MarketplaceReviewCheckInput): ReviewCheckEvaluation[] {
  const metadata = reviewRecord(input.metadata);
  const resource = reviewRecord(input.resource);
  const qa = {
    ...nestedReviewRecord(metadata, 'qa'),
    ...nestedReviewRecord(resource, 'qa'),
    ...nestedReviewRecord(resource, 'quality_report'),
  };
  const lighthouse = {
    ...nestedReviewRecord(metadata, 'lighthouse'),
    ...nestedReviewRecord(resource, 'lighthouse'),
  };
  const performanceScore = reviewNumber(
    qa.performance_score,
    qa.perf_score,
    lighthouse.performance,
    metadata.performance_score,
    resource.performance_score,
  );
  const accessibilityScore = reviewNumber(
    qa.accessibility_score,
    qa.a11y_score,
    lighthouse.accessibility,
    metadata.accessibility_score,
    resource.accessibility_score,
  );
  const unsafeScripts = reviewStringArray(qa.unsafe_scripts).concat(reviewStringArray(metadata.unsafe_scripts));
  const compatibilityErrors = reviewStringArray(qa.compatibility_errors).concat(reviewStringArray(metadata.compatibility_errors));
  const hasManifest = Boolean(
    resource.renderer_manifest_id
    || resource.schema_manifest_id
    || Object.keys(nestedReviewRecord(resource, 'renderer_manifest')).length > 0
    || Object.keys(nestedReviewRecord(resource, 'schema_manifest')).length > 0
    || Object.keys(nestedReviewRecord(metadata, 'renderer_manifest')).length > 0
    || Object.keys(nestedReviewRecord(metadata, 'schema_manifest')).length > 0
  );
  const bundleSizeKb = reviewNumber(qa.bundle_size_kb, metadata.bundle_size_kb, resource.bundle_size_kb);
  const codeQualityIssues = reviewStringArray(qa.code_quality_issues).concat(reviewStringArray(metadata.code_quality_issues));

  return [
    checkResult({
      check_type: 'theme_performance_budget',
      result: performanceScore === null ? 'warning' : performanceScore < THEME_REVIEW_PERFORMANCE_FLOOR ? 'failed' : 'passed',
      title: 'Performance budget',
      summary: performanceScore === null
        ? 'No performance score was provided for this theme version.'
        : performanceScore < THEME_REVIEW_PERFORMANCE_FLOOR
          ? `Performance score ${performanceScore} is below the ${THEME_REVIEW_PERFORMANCE_FLOOR} floor.`
          : `Performance score ${performanceScore} meets the floor.`,
      detail: { performance_score: performanceScore, floor: THEME_REVIEW_PERFORMANCE_FLOOR },
      evidence: { source: 'theme-qa-metadata' },
      hard_fail: performanceScore !== null && performanceScore < THEME_REVIEW_PERFORMANCE_FLOOR,
    }),
    checkResult({
      check_type: 'theme_accessibility',
      result: accessibilityScore === null ? 'warning' : accessibilityScore < THEME_REVIEW_ACCESSIBILITY_FLOOR ? 'failed' : 'passed',
      title: 'Accessibility floor',
      summary: accessibilityScore === null
        ? 'No accessibility score was provided for this theme version.'
        : accessibilityScore < THEME_REVIEW_ACCESSIBILITY_FLOOR
          ? `Accessibility score ${accessibilityScore} is below the ${THEME_REVIEW_ACCESSIBILITY_FLOOR} floor.`
          : `Accessibility score ${accessibilityScore} meets the floor.`,
      detail: { accessibility_score: accessibilityScore, floor: THEME_REVIEW_ACCESSIBILITY_FLOOR },
      evidence: { source: 'theme-qa-metadata' },
      hard_fail: accessibilityScore !== null && accessibilityScore < THEME_REVIEW_ACCESSIBILITY_FLOOR,
    }),
    checkResult({
      check_type: 'theme_security',
      result: unsafeScripts.length > 0 ? 'failed' : 'passed',
      title: 'Theme security scan',
      summary: unsafeScripts.length > 0 ? 'Unsafe scripts or eval-like usage were reported.' : 'No unsafe script findings were reported.',
      detail: { unsafe_scripts: unsafeScripts },
      evidence: { source: 'theme-qa-metadata' },
      hard_fail: unsafeScripts.length > 0,
    }),
    checkResult({
      check_type: 'theme_compatibility',
      result: compatibilityErrors.length > 0 ? 'failed' : hasManifest ? 'passed' : 'warning',
      title: 'Theme-engine compatibility',
      summary: compatibilityErrors.length > 0
        ? 'Theme-engine compatibility errors were reported.'
        : hasManifest
          ? 'Theme manifests are present for compatibility review.'
          : 'Theme manifest evidence was not attached.',
      detail: { compatibility_errors: compatibilityErrors, has_manifest: hasManifest },
      evidence: { source: 'theme-engine-manifest' },
      hard_fail: compatibilityErrors.length > 0,
    }),
    checkResult({
      check_type: 'theme_code_quality',
      result: bundleSizeKb !== null && bundleSizeKb > 1000 ? 'failed' : codeQualityIssues.length > 0 || bundleSizeKb === null ? 'warning' : 'passed',
      title: 'Theme code quality',
      summary: bundleSizeKb !== null && bundleSizeKb > 1000
        ? `Bundle size ${bundleSizeKb}KB exceeds the 1000KB foundation budget.`
        : codeQualityIssues.length > 0
          ? 'Theme QA reported code-quality issues.'
          : bundleSizeKb === null
            ? 'Bundle size evidence was not attached.'
            : 'Theme code-quality checks are within foundation limits.',
      detail: { bundle_size_kb: bundleSizeKb, code_quality_issues: codeQualityIssues, bundle_size_budget_kb: 1000 },
      evidence: { source: 'theme-qa-metadata' },
      hard_fail: bundleSizeKb !== null && bundleSizeKb > 1000,
    }),
  ];
}

export function evaluateMarketplaceReviewChecks(input: MarketplaceReviewCheckInput): ReviewCheckEvaluation[] {
  return input.submission_type === 'theme'
    ? themeReviewCheckEvaluations(input)
    : appReviewCheckEvaluations(input);
}

export function buildMarketplaceReviewAutomatedChecks(input: {
  source: string;
  checks: ReviewCheckEvaluation[];
  metadata?: JsonRecord;
}): z.infer<typeof MarketplaceReviewAutomatedChecksSchema> {
  const failed = input.checks.filter((check) => check.result === 'failed');
  const warnings = input.checks.filter((check) => check.result === 'warning');
  const hardFails = input.checks.filter((check) => check.hard_fail);

  return {
    status: hardFails.length > 0 || failed.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
    checked_at: new Date().toISOString(),
    source: input.source,
    checks: input.checks.map((check) => ({
      check_type: check.check_type,
      name: check.title,
      status: check.result,
      message: check.summary,
      hard_fail: check.hard_fail,
      detail: check.detail,
    })),
    failed_count: failed.length,
    warning_count: warnings.length,
    hard_fail_count: hardFails.length,
    metadata: input.metadata ?? {},
  };
}

export function isExecutiveAnalyticsStale(
  computedAt: string | null | undefined,
  referenceDate: Date = new Date(),
  staleAfterHours = EXECUTIVE_ANALYTICS_STALE_AFTER_HOURS,
): boolean {
  if (!computedAt) return true;
  const timestamp = Date.parse(computedAt);
  if (!Number.isFinite(timestamp)) return true;
  return referenceDate.getTime() - timestamp > staleAfterHours * 60 * 60 * 1000;
}

export const AppBridgeCapabilitySchema = z.enum([
  'api.fetch',
  'toast',
  'resize',
  'navigation.redirect',
]);

export const MarketplaceAppCategorySchema = z.object({
  id: z.string().min(1).optional().nullable(),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  icon: z.string().min(1).max(80).optional().nullable(),
  group: z.string().min(1).max(120).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  is_active: z.boolean().optional().nullable(),
  seo_title: z.string().max(120).optional().nullable(),
  seo_description: z.string().max(300).optional().nullable(),
  seo_content: z.string().max(5000).optional().nullable(),
  seo_faq: z.array(z.object({
    question: z.string().min(1).max(240),
    answer: z.string().min(1).max(1000),
  }).passthrough()).optional().nullable(),
  buyer_guidance: z.string().max(2000).optional().nullable(),
    count: z.number().int().nonnegative().optional().nullable(),
}).passthrough();

export const MarketplaceAppFeatureTagSchema = z.object({
  id: z.string().min(1),
  group_id: z.string().min(1).optional().nullable(),
  handle: z.string().min(1).max(160),
  label: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  display_order: z.number().int().optional().nullable(),
  count: z.number().int().nonnegative().optional().nullable(),
  selected: z.boolean().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceAppFeatureGroupSchema = z.object({
  id: z.string().min(1),
  category_id: z.string().min(1),
  category_slug: z.string().min(1).max(120).optional().nullable(),
  handle: z.string().min(1).max(160),
  label: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  display_order: z.number().int().optional().nullable(),
  tags: z.array(MarketplaceAppFeatureTagSchema).default([]),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceAppAwardSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  award_key: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  year: z.number().int().optional().nullable(),
  blurb: z.string().max(1000).optional().nullable(),
  awarded_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceAppReviewSummarySchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  summary: z.string().min(1).max(5000),
  source: z.string().min(1).max(80).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  eligibility_snapshot: MetadataSchema.default({}),
  generated_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceAppCollectionSectionSchema = z.object({
  id: z.string().min(1),
  collection_id: z.string().min(1),
  section_type: z.string().min(1).max(80),
  heading: z.string().max(240).optional().nullable(),
  body: z.string().max(50000).optional().nullable(),
  media_url: UrlSchema.optional().nullable(),
  app_id: z.string().min(1).optional().nullable(),
  cta_label: z.string().max(120).optional().nullable(),
  cta_href: z.string().max(2000).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceAppCollectionReferenceSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  description: z.string().max(1200).optional().nullable(),
  curation_type: z.string().min(1).max(80).optional().nullable(),
  disclosure: z.string().max(500).optional().nullable(),
  status: z.string().min(1).max(80).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  count: z.number().int().nonnegative().optional().nullable(),
  sections: z.array(MarketplaceAppCollectionSectionSchema).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceAppCollectionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  description: z.string().max(1200).optional().nullable(),
  curation_type: z.string().min(1).max(80).optional().nullable(),
  disclosure: z.string().max(500).optional().nullable(),
  status: z.string().min(1).max(80).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  count: z.number().int().nonnegative().optional().nullable(),
  sections: z.array(MarketplaceAppCollectionSectionSchema).optional().nullable(),
  apps: z.array(z.lazy(() => MarketplaceAppSchema)).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppDiscoveryEventInputSchema = z.object({
  event_type: z.enum(['search', 'zero_results', 'app_click', 'collection_view', 'featured_impression']),
  site_id: z.string().min(1).optional().nullable(),
  app_id: z.string().min(1).optional().nullable(),
  category_id: z.string().min(1).optional().nullable(),
  collection_id: z.string().min(1).optional().nullable(),
  search_query: z.string().trim().max(200).optional().nullable(),
  result_count: z.number().int().min(0).max(100000).optional().nullable(),
  request_id: z.string().trim().max(200).optional().nullable(),
  metadata: MetadataSchema.default({}),
}).strict();

export const AppDiscoveryEventResultSchema = z.object({
  accepted: z.boolean().default(true),
  id: z.string().min(1).optional().nullable(),
}).passthrough();

export const AppRequestInputSchema = z.object({
  query: z.string().trim().max(200).optional().nullable(),
  category_slug: z.string().trim().max(120).optional().nullable(),
  requested_app_name: z.string().trim().max(200).optional().nullable(),
  use_case: z.string().trim().min(1).max(2000),
  contact_email: EmailSchema.optional().nullable(),
  metadata: MetadataSchema.default({}),
}).strict();

export const AppRequestResultSchema = z.object({
  accepted: z.boolean().default(true),
  request_id: z.string().min(1).optional().nullable(),
  status: z.string().min(1).max(80).default('open'),
}).passthrough();

export const AppSavedAppInputSchema = z.object({
  site_id: z.string().min(1).optional().nullable(),
  app_id: z.string().min(1),
  source: z.string().trim().max(80).optional().nullable(),
  metadata: MetadataSchema.default({}),
}).strict();

export const AppSavedAppSchema = z.object({
  id: z.string().min(1),
  site_id: z.string().min(1),
  app_id: z.string().min(1),
  saved_by: z.string().min(1).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  metadata: MetadataSchema.default({}),
  marketplace_apps: z.lazy(() => MarketplaceAppSchema).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppSavedAppsResultSchema = z.object({
  saved_apps: z.array(AppSavedAppSchema).default([]),
  apps: z.array(z.lazy(() => MarketplaceAppSchema)).default([]),
}).passthrough();

export const AppTrustReportInputSchema = z.object({
  reason_code: z.string().trim().min(1).max(80),
  reason_text: z.string().trim().max(1000).optional().nullable(),
  site_id: z.string().min(1).optional().nullable(),
  metadata: MetadataSchema.default({}),
}).strict();

export const AppReviewReplyInputSchema = z.object({
  developer_reply: z.string().trim().min(1).max(2000),
}).strict();

export const AppTrustReportResultSchema = z.object({
  accepted: z.boolean().default(true),
  report_id: z.string().min(1).optional().nullable(),
  status: z.string().min(1).max(80).optional().nullable(),
}).passthrough();

export const AppReviewPolicySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(120),
  version: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(2000),
  sections: z.array(z.object({
    heading: z.string().min(1).max(200),
    items: z.array(z.string().min(1).max(500)).default([]),
  }).passthrough()).default([]),
  status: z.string().min(1).max(80),
  effective_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppActivityEventSchema = z.object({
  id: z.string().min(1),
  site_id: z.string().min(1),
  app_id: z.string().min(1),
  installation_id: z.string().min(1).optional().nullable(),
  actor_id: z.string().min(1).optional().nullable(),
  event_type: z.string().min(1).max(80),
  summary: z.string().min(1).max(500),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppBundleSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.string().min(1).max(80).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('INR'),
  discount_percent: z.number().min(0).max(100).optional().nullable(),
  discount_amount_minor: z.number().int().nonnegative().optional().nullable(),
  disclosure: z.string().max(500).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  apps: z.array(z.lazy(() => MarketplaceAppSchema)).default([]),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppReviewProofSchema = z.object({
  id: z.string().min(1),
  review_id: z.string().min(1),
  app_id: z.string().min(1),
  site_id: z.string().min(1).optional().nullable(),
  installation_id: z.string().min(1).optional().nullable(),
  proof_type: z.string().min(1).max(80),
  proof_status: z.string().min(1).max(80),
  source: z.string().max(120).optional().nullable(),
  external_reference: z.string().max(300).optional().nullable(),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppReviewModerationItemSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().optional().nullable(),
  user_name: z.string().max(200).optional().nullable(),
  status: z.string().max(80).optional().nullable(),
  fraud_score: z.number().nonnegative().optional().nullable(),
  fraud_flags: z.array(z.string().min(1)).default([]),
  reported_count: z.number().int().nonnegative().optional().nullable(),
  moderation_reason: z.string().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  marketplace_apps: z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(160).optional().nullable(),
  }).passthrough().optional().nullable(),
}).passthrough();

export const MarketplaceAppDeveloperSchema = z.object({
  id: z.string().min(1).optional().nullable(),
  company_name: z.string().min(1).max(200).optional().nullable(),
  slug: z.string().min(1).max(160).optional().nullable(),
  logo_url: UrlSchema.optional().nullable(),
  website_url: UrlSchema.optional().nullable(),
  support_email: EmailSchema.optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  country: z.string().max(20).optional().nullable(),
  verified: z.boolean().optional().nullable(),
  status: z.string().min(1).max(80).optional().nullable(),
}).passthrough();

export const MarketplaceAppExtensionSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1).optional().nullable(),
  type: MarketplaceAppExtensionTypeSchema.or(z.string().min(1)),
  name: z.string().min(1).max(160).optional().nullable(),
  entry_point: z.string().max(2000).optional().nullable(),
  target: z.string().max(200).optional().nullable(),
  label: z.string().max(120).optional().nullable(),
  config: MetadataSchema.default({}),
  status: z.string().min(1).max(80).optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
}).passthrough();

export const AppPricingPlanIntervalSchema = z.enum(['none', 'monthly', 'yearly']);
export const AppPricingPlanStatusSchema = z.enum(['draft', 'active', 'archived']);

export const AppPricingPlanInputSchema = z.object({
  plan_slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  pricing_model: MarketplaceAppPricingModelSchema.default('free'),
  billing_mode: AppBillingChargeModeSchema.optional().nullable(),
  currency: z.literal('INR').default('INR'),
  amount_minor: z.number().int().nonnegative().default(0),
  interval: AppPricingPlanIntervalSchema.default('none'),
  trial_days: z.number().int().min(0).max(365).default(0),
  usage_meter: z.string().trim().max(120).optional().nullable(),
  usage_unit: z.string().trim().max(80).optional().nullable(),
  included_usage: z.number().int().nonnegative().default(0),
  usage_unit_amount_minor: z.number().int().nonnegative().default(0),
  features: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  limits: MetadataSchema.default({}),
  is_default: z.boolean().default(false),
  status: AppPricingPlanStatusSchema.default('active'),
  sort_order: z.number().int().min(0).max(1000).default(0),
}).strict();

export const AppPricingPlanUpdateSchema = AppPricingPlanInputSchema.partial().strict();

export const AppPricingPlanSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  developer_id: z.string().min(1),
  plan_slug: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  pricing_model: MarketplaceAppPricingModelSchema.or(z.string().min(1)),
  billing_mode: AppBillingChargeModeSchema.or(z.string().min(1)).optional().nullable(),
  currency: z.literal('INR').default('INR'),
  amount_minor: z.number().int().nonnegative(),
  interval: AppPricingPlanIntervalSchema.or(z.string().min(1)).default('none'),
  trial_days: z.number().int().nonnegative().optional().nullable(),
  usage_meter: z.string().max(120).optional().nullable(),
  usage_unit: z.string().max(80).optional().nullable(),
  included_usage: z.number().int().nonnegative().optional().nullable(),
  usage_unit_amount_minor: z.number().int().nonnegative().optional().nullable(),
  features: z.array(z.string().min(1)).default([]),
  limits: MetadataSchema.default({}),
  is_default: z.boolean().default(false),
  status: AppPricingPlanStatusSchema.or(z.string().min(1)).default('active'),
  sort_order: z.number().int().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppVersionStatusSchema = z.enum(['draft', 'in_review', 'approved', 'released', 'rejected', 'rolled_back']);

export const AppVersionInputSchema = z.object({
  version: z.string().trim().min(1).max(60),
  release_notes: z.string().trim().min(1).max(5000),
  changelog: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  rollout_percentage: z.number().int().min(0).max(100).default(100),
  rollout_cohort: z.string().trim().max(120).optional().nullable(),
  manifest: MetadataSchema.optional().nullable(),
}).strict();

export const AppListingUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  tagline: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().min(1).max(50000).optional(),
  category_id: z.string().trim().min(1).max(120).optional(),
  app_url: UrlSchema.optional(),
  privacy_policy_url: UrlSchema.optional(),
  terms_url: UrlSchema.optional().nullable(),
  documentation_url: UrlSchema.optional().nullable(),
  pricing_model: MarketplaceAppPricingModelSchema.optional(),
  version: z.string().trim().min(1).max(60).optional(),
  release_notes: z.string().trim().min(1).max(5000).optional(),
  changelog: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  rollout_percentage: z.number().int().min(0).max(100).optional(),
  rollout_cohort: z.string().trim().max(120).optional().nullable(),
  manifest: MetadataSchema.optional().nullable(),
}).strict();

export const AppVersionSchema = z.object({
  id: UuidSchema,
  app_id: UuidSchema,
  developer_id: UuidSchema,
  version: z.string().min(1).max(60),
  release_notes: z.string().max(5000).optional().nullable(),
  changelog: z.array(z.string().min(1)).default([]),
  rollout_percentage: z.number().int().min(0).max(100).default(100),
  rollout_cohort: z.string().max(120).optional().nullable(),
  status: AppVersionStatusSchema.or(z.string().min(1)).default('draft'),
  manifest: MetadataSchema.default({}),
  automated_checks: MetadataSchema.default({}),
  review_record_id: UuidSchema.optional().nullable(),
  submitted_at: z.string().datetime().optional().nullable(),
  released_at: z.string().datetime().optional().nullable(),
  created_by: UuidSchema.optional().nullable(),
  updated_by: UuidSchema.optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  deleted_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppVersionsResultSchema = z.object({
  app: z.lazy(() => MarketplaceAppSchema),
  versions: z.array(AppVersionSchema).default([]),
}).passthrough();

export const MarketplaceAppSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  tagline: z.string().max(300).optional().nullable(),
  description: z.string().optional().nullable(),
  type: MarketplaceAppTypeSchema.or(z.string().min(1)).optional().nullable(),
  status: MarketplaceAppStatusSchema.or(z.string().min(1)).optional().nullable(),
  developer_id: z.string().min(1).optional().nullable(),
  developer_name: z.string().max(200).optional().nullable(),
  developer_email: EmailSchema.optional().nullable(),
  client_id: z.string().max(200).optional().nullable(),
  redirect_uris: z.array(z.string().min(1)).optional().nullable(),
  scopes: z.array(z.string().min(1)).optional().nullable(),
  api_scopes: z.array(z.string().min(1)).optional().nullable(),
  app_url: UrlSchema.optional().nullable(),
  proxy_url: UrlSchema.optional().nullable(),
  proxy_path: z.string().max(500).optional().nullable(),
  privacy_url: UrlSchema.optional().nullable(),
  privacy_policy_url: UrlSchema.optional().nullable(),
  terms_url: UrlSchema.optional().nullable(),
  documentation_url: UrlSchema.optional().nullable(),
  icon_url: UrlSchema.optional().nullable(),
  screenshots: z.array(UrlSchema).optional().nullable(),
  video_url: UrlSchema.optional().nullable(),
  video_captions_url: UrlSchema.optional().nullable(),
  pricing_model: MarketplaceAppPricingModelSchema.or(z.string().min(1)).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional().nullable(),
  price_monthly: z.number().nonnegative().optional().nullable(),
  price_yearly: z.number().nonnegative().optional().nullable(),
  price_inr: z.number().nonnegative().optional().nullable(),
  trial_days: z.number().int().nonnegative().optional().nullable(),
  category_id: z.string().min(1).optional().nullable(),
  tags: z.array(z.string().min(1)).optional().nullable(),
  collection_ids: z.array(z.string().min(1)).optional().nullable(),
  install_count: z.number().int().nonnegative().optional().nullable(),
  review_count: z.number().int().nonnegative().optional().nullable(),
  avg_rating: z.number().nonnegative().optional().nullable(),
  rating_avg: z.number().or(z.string()).optional().nullable(),
  extensions: z.array(MarketplaceAppExtensionSchema).optional().nullable(),
  app_extensions: z.array(MarketplaceAppExtensionSchema).optional().nullable(),
  app_pricing_plans: z.array(AppPricingPlanSchema).optional().nullable(),
  app_versions: z.array(AppVersionSchema).optional().nullable(),
  feature_tags: z.array(MarketplaceAppFeatureTagSchema).optional().nullable(),
  feature_groups: z.array(MarketplaceAppFeatureGroupSchema).optional().nullable(),
  awards: z.array(MarketplaceAppAwardSchema).optional().nullable(),
  app_awards: z.array(MarketplaceAppAwardSchema).optional().nullable(),
  app_review_summary: MarketplaceAppReviewSummarySchema.optional().nullable(),
  featured_in: z.array(MarketplaceAppCollectionReferenceSchema).optional().nullable(),
  app_developers: MarketplaceAppDeveloperSchema.optional().nullable(),
  app_categories: MarketplaceAppCategorySchema.optional().nullable(),
  version: z.string().max(80).optional().nullable(),
  current_version: z.string().max(80).optional().nullable(),
  min_plan: z.string().max(80).optional().nullable(),
  supported_locales: z.array(z.string().min(2)).optional().nullable(),
  is_first_party_demo: z.boolean().optional().nullable(),
  is_featured: z.boolean().optional().nullable(),
  built_for_letbuyy: z.boolean().optional().nullable(),
  built_for_letbuyy_awarded_at: z.string().datetime().optional().nullable(),
  built_for_letbuyy_checked_at: z.string().datetime().optional().nullable(),
  data_handling: MetadataSchema.optional().nullable(),
  support_sla: z.string().max(300).optional().nullable(),
  support_sla_response_minutes: z.number().int().nonnegative().optional().nullable(),
  status_url: UrlSchema.optional().nullable(),
  works_with: z.array(z.string().min(1)).optional().nullable(),
  conflict_app_ids: z.array(z.string().min(1)).optional().nullable(),
  health_status: z.string().max(80).optional().nullable(),
  health_checked_at: z.string().datetime().optional().nullable(),
  discovery_label: z.string().max(120).optional().nullable(),
  featured_disclosure: z.string().max(500).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceAppRecommendationsSchema = z.object({
  app_id: z.string().min(1),
  works_with: z.array(z.string().min(1)).default([]),
  alternatives: z.array(MarketplaceAppSchema).default([]),
  also_installed: z.array(MarketplaceAppSchema).default([]),
}).passthrough();

export const MarketplaceAppReviewSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  user_id: z.string().min(1).optional().nullable(),
  user_name: z.string().max(200).optional().nullable(),
  store_name: z.string().max(200).optional().nullable(),
  store_country: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  country_code: z.string().max(10).optional().nullable(),
  duration_using_app: z.string().max(120).optional().nullable(),
  usage_duration: z.string().max(120).optional().nullable(),
  installed_at: z.string().datetime().optional().nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().optional().nullable(),
  helpful_count: z.number().int().nonnegative().optional().nullable(),
  is_verified: z.boolean().optional().nullable(),
  verified_installation_id: z.string().min(1).optional().nullable(),
  proof_status: z.string().max(80).optional().nullable(),
  app_review_proofs: z.array(AppReviewProofSchema).optional().nullable(),
  developer_reply: z.string().optional().nullable(),
  developer_replied_at: z.string().datetime().optional().nullable(),
  developer_reply_by: z.string().min(1).optional().nullable(),
  reported_count: z.number().int().nonnegative().optional().nullable(),
  fraud_score: z.number().nonnegative().optional().nullable(),
  fraud_flags: z.array(z.string().min(1)).default([]),
  moderation_reason: z.string().optional().nullable(),
  status: z.string().max(80).optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const MarketplaceReviewRecordSchema = AuditedEntitySchema.extend({
  submission_type: MarketplaceSubmissionTypeSchema,
  resource_id: UuidSchema,
  resource_slug: z.string().min(1).max(200).optional().nullable(),
  resource_name: z.string().min(1).max(240),
  partner_user_id: UuidSchema,
  app_developer_id: UuidSchema.optional().nullable(),
  status: MarketplaceReviewStatusSchema,
  automated_checks: MetadataSchema.default({}),
  submitted_at: z.string().datetime(),
  reviewed_by: UuidSchema.optional().nullable(),
  reviewed_at: z.string().datetime().optional().nullable(),
  review_notes: z.string().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).passthrough();

export const InstalledMarketplaceAppSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(160).optional().nullable(),
  icon_url: UrlSchema.optional().nullable(),
  tagline: z.string().max(240).optional().nullable(),
  pricing_model: z.string().max(80).optional().nullable(),
  app_url: UrlSchema.optional().nullable(),
}).passthrough();

export const InstalledAppSchema = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  store_id: z.string().min(1),
  status: AppInstallationStatusSchema.or(z.string().min(1)),
  scopes_granted: z.array(z.string().min(1)).default([]),
  config: MetadataSchema.default({}),
  installed_at: z.string().datetime().optional().nullable(),
  uninstalled_at: z.string().datetime().optional().nullable(),
  marketplace_apps: InstalledMarketplaceAppSchema.optional().nullable(),
}).passthrough();

export const AdminAppEmbedSurfaceSchema = z.object({
  title: z.string().min(1).max(160),
  label: z.string().min(1).max(80),
  url: UrlSchema,
  origin: z.string().min(1).max(300),
  target: z.string().min(1).max(160).optional().nullable(),
  icon_url: UrlSchema.optional().nullable(),
  capabilities: z.array(AppBridgeCapabilitySchema).default(['api.fetch', 'toast', 'resize']),
}).strict();

export const MobileAdminAppBridgeHostPolicySchema = z.object({
  platform: z.literal('mobile_webview'),
  host_version: z.string().min(1).max(80),
  allowed_origin: z.string().min(1).max(300),
  allowed_navigation_origins: z.array(z.string().min(1).max(300)).default([]),
  js_namespace: z.string().min(1).max(80).default('LetBuyyAppBridge'),
  message_channel: z.string().min(1).max(80).default('LetBuyyAppBridge'),
  bridge_fetch_path: z.literal('/app-store/bridge/fetch'),
  token_transport: z.literal('native_bridge'),
  capabilities: z.array(AppBridgeCapabilitySchema).default(['api.fetch', 'toast', 'resize']),
  expires_at: z.string().datetime(),
}).strict();

export const AdminAppBridgeSessionSchema = z.object({
  installation: InstalledAppSchema,
  embed: AdminAppEmbedSurfaceSchema,
  bridge: z.object({
    version: z.string().min(1).max(40),
    token_type: z.literal('Bearer'),
    access_token: z.string().min(1),
    expires_at: z.string().datetime(),
    api_base_url: UrlSchema,
    store_id: z.string().min(1),
    installation_id: z.string().min(1),
    app_id: z.string().min(1),
    scopes: z.array(z.string().min(1)).default([]),
    capabilities: z.array(AppBridgeCapabilitySchema).default(['api.fetch', 'toast', 'resize']),
  }).strict(),
  mobile_host: MobileAdminAppBridgeHostPolicySchema.optional(),
}).strict();

export const AppBridgeApiFetchResultSchema = z.object({
  ok: z.boolean(),
  status: z.number().int().min(100).max(599),
  data: z.unknown().optional().nullable(),
  error: z.string().optional().nullable(),
}).strict();

export const AppExtensionRegistrationStatusSchema = z.enum(['enabled', 'disabled', 'revoked']);
export const AppExtensionRegistrationSchema = z.object({
  id: z.string().min(1),
  site_id: z.string().min(1),
  app_id: z.string().min(1),
  installation_id: z.string().min(1),
  extension_handle: z.string().min(1),
  extension_type: z.string().min(1),
  surface: z.enum(['admin.ui', 'checkout.ui', 'theme.app_block']).or(z.string().min(1)),
  target: z.string().min(1),
  renderer: z.enum(['iframe', 'web_component', 'liquid_app_block']).or(z.string().min(1)),
  source_url: UrlSchema.optional().nullable(),
  source_entrypoint: z.string().optional().nullable(),
  scopes: z.array(z.string().min(1)).default([]),
  capabilities: z.array(AppBridgeCapabilitySchema).default([]),
  settings: MetadataSchema.default({}),
  manifest_schema_version: z.string().min(1),
  app_version: z.string().optional().nullable(),
  status: AppExtensionRegistrationStatusSchema.or(z.string().min(1)),
  enabled_at: z.string().datetime().optional().nullable(),
  disabled_at: z.string().datetime().optional().nullable(),
  revoked_at: z.string().datetime().optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppFunctionRegistrationSchema = z.object({
  id: z.string().min(1),
  site_id: z.string().min(1),
  app_id: z.string().min(1),
  installation_id: z.string().min(1),
  function_handle: z.string().min(1),
  name: z.string().min(1),
  hooks: z.array(z.string().min(1)).default([]),
  runtime: z.literal('wasm').or(z.string().min(1)),
  wasm_module_url: UrlSchema,
  wasm_sha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  wasm_entrypoint: z.string().min(1),
  timeout_ms: z.number().int().min(1).max(5),
  memory_limit_kb: z.number().int().min(64).max(1024),
  input_schema: MetadataSchema.default({}),
  output_schema: MetadataSchema.default({}),
  config: MetadataSchema.default({}),
  manifest_schema_version: z.string().min(1),
  app_version: z.string().optional().nullable(),
  status: AppExtensionRegistrationStatusSchema.or(z.string().min(1)),
  enabled_at: z.string().datetime().optional().nullable(),
  disabled_at: z.string().datetime().optional().nullable(),
  revoked_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppExtensionRegistryResponseSchema = z.object({
  installation_id: z.string().min(1),
  app_id: z.string().min(1),
  store_id: z.string().min(1),
  extensions: z.array(AppExtensionRegistrationSchema).default([]),
  functions: z.array(AppFunctionRegistrationSchema).default([]),
}).strict();

export const StorefrontCheckoutExtensionRegistryResponseSchema = z.object({
  store_id: z.string().min(1),
  surface: z.literal('checkout.ui'),
  extensions: z.array(AppExtensionRegistrationSchema).default([]),
}).strict();

export const AppBillingChargeStatusSchema = z.enum([
  'pending_merchant_approval',
  'approved',
  'trialing',
  'active',
  'cancelled',
  'failed',
]);
export const AppBillingIndiaPayoutRailSchema = z.enum(['razorpay_route', 'upi', 'manual']);
export const AppBillingChargeProviderModeSchema = z.enum(['sandbox', 'live']);

export const AppBillingChargeSchema = z.object({
  id: UuidSchema,
  site_id: UuidSchema,
  app_id: UuidSchema,
  partner_id: UuidSchema,
  installation_id: UuidSchema,
  pricing_plan_id: UuidSchema.optional().nullable(),
  billing_mode: AppBillingChargeModeSchema,
  status: AppBillingChargeStatusSchema.or(z.string().min(1)),
  name: z.string().min(1).max(160),
  amount_minor: z.number().int().positive(),
  currency: z.literal('INR').default('INR'),
  trial_days: z.number().int().min(0).max(365).default(0),
  trial_starts_at: z.string().datetime().optional().nullable(),
  trial_ends_at: z.string().datetime().optional().nullable(),
  billing_starts_at: z.string().datetime().optional().nullable(),
  revenue_share_bps: z.number().int().min(0).max(10000).default(8500),
  partner_amount_minor: z.number().int().nonnegative(),
  platform_fee_minor: z.number().int().nonnegative(),
  partner_gst_bps: z.number().int().min(0).max(10000).default(1800),
  partner_gst_minor: z.number().int().nonnegative().default(0),
  payout_rail: AppBillingIndiaPayoutRailSchema.default('razorpay_route'),
  provider: AppBillingIndiaPayoutRailSchema.default('razorpay_route'),
  provider_mode: AppBillingChargeProviderModeSchema.default('sandbox'),
  provider_reference: z.string().max(200).optional().nullable(),
  approval_url: z.string().min(1).max(500).optional().nullable(),
  approved_by: z.string().min(1).optional().nullable(),
  approved_at: z.string().datetime().optional().nullable(),
  activated_at: z.string().datetime().optional().nullable(),
  idempotency_key: z.string().min(8).max(200),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppBillingChargeCreateSchema = z.object({
  store_id: UuidSchema,
  installation_id: UuidSchema,
  pricing_plan_id: UuidSchema.optional(),
  billing_mode: AppBillingChargeModeSchema.default('recurring'),
  name: z.string().trim().min(1).max(160),
  amount_minor: z.number().int().positive(),
  trial_days: z.number().int().min(0).max(365).default(0),
  idempotency_key: z.string().trim().min(8).max(200),
  return_url: UrlSchema.optional(),
  metadata: MetadataSchema.default({}),
}).strict();

export const AppBillingChargeApproveSchema = z.object({
  store_id: UuidSchema,
  charge_id: UuidSchema,
  idempotency_key: z.string().trim().min(8).max(200),
  provider_reference: z.string().trim().min(1).max(200).optional(),
  provider_payment_id: z.string().trim().min(1).max(200).optional(),
  provider_signature: z.string().trim().min(1).max(500).optional(),
  provider_mode: AppBillingChargeProviderModeSchema.default('sandbox'),
}).strict();

export const AppBillingChargeResultSchema = z.object({
  charge: AppBillingChargeSchema,
  approval: z.object({
    required: z.boolean(),
    url: z.string().min(1).max(500).optional().nullable(),
  }).optional(),
  billing: z.record(z.string(), z.unknown()).optional(),
  payout: z.record(z.string(), z.unknown()).optional(),
  payout_plan: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const AppUsageBillingStatusSchema = z.enum(['metered', 'trial_included', 'blocked']);

export const AppUsageEventCreateSchema = z.object({
  meter_name: z.string().trim().min(1).max(120),
  quantity: z.number().positive(),
  idempotency_key: z.string().trim().min(8).max(200),
  source: z.string().trim().min(1).max(80).optional(),
  resource_type: z.string().trim().min(1).max(80).optional(),
  resource_id: z.string().trim().min(1).max(200).optional(),
  metadata: MetadataSchema.default({}),
}).strict();

export const AppUsageEventSchema = z.object({
  id: UuidSchema,
  site_id: UuidSchema,
  app_id: UuidSchema,
  installation_id: UuidSchema,
  pricing_plan_id: UuidSchema.optional().nullable(),
  charge_id: UuidSchema.optional().nullable(),
  meter_name: z.string().min(1).max(120),
  quantity: z.number().positive(),
  billable_quantity: z.number().nonnegative().default(0),
  usage_unit: z.string().min(1).max(80).default('unit'),
  unit_amount_minor: z.number().int().nonnegative().default(0),
  amount_minor: z.number().int().nonnegative().default(0),
  currency: z.literal('INR').default('INR'),
  billing_status: AppUsageBillingStatusSchema.default('metered'),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  idempotency_key: z.string().min(8).max(200),
  source: z.string().min(1).max(80).default('app_api'),
  resource_type: z.string().max(80).optional().nullable(),
  resource_id: z.string().max(200).optional().nullable(),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppUsageMeterRollupSchema = z.object({
  id: UuidSchema,
  site_id: UuidSchema,
  app_id: UuidSchema,
  installation_id: UuidSchema,
  pricing_plan_id: UuidSchema.optional().nullable(),
  charge_id: UuidSchema.optional().nullable(),
  meter_name: z.string().min(1).max(120),
  usage_unit: z.string().min(1).max(80).default('unit'),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  quantity: z.number().nonnegative().default(0),
  included_quantity: z.number().nonnegative().default(0),
  billable_quantity: z.number().nonnegative().default(0),
  unit_amount_minor: z.number().int().nonnegative().default(0),
  amount_minor: z.number().int().nonnegative().default(0),
  currency: z.literal('INR').default('INR'),
  last_event_at: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppUsageMeteringResultSchema = z.object({
  event: AppUsageEventSchema,
  rollup: AppUsageMeterRollupSchema,
}).passthrough();

export const AppUsageSummarySchema = z.object({
  app_id: UuidSchema,
  rollups: z.array(AppUsageMeterRollupSchema).default([]),
  events: z.array(AppUsageEventSchema).default([]),
}).passthrough();

export const AppSpendControlEnforcementModeSchema = z.enum(['block', 'alert_only']);
export const AppSpendControlStatusSchema = z.enum(['active', 'disabled']);

export const AppSpendControlSchema = z.object({
  id: UuidSchema,
  site_id: UuidSchema,
  monthly_cap_minor: z.number().int().nonnegative().default(0),
  alert_threshold_minor: z.number().int().nonnegative().default(0),
  alerts_enabled: z.boolean().default(true),
  enforcement_mode: AppSpendControlEnforcementModeSchema.default('block'),
  status: AppSpendControlStatusSchema.default('active'),
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppSpendControlUpdateSchema = z.object({
  monthly_cap_minor: z.number().int().nonnegative().max(999_999_999).optional(),
  alert_threshold_minor: z.number().int().nonnegative().max(999_999_999).optional(),
  alerts_enabled: z.boolean().optional(),
  enforcement_mode: AppSpendControlEnforcementModeSchema.optional(),
  status: AppSpendControlStatusSchema.optional(),
}).strict();

export const AppSpendControlResultSchema = z.object({
  control: AppSpendControlSchema.optional().nullable(),
  spend: z.object({
    period_start: z.string().datetime(),
    period_end: z.string().datetime(),
    current_amount_minor: z.number().int().nonnegative(),
    projected_amount_minor: z.number().int().nonnegative().optional(),
    over_cap: z.boolean().default(false),
    over_alert_threshold: z.boolean().default(false),
  }),
}).passthrough();

export const PartnerPayoutLedgerEntrySchema = z.object({
  id: UuidSchema,
  partner_id: UuidSchema,
  site_id: UuidSchema.optional().nullable(),
  app_id: UuidSchema.optional().nullable(),
  installation_id: UuidSchema.optional().nullable(),
  charge_id: UuidSchema,
  billing_mode: AppBillingChargeModeSchema,
  amount_minor: z.number().int().nonnegative(),
  currency: z.literal('INR').default('INR'),
  revenue_share_bps: z.number().int().min(0).max(10000).default(8500),
  partner_amount_minor: z.number().int().nonnegative(),
  platform_fee_minor: z.number().int().nonnegative(),
  status: z.string().min(1).max(80),
  rail: AppBillingIndiaPayoutRailSchema,
  metadata: MetadataSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const PartnerDevelopmentStoreSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(200),
  subdomain: z.string().min(1).max(120).optional().nullable(),
  site_type: SiteTypeSchema.or(z.string().min(1)).optional().nullable(),
  status: z.string().min(1).max(80).optional().nullable(),
  role_slugs: z.array(z.string().min(1)).default([]),
  managed: z.boolean().default(false),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const PartnerCollaboratorAccessSchema = z.object({
  request_code: z.string().min(8).max(80),
  expires_at: z.string().datetime(),
  has_active_code: z.boolean().optional().default(false),
  scopes: z.array(z.string().min(1)).default([]),
  managed_stores: z.array(PartnerDevelopmentStoreSchema).default([]),
}).passthrough();

export const PartnerAnalyticsSchema = z.object({
  total_apps: z.number().int().nonnegative(),
  published_apps: z.number().int().nonnegative(),
  active_installations: z.number().int().nonnegative(),
  uninstalls: z.number().int().nonnegative(),
  charges: z.number().int().nonnegative(),
  gross_amount_minor: z.number().int().nonnegative(),
  partner_earnings_minor: z.number().int().nonnegative(),
  partner_gst_minor: z.number().int().nonnegative(),
  payout_pending_minor: z.number().int().nonnegative(),
  payout_released_minor: z.number().int().nonnegative(),
  currency: z.literal('INR').default('INR'),
}).passthrough();

export const PartnerAnalyticsPointSchema = z.object({
  metric_date: z.string().min(1),
  app_id: UuidSchema.optional().nullable(),
  installs: z.number().int().nonnegative().default(0),
  uninstalls: z.number().int().nonnegative().default(0),
  active_installations: z.number().int().nonnegative().default(0),
  reviews: z.number().int().nonnegative().default(0),
  usage_events: z.number().int().nonnegative().default(0),
  api_requests: z.number().int().nonnegative().default(0),
  api_errors: z.number().int().nonnegative().default(0),
  gross_amount_minor: z.number().int().nonnegative().default(0),
  partner_amount_minor: z.number().int().nonnegative().default(0),
  payout_released_minor: z.number().int().nonnegative().default(0),
  currency: z.literal('INR').default('INR'),
}).passthrough();

export const PartnerAnalyticsTimeseriesSchema = z.object({
  points: z.array(PartnerAnalyticsPointSchema).default([]),
  totals: PartnerAnalyticsSchema.partial().passthrough().default({}),
}).passthrough();

export const AppApiUsageMetricSchema = z.object({
  id: UuidSchema.optional().nullable(),
  app_id: UuidSchema,
  developer_id: UuidSchema.optional().nullable(),
  metric_date: z.string().min(1),
  route_group: z.string().min(1).max(160),
  method: z.string().min(1).max(16).default('GET'),
  request_count: z.number().int().nonnegative().default(0),
  error_count: z.number().int().nonnegative().default(0),
  avg_latency_ms: z.number().int().nonnegative().default(0),
  p95_latency_ms: z.number().int().nonnegative().default(0),
  metadata: JsonRecordSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppApiUsageSummarySchema = z.object({
  app_id: UuidSchema,
  metrics: z.array(AppApiUsageMetricSchema).default([]),
}).passthrough();

export const AppWebhookEndpointSchema = z.object({
  id: UuidSchema,
  app_id: UuidSchema,
  name: z.string().min(1).max(160).optional().nullable(),
  event: z.string().min(1).max(120),
  event_types: z.array(z.string().min(1).max(120)).default([]),
  url: UrlSchema,
  is_active: z.boolean().default(true),
  status: z.enum(['active', 'paused', 'disabled']).default('active'),
  last_delivery_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional().nullable(),
  updated_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppWebhookEndpointInputSchema = z.object({
  name: z.string().min(1).max(160).optional().nullable(),
  event: z.string().min(1).max(120),
  event_types: z.array(z.string().min(1).max(120)).default([]),
  url: UrlSchema,
  status: z.enum(['active', 'paused', 'disabled']).default('active'),
}).strict();

export const AppWebhookEndpointUpdateSchema = AppWebhookEndpointInputSchema.partial().strict();

export const PartnerCollaboratorRedeemInputSchema = z.object({
  request_code: z.string().min(8).max(120),
  site_id: UuidSchema,
}).strict();

export const PartnerTierSchema = z.object({
  id: UuidSchema,
  developer_id: UuidSchema,
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
  status: z.enum(['active', 'expired', 'revoked']).default('active'),
  awarded_at: z.string().datetime().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  criteria: JsonRecordSchema.default({}),
  metrics: JsonRecordSchema.default({}),
  reason: z.string().optional().nullable(),
}).passthrough();

export const AppSandboxStoreSchema = z.object({
  id: UuidSchema,
  developer_id: UuidSchema,
  site_id: UuidSchema.optional().nullable(),
  name: z.string().min(1).max(200),
  subdomain: z.string().optional().nullable(),
  status: z.enum(['requested', 'ready', 'failed', 'expired']),
  provisioning_mode: z.enum(['sandbox', 'test_store', 'manual']).default('sandbox'),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: JsonRecordSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppDemoSessionSchema = z.object({
  id: UuidSchema,
  app_id: UuidSchema,
  developer_id: UuidSchema,
  site_id: UuidSchema.optional().nullable(),
  demo_url: UrlSchema,
  status: z.enum(['active', 'expired', 'disabled']).default('active'),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: JsonRecordSchema.default({}),
  created_at: z.string().datetime().optional().nullable(),
}).passthrough();

export const AppTelemetryEventInputSchema = z.object({
  event_type: z.string().min(1).max(160),
  app_id: UuidSchema.optional().nullable(),
  site_id: UuidSchema.optional().nullable(),
  session_id: z.string().min(1).max(240).optional().nullable(),
  source: z.string().min(1).max(80).default('marketplace'),
  metadata: JsonRecordSchema.default({}),
  occurred_at: z.string().datetime().optional().nullable(),
}).strict();

export const AppTelemetryEventResultSchema = z.object({
  accepted: z.boolean(),
  event_id: UuidSchema.optional().nullable(),
}).passthrough();

export const PartnerDashboardSchema = z.object({
  developer: MarketplaceAppDeveloperSchema,
  apps: z.array(MarketplaceAppSchema).default([]),
  app_versions: z.array(AppVersionSchema).default([]),
  pricing_plans: z.array(AppPricingPlanSchema).default([]),
  review_records: z.array(MarketplaceReviewRecordSchema).default([]),
  charges: z.array(AppBillingChargeSchema).default([]),
  payouts: z.array(PartnerPayoutLedgerEntrySchema).default([]),
  development_stores: z.array(PartnerDevelopmentStoreSchema).default([]),
  collaborator_access: PartnerCollaboratorAccessSchema,
  analytics: PartnerAnalyticsSchema,
  analytics_timeseries: z.array(PartnerAnalyticsPointSchema).default([]),
  api_usage: z.array(AppApiUsageMetricSchema).default([]),
  partner_tiers: z.array(PartnerTierSchema).default([]),
  sandbox_stores: z.array(AppSandboxStoreSchema).default([]),
}).passthrough();

export const AppOAuthAuthorizationSchema = z.object({
  code: z.string().min(1),
  redirect_uri: UrlSchema,
  redirect_to: UrlSchema,
  state: z.string().max(500).optional().nullable(),
  scopes: z.array(z.string().min(1)).default([]),
  expires_at: z.string().datetime(),
  installation_id: z.string().min(1),
  app_id: z.string().min(1),
  store_id: z.string().min(1),
}).strict();

export const AppOAuthAuthorizationResultSchema = z.object({
  installation: InstalledAppSchema,
  authorization: AppOAuthAuthorizationSchema,
}).strict();

export const AppOAuthTokenResultSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  token_type: z.literal('Bearer'),
  expires_at: z.string().datetime(),
  refresh_expires_at: z.string().datetime().optional(),
  scope: z.string().default(''),
  scopes: z.array(z.string().min(1)).default([]),
  installation_id: z.string().min(1),
  app_id: z.string().min(1),
  store_id: z.string().min(1),
}).strict();

export const GraphQLPageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().min(1).optional().nullable(),
  endCursor: z.string().min(1).optional().nullable(),
}).strict();

export const GraphQLQueryCostSchema = z.object({
  requested: z.number().int().min(1).max(1000),
  actual: z.number().int().min(0).max(1000),
  maximumAvailable: z.number().int().min(0),
  currentlyAvailable: z.number().int().min(0),
  restoreRate: z.number().int().min(1),
  policy: z.string().min(1).max(120),
}).strict();

export const GraphQLApiSurfaceSchema = z.enum(['admin', 'storefront']);
export const GraphQLBulkOperationTypeSchema = z.enum(['query', 'mutation']);
export const GraphQLBulkOperationStatusSchema = z.enum([
  'created',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'expired',
]);

export const GraphQLBulkOperationSchema = z.object({
  id: UuidSchema,
  storeId: UuidSchema.optional().nullable(),
  apiSurface: GraphQLApiSurfaceSchema,
  operationType: GraphQLBulkOperationTypeSchema,
  status: GraphQLBulkOperationStatusSchema,
  query: z.string().min(1).max(500_000),
  variables: MetadataSchema.default({}),
  inputUrl: UrlSchema.optional().nullable(),
  resultUrl: UrlSchema.optional().nullable(),
  objectCount: z.number().int().min(0).default(0),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  errorCode: z.string().min(1).max(120).optional().nullable(),
  errorMessage: z.string().min(1).max(1000).optional().nullable(),
  idempotencyKey: z.string().min(8).max(200).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional().nullable(),
  startedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  metadata: MetadataSchema.default({}),
}).strict();

export type SiteType = z.infer<typeof SiteTypeSchema>;
export type StoreStatus = z.infer<typeof StoreStatusSchema>;
export type CustomDomainStatus = z.infer<typeof CustomDomainStatusSchema>;
export type DomainHealthRecord = z.infer<typeof DomainHealthRecordSchema>;
export type CustomDomainHealth = z.infer<typeof CustomDomainHealthSchema>;
export type DomainRegistrarProvider = z.infer<typeof DomainRegistrarProviderSchema>;
export type DomainAvailabilityQuote = z.infer<typeof DomainAvailabilityQuoteSchema>;
export type DomainCheckout = z.infer<typeof DomainCheckoutSchema>;
export type DomainPurchaseResult = z.infer<typeof DomainPurchaseResultSchema>;
export type StoreAccessMode = z.infer<typeof StoreAccessModeSchema>;
export type StoreHealthPillarStatus = z.infer<typeof StoreHealthPillarStatusSchema>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type InventoryPolicy = z.infer<typeof InventoryPolicySchema>;
export type InventoryAdjustmentReason = z.infer<typeof InventoryAdjustmentReasonSchema>;
export type CollectionStatus = z.infer<typeof CollectionStatusSchema>;
export type GiftCardStatus = z.infer<typeof GiftCardStatusSchema>;
export type ReviewModerationStatus = z.infer<typeof ReviewModerationStatusSchema>;
export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;
export type CartStatus = z.infer<typeof CartStatusSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type DraftOrderStatus = z.infer<typeof DraftOrderStatusSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type FulfillmentStatus = z.infer<typeof FulfillmentStatusSchema>;
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type SubscriptionBillingPeriod = z.infer<typeof SubscriptionBillingPeriodSchema>;
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
export type DiscountType = z.infer<typeof DiscountTypeSchema>;
export type PageStatus = z.infer<typeof PageStatusSchema>;
export type PolicyType = z.infer<typeof PolicyTypeSchema>;
export type BlogPostStatus = z.infer<typeof BlogPostStatusSchema>;
export type BlogCommentStatus = z.infer<typeof BlogCommentStatusSchema>;
export type FormSubmissionStatus = z.infer<typeof FormSubmissionStatusSchema>;
export type MediaType = z.infer<typeof MediaTypeSchema>;
export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriodSchema>;
export type AIGenerationStatus = z.infer<typeof AIGenerationStatusSchema>;
export type ResumeContentSection = z.infer<typeof ResumeContentSectionSchema>;
export type ThemeCategory = z.infer<typeof ThemeCategorySchema>;
export type ThemePricingType = z.infer<typeof ThemePricingTypeSchema>;
export type ShippingRateType = z.infer<typeof ShippingRateTypeSchema>;
export type TaxAppliesTo = z.infer<typeof TaxAppliesToSchema>;
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;
export type MerchantPayoutStatus = z.infer<typeof MerchantPayoutStatusSchema>;
export type MerchantPayoutRail = z.infer<typeof MerchantPayoutRailSchema>;
export type MerchantPayoutMode = z.infer<typeof MerchantPayoutModeSchema>;
export type WalletLedgerEntryType = z.infer<typeof WalletLedgerEntryTypeSchema>;
export type WalletLedgerDirection = z.infer<typeof WalletLedgerDirectionSchema>;
export type WalletLedgerStatus = z.infer<typeof WalletLedgerStatusSchema>;
export type CommissionReconciliationStatus = z.infer<typeof CommissionReconciliationStatusSchema>;
export type MerchantKycDocumentType = z.infer<typeof MerchantKycDocumentTypeSchema>;
export type MerchantKycDocumentStatus = z.infer<typeof MerchantKycDocumentStatusSchema>;
export type MerchantKycProviderMode = z.infer<typeof MerchantKycProviderModeSchema>;
export type MerchantKycOverallStatus = z.infer<typeof MerchantKycOverallStatusSchema>;
export type MerchantTwoFactorType = z.infer<typeof MerchantTwoFactorTypeSchema>;
export type MerchantTwoFactorStatus = z.infer<typeof MerchantTwoFactorStatusSchema>;
export type BusinessEntityType = z.infer<typeof BusinessEntityTypeSchema>;
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
export type InvoiceAddress = z.infer<typeof InvoiceAddressSchema>;
export type AuthSessionUser = z.infer<typeof AuthSessionUserSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
export type Store = z.infer<typeof StoreSchema>;
export type StoreSummary = z.infer<typeof StoreSummarySchema>;
export type StoreHealthPillar = z.infer<typeof StoreHealthPillarSchema>;
export type StoreHealth = z.infer<typeof StoreHealthSchema>;
export type StorefrontLocaleStatus = z.infer<typeof StorefrontLocaleStatusSchema>;
export type StorefrontTranslationResourceType = z.infer<typeof StorefrontTranslationResourceTypeSchema>;
export type StorefrontTranslationStatus = z.infer<typeof StorefrontTranslationStatusSchema>;
export type StoreMarketRoundingMode = z.infer<typeof StoreMarketRoundingModeSchema>;
export type StoreMarket = z.infer<typeof StoreMarketSchema>;
export type StorefrontLocale = z.infer<typeof StorefrontLocaleSchema>;
export type StorefrontTranslation = z.infer<typeof StorefrontTranslationSchema>;
export type StoreLocalizationSummary = z.infer<typeof StoreLocalizationSummarySchema>;
export type StoreMetafieldOwnerType = z.infer<typeof StoreMetafieldOwnerTypeSchema>;
export type StoreMetafieldValueType = z.infer<typeof StoreMetafieldValueTypeSchema>;
export type StoreMetafieldJsonValue = z.infer<typeof StoreMetafieldJsonValueSchema>;
export type StoreMetafieldDefinition = z.infer<typeof StoreMetafieldDefinitionSchema>;
export type StoreMetafieldValue = z.infer<typeof StoreMetafieldValueSchema>;
export type StoreMetafieldsSummary = z.infer<typeof StoreMetafieldsSummarySchema>;
export type MerchantPayoutStatement = z.infer<typeof MerchantPayoutStatementSchema>;
export type MerchantPayoutList = z.infer<typeof MerchantPayoutListSchema>;
export type WalletLedgerEntry = z.infer<typeof WalletLedgerEntrySchema>;
export type WalletBalance = z.infer<typeof WalletBalanceSchema>;
export type CommissionSchedule = z.infer<typeof CommissionScheduleSchema>;
export type CommissionReconciliationEntry = z.infer<typeof CommissionReconciliationEntrySchema>;
export type CommissionOverview = z.infer<typeof CommissionOverviewSchema>;
export type CodReconciliationStatus = z.infer<typeof CodReconciliationStatusSchema>;
export type CodReconciliationEntry = z.infer<typeof CodReconciliationEntrySchema>;
export type CodReconciliationOverview = z.infer<typeof CodReconciliationOverviewSchema>;
export type MerchantKycDocument = z.infer<typeof MerchantKycDocumentSchema>;
export type MerchantKycRequirement = z.infer<typeof MerchantKycRequirementSchema>;
export type MerchantKycOverview = z.infer<typeof MerchantKycOverviewSchema>;
export type MerchantTwoFactor = z.infer<typeof MerchantTwoFactorSchema>;
export type MerchantSessionInventoryItem = z.infer<typeof MerchantSessionInventoryItemSchema>;
export type MerchantTwoFactorOverview = z.infer<typeof MerchantTwoFactorOverviewSchema>;
export type MerchantTwoFactorEnrollment = z.infer<typeof MerchantTwoFactorEnrollmentSchema>;
export type ProductOption = z.infer<typeof ProductOptionSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type ProductVariant = Variant;
export type Product = z.infer<typeof ProductSchema>;
export type ProductBarcodeLookup = z.infer<typeof ProductBarcodeLookupSchema>;
export type ProductCategory = z.infer<typeof ProductCategorySchema>;
export type CollectionRule = z.infer<typeof CollectionRuleSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type GiftCard = z.infer<typeof GiftCardSchema>;
export type ProductReview = z.infer<typeof ProductReviewSchema>;
export type InventoryLevel = z.infer<typeof InventoryLevelSchema>;
export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type CustomerNote = z.infer<typeof CustomerNoteSchema>;
export type WhatsAppCapability = z.infer<typeof WhatsAppCapabilitySchema>;
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;
export type WhatsAppSendInput = z.infer<typeof WhatsAppSendInputSchema>;
export type WhatsAppSendResult = z.infer<typeof WhatsAppSendResultSchema>;
export type WhatsAppTemplate = z.infer<typeof WhatsAppTemplateSchema>;
export type WhatsAppTemplateKey = z.infer<typeof WhatsAppTemplateKeySchema>;
export type CustomerSegmentRules = z.infer<typeof CustomerSegmentRulesSchema>;
export type CustomerSegment = z.infer<typeof CustomerSegmentSchema>;
export type CustomerSegmentPreview = z.infer<typeof CustomerSegmentPreviewSchema>;
export type MarketingEmailCampaignStatus = z.infer<typeof MarketingEmailCampaignStatusSchema>;
export type MarketingEmailAudienceType = z.infer<typeof MarketingEmailAudienceTypeSchema>;
export type MarketingEmailDeliveryMode = z.infer<typeof MarketingEmailDeliveryModeSchema>;
export type MarketingEmailRecipientStatus = z.infer<typeof MarketingEmailRecipientStatusSchema>;
export type MarketingEmailAudience = z.infer<typeof MarketingEmailAudienceSchema>;
export type MarketingEmailCampaign = z.infer<typeof MarketingEmailCampaignSchema>;
export type MarketingEmailRecipient = z.infer<typeof MarketingEmailRecipientSchema>;
export type MarketingEmailAudiencePreview = z.infer<typeof MarketingEmailAudiencePreviewSchema>;
export type MarketingEmailSendResult = z.infer<typeof MarketingEmailSendResultSchema>;
export type CartLine = z.infer<typeof CartLineSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type OrderItem = LineItem;
export type DraftOrderLine = z.infer<typeof DraftOrderLineSchema>;
export type GstInvoiceParty = z.infer<typeof GstInvoicePartySchema>;
export type GstInvoiceLine = z.infer<typeof GstInvoiceLineSchema>;
export type GstInvoice = z.infer<typeof GstInvoiceSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type DraftOrder = z.infer<typeof DraftOrderSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type StoreSubscription = z.infer<typeof StoreSubscriptionSchema>;
export type StoreSubscriptionState = z.infer<typeof StoreSubscriptionStateSchema>;
export type BillingHistoryItem = z.infer<typeof BillingHistoryItemSchema>;
export type SubscriptionCancelResult = z.infer<typeof SubscriptionCancelResultSchema>;
export type SubscriptionOrderResult = z.infer<typeof SubscriptionOrderResultSchema>;
export type SubscriptionRecoveryResult = z.infer<typeof SubscriptionRecoveryResultSchema>;
export type SubscriptionVerificationResult = z.infer<typeof SubscriptionVerificationResultSchema>;
export type StorePaymentSettings = z.infer<typeof StorePaymentSettingsSchema>;
export type StorePaymentConfig = z.infer<typeof StorePaymentConfigSchema>;
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;
export type Employee = z.infer<typeof EmployeeSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type FileUploadResult = z.infer<typeof FileUploadResultSchema>;
export type AnalyticsMetric = z.infer<typeof AnalyticsMetricSchema>;
export type AnalyticsPeriodWindow = z.infer<typeof AnalyticsPeriodWindowSchema>;
export type AnalyticsComparison = z.infer<typeof AnalyticsComparisonSchema>;
export type AnalyticsDashboard = z.infer<typeof AnalyticsDashboardSchema>;
export type AnalyticsRevenuePoint = z.infer<typeof AnalyticsRevenuePointSchema>;
export type AnalyticsRevenue = z.infer<typeof AnalyticsRevenueSchema>;
export type AnalyticsOrdersBreakdown = z.infer<typeof AnalyticsOrdersBreakdownSchema>;
export type AnalyticsLiveViewEntry = z.infer<typeof AnalyticsLiveViewEntrySchema>;
export type AnalyticsLiveViewSignal = z.infer<typeof AnalyticsLiveViewSignalSchema>;
export type AnalyticsLiveView = z.infer<typeof AnalyticsLiveViewSchema>;
export type StorefrontAnalyticsEventType = z.infer<typeof StorefrontAnalyticsEventTypeSchema>;
export type StorefrontAnalyticsBeacon = z.infer<typeof StorefrontAnalyticsBeaconSchema>;
export type StorefrontAnalyticsBeaconResult = z.infer<typeof StorefrontAnalyticsBeaconResultSchema>;
export type AnalyticsTrafficSourceEntry = z.infer<typeof AnalyticsTrafficSourceEntrySchema>;
export type AnalyticsTrafficSources = z.infer<typeof AnalyticsTrafficSourcesSchema>;
export type AICreditBalance = z.infer<typeof AICreditBalanceSchema>;
export type AICreditPurchase = z.infer<typeof AICreditPurchaseSchema>;
export type AIUsageRecord = z.infer<typeof AIUsageRecordSchema>;
export type AIOperatorRequest = z.infer<typeof AIOperatorRequestSchema>;
export type AIOperatorTool = z.infer<typeof AIOperatorToolSchema>;
export type AIOperatorToolCall = z.infer<typeof AIOperatorToolCallSchema>;
export type AIOperatorToolStatus = z.infer<typeof AIOperatorToolStatusSchema>;
export type AIOperatorResponse = z.infer<typeof AIOperatorResponseSchema>;
export type AIHomepageGenerationRequest = z.infer<typeof AIHomepageGenerationRequestSchema>;
export type AIHomepageDraftSection = z.infer<typeof AIHomepageDraftSectionSchema>;
export type AIHomepageGenerationResult = z.infer<typeof AIHomepageGenerationResultSchema>;
export type Coupon = z.infer<typeof CouponSchema>;
export type ShippingZone = z.infer<typeof ShippingZoneSchema>;
export type ShippingRate = z.infer<typeof ShippingRateSchema>;
export type TaxRate = z.infer<typeof TaxRateSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type NavigationMenu = z.infer<typeof NavigationMenuSchema>;
export type NavigationItem = z.infer<typeof NavigationItemSchema>;
export type NavigationResponse = z.infer<typeof NavigationResponseSchema>;
export type ReplaceNavigationResult = z.infer<typeof ReplaceNavigationResultSchema>;
export type BlogPost = z.infer<typeof BlogPostSchema>;
export type BlogComment = z.infer<typeof BlogCommentSchema>;
export type FormSubmission = z.infer<typeof FormSubmissionSchema>;
export type ResumeContentItem = z.infer<typeof ResumeContentItemSchema>;
export type ThemeSettingField = z.infer<typeof ThemeSettingFieldSchema>;
export type ThemeSettings = z.infer<typeof ThemeSettingsSchema>;
export type ThemeBlock = z.infer<typeof ThemeBlockSchema>;
export type ThemeSection = z.infer<typeof ThemeSectionSchema>;
export type ThemeTemplate = z.infer<typeof ThemeTemplateSchema>;
export type ThemeBundle = z.infer<typeof ThemeBundleSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeEditableSchemaResponse = z.infer<typeof ThemeEditableSchemaResponseSchema>;
export type ThemeEditorPayload = z.infer<typeof ThemeEditorPayloadSchema>;
export type ThemeDraftSaveResult = z.infer<typeof ThemeDraftSaveResultSchema>;
export type ThemePublishedRelease = z.infer<typeof ThemePublishedReleaseSchema>;
export type ThemePublishResult = z.infer<typeof ThemePublishResultSchema>;
export type ThemePreviewSessionResult = z.infer<typeof ThemePreviewSessionResultSchema>;
export type ThemeRelease = z.infer<typeof ThemeReleaseSchema>;
export type ThemeRollbackResult = z.infer<typeof ThemeRollbackResultSchema>;
export type AppInstallationStatus = z.infer<typeof AppInstallationStatusSchema>;
export type MarketplaceAppType = z.infer<typeof MarketplaceAppTypeSchema>;
export type MarketplaceAppStatus = z.infer<typeof MarketplaceAppStatusSchema>;
export type MarketplaceAppPricingModel = z.infer<typeof MarketplaceAppPricingModelSchema>;
export type MarketplaceAppExtensionType = z.infer<typeof MarketplaceAppExtensionTypeSchema>;
export type MarketplaceAppCategory = z.infer<typeof MarketplaceAppCategorySchema>;
export type MarketplaceAppFeatureTag = z.infer<typeof MarketplaceAppFeatureTagSchema>;
export type MarketplaceAppFeatureGroup = z.infer<typeof MarketplaceAppFeatureGroupSchema>;
export type MarketplaceAppAward = z.infer<typeof MarketplaceAppAwardSchema>;
export type MarketplaceAppReviewSummary = z.infer<typeof MarketplaceAppReviewSummarySchema>;
export type MarketplaceAppCollectionSection = z.infer<typeof MarketplaceAppCollectionSectionSchema>;
export type MarketplaceAppCollectionReference = z.infer<typeof MarketplaceAppCollectionReferenceSchema>;
export type MarketplaceAppCollection = z.infer<typeof MarketplaceAppCollectionSchema>;
export type AppDiscoveryEventInput = z.infer<typeof AppDiscoveryEventInputSchema>;
export type AppDiscoveryEventResult = z.infer<typeof AppDiscoveryEventResultSchema>;
export type AppRequestInput = z.infer<typeof AppRequestInputSchema>;
export type AppRequestResult = z.infer<typeof AppRequestResultSchema>;
export type AppSavedAppInput = z.infer<typeof AppSavedAppInputSchema>;
export type AppSavedApp = z.infer<typeof AppSavedAppSchema>;
export type AppSavedAppsResult = z.infer<typeof AppSavedAppsResultSchema>;
export type AppTrustReportInput = z.infer<typeof AppTrustReportInputSchema>;
export type AppReviewReplyInput = z.infer<typeof AppReviewReplyInputSchema>;
export type AppTrustReportResult = z.infer<typeof AppTrustReportResultSchema>;
export type AppReviewPolicy = z.infer<typeof AppReviewPolicySchema>;
export type AppActivityEvent = z.infer<typeof AppActivityEventSchema>;
export type AppBundle = z.infer<typeof AppBundleSchema>;
export type AppReviewProof = z.infer<typeof AppReviewProofSchema>;
export type AppReviewModerationItem = z.infer<typeof AppReviewModerationItemSchema>;
export type MarketplaceAppDeveloper = z.infer<typeof MarketplaceAppDeveloperSchema>;
export type MarketplaceAppExtension = z.infer<typeof MarketplaceAppExtensionSchema>;
export type AppPricingPlanInterval = z.infer<typeof AppPricingPlanIntervalSchema>;
export type AppPricingPlanStatus = z.infer<typeof AppPricingPlanStatusSchema>;
export type AppPricingPlanInput = z.infer<typeof AppPricingPlanInputSchema>;
export type AppPricingPlanUpdate = z.infer<typeof AppPricingPlanUpdateSchema>;
export type AppPricingPlan = z.infer<typeof AppPricingPlanSchema>;
export type AppVersionStatus = z.infer<typeof AppVersionStatusSchema>;
export type AppVersionInput = z.infer<typeof AppVersionInputSchema>;
export type AppListingUpdate = z.infer<typeof AppListingUpdateSchema>;
export type AppVersion = z.infer<typeof AppVersionSchema>;
export type AppVersionsResult = z.infer<typeof AppVersionsResultSchema>;
export type MarketplaceApp = z.infer<typeof MarketplaceAppSchema>;
export type MarketplaceAppRecommendations = z.infer<typeof MarketplaceAppRecommendationsSchema>;
export type MarketplaceAppReview = z.infer<typeof MarketplaceAppReviewSchema>;
export type MarketplaceSubmissionType = z.infer<typeof MarketplaceSubmissionTypeSchema>;
export type MarketplaceReviewStatus = z.infer<typeof MarketplaceReviewStatusSchema>;
export type ReviewCheckType = z.infer<typeof ReviewCheckTypeSchema>;
export type ReviewCheckResult = z.infer<typeof ReviewCheckResultSchema>;
export type ReviewCheckRun = z.infer<typeof ReviewCheckRunSchema>;
export type MarketplaceReviewAutomatedChecks = z.infer<typeof MarketplaceReviewAutomatedChecksSchema>;
export type ExecutiveMetricDefinition = z.infer<typeof ExecutiveMetricDefinitionSchema>;
export type ExecutiveRollupFreshness = z.infer<typeof ExecutiveRollupFreshnessSchema>;
export type ExecutiveMrrRollup = z.infer<typeof ExecutiveMrrRollupSchema>;
export type ExecutiveMetricRollup = z.infer<typeof ExecutiveMetricRollupSchema>;
export type ExecutiveCohortSnapshot = z.infer<typeof ExecutiveCohortSnapshotSchema>;
export type ExecutiveFunnelStep = z.infer<typeof ExecutiveFunnelStepSchema>;
export type ExecutiveMrrAnalytics = z.infer<typeof ExecutiveMrrAnalyticsSchema>;
export type ExecutiveFunnelAnalytics = z.infer<typeof ExecutiveFunnelAnalyticsSchema>;
export type ExecutiveCohortAnalytics = z.infer<typeof ExecutiveCohortAnalyticsSchema>;
export type ExecutiveCompanyHealth = z.infer<typeof ExecutiveCompanyHealthSchema>;
export type MarketplaceReviewRecord = z.infer<typeof MarketplaceReviewRecordSchema>;
export type AppBridgeCapability = z.infer<typeof AppBridgeCapabilitySchema>;
export type InstalledMarketplaceApp = z.infer<typeof InstalledMarketplaceAppSchema>;
export type InstalledApp = z.infer<typeof InstalledAppSchema>;
export type AdminAppEmbedSurface = z.infer<typeof AdminAppEmbedSurfaceSchema>;
export type MobileAdminAppBridgeHostPolicy = z.infer<typeof MobileAdminAppBridgeHostPolicySchema>;
export type AdminAppBridgeSession = z.infer<typeof AdminAppBridgeSessionSchema>;
export type AppBridgeApiFetchResult = z.infer<typeof AppBridgeApiFetchResultSchema>;
export type AppExtensionRegistrationStatus = z.infer<typeof AppExtensionRegistrationStatusSchema>;
export type AppExtensionRegistration = z.infer<typeof AppExtensionRegistrationSchema>;
export type AppFunctionRegistration = z.infer<typeof AppFunctionRegistrationSchema>;
export type AppExtensionRegistryResponse = z.infer<typeof AppExtensionRegistryResponseSchema>;
export type StorefrontCheckoutExtensionRegistryResponse = z.infer<typeof StorefrontCheckoutExtensionRegistryResponseSchema>;
export type AppBillingChargeMode = z.infer<typeof AppBillingChargeModeSchema>;
export type AppBillingChargeStatus = z.infer<typeof AppBillingChargeStatusSchema>;
export type AppBillingIndiaPayoutRail = z.infer<typeof AppBillingIndiaPayoutRailSchema>;
export type AppBillingChargeProviderMode = z.infer<typeof AppBillingChargeProviderModeSchema>;
export type AppBillingCharge = z.infer<typeof AppBillingChargeSchema>;
export type AppBillingChargeCreate = z.infer<typeof AppBillingChargeCreateSchema>;
export type AppBillingChargeApprove = z.infer<typeof AppBillingChargeApproveSchema>;
export type AppBillingChargeResult = z.infer<typeof AppBillingChargeResultSchema>;
export type AppUsageBillingStatus = z.infer<typeof AppUsageBillingStatusSchema>;
export type AppUsageEventCreate = z.infer<typeof AppUsageEventCreateSchema>;
export type AppUsageEvent = z.infer<typeof AppUsageEventSchema>;
export type AppUsageMeterRollup = z.infer<typeof AppUsageMeterRollupSchema>;
export type AppUsageMeteringResult = z.infer<typeof AppUsageMeteringResultSchema>;
export type AppUsageSummary = z.infer<typeof AppUsageSummarySchema>;
export type AppSpendControl = z.infer<typeof AppSpendControlSchema>;
export type AppSpendControlUpdate = z.infer<typeof AppSpendControlUpdateSchema>;
export type AppSpendControlResult = z.infer<typeof AppSpendControlResultSchema>;
export type PartnerPayoutLedgerEntry = z.infer<typeof PartnerPayoutLedgerEntrySchema>;
export type PartnerDevelopmentStore = z.infer<typeof PartnerDevelopmentStoreSchema>;
export type PartnerCollaboratorAccess = z.infer<typeof PartnerCollaboratorAccessSchema>;
export type PartnerAnalytics = z.infer<typeof PartnerAnalyticsSchema>;
export type PartnerAnalyticsPoint = z.infer<typeof PartnerAnalyticsPointSchema>;
export type PartnerAnalyticsTimeseries = z.infer<typeof PartnerAnalyticsTimeseriesSchema>;
export type AppApiUsageMetric = z.infer<typeof AppApiUsageMetricSchema>;
export type AppApiUsageSummary = z.infer<typeof AppApiUsageSummarySchema>;
export type AppWebhookEndpoint = z.infer<typeof AppWebhookEndpointSchema>;
export type AppWebhookEndpointInput = z.infer<typeof AppWebhookEndpointInputSchema>;
export type AppWebhookEndpointUpdate = z.infer<typeof AppWebhookEndpointUpdateSchema>;
export type PartnerCollaboratorRedeemInput = z.infer<typeof PartnerCollaboratorRedeemInputSchema>;
export type PartnerTier = z.infer<typeof PartnerTierSchema>;
export type AppSandboxStore = z.infer<typeof AppSandboxStoreSchema>;
export type AppDemoSession = z.infer<typeof AppDemoSessionSchema>;
export type AppTelemetryEventInput = z.infer<typeof AppTelemetryEventInputSchema>;
export type AppTelemetryEventResult = z.infer<typeof AppTelemetryEventResultSchema>;
export type PartnerDashboard = z.infer<typeof PartnerDashboardSchema>;
export type AppOAuthAuthorization = z.infer<typeof AppOAuthAuthorizationSchema>;
export type AppOAuthAuthorizationResult = z.infer<typeof AppOAuthAuthorizationResultSchema>;
export type AppOAuthTokenResult = z.infer<typeof AppOAuthTokenResultSchema>;
export type GraphQLPageInfo = z.infer<typeof GraphQLPageInfoSchema>;
export type GraphQLQueryCost = z.infer<typeof GraphQLQueryCostSchema>;
export type GraphQLApiSurface = z.infer<typeof GraphQLApiSurfaceSchema>;
export type GraphQLBulkOperationType = z.infer<typeof GraphQLBulkOperationTypeSchema>;
export type GraphQLBulkOperationStatus = z.infer<typeof GraphQLBulkOperationStatusSchema>;
export type GraphQLBulkOperation = z.infer<typeof GraphQLBulkOperationSchema>;

export interface GraphQLConnectionEdge<TNode> {
  cursor: string;
  node: TNode;
}

export interface GraphQLConnection<TNode> {
  edges: GraphQLConnectionEdge<TNode>[];
  nodes: TNode[];
  pageInfo: GraphQLPageInfo;
  totalCount?: number;
  queryCost?: GraphQLQueryCost;
}

export const RuntimeEnvironmentSchema = z.enum(['local', 'development', 'staging', 'production']);

export const FeatureFlagScopeSchema = z.enum([
  'tenant',
  'percentage',
  'internal',
  'region',
  'environment',
]);

export const FeatureFlagRuleSchema = z.object({
  id: z.string().min(1).max(120),
  scope: FeatureFlagScopeSchema,
  enabled: z.boolean().default(true),
  tenantSiteIds: z.array(UuidSchema).optional(),
  regions: z.array(z.string().min(1).max(64)).optional(),
  environments: z.array(RuntimeEnvironmentSchema).optional(),
  percentage: z.number().min(0).max(100).optional(),
  variant: z.string().min(1).max(120).optional(),
});

export const FeatureFlagDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/, 'Feature flag keys must be stable lowercase identifiers'),
  enabled: z.boolean().default(false),
  killSwitch: z.boolean().default(false),
  ownerRuntime: z.string().min(1).max(160),
  defaultVariant: z.string().min(1).max(120).optional(),
  rules: z.array(FeatureFlagRuleSchema).default([]),
  expiresAt: z.string().datetime().optional(),
});

export const FeatureFlagContextSchema = z.object({
  environment: RuntimeEnvironmentSchema,
  tenantSiteId: UuidSchema.optional(),
  actorId: UuidSchema.optional(),
  anonymousKey: z.string().min(1).max(240).optional(),
  region: z.string().min(1).max(64).optional(),
  internal: z.boolean().default(false),
});

export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;
export type FeatureFlagScope = z.infer<typeof FeatureFlagScopeSchema>;
export type FeatureFlagRule = z.infer<typeof FeatureFlagRuleSchema>;
export type FeatureFlagDefinition = z.infer<typeof FeatureFlagDefinitionSchema>;
export type FeatureFlagContext = z.infer<typeof FeatureFlagContextSchema>;

export interface FeatureFlagEvaluation {
  flagKey: string;
  enabled: boolean;
  variant?: string;
  reason:
    | 'kill_switch'
    | 'flag_disabled'
    | 'expired'
    | 'rule_match'
    | 'no_matching_rule'
    | 'percentage_miss';
  ruleId?: string;
  bucket?: number;
}

function stableBucket(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function rolloutIdentity(context: FeatureFlagContext): string {
  return context.tenantSiteId ?? context.actorId ?? context.anonymousKey ?? 'anonymous';
}

function ruleMatches(rule: FeatureFlagRule, context: FeatureFlagContext, flagKey: string): { matched: boolean; bucket?: number } {
  if (rule.scope === 'tenant') {
    return { matched: Boolean(context.tenantSiteId && rule.tenantSiteIds?.includes(context.tenantSiteId)) };
  }

  if (rule.scope === 'internal') {
    return { matched: context.internal === true };
  }

  if (rule.scope === 'region') {
    return { matched: Boolean(context.region && rule.regions?.includes(context.region)) };
  }

  if (rule.scope === 'environment') {
    return { matched: Boolean(rule.environments?.includes(context.environment)) };
  }

  const bucket = stableBucket(`${flagKey}:${rolloutIdentity(context)}`);
  return { matched: bucket < (rule.percentage ?? 0), bucket };
}

export function evaluateFeatureFlag(
  definition: FeatureFlagDefinition,
  context: FeatureFlagContext,
  evaluatedAt: Date = new Date(),
): FeatureFlagEvaluation {
  if (definition.killSwitch) {
    return { flagKey: definition.key, enabled: false, reason: 'kill_switch' };
  }

  if (!definition.enabled) {
    return { flagKey: definition.key, enabled: false, reason: 'flag_disabled' };
  }

  if (definition.expiresAt && Date.parse(definition.expiresAt) <= evaluatedAt.getTime()) {
    return { flagKey: definition.key, enabled: false, reason: 'expired' };
  }

  for (const rule of definition.rules) {
    const result = ruleMatches(rule, context, definition.key);
    if (!result.matched) continue;

    return {
      flagKey: definition.key,
      enabled: rule.enabled,
      variant: rule.variant ?? definition.defaultVariant,
      reason: 'rule_match',
      ruleId: rule.id,
      bucket: result.bucket,
    };
  }

  return {
    flagKey: definition.key,
    enabled: false,
    variant: definition.defaultVariant,
    reason: definition.rules.some((rule) => rule.scope === 'percentage') ? 'percentage_miss' : 'no_matching_rule',
  };
}

export function featureFlagExposureTelemetry(
  evaluation: FeatureFlagEvaluation,
  context: FeatureFlagContext,
  evaluatedAt: Date = new Date(),
): JsonRecord {
  return {
    flag_key: evaluation.flagKey,
    enabled: evaluation.enabled,
    variant: evaluation.variant ?? null,
    reason: evaluation.reason,
    rule_id: evaluation.ruleId ?? null,
    bucket: evaluation.bucket ?? null,
    environment: context.environment,
    tenant_site_id: context.tenantSiteId ?? null,
    actor_id: context.actorId ?? null,
    region: context.region ?? null,
    internal: context.internal === true,
    evaluated_at: evaluatedAt.toISOString(),
  };
}

export * from './reel-upload';
export { BuyerAssistantRequestSchema, BuyerAssistantResponseSchema } from './buyer-assistant';
export type { BuyerAssistantRequest, BuyerAssistantResponse } from './buyer-assistant';

export { calculateGstAmounts } from './gst-amounts';
