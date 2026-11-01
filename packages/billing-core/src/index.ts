import { z } from 'zod';
import type { RuntimeEventEnvelope } from '@letbuyy/event-core';
import { MarketplaceAppPricingModelSchema, GstinSchema, IndianStateCodeSchema } from '@letbuyy/shared-types';
import type { SubscriptionTaxSummary } from '@letbuyy/shared-types';
export type { SubscriptionTaxSummary } from '@letbuyy/shared-types';
import { calculateGstAmounts } from '@letbuyy/shared-types';

export type SubscriptionTier = 'free' | 'starter' | 'business' | 'enterprise' | 'launch' | 'growth' | 'scale' | 'commerce_os';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionBillingPeriod = 'monthly' | 'yearly';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export const BillingPlanSchema = z.object({
  plan_id: z.string().min(1).max(120),
  tier: z.enum(['free', 'starter', 'business', 'enterprise', 'launch', 'growth', 'scale', 'commerce_os']),
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
  store_id: z.string().uuid().optional(),
  site_type: z.string().min(1),
  slug: z.string().min(1).optional(),
});

// Private verified-provider notification transport. Commercial quote/pricing
// remains server-owned; caller identity is rechecked by the activation RPC.
export const InternalSubscriptionActivationSchema=z.object({
  storeId:z.string().uuid(),planSlug:z.string().trim().min(1).max(120),siteType:z.string().trim().min(1).max(80).nullish(),
  userId:z.string().uuid().nullish(),provider:z.enum(['razorpay','stripe']),billingPeriod:z.enum(['monthly','yearly']).default('monthly'),
  providerOrderId:z.string().trim().min(1).max(200).nullish(),providerPaymentId:z.string().trim().min(1).max(200).nullish(),
  externalSubscriptionId:z.string().trim().min(1).max(200).nullish(),
  amountPaid:z.union([z.number(),z.string().trim().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().safe().nonnegative()).nullish(),
}).strict();

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

export const CreateAppUsageEventSchema = z.object({
  meter_name: z.string().trim().min(1).max(120),
  quantity: z.number().positive(),
  idempotency_key: z.string().trim().min(8).max(200),
  source: z.string().trim().min(1).max(80).default('app_api'),
  resource_type: z.string().trim().min(1).max(80).optional(),
  resource_id: z.string().trim().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CreateSubscriptionOrderSchema = z.object({
  store_id: z.string().uuid(),
  plan_slug: z.string().min(1),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  site_type: z.string().min(1),
  approved_usage_charges: z.array(MerchantApprovedUsageChargeSchema).max(20).default([]),
  coupon_code: z.string().trim().min(1).max(64).optional(),
});

export const ValidateSubscriptionCouponSchema = z.object({
  store_id: z.string().uuid(),
  plan_slug: z.string().min(1),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  site_type: z.string().min(1),
  coupon_code: z.string().trim().min(1).max(64),
});

export const RecoverSubscriptionPaymentSchema = z.object({
  store_id: z.string().uuid(),
  billing_period: z.enum(['monthly', 'yearly']).optional(),
  idempotency_key: z.string().trim().min(8).max(200).optional(),
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
  coupon_code: z.string().trim().min(1).max(64).optional(),
}).refine((value) => Boolean(value.razorpay_order_id || value.razorpay_subscription_id), {
  message: 'Razorpay order id or subscription id is required',
  path: ['razorpay_order_id'],
});

export const AppChargeBillingModeSchema = z.enum(['recurring', 'one_time', 'usage']);
export const AppChargeStatusSchema = z.enum([
  'pending_merchant_approval',
  'approved',
  'trialing',
  'active',
  'cancelled',
  'failed',
]);
export const IndiaPayoutRailSchema = z.enum(['razorpay_route', 'upi', 'manual']);
export const AppChargeProviderModeSchema = z.enum(['sandbox', 'live']);
export const SettlementRailSchema = z.enum(['pa_split', 'cod_remittance']);
export const SettlementProviderSchema = z.enum(['razorpay_route', 'cashfree', 'cod', 'manual']);
export const SettlementProviderModeSchema = z.enum(['sandbox', 'live']);
export const BillingProviderModeSchema = z.enum(['sandbox', 'live']);
export const BillingMandateSchema = z.object({
  store_id: z.string().uuid(),
  plan_slug: z.enum(['launch', 'growth', 'scale', 'commerce_os']),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  provider_mode: BillingProviderModeSchema.default('sandbox'),
  idempotency_key: z.string().trim().min(8).max(200),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();
export const BillingSubscribeSchema = z.object({
  store_id: z.string().uuid(),
  plan_slug: z.enum(['free', 'starter', 'business', 'enterprise', 'launch', 'growth', 'scale', 'commerce_os']),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  mandate_id: z.string().uuid().optional(),
  idempotency_key: z.string().trim().min(8).max(200),
  sandbox_payment_status: z.enum(['paid', 'failed']).default('paid'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export const BillingInvoiceQuerySchema = z.object({
  store_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
// List a store's billing payment methods (Razorpay UPI AutoPay mandates — how the
// merchant pays LetBuyy). Read-only; the same store_id is re-checked for ownership.
export const BillingMandateQuerySchema = z.object({
  store_id: z.string().uuid(),
});
export const SettlementIngestSchema = z.object({
  store_id: z.string().uuid(),
  settlement_reference: z.string().trim().min(3).max(200),
  idempotency_key: z.string().trim().min(8).max(200),
  rail: SettlementRailSchema.default('pa_split'),
  provider: SettlementProviderSchema.default('razorpay_route'),
  provider_mode: SettlementProviderModeSchema.default('sandbox'),
  currency: z.enum(['INR']).default('INR'),
  gross_amount_minor: z.number().int().nonnegative(),
  platform_fee_minor: z.number().int().nonnegative().default(0),
  gst_minor: z.number().int().nonnegative().default(0),
  net_amount_minor: z.number().int().nonnegative().optional(),
  reserve_minor: z.number().int().nonnegative().default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CreateAppBillingChargeSchema = z.object({
  store_id: z.string().uuid(),
  installation_id: z.string().uuid(),
  pricing_plan_id: z.string().uuid().optional(),
  billing_mode: AppChargeBillingModeSchema.default('recurring'),
  name: z.string().trim().min(1).max(160),
  amount_minor: z.number().int().positive(),
  currency: z.enum(['INR']).default('INR'),
  trial_days: z.number().int().min(0).max(365).default(0),
  idempotency_key: z.string().trim().min(8).max(200),
  return_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const ApproveAppBillingChargeSchema = z.object({
  store_id: z.string().uuid(),
  charge_id: z.string().uuid(),
  idempotency_key: z.string().trim().min(8).max(200),
  provider_reference: z.string().trim().min(1).max(200).optional(),
  provider_payment_id: z.string().trim().min(1).max(200).optional(),
  provider_signature: z.string().trim().min(1).max(500).optional(),
  provider_mode: AppChargeProviderModeSchema.default('sandbox'),
});

export const CancelAppBillingChargeSchema = z.object({
  store_id: z.string().uuid(),
  charge_id: z.string().uuid(),
  idempotency_key: z.string().trim().min(8).max(200),
  reason: z.string().trim().max(500).optional(),
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

export interface AppUsageBillingPeriod {
  period_start: string;
  period_end: string;
}

export interface AppUsageMeteringPlan {
  quantity: number;
  included_quantity: number;
  billable_quantity: number;
  unit_amount_minor: number;
  amount_minor: number;
  billing_status: 'metered' | 'trial_included';
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
  // V1 founding/commercial columns (INR minor / paise for prices).
  founding_price_inr?: number | null;
  status?: string | null;
  purchasable?: boolean | null;
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
export type AppPricingModel = z.infer<typeof MarketplaceAppPricingModelSchema>;
export type AppChargeStatus = z.infer<typeof AppChargeStatusSchema>;
export type IndiaPayoutRail = z.infer<typeof IndiaPayoutRailSchema>;
export type AppChargeProviderMode = z.infer<typeof AppChargeProviderModeSchema>;
export type SettlementRail = z.infer<typeof SettlementRailSchema>;
export type SettlementProvider = z.infer<typeof SettlementProviderSchema>;
export type SettlementProviderMode = z.infer<typeof SettlementProviderModeSchema>;
export type BillingProviderMode = z.infer<typeof BillingProviderModeSchema>;
export type BillingMandateInput = z.infer<typeof BillingMandateSchema>;
export type BillingSubscribeInput = z.infer<typeof BillingSubscribeSchema>;
export type BillingInvoiceQueryInput = z.infer<typeof BillingInvoiceQuerySchema>;
export type BillingMandateQueryInput = z.infer<typeof BillingMandateQuerySchema>;
export type SettlementIngestInput = z.infer<typeof SettlementIngestSchema>;

export type SettlementLedgerAccountCode =
  | 'pa_clearing'
  | 'merchant_payable'
  | 'platform_revenue'
  | 'gst_payable'
  | 'cod_receivable'
  | 'reserve';

export interface SettlementLedgerLine {
  account_code: SettlementLedgerAccountCode;
  side: 'debit' | 'credit';
  amount_minor: number;
  memo: string;
}

export interface SettlementLedgerPlan {
  source_type: 'settlement' | 'cod_remittance';
  currency: 'INR';
  gross_amount_minor: number;
  platform_fee_minor: number;
  gst_minor: number;
  net_amount_minor: number;
  reserve_minor: number;
  recon_break_minor: number;
  balanced: boolean;
  reconciliation_alert: {
    status: 'none' | 'open';
    amount_minor: number;
    message: string | null;
  };
  lines: SettlementLedgerLine[];
}

export interface BillingMandatePlan {
  provider: 'upi_autopay';
  provider_mode: BillingProviderMode;
  status: 'active' | 'pending_provider';
  amount_minor: number;
  currency: 'INR';
  external_mandate_id: string;
  sandbox: boolean;
}

export interface BillingDunningPlan {
  status: 'none' | 'past_due';
  dunning_attempts: number;
  next_dunning_at: string | null;
  event_type: 'billing.charged' | 'billing.failed';
}

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
  provider: IndiaPayoutRail;
  provider_mode: AppChargeProviderMode;
}

export type AppPayoutSettlementStatus = 'processing' | 'released' | 'failed';

export interface AppPayoutTransferRequest {
  ledgerEntryId: string;
  partnerId: string;
  amountMinor: number;
  currency: 'INR';
  rail: IndiaPayoutRail;
  providerMode: AppChargeProviderMode;
  idempotencyKey: string;
  requestedAt?: string;
}

export interface AppPayoutTransferStatement {
  ledger_entry_id: string;
  partner_id: string;
  amount_minor: number;
  currency: 'INR';
  rail: IndiaPayoutRail;
  provider_mode: AppChargeProviderMode;
  idempotency_key: string;
  provider_reference: string | null;
  settled_at: string | null;
  dry_run: boolean;
}

export interface AppPayoutTransferResult {
  status: AppPayoutSettlementStatus;
  provider_reference: string | null;
  statement: AppPayoutTransferStatement;
  failure_reason?: string;
}

export interface AppBillingChargePlan {
  app_id: string;
  installation_id: string;
  store_id: string;
  partner_id: string;
  pricing_plan_id?: string | null;
  billing_mode: AppChargeBillingMode;
  status: 'pending_merchant_approval';
  name: string;
  amount_minor: number;
  currency: 'INR';
  trial_days: number;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  billing_starts_at: string | null;
  idempotency_key: string;
  approval_url: string;
  payout: AppBillingChargePayoutPlan;
  metadata: Record<string, unknown>;
}

export interface AppBillingTrialWindow {
  trial_days: number;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  billing_starts_at: string;
  status: 'trialing' | 'active';
  activated_at: string | null;
  activation_event_type: 'app.charge.activated' | null;
}

export const INDIA_APP_PAYOUT_RAILS: readonly IndiaPayoutRail[] = [
  'razorpay_route',
  'upi',
  'manual',
];
export const DEFAULT_APP_REVENUE_SHARE_BPS = 8500;
export const DEFAULT_APP_PLATFORM_FEE_BPS = 10_000 - DEFAULT_APP_REVENUE_SHARE_BPS;
export const DEFAULT_PARTNER_GST_BPS = 1800;

export function appRevenueSharePolicy(input?: { revenueShareBps?: number | null }) {
  const partnerShareBps = clampBillingBps(input?.revenueShareBps, DEFAULT_APP_REVENUE_SHARE_BPS);
  const platformFeeBps = 10_000 - partnerShareBps;
  return {
    partner_share_bps: partnerShareBps,
    platform_fee_bps: platformFeeBps,
    partner_share_percent: partnerShareBps / 100,
    platform_fee_percent: platformFeeBps / 100,
  };
}

export function appBillingModeForPricingModel(pricingModel: unknown): AppChargeBillingMode | null {
  const parsed = MarketplaceAppPricingModelSchema.safeParse(pricingModel);
  if (!parsed.success) return null;
  if (parsed.data === 'one_time') return 'one_time';
  if (parsed.data === 'usage') return 'usage';
  if (parsed.data === 'recurring') return 'recurring';
  return null;
}

export function normalizeAppTrialDays(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(365, Math.round(parsed)));
}

export function planAppBillingTrialWindow(input?: {
  trialDays?: number | string | null;
  nowMs?: number;
}): AppBillingTrialWindow {
  const trialDays = normalizeAppTrialDays(input?.trialDays);
  const now = new Date(input?.nowMs ?? Date.now());

  if (trialDays <= 0) {
    const billingStartsAt = now.toISOString();
    return {
      trial_days: 0,
      trial_starts_at: null,
      trial_ends_at: null,
      billing_starts_at: billingStartsAt,
      status: 'active',
      activated_at: billingStartsAt,
      activation_event_type: 'app.charge.activated',
    };
  }

  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    trial_days: trialDays,
    trial_starts_at: now.toISOString(),
    trial_ends_at: trialEndsAt,
    billing_starts_at: trialEndsAt,
    status: 'trialing',
    activated_at: null,
    activation_event_type: null,
  };
}

export function isAppBillingTrialExpired(input: {
  status?: string | null;
  trialEndsAt?: string | null;
  nowMs?: number;
}): boolean {
  if (input.status !== 'trialing' || !input.trialEndsAt) return false;
  const endsAtMs = Date.parse(input.trialEndsAt);
  if (!Number.isFinite(endsAtMs)) return false;
  return endsAtMs <= (input.nowMs ?? Date.now());
}

export function planSandboxAppPayoutTransfer(input: AppPayoutTransferRequest): AppPayoutTransferResult {
  const dryRun = input.providerMode !== 'live';
  const requestedAt = input.requestedAt || new Date().toISOString();
  const providerReference = dryRun ? `sandbox_payout_${input.ledgerEntryId}` : null;

  return {
    status: dryRun ? 'released' : 'processing',
    provider_reference: providerReference,
    statement: {
      ledger_entry_id: input.ledgerEntryId,
      partner_id: input.partnerId,
      amount_minor: Math.max(0, billingInteger(input.amountMinor)),
      currency: input.currency,
      rail: input.rail,
      provider_mode: input.providerMode,
      idempotency_key: input.idempotencyKey,
      provider_reference: providerReference,
      settled_at: dryRun ? requestedAt : null,
      dry_run: dryRun,
    },
  };
}

export function planSettlementLedgerPosting(input: SettlementIngestInput): SettlementLedgerPlan {
  const grossAmountMinor = billingInteger(input.gross_amount_minor);
  const platformFeeMinor = billingInteger(input.platform_fee_minor);
  const gstMinor = billingInteger(input.gst_minor);
  const reserveMinor = billingInteger(input.reserve_minor);
  const inferredNetAmountMinor = Math.max(0, grossAmountMinor - platformFeeMinor - gstMinor - reserveMinor);
  const netAmountMinor = input.net_amount_minor === undefined
    ? inferredNetAmountMinor
    : billingInteger(input.net_amount_minor);
  const declaredCreditMinor = netAmountMinor + platformFeeMinor + gstMinor + reserveMinor;
  const reconBreakMinor = grossAmountMinor - declaredCreditMinor;
  const sourceAccount: SettlementLedgerAccountCode = input.rail === 'cod_remittance' ? 'cod_receivable' : 'pa_clearing';
  const lines: SettlementLedgerLine[] = [
    {
      account_code: sourceAccount,
      side: 'debit',
      amount_minor: grossAmountMinor,
      memo: `${input.provider} ${input.rail} settlement ${input.settlement_reference}`,
    },
  ];

  if (netAmountMinor > 0) {
    lines.push({
      account_code: 'merchant_payable',
      side: 'credit',
      amount_minor: netAmountMinor,
      memo: `Merchant payable settlement ${input.settlement_reference}`,
    });
  }
  if (platformFeeMinor > 0) {
    lines.push({
      account_code: 'platform_revenue',
      side: 'credit',
      amount_minor: platformFeeMinor,
      memo: `Platform fee settlement ${input.settlement_reference}`,
    });
  }
  if (gstMinor > 0) {
    lines.push({
      account_code: 'gst_payable',
      side: 'credit',
      amount_minor: gstMinor,
      memo: `GST payable settlement ${input.settlement_reference}`,
    });
  }
  if (reserveMinor > 0) {
    lines.push({
      account_code: 'reserve',
      side: 'credit',
      amount_minor: reserveMinor,
      memo: `Reserve hold settlement ${input.settlement_reference}`,
    });
  }
  const debitTotal = lines
    .filter((line) => line.side === 'debit')
    .reduce((sum, line) => sum + line.amount_minor, 0);
  const creditTotal = lines
    .filter((line) => line.side === 'credit')
    .reduce((sum, line) => sum + line.amount_minor, 0);
  const balanced = debitTotal === creditTotal;
  if (lines.length < 2 || (reconBreakMinor === 0 && !balanced)) {
    throw new Error(`Settlement ledger posting must balance: debit=${debitTotal} credit=${creditTotal}`);
  }

  return {
    source_type: input.rail === 'cod_remittance' ? 'cod_remittance' : 'settlement',
    currency: 'INR',
    gross_amount_minor: grossAmountMinor,
    platform_fee_minor: platformFeeMinor,
    gst_minor: gstMinor,
    net_amount_minor: netAmountMinor,
    reserve_minor: reserveMinor,
    recon_break_minor: reconBreakMinor,
    balanced,
    reconciliation_alert: reconBreakMinor === 0
      ? { status: 'none', amount_minor: 0, message: null }
      : {
        status: 'open',
        amount_minor: Math.abs(reconBreakMinor),
        message: `Settlement ${input.settlement_reference} has an unposted reconciliation break; no reserve auto-plug was created.`,
      },
    lines,
  };
}

export function planPayoutReleaseLedgerPosting(input: {
  payoutReference: string;
  amountMinor: number;
}): SettlementLedgerLine[] {
  const amountMinor = billingInteger(input.amountMinor);
  if (amountMinor <= 0) {
    throw new Error('Payout release amount must be positive');
  }

  return [
    {
      account_code: 'merchant_payable',
      side: 'debit',
      amount_minor: amountMinor,
      memo: `Merchant payable released ${input.payoutReference}`,
    },
    {
      account_code: 'pa_clearing',
      side: 'credit',
      amount_minor: amountMinor,
      memo: `PA split payout released ${input.payoutReference}`,
    },
  ];
}

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
    gmv_percentage: 0,
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
      themes: 1,
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
    gmv_percentage: 0,
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
      themes: 3,
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
    gmv_percentage: 0,
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
      themes: 10,
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
    gmv_percentage: 0,
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
      themes: null,
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
  {
    site_type: 'store',
    slug: 'launch',
    plan: 'launch',
    name: 'Launch',
    tagline: 'Everything you need to start selling',
    display_order: 1,
    is_popular: false,
    requires_contact: false,
    price_monthly_inr: 29900,
    price_yearly_inr: 29900,
    gmv_percentage: 0,
    trial_days: 7,
    features: ['storefront', 'products', 'orders', 'themes', 'cod', 'upi', 'qr_payments', 'basic_analytics', 'blogs', 'pages', 'free_hosting', 'subdomain'],
    limits: {
      products: null,
      orders_monthly: null,
      storage_mb: 5120,
      staff: 1,
      ai_credits_monthly: 30,
      api_requests_monthly: 10000,
      webhook_subscriptions: 0,
      themes: 3,
    },
    entitlements: {
      custom_domain: false,
      remove_branding: false,
      multi_location_inventory: false,
      advanced_promotions: false,
      api_access: false,
    },
    features_view: [
      { label: 'Unlimited products', icon: 'inventory_2' },
      { label: 'Unlimited orders', icon: 'shopping_bag' },
      { label: 'COD, UPI & QR', icon: 'payments' },
      { label: 'Basic analytics', icon: 'insights' },
    ],
  },
  {
    site_type: 'store',
    slug: 'growth',
    plan: 'growth',
    name: 'Growth',
    tagline: 'Scale your store with advanced tools',
    display_order: 2,
    is_popular: true,
    requires_contact: false,
    price_monthly_inr: 99900,
    price_yearly_inr: 99900,
    gmv_percentage: 0,
    trial_days: 7,
    features: ['storefront', 'products', 'orders', 'themes', 'cod', 'upi', 'qr_payments', 'advanced_analytics', 'blogs', 'pages', 'free_hosting', 'custom_domain', 'inventory_management', 'bulk_import', 'discount_engine', 'customer_segments', 'whatsapp_notifications', 'marketing_tools', 'basic_automations'],
    limits: {
      products: null,
      orders_monthly: null,
      storage_mb: 20480,
      staff: 3,
      ai_credits_monthly: 100,
      api_requests_monthly: 50000,
      webhook_subscriptions: 10,
      themes: 5,
    },
    entitlements: {
      custom_domain: true,
      remove_branding: true,
      multi_location_inventory: true,
      advanced_promotions: true,
      api_access: false,
    },
    features_view: [
      { label: 'Everything in Launch', icon: 'check_circle' },
      { label: 'Custom domain', icon: 'language' },
      { label: '3 staff accounts', icon: 'group' },
      { label: 'Advanced analytics', icon: 'insights' },
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
    gmv_percentage: 0,
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

// ---------------------------------------------------------------------------
// Founding Merchant lifetime price lock (see docs/v1/PRICE_LOCK_VERIFICATION.md).
// The single override point: every charge site feeds a lock-applied plan to the
// amount functions above, so a founder is never charged catalog pricing and a
// future catalog change can never affect an existing founder.
// All *_price values are INR MINOR (paise), matching plans.price_monthly_inr.
// ---------------------------------------------------------------------------
export interface FoundingLock {
  price_lock_enabled?: boolean | null;
  is_founding_merchant?: boolean | null;
  locked_launch_price?: number | null;
  locked_growth_price?: number | null;
}

export interface MerchantPricing {
  monthlyInr: number;        // rupees (display)
  amountMinor: number;       // paise (charge for the requested billing period)
  isFounding: boolean;
  savingsInr: number;        // rupees saved per month vs catalog
  catalogMonthlyInr: number; // rupees (catalog reference)
}

export interface PlanPublicPricing {
  slug: string;
  regularInr: number;        // rupees
  foundingInr: number;       // rupees (== regular when no founding price)
  savingsInr: number;        // rupees
  hasFounding: boolean;
  purchasable: boolean;
  status: string;
}

// Returns a clone of the catalog plan with prices overridden to the founder's
// locked snapshot. No-op for non-founders / non-eligible plans.
export function applyFoundingLockToPlan(
  plan: BillingPlanCatalogRecord,
  lock: FoundingLock | null | undefined,
): BillingPlanCatalogRecord {
  if (!lock || !lock.price_lock_enabled) return plan;
  const locked = plan.slug === 'growth'
    ? lock.locked_growth_price
    : plan.slug === 'launch'
      ? lock.locked_launch_price
      : null;
  if (locked === null || locked === undefined || !(Number(locked) >= 0)) return plan;
  const lockedMinor = billingInteger(locked);
  return {
    ...plan,
    price_monthly_inr: lockedMinor,
    price_yearly_inr: lockedMinor,
    promo_price_inr: 0,
    promo_months: 0,
    founding_price_inr: lockedMinor,
    // Force server-authoritative order/mandate mode for founders: a native Razorpay
    // subscription is bound to a catalog-priced razorpay_plan_id and cannot carry a
    // per-merchant locked price (PRICE_LOCK_ARCHITECTURE.md). Null them so the locked
    // amount above is always what is charged.
    razorpay_plan_id_monthly: null,
    razorpay_plan_id_yearly: null,
  };
}

// Effective charge for a specific merchant (lock-aware). Use this everywhere a
// subscription amount is computed for an actual merchant.
export function resolveMerchantPricing(input: {
  plan: BillingPlanCatalogRecord;
  foundingLock?: FoundingLock | null;
  billingPeriod?: SubscriptionBillingPeriod;
}): MerchantPricing {
  const period = input.billingPeriod || 'monthly';
  const isFounding = Boolean(input.foundingLock?.price_lock_enabled);
  const effectivePlan = applyFoundingLockToPlan(input.plan, input.foundingLock);
  const amountMinor = planBillingAmountMinor(effectivePlan, period).amountMinor;
  const catalogMinor = planBillingAmountMinor(input.plan, period).amountMinor;
  const monthlyInr = Math.round((period === 'yearly' ? amountMinor / 12 : amountMinor) / 100);
  const catalogMonthlyInr = Math.round((period === 'yearly' ? catalogMinor / 12 : catalogMinor) / 100);
  return {
    monthlyInr,
    amountMinor,
    isFounding,
    savingsInr: Math.max(catalogMonthlyInr - monthlyInr, 0),
    catalogMonthlyInr,
  };
}

// Public pricing-page view: regular + founding price from the catalog record
// (not merchant-specific). Drives the marketing pricing page + savings copy.
export function resolvePlanPublicPricing(plan: BillingPlanCatalogRecord): PlanPublicPricing {
  const regularInr = Math.round(billingNumber(plan.price_monthly_inr) / 100);
  const foundingMinor = billingNumber(plan.founding_price_inr);
  const foundingInr = Math.round(foundingMinor / 100);
  const hasFounding = foundingMinor > 0 && foundingInr < regularInr;
  return {
    slug: plan.slug,
    regularInr,
    foundingInr: hasFounding ? foundingInr : regularInr,
    savingsInr: hasFounding ? regularInr - foundingInr : 0,
    hasFounding,
    purchasable: plan.purchasable !== false && plan.status !== 'coming_soon',
    status: typeof plan.status === 'string' ? plan.status : 'available',
  };
}

export function planSandboxUpiAutopayMandate(input: {
  plan: BillingPlanCatalogRecord;
  billingPeriod: SubscriptionBillingPeriod;
  providerMode?: BillingProviderMode;
  idempotencyKey: string;
}): BillingMandatePlan {
  const amount = planBillingAmountMinor(input.plan, input.billingPeriod);
  const providerMode = input.providerMode || 'sandbox';
  return {
    provider: 'upi_autopay',
    provider_mode: providerMode,
    status: providerMode === 'live' ? 'pending_provider' : 'active',
    amount_minor: Math.max(0, amount.amountMinor),
    currency: 'INR',
    external_mandate_id: `${providerMode}_upi_autopay_${input.idempotencyKey.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80)}`,
    sandbox: providerMode !== 'live',
  };
}

export function planBillingDunning(input: {
  paymentStatus: 'paid' | 'failed';
  previousAttempts?: number;
  nowMs?: number;
}): BillingDunningPlan {
  if (input.paymentStatus === 'paid') {
    return {
      status: 'none',
      dunning_attempts: 0,
      next_dunning_at: null,
      event_type: 'billing.charged',
    };
  }

  const attempts = Math.max(1, billingInteger(input.previousAttempts || 0) + 1);
  const now = new Date(input.nowMs ?? Date.now());
  const next = new Date(now.getTime() + Math.min(7, attempts * 2) * 24 * 60 * 60 * 1000);
  return {
    status: 'past_due',
    dunning_attempts: attempts,
    next_dunning_at: next.toISOString(),
    event_type: 'billing.failed',
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

export function appUsageBillingPeriod(input?: { nowMs?: number }): AppUsageBillingPeriod {
  const now = new Date(input?.nowMs ?? Date.now());
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    period_start: start.toISOString(),
    period_end: end.toISOString(),
  };
}

export function planAppUsageMetering(input: {
  quantity: number;
  previousQuantity?: number | null;
  includedQuantity?: number | null;
  unitAmountMinor?: number | null;
  trialing?: boolean | null;
}): AppUsageMeteringPlan {
  const quantity = Math.max(0, Number.isFinite(input.quantity) ? input.quantity : 0);
  const previousQuantity = Math.max(0, Number(input.previousQuantity || 0));
  const includedQuantity = Math.max(0, Number(input.includedQuantity || 0));
  const unitAmountMinor = Math.max(0, billingInteger(input.unitAmountMinor || 0));
  const billableBefore = Math.max(0, previousQuantity - includedQuantity);
  const billableAfter = Math.max(0, previousQuantity + quantity - includedQuantity);
  const billableQuantity = input.trialing ? 0 : Math.max(0, billableAfter - billableBefore);
  return {
    quantity,
    included_quantity: includedQuantity,
    billable_quantity: billableQuantity,
    unit_amount_minor: unitAmountMinor,
    amount_minor: Math.round(billableQuantity * unitAmountMinor),
    billing_status: input.trialing ? 'trial_included' : 'metered',
  };
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
  const providerMode = input.providerMode === 'live' ? 'live' : 'sandbox';

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
  pricingPlanId?: string | null;
  billingMode: AppChargeBillingMode;
  name: string;
  amountMinor: number;
  trialDays?: number | string | null;
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
    pricing_plan_id: input.pricingPlanId || null,
    billing_mode: input.billingMode,
    status: 'pending_merchant_approval',
    name: input.name,
    amount_minor: payout.amount_minor,
    currency: 'INR',
    trial_days: normalizeAppTrialDays(input.trialDays),
    trial_starts_at: null,
    trial_ends_at: null,
    billing_starts_at: null,
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
    gmv_percentage: 0,
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
export type ValidateSubscriptionCouponInput = z.infer<typeof ValidateSubscriptionCouponSchema>;
export type RecoverSubscriptionPaymentInput = z.infer<typeof RecoverSubscriptionPaymentSchema>;
export type VerifySubscriptionInput = z.infer<typeof VerifySubscriptionSchema>;
export type CreateAppBillingChargeInput = z.infer<typeof CreateAppBillingChargeSchema>;
export type ApproveAppBillingChargeInput = z.infer<typeof ApproveAppBillingChargeSchema>;
export type CancelAppBillingChargeInput = z.infer<typeof CancelAppBillingChargeSchema>;

// Subscription prices are final gross. The canonical commerce GST helper owns
// rounding; Billing owns applicability, immutable source identity and conservation.
export const SUBSCRIPTION_TAX_POLICY = 'D-SUB-TAX-INCLUSIVE-V1' as const;
const SubscriptionMinorSchema = z.number().int().safe().min(0).max(2_147_483_647);
export const SubscriptionTaxPartySchema = z.object({
  name: z.string().trim().min(1).max(200), country: z.literal('IN'),
  state_code: IndianStateCodeSchema, gstin: GstinSchema.nullable(),
  address: z.object({line1:z.string().trim().min(1).max(500),city:z.string().trim().min(1).max(100),
    state:z.string().trim().min(1).max(100),zip:z.string().trim().min(3).max(20),country:z.literal('IN')}).strict(),
}).strict().refine(p => !p.gstin || p.gstin.slice(0,2) === p.state_code, 'GSTIN and billing state disagree');
export const SubscriptionSupplierTaxProfileSchema = z.object({
  schema_version:z.literal(1),policy_version:z.literal(SUBSCRIPTION_TAX_POLICY),
  profile_id:z.string().trim().min(1).max(120),profile_version:z.number().int().safe().positive(),
  approval_status:z.literal('approved'),approval_reference:z.string().trim().min(1).max(200),
  registration_status:z.literal('registered'),supply_category:z.literal('domestic_taxable_saas'),rate_bps:z.literal(1800),
  supplier:SubscriptionTaxPartySchema.refine(p => p.gstin !== null, 'Registered supplier GSTIN is required'),
}).strict();
export const SubscriptionTaxSourceSchema=z.object({
  actor_id:z.string().uuid().toLowerCase(),site_id:z.string().uuid().toLowerCase(),request_key:z.string().min(8).max(200),
  plan_id:z.string().uuid().toLowerCase(),plan_slug:z.string().min(1).max(120),billing_period:z.enum(['monthly','yearly']),
  price_version:z.string().min(1).max(200),gross_before_discount_minor:SubscriptionMinorSchema,
  discount_minor:SubscriptionMinorSchema,coupon_code:z.string().min(1).max(120).nullable(),
}).strict();
export const SubscriptionTaxSnapshotSchema=z.object({
  schema_version:z.literal(1),policy_version:z.literal(SUBSCRIPTION_TAX_POLICY),basis:z.literal('inclusive'),currency:z.literal('INR'),
  source:SubscriptionTaxSourceSchema,profile:SubscriptionSupplierTaxProfileSchema,recipient:SubscriptionTaxPartySchema,
  supply_type:z.enum(['intra_state','inter_state']),gross_minor:SubscriptionMinorSchema,taxable_minor:SubscriptionMinorSchema,
  tax_minor:SubscriptionMinorSchema,cgst_minor:SubscriptionMinorSchema,sgst_minor:SubscriptionMinorSchema,igst_minor:SubscriptionMinorSchema,
}).strict().superRefine((s,ctx)=>{
  const line=calculateGstAmounts(s.gross_minor,s.profile.rate_bps,true,s.supply_type);
  if(s.gross_minor<=0 || s.source.gross_before_discount_minor-s.source.discount_minor!==s.gross_minor
    || s.supply_type!==(s.profile.supplier.state_code===s.recipient.state_code?'intra_state':'inter_state')
    || s.taxable_minor!==line.taxable_amount_minor || s.tax_minor!==line.tax_amount_minor
    || s.cgst_minor!==line.cgst_amount_minor || s.sgst_minor!==line.sgst_amount_minor || s.igst_minor!==line.igst_amount_minor)
    ctx.addIssue({code:'custom',message:'Subscription tax snapshot does not conserve its canonical gross source'});
});
export type SubscriptionTaxSnapshot=z.infer<typeof SubscriptionTaxSnapshotSchema>;
export function subscriptionTaxSummary(snapshot:SubscriptionTaxSnapshot):SubscriptionTaxSummary {
  const {schema_version,policy_version,basis,currency,supply_type,gross_minor,taxable_minor,tax_minor,cgst_minor,sgst_minor,igst_minor}=SubscriptionTaxSnapshotSchema.parse(snapshot);
  return {schema_version,policy_version,basis,currency,supply_type,gross_minor,taxable_minor,tax_minor,cgst_minor,sgst_minor,igst_minor};
}
export function planSubscriptionTaxSnapshot(input:{profile:unknown;recipient:unknown;source:unknown;grossMinor:unknown}):SubscriptionTaxSnapshot {
  const profile=SubscriptionSupplierTaxProfileSchema.parse(input.profile),recipient=SubscriptionTaxPartySchema.parse(input.recipient),
    source=SubscriptionTaxSourceSchema.parse(input.source),gross=SubscriptionMinorSchema.positive().parse(input.grossMinor);
  // Keep all products passed to the shared number-based helper exact, including
  // its inclusive denominator multiplication. No clamping/coercion of bad money.
  if(!Number.isSafeInteger(gross*10_000))throw new Error('Subscription amount exceeds safe tax arithmetic');
  const supply=profile.supplier.state_code===recipient.state_code?'intra_state':'inter_state';
  const line=calculateGstAmounts(gross,profile.rate_bps,true,supply);
  return SubscriptionTaxSnapshotSchema.parse({schema_version:1,policy_version:SUBSCRIPTION_TAX_POLICY,basis:'inclusive',currency:'INR',source,profile,recipient,
    supply_type:supply,gross_minor:gross,taxable_minor:line.taxable_amount_minor,tax_minor:line.tax_amount_minor,
    cgst_minor:line.cgst_amount_minor,sgst_minor:line.sgst_amount_minor,igst_minor:line.igst_amount_minor});
}

/** Preserve the consented base and upfront components independently. Provider
 * authorization timing is not inferred by combining them into a charge. */
export function subscriptionApprovedChargeComponents(base:unknown,approved:unknown):{baseGrossMinor:number;upfrontGrossMinor:number}{
  const recurring=SubscriptionMinorSchema.positive().parse(base);
  const lines=z.array(MerchantApprovedUsageChargeSchema).parse(approved);
  let upfront=0;
  for(const line of lines){
    const product=line.amount_minor*line.quantity;
    if(!Number.isSafeInteger(product)||!Number.isSafeInteger(upfront+product))throw new Error('Subscription addon amount exceeds safe arithmetic');
    upfront=SubscriptionMinorSchema.parse(upfront+product);
  }
  return {baseGrossMinor:recurring,upfrontGrossMinor:upfront};
}

/** The maintained create payload omits start_at: Razorpay immediate-start
 * authorization is the base plus explicitly approved upfront amounts. Persist
 * both components so an initial addon cannot become a later recurring charge.
 * This describes money only; provider invoice lineage still establishes phase.
 */
export const SubscriptionImmediateChargeScheduleSchema=z.object({
 schema_version:z.literal(1),start_mode:z.literal('immediate'),
 base_gross_minor:SubscriptionMinorSchema.positive(),upfront_gross_minor:SubscriptionMinorSchema,
 initial_gross_minor:SubscriptionMinorSchema.positive(),
}).strict().refine(s=>s.base_gross_minor+s.upfront_gross_minor===s.initial_gross_minor,
 'Immediate subscription gross must preserve the base and approved upfront amount');
export type SubscriptionImmediateChargeSchedule=z.infer<typeof SubscriptionImmediateChargeScheduleSchema>;
export function planImmediateSubscriptionChargeSchedule(base:unknown,approved:unknown):SubscriptionImmediateChargeSchedule {
 const parts=subscriptionApprovedChargeComponents(base,approved);
 const initial=SubscriptionMinorSchema.positive().parse(parts.baseGrossMinor+parts.upfrontGrossMinor);
 return SubscriptionImmediateChargeScheduleSchema.parse({schema_version:1,start_mode:'immediate',
  base_gross_minor:parts.baseGrossMinor,upfront_gross_minor:parts.upfrontGrossMinor,initial_gross_minor:initial});
}

/** Freeze both taxable money sources before a native provider create. The
 * existing approved SaaS profile is reused; no later profile/catalog read owns
 * the cycle amount. This does not establish which invoice paid either source.
 */
export function planSubscriptionRecurringTaxSnapshots(baseSnapshot:unknown,approved:unknown):{
 initial:SubscriptionTaxSnapshot;recurring:SubscriptionTaxSnapshot;schedule:SubscriptionImmediateChargeSchedule;
}{
 const recurring=SubscriptionTaxSnapshotSchema.parse(baseSnapshot);
 if(recurring.source.discount_minor!==0||recurring.source.coupon_code!==null)throw new Error('Recurring source requires the existing undiscounted native billing basis');
 const schedule=planImmediateSubscriptionChargeSchedule(recurring.gross_minor,approved);
 const initial=planSubscriptionTaxSnapshot({profile:recurring.profile,recipient:recurring.recipient,
  source:{...recurring.source,gross_before_discount_minor:schedule.initial_gross_minor},grossMinor:schedule.initial_gross_minor});
 return {initial,recurring,schedule};
}

/** Resolve a paid provider invoice against retained native money sources.
 * This proves invoice money/lineage only: current entitlement, owner, replay and
 * once-only upfront consumption remain the canonical transaction's authority.
 * Neither today's price/profile nor provider paid_count/current cycle selects tax.
 */
export function resolveSubscriptionInvoiceTaxPhase(input:{
 subscriptionReference:string;providerPlanId:string;schedule:unknown;initialSnapshot:unknown;recurringSnapshot:unknown;
 approvedUsageCharges:unknown;payment:unknown;invoice:unknown;subscription:unknown;
}){
 try{
  const schedule=SubscriptionImmediateChargeScheduleSchema.parse(input.schedule),initial=SubscriptionTaxSnapshotSchema.parse(input.initialSnapshot),recurring=SubscriptionTaxSnapshotSchema.parse(input.recurringSnapshot);
  const approved=z.array(MerchantApprovedUsageChargeSchema).max(20).parse(input.approvedUsageCharges);
  if(initial.gross_minor!==schedule.initial_gross_minor||recurring.gross_minor!==schedule.base_gross_minor
   ||subscriptionApprovedChargeComponents(schedule.base_gross_minor,approved).upfrontGrossMinor!==schedule.upfront_gross_minor
   ||JSON.stringify(initial.profile)!==JSON.stringify(recurring.profile)||JSON.stringify(initial.recipient)!==JSON.stringify(recurring.recipient)
   ||initial.source.discount_minor!==0||initial.source.coupon_code!==null
   ||Object.keys(initial.source).filter(k=>k!=='gross_before_discount_minor').some(k=>initial.source[k as keyof typeof initial.source]!==recurring.source[k as keyof typeof recurring.source]))throw new Error();
  const reference=z.string().regex(/^sub_[A-Za-z0-9]+$/).max(120).parse(input.subscriptionReference);
  const providerPlan=z.string().regex(/^plan_[A-Za-z0-9]+$/).max(120).parse(input.providerPlanId);
  const payment=z.object({id:z.string().regex(/^pay_[A-Za-z0-9]+$/),invoice_id:z.string().regex(/^inv_[A-Za-z0-9]+$/),order_id:z.string().regex(/^order_[A-Za-z0-9]+$/),
   amount:SubscriptionMinorSchema.positive(),currency:z.literal('INR'),status:z.literal('captured'),captured:z.literal(true).optional()}).passthrough().parse(input.payment);
  const invoice=z.object({id:z.literal(payment.invoice_id),entity:z.literal('invoice'),subscription_id:z.literal(reference),payment_id:z.literal(payment.id),order_id:z.literal(payment.order_id),
   status:z.literal('paid'),currency:z.literal('INR'),amount:SubscriptionMinorSchema.positive(),amount_paid:SubscriptionMinorSchema.positive(),amount_due:z.literal(0),gross_amount:SubscriptionMinorSchema.positive(),partial_payment:z.literal(false),
   billing_start:z.number().int().safe().positive(),billing_end:z.number().int().safe().positive(),
   line_items:z.array(z.object({type:z.enum(['plan','addon']),name:z.string().min(1).max(200),quantity:z.number().int().safe().positive().max(999),unit_amount:SubscriptionMinorSchema.positive(),gross_amount:SubscriptionMinorSchema.positive(),tax_amount:z.literal(0),currency:z.literal('INR')}).passthrough()).min(1).max(50),
  }).passthrough().parse(input.invoice);
  z.object({id:z.literal(reference),entity:z.literal('subscription'),plan_id:z.literal(providerPlan),quantity:z.literal(1)}).passthrough().parse(input.subscription);
  if(invoice.billing_end<=invoice.billing_start||invoice.amount!==payment.amount||invoice.amount_paid!==payment.amount||invoice.gross_amount!==payment.amount)throw new Error();
  let sum=0;
  for(const line of invoice.line_items){
   const total=line.unit_amount*line.quantity;
   if(!Number.isSafeInteger(total)||total!==line.gross_amount)throw new Error();
   sum=SubscriptionMinorSchema.parse(sum+total);
  }
  if(sum!==payment.amount)throw new Error();
  const base=invoice.line_items.filter(l=>l.type==='plan'),addons=invoice.line_items.filter(l=>l.type==='addon');
  if(base.length!==1||base[0]!.quantity!==1||base[0]!.gross_amount!==schedule.base_gross_minor)throw new Error();
  const lineKey=(name:string,amount:number,quantity:number)=>JSON.stringify([name,amount,quantity]);
  if(addons.length){
   const expected=approved.map(l=>lineKey(l.description||`${l.meter_name} usage`,l.amount_minor,l.quantity)).sort();
   const actual=addons.map(l=>lineKey(l.name,l.unit_amount,l.quantity)).sort();
   if(schedule.upfront_gross_minor<=0||JSON.stringify(actual)!==JSON.stringify(expected)||payment.amount!==initial.gross_minor)throw new Error();
  }else if(payment.amount!==recurring.gross_minor)throw new Error();
  const taxSnapshot=addons.length?initial:recurring;
  // Bound Unix values before converting to ISO. No locale, now or current
  // subscription pointer supplies the immutable invoice period.
  const start=new Date(invoice.billing_start*1000),end=new Date(invoice.billing_end*1000);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))throw new Error();
  return {phase:addons.length?'initial_with_upfront' as const:'base_cycle' as const,invoice_id:invoice.id,payment_id:payment.id,
   order_id:payment.order_id,subscription_reference:reference,period_start:start.toISOString(),period_end:end.toISOString(),gross_minor:payment.amount,taxSnapshot};
 }catch{throw new Error('Provider subscription invoice does not match its retained charge sources');}
}

export const InternalSubscriptionInvoiceSchema=z.object({
  externalSubscriptionId:z.string().trim().min(1).max(200),provider:z.enum(['razorpay','stripe']),
  invoiceNumber:z.string().trim().min(1).max(80).nullish(),description:z.string().trim().min(1).max(256).nullish(),
  amount:SubscriptionMinorSchema.positive(),currency:z.literal('INR'),taxAmount:SubscriptionMinorSchema,totalAmount:SubscriptionMinorSchema.positive(),
  paymentId:z.string().trim().min(1).max(200),paymentStatus:z.enum(['paid','failed']).default('paid'),
  periodStart:z.string().datetime().nullish(),periodEnd:z.string().datetime().nullish(),
}).strict().refine(s=>s.amount===s.totalAmount&&s.taxAmount<=s.totalAmount,'Subscription invoice gross must match its verified charge');

export const InternalSubscriptionStateSyncSchema=z.object({
 externalSubscriptionId:z.string().trim().min(1).max(200),status:z.enum(['active','cancelled','past_due','trialing']),
 currentPeriodStart:z.string().datetime().nullish(),currentPeriodEnd:z.string().datetime().nullish(),
}).strict().refine(s=>!s.currentPeriodStart||!s.currentPeriodEnd||Date.parse(s.currentPeriodEnd)>Date.parse(s.currentPeriodStart),
 'Provider status cannot reverse the retained billing period');

/** Private verified-provider evidence. Derived by the Gateway from authenticated
 * provider reads; it is never an input in public checkout/verify DTOs. */
export const SubscriptionInvoiceEvidenceSchema=z.object({
 phase:z.enum(['initial_with_upfront','base_cycle']),invoice_id:z.string().regex(/^inv_[A-Za-z0-9]+$/).max(120),
 payment_id:z.string().regex(/^pay_[A-Za-z0-9]+$/).max(120),order_id:z.string().regex(/^order_[A-Za-z0-9]+$/).max(120),
 subscription_reference:z.string().regex(/^sub_[A-Za-z0-9]+$/).max(120),
 period_start:z.string().datetime(),period_end:z.string().datetime(),gross_minor:SubscriptionMinorSchema.positive(),
}).strict().refine(e=>Date.parse(e.period_end)>Date.parse(e.period_start),'Verified invoice period must advance');
export type SubscriptionInvoiceEvidence=z.infer<typeof SubscriptionInvoiceEvidenceSchema>;
