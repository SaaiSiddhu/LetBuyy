import { z } from 'zod';
import type { RuntimeEventEnvelope } from '@letbuyy/event-core';

export type SubscriptionTier = 'free' | 'starter' | 'business' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionBillingPeriod = 'monthly' | 'yearly';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export const BillingPlanSchema = z.object({
  plan_id: z.string().min(1).max(120),
  tier: z.enum(['free', 'starter', 'business', 'enterprise']),
  billing_cycle: z.enum(['monthly', 'annual']).default('monthly'),
  currency: z.enum(['INR']).default('INR'),
  amount: z.number().min(0),
  entitlements: z.record(z.string(), z.unknown()).default({}),
});

export const CreateSubscriptionSchema = z.object({
  site_id: z.string().uuid(),
  plan_id: z.string().min(1).max(120),
  billing_cycle: z.enum(['monthly', 'annual']).default('monthly'),
  idempotency_key: z.string().min(8).max(200),
});

export const StoreSubscriptionQuerySchema = z.object({
  store_id: z.string().uuid(),
});

export const PlanListQuerySchema = z.object({
  site_type: z.string().min(1),
  slug: z.string().min(1).optional(),
});

export const CancelSubscriptionSchema = z.object({
  store_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const MerchantApprovedUsageChargeSchema = z.object({
  meter_name: z.string().min(1).max(120),
  description: z.string().min(1).max(200).optional(),
  amount_minor: z.number().int().positive(),
  quantity: z.number().int().positive().max(999).default(1),
  idempotency_key: z.string().min(8).max(200),
});

export const CreateSubscriptionOrderSchema = z.object({
  store_id: z.string().uuid(),
  plan_slug: z.string().min(1),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  site_type: z.string().min(1),
  approved_usage_charges: z.array(MerchantApprovedUsageChargeSchema).max(20).default([]),
});

export const VerifySubscriptionSchema = z.object({
  store_id: z.string().uuid(),
  plan_slug: z.string().min(1),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  site_type: z.string().min(1),
  razorpay_order_id: z.string().min(1).optional(),
  razorpay_subscription_id: z.string().min(1).optional(),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
}).refine((value) => Boolean(value.razorpay_order_id || value.razorpay_subscription_id), {
  message: 'Razorpay order id or subscription id is required',
  path: ['razorpay_order_id'],
});

export const AppChargeBillingModeSchema = z.enum(['recurring', 'usage']);
export const AppChargeStatusSchema = z.enum([
  'pending_merchant_approval',
  'approved',
  'active',
  'cancelled',
  'failed',
]);
export const IndiaPayoutRailSchema = z.enum(['razorpay_route', 'razorpayx', 'upi', 'manual']);
export const AppChargeProviderModeSchema = z.enum(['test', 'live']);

export const CreateAppBillingChargeSchema = z.object({
  store_id: z.string().uuid(),
  installation_id: z.string().uuid(),
  billing_mode: AppChargeBillingModeSchema.default('recurring'),
  name: z.string().trim().min(1).max(160),
  amount_minor: z.number().int().positive(),
  currency: z.enum(['INR']).default('INR'),
  idempotency_key: z.string().trim().min(8).max(200),
  return_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const ApproveAppBillingChargeSchema = z.object({
  store_id: z.string().uuid(),
  charge_id: z.string().uuid(),
  idempotency_key: z.string().trim().min(8).max(200),
  provider_reference: z.string().trim().min(1).max(200).optional(),
  provider_mode: AppChargeProviderModeSchema.default('test'),
});

export interface BillingPlan {
  plan_id: string;
  tier: SubscriptionTier;
  billing_cycle: BillingCycle;
  currency: 'INR';
  amount: number;
  entitlements: Record<string, unknown>;
}

export interface SubscriptionContract {
  id: string;
  site_id: string;
  plan_id: string;
  tier: SubscriptionTier;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  provider?: 'razorpay' | 'stripe' | 'manual';
}

export interface InvoiceDto {
  id: string;
  site_id: string;
  subscription_id?: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  due_at?: string;
  paid_at?: string;
}

export type BillingEvent = RuntimeEventEnvelope<{
  site_id: string;
  subscription_id?: string;
  invoice_id?: string;
  plan_id?: string;
}>;

export interface MerchantApprovedUsageCharge {
  meter_name: string;
  description?: string;
  amount_minor: number;
  quantity: number;
  idempotency_key: string;
}

export interface BillingPlanCatalogRecord {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  is_popular?: boolean | null;
  price_monthly_inr?: number | null;
  price_yearly_inr?: number | null;
  promo_price_inr?: number | null;
  promo_months?: number | null;
  promo_label?: string | null;
  gmv_percentage?: number | null;
  products_limit?: number | null;
  orders_limit?: number | null;
  storage_mb?: number | null;
  staff_limit?: number | null;
  ai_credits_monthly?: number | null;
  requires_contact?: boolean | null;
  razorpay_plan_id_monthly?: string | null;
  razorpay_plan_id_yearly?: string | null;
  features?: unknown;
  compare_features?: unknown;
  limits?: Record<string, unknown> | null;
  entitlements?: Record<string, unknown> | null;
}

export interface BillingTierEntitlementSnapshot {
  plan: SubscriptionTier;
  features: string[];
  limits: Record<string, number | null>;
  entitlements: Record<string, boolean | number | string | null>;
}

export interface StoreBillingTierDefinition extends BillingTierEntitlementSnapshot {
  site_type: 'store';
  slug: SubscriptionTier;
  name: string;
  tagline: string;
  display_order: number;
  is_popular: boolean;
  requires_contact: boolean;
  price_monthly_inr: number;
  price_yearly_inr: number;
  gmv_percentage: number;
  trial_days: number;
  features_view: Array<{ label: string; icon: string }>;
}

export type MerchantBillingCheckoutMode = 'free_activation' | 'razorpay_subscription' | 'razorpay_order';
export type AppChargeBillingMode = z.infer<typeof AppChargeBillingModeSchema>;
export type AppChargeStatus = z.infer<typeof AppChargeStatusSchema>;
export type IndiaPayoutRail = z.infer<typeof IndiaPayoutRailSchema>;
export type AppChargeProviderMode = z.infer<typeof AppChargeProviderModeSchema>;

export interface MerchantBillingCheckoutPlan {
  mode: MerchantBillingCheckoutMode;
  amount_minor: number;
  currency: 'INR';
  billing_period: SubscriptionBillingPeriod;
  is_promo: boolean;
  plan_payload: Record<string, unknown>;
  order?: {
    amount: number;
    currency: 'INR';
    receipt: string;
    notes: Record<string, string>;
  };
  subscription?: {
    plan_id: string;
    total_count: number;
    quantity: number;
    customer_notify: boolean;
    addons: Array<{
      item: {
        name: string;
        amount: number;
        currency: 'INR';
      };
      quantity: number;
    }>;
    notes: Record<string, string>;
  };
}

export interface AppBillingChargePayoutPlan {
  amount_minor: number;
  currency: 'INR';
  revenue_share_bps: number;
  partner_amount_minor: number;
  platform_fee_minor: number;
  partner_gst_bps: number;
  partner_gst_minor: number;
  payout_rail: IndiaPayoutRail;
  provider: 'razorpay_route' | 'razorpayx' | 'upi' | 'manual';
  provider_mode: AppChargeProviderMode;
}

export interface AppBillingChargePlan {
  app_id: string;
  installation_id: string;
  store_id: string;
  partner_id: string;
  billing_mode: AppChargeBillingMode;
  status: 'pending_merchant_approval';
  name: string;
  amount_minor: number;
  currency: 'INR';
  idempotency_key: string;
  approval_url: string;
  payout: AppBillingChargePayoutPlan;
  metadata: Record<string, unknown>;
}

export const INDIA_APP_PAYOUT_RAILS: readonly IndiaPayoutRail[] = [
  'razorpay_route',
  'razorpayx',
  'upi',
  'manual',
];
export const DEFAULT_APP_REVENUE_SHARE_BPS = 8000;
export const DEFAULT_PARTNER_GST_BPS = 1800;

// Interim India-native tier contract for local/test wiring. Final production
// price points remain an owner policy decision and are recorded in the ledger.
export const STORE_BILLING_TIER_DEFINITIONS: readonly StoreBillingTierDefinition[] = [
  {
    site_type: 'store',
    slug: 'free',
    plan: 'free',
    name: 'Free',
    tagline: 'Start selling with the essentials',
    display_order: 0,
    is_popular: false,
    requires_contact: false,
    price_monthly_inr: 0,
    price_yearly_inr: 0,
    gmv_percentage: 2.5,
    trial_days: 0,
    features: ['storefront', 'products', 'orders'],
    limits: {
      products: 25,
      orders_monthly: 50,
      storage_mb: 100,
      staff: 1,
      ai_credits_monthly: 5,
      api_requests_monthly: 1000,
      webhook_subscriptions: 0,
    },
    entitlements: {
      custom_domain: false,
      remove_branding: false,
      multi_location_inventory: false,
      advanced_promotions: false,
      api_access: false,
    },
    features_view: [
      { label: '25 products', icon: 'inventory_2' },
      { label: '50 orders/month', icon: 'shopping_bag' },
      { label: '100 MB storage', icon: 'cloud' },
      { label: 'LetBuyy branding', icon: 'storefront' },
    ],
  },
  {
    site_type: 'store',
    slug: 'starter',
    plan: 'starter',
    name: 'Starter',
    tagline: 'For solo entrepreneurs launching their first store',
    display_order: 1,
    is_popular: false,
    requires_contact: false,
    price_monthly_inr: 39900,
    price_yearly_inr: 31900,
    gmv_percentage: 2,
    trial_days: 7,
    features: ['storefront', 'products', 'orders', 'custom_domain', 'basic_analytics', 'webhooks'],
    limits: {
      products: 100,
      orders_monthly: 250,
      storage_mb: 2048,
      staff: 1,
      ai_credits_monthly: 30,
      api_requests_monthly: 10000,
      webhook_subscriptions: 3,
    },
    entitlements: {
      custom_domain: true,
      remove_branding: false,
      multi_location_inventory: false,
      advanced_promotions: false,
      api_access: true,
    },
    features_view: [
      { label: '100 products', icon: 'inventory_2' },
      { label: '250 orders/month', icon: 'shopping_bag' },
      { label: '2 GB storage', icon: 'cloud' },
      { label: 'Custom domain', icon: 'language' },
    ],
  },
  {
    site_type: 'store',
    slug: 'business',
    plan: 'business',
    name: 'Business',
    tagline: 'For growing brands with advanced operations',
    display_order: 2,
    is_popular: true,
    requires_contact: false,
    price_monthly_inr: 99900,
    price_yearly_inr: 79900,
    gmv_percentage: 1.2,
    trial_days: 7,
    features: ['storefront', 'products', 'orders', 'custom_domain', 'advanced_analytics', 'webhooks', 'multi_location_inventory', 'advanced_promotions'],
    limits: {
      products: 1000,
      orders_monthly: 2500,
      storage_mb: 10240,
      staff: 3,
      ai_credits_monthly: 100,
      api_requests_monthly: 100000,
      webhook_subscriptions: 25,
    },
    entitlements: {
      custom_domain: true,
      remove_branding: true,
      multi_location_inventory: true,
      advanced_promotions: true,
      api_access: true,
    },
    features_view: [
      { label: '1,000 products', icon: 'inventory_2' },
      { label: '2,500 orders/month', icon: 'shopping_bag' },
      { label: '10 GB storage', icon: 'cloud' },
      { label: 'Advanced promotions', icon: 'local_offer' },
    ],
  },
  {
    site_type: 'store',
    slug: 'enterprise',
    plan: 'enterprise',
    name: 'Enterprise',
    tagline: 'For high-volume brands that need custom scale',
    display_order: 3,
    is_popular: false,
    requires_contact: true,
    price_monthly_inr: 0,
    price_yearly_inr: 0,
    gmv_percentage: 0.8,
    trial_days: 7,
    features: ['storefront', 'products', 'orders', 'custom_domain', 'enterprise_analytics', 'webhooks', 'multi_location_inventory', 'advanced_promotions', 'dedicated_support'],
    limits: {
      products: null,
      orders_monthly: null,
      storage_mb: 51200,
      staff: null,
      ai_credits_monthly: 500,
      api_requests_monthly: null,
      webhook_subscriptions: null,
    },
    entitlements: {
      custom_domain: true,
      remove_branding: true,
      multi_location_inventory: true,
      advanced_promotions: true,
      api_access: true,
      dedicated_support: true,
    },
    features_view: [
      { label: 'Unlimited products', icon: 'inventory_2' },
      { label: 'Unlimited orders', icon: 'shopping_bag' },
      { label: '50 GB storage', icon: 'cloud' },
      { label: 'Dedicated support', icon: 'support_agent' },
    ],
  },
];

export function normalizeBillingStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function normalizeBillingObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function billingNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function billingInteger(value: unknown, fallback = 0): number {
  const numberValue = Math.trunc(billingNumber(value, fallback));
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clampBillingBps(value: unknown, fallback: number): number {
  return Math.max(0, Math.min(10000, billingInteger(value, fallback)));
}

function cloneRecord<T extends Record<string, unknown>>(record: T): T {
  return { ...record };
}

function cloneNumberLimitRecord(record: Record<string, number | null>): Record<string, number | null> {
  return { ...record };
}

function cloneStringArray(value: readonly string[]): string[] {
  return [...value];
}

export function getStoreBillingTierDefinition(slug: string | null | undefined): StoreBillingTierDefinition | null {
  const normalized = String(slug || '').trim().toLowerCase();
  return STORE_BILLING_TIER_DEFINITIONS.find((tier) => tier.slug === normalized) || null;
}

export function getStoreBillingTierDefinitions(): StoreBillingTierDefinition[] {
  return STORE_BILLING_TIER_DEFINITIONS.map((tier) => ({
    ...tier,
    features: cloneStringArray(tier.features),
    limits: cloneNumberLimitRecord(tier.limits),
    entitlements: cloneRecord(tier.entitlements),
    features_view: tier.features_view.map((feature) => ({ ...feature })),
  }));
}

export function resolvePlanEntitlementSnapshot(slug: string | null | undefined): BillingTierEntitlementSnapshot {
  const tier = getStoreBillingTierDefinition(slug) || getStoreBillingTierDefinition('free')!;
  return {
    plan: tier.slug,
    features: cloneStringArray(tier.features),
    limits: cloneNumberLimitRecord(tier.limits),
    entitlements: cloneRecord(tier.entitlements),
  };
}

export function applyStorePlanTierDefaults(plan: BillingPlanCatalogRecord): BillingPlanCatalogRecord {
  const tier = getStoreBillingTierDefinition(plan.slug);
  if (!tier) return plan;

  return {
    ...plan,
    name: plan.name || tier.name,
    tagline: plan.tagline || tier.tagline,
    is_popular: typeof plan.is_popular === 'boolean' ? plan.is_popular : tier.is_popular,
    price_monthly_inr: plan.price_monthly_inr ?? tier.price_monthly_inr,
    price_yearly_inr: plan.price_yearly_inr ?? tier.price_yearly_inr,
    gmv_percentage: plan.gmv_percentage ?? tier.gmv_percentage,
    products_limit: plan.products_limit ?? tier.limits.products,
    orders_limit: plan.orders_limit ?? tier.limits.orders_monthly,
    storage_mb: plan.storage_mb ?? tier.limits.storage_mb,
    staff_limit: plan.staff_limit ?? tier.limits.staff,
    ai_credits_monthly: plan.ai_credits_monthly ?? tier.limits.ai_credits_monthly,
    requires_contact: typeof plan.requires_contact === 'boolean' ? plan.requires_contact : tier.requires_contact,
    features: Array.isArray(plan.features) && plan.features.length > 0 ? plan.features : tier.features_view,
    limits: normalizeBillingObject(plan.limits).products || normalizeBillingObject(plan.limits).orders_monthly
      ? normalizeBillingObject(plan.limits)
      : cloneNumberLimitRecord(tier.limits),
    entitlements: Object.keys(normalizeBillingObject(plan.entitlements)).length > 0
      ? normalizeBillingObject(plan.entitlements)
      : cloneRecord(tier.entitlements),
  };
}

export function evaluatePlanLimit(input: {
  plan: string | null | undefined;
  limitName: string;
  currentUsage: number;
  increment?: number;
}): { allowed: boolean; limit: number | null; nextUsage: number; plan: SubscriptionTier } {
  const snapshot = resolvePlanEntitlementSnapshot(input.plan);
  const rawLimit = snapshot.limits[input.limitName];
  const limit = rawLimit === null || rawLimit === undefined ? null : Number(rawLimit);
  const nextUsage = input.currentUsage + (input.increment ?? 1);

  if (limit === null || !Number.isFinite(limit)) {
    return { allowed: true, limit: null, nextUsage, plan: snapshot.plan };
  }

  return {
    allowed: nextUsage <= limit,
    limit,
    nextUsage,
    plan: snapshot.plan,
  };
}

export function planBillingAmountMinor(
  plan: BillingPlanCatalogRecord,
  billingPeriod: SubscriptionBillingPeriod,
): { amountMinor: number; isPromo: boolean } {
  const promoActive = billingNumber(plan.promo_price_inr) > 0 && billingNumber(plan.promo_months) > 0;
  if (billingPeriod === 'yearly') {
    return { amountMinor: billingNumber(plan.price_yearly_inr) * 12, isPromo: false };
  }

  return {
    amountMinor: promoActive ? billingNumber(plan.promo_price_inr) : billingNumber(plan.price_monthly_inr),
    isPromo: promoActive,
  };
}

export function selectRazorpayPlanId(
  plan: BillingPlanCatalogRecord,
  billingPeriod: SubscriptionBillingPeriod,
): string | null {
  const candidate = billingPeriod === 'yearly'
    ? plan.razorpay_plan_id_yearly
    : plan.razorpay_plan_id_monthly;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

export function normalizeMerchantApprovedUsageCharges(value: unknown): MerchantApprovedUsageCharge[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => MerchantApprovedUsageChargeSchema.safeParse(item))
    .filter((result): result is { success: true; data: MerchantApprovedUsageCharge } => result.success)
    .map((result) => result.data);
}

export function planIndiaAppChargePayout(input: {
  amountMinor: number;
  revenueShareBps?: number | null;
  partnerGstBps?: number | null;
  payoutRail?: IndiaPayoutRail | null;
  providerMode?: AppChargeProviderMode | null;
}): AppBillingChargePayoutPlan {
  const amountMinor = Math.max(0, billingInteger(input.amountMinor));
  const revenueShareBps = clampBillingBps(input.revenueShareBps, DEFAULT_APP_REVENUE_SHARE_BPS);
  const partnerGstBps = clampBillingBps(input.partnerGstBps, DEFAULT_PARTNER_GST_BPS);
  const partnerAmountMinor = Math.floor((amountMinor * revenueShareBps) / 10000);
  const platformFeeMinor = amountMinor - partnerAmountMinor;
  const partnerGstMinor = Math.round((partnerAmountMinor * partnerGstBps) / 10000);
  const payoutRail = input.payoutRail && INDIA_APP_PAYOUT_RAILS.includes(input.payoutRail)
    ? input.payoutRail
    : 'razorpay_route';
  const providerMode = input.providerMode === 'live' ? 'live' : 'test';

  return {
    amount_minor: amountMinor,
    currency: 'INR',
    revenue_share_bps: revenueShareBps,
    partner_amount_minor: partnerAmountMinor,
    platform_fee_minor: platformFeeMinor,
    partner_gst_bps: partnerGstBps,
    partner_gst_minor: partnerGstMinor,
    payout_rail: payoutRail,
    provider: payoutRail,
    provider_mode: providerMode,
  };
}

export function planAppBillingCharge(input: {
  appId: string;
  installationId: string;
  storeId: string;
  partnerId: string;
  billingMode: AppChargeBillingMode;
  name: string;
  amountMinor: number;
  idempotencyKey: string;
  approvalUrl: string;
  metadata?: Record<string, unknown>;
  revenueShareBps?: number | null;
  partnerGstBps?: number | null;
  payoutRail?: IndiaPayoutRail | null;
  providerMode?: AppChargeProviderMode | null;
}): AppBillingChargePlan {
  const payout = planIndiaAppChargePayout({
    amountMinor: input.amountMinor,
    revenueShareBps: input.revenueShareBps,
    partnerGstBps: input.partnerGstBps,
    payoutRail: input.payoutRail,
    providerMode: input.providerMode,
  });

  return {
    app_id: input.appId,
    installation_id: input.installationId,
    store_id: input.storeId,
    partner_id: input.partnerId,
    billing_mode: input.billingMode,
    status: 'pending_merchant_approval',
    name: input.name,
    amount_minor: payout.amount_minor,
    currency: 'INR',
    idempotency_key: input.idempotencyKey,
    approval_url: input.approvalUrl,
    payout,
    metadata: {
      ...(input.metadata || {}),
      india_payout: payout,
    },
  };
}

export function planMerchantRazorpayBillingCheckout(input: {
  plan: BillingPlanCatalogRecord;
  storeId: string;
  userId: string;
  billingPeriod: SubscriptionBillingPeriod;
  approvedUsageCharges?: MerchantApprovedUsageCharge[];
  nowMs?: number;
}): MerchantBillingCheckoutPlan {
  const nowMs = input.nowMs ?? Date.now();
  const plan = applyStorePlanTierDefaults(input.plan);
  const amount = planBillingAmountMinor(plan, input.billingPeriod);
  const notes = {
    store_id: input.storeId,
    plan_slug: plan.slug,
    billing_period: input.billingPeriod,
    user_id: input.userId,
  };
  const planPayload = {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    tagline: plan.tagline,
    price_monthly_inr: plan.price_monthly_inr,
    price_yearly_inr: plan.price_yearly_inr,
    promo_price_inr: plan.promo_price_inr,
    promo_months: plan.promo_months,
    promo_label: plan.promo_label,
    gmv_percentage: plan.gmv_percentage,
    limits: plan.limits || resolvePlanEntitlementSnapshot(plan.slug).limits,
    entitlements: plan.entitlements || resolvePlanEntitlementSnapshot(plan.slug).entitlements,
    razorpay_plan_id_configured: Boolean(selectRazorpayPlanId(plan, input.billingPeriod)),
  };
  const razorpayPlanId = selectRazorpayPlanId(plan, input.billingPeriod);

  if (amount.amountMinor <= 0 && !plan.requires_contact) {
    return {
      mode: 'free_activation',
      amount_minor: 0,
      currency: 'INR',
      billing_period: input.billingPeriod,
      is_promo: false,
      plan_payload: planPayload,
    };
  }

  if (razorpayPlanId) {
    const approvedUsageCharges = input.approvedUsageCharges || [];
    return {
      mode: 'razorpay_subscription',
      amount_minor: amount.amountMinor,
      currency: 'INR',
      billing_period: input.billingPeriod,
      is_promo: amount.isPromo,
      plan_payload: planPayload,
      subscription: {
        plan_id: razorpayPlanId,
        total_count: input.billingPeriod === 'yearly' ? 100 : 1200,
        quantity: 1,
        customer_notify: true,
        addons: approvedUsageCharges.map((charge) => ({
          item: {
            name: charge.description || `${charge.meter_name} usage`,
            amount: charge.amount_minor,
            currency: 'INR',
          },
          quantity: charge.quantity,
        })),
        notes,
      },
    };
  }

  return {
    mode: 'razorpay_order',
    amount_minor: amount.amountMinor,
    currency: 'INR',
    billing_period: input.billingPeriod,
    is_promo: amount.isPromo,
    plan_payload: planPayload,
    order: {
      amount: amount.amountMinor,
      currency: 'INR',
      receipt: `sub_${input.storeId.slice(-8)}_${nowMs}`,
      notes,
    },
  };
}

export function razorpayOrderSignaturePayload(orderId: string, paymentId: string): string {
  return `${orderId}|${paymentId}`;
}

export function razorpaySubscriptionSignaturePayload(subscriptionId: string, paymentId: string): string {
  return `${paymentId}|${subscriptionId}`;
}

export function razorpayBillingSignaturePayload(input: {
  orderId?: string | null;
  subscriptionId?: string | null;
  paymentId: string;
}): string {
  if (input.subscriptionId) {
    return razorpaySubscriptionSignaturePayload(input.subscriptionId, input.paymentId);
  }
  if (input.orderId) {
    return razorpayOrderSignaturePayload(input.orderId, input.paymentId);
  }
  throw new Error('Razorpay order id or subscription id is required');
}

export type BillingPlanInput = z.infer<typeof BillingPlanSchema>;
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
export type StoreSubscriptionQueryInput = z.infer<typeof StoreSubscriptionQuerySchema>;
export type PlanListQueryInput = z.infer<typeof PlanListQuerySchema>;
export type CancelSubscriptionInput = z.infer<typeof CancelSubscriptionSchema>;
export type MerchantApprovedUsageChargeInput = z.infer<typeof MerchantApprovedUsageChargeSchema>;
export type CreateSubscriptionOrderInput = z.infer<typeof CreateSubscriptionOrderSchema>;
export type VerifySubscriptionInput = z.infer<typeof VerifySubscriptionSchema>;
export type CreateAppBillingChargeInput = z.infer<typeof CreateAppBillingChargeSchema>;
export type ApproveAppBillingChargeInput = z.infer<typeof ApproveAppBillingChargeSchema>;
