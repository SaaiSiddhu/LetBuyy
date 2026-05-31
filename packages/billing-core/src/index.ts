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

export const CreateSubscriptionOrderSchema = z.object({
  store_id: z.string().uuid(),
  plan_slug: z.string().min(1),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  site_type: z.string().min(1),
});

export const VerifySubscriptionSchema = z.object({
  store_id: z.string().uuid(),
  plan_slug: z.string().min(1),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  site_type: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
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

export function normalizeBillingStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function normalizeBillingObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export type BillingPlanInput = z.infer<typeof BillingPlanSchema>;
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
export type StoreSubscriptionQueryInput = z.infer<typeof StoreSubscriptionQuerySchema>;
export type PlanListQueryInput = z.infer<typeof PlanListQuerySchema>;
export type CancelSubscriptionInput = z.infer<typeof CancelSubscriptionSchema>;
export type CreateSubscriptionOrderInput = z.infer<typeof CreateSubscriptionOrderSchema>;
export type VerifySubscriptionInput = z.infer<typeof VerifySubscriptionSchema>;
