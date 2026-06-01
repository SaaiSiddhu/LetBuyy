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

export type MerchantBillingCheckoutMode = 'razorpay_subscription' | 'razorpay_order';

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
  price_monthly_inr?: number | null;
  price_yearly_inr?: number | null;
  promo_price_inr?: number | null;
  promo_months?: number | null;
  products_limit?: number | null;
  requires_contact?: boolean | null;
  razorpay_plan_id_monthly?: string | null;
  razorpay_plan_id_yearly?: string | null;
}

export interface MerchantRazorpayBillingCheckoutPlan {
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

export function planMerchantRazorpayBillingCheckout(input: {
  plan: BillingPlanCatalogRecord;
  storeId: string;
  userId: string;
  billingPeriod: SubscriptionBillingPeriod;
  approvedUsageCharges?: MerchantApprovedUsageCharge[];
  nowMs?: number;
}): MerchantRazorpayBillingCheckoutPlan {
  const nowMs = input.nowMs ?? Date.now();
  const amount = planBillingAmountMinor(input.plan, input.billingPeriod);
  const notes = {
    store_id: input.storeId,
    plan_slug: input.plan.slug,
    billing_period: input.billingPeriod,
    user_id: input.userId,
  };
  const planPayload = {
    id: input.plan.id,
    name: input.plan.name,
    slug: input.plan.slug,
    price_monthly_inr: input.plan.price_monthly_inr,
    price_yearly_inr: input.plan.price_yearly_inr,
    promo_price_inr: input.plan.promo_price_inr,
    promo_months: input.plan.promo_months,
    razorpay_plan_id_configured: Boolean(selectRazorpayPlanId(input.plan, input.billingPeriod)),
  };
  const razorpayPlanId = selectRazorpayPlanId(input.plan, input.billingPeriod);

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
