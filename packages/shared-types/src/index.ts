import { z } from 'zod';

export const UuidSchema = z.string().uuid('Must be a valid UUID');

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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

export const MoneySchema = z
  .number()
  .min(0, 'Amount cannot be negative')
  .max(99_999_999.99, 'Amount exceeds maximum');

export const CurrencySchema = z.string().length(3).toUpperCase().default('INR');

export const AddressSchema = z.object({
  line1: z.string().min(1).max(500),
  line2: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zip: z.string().min(3).max(20),
  country: z.string().length(2).toUpperCase().default('IN'),
});

export const SeoSchema = z.object({
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(160).optional(),
  og_image_url: UrlSchema.optional(),
});

export type PaginationQueryInput = z.infer<typeof PaginationQuery>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type CurrencyCode = z.infer<typeof CurrencySchema>;

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
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
}

export type JsonRecord = Record<string, unknown>;

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
