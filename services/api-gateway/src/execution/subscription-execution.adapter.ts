import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    BILLING_APPLICATION_WORKFLOWS,
    BILLING_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/shared-types';
import type { BillingPlanCatalogRecord, SubscriptionBillingPeriod } from '@letbuyy/billing-core';

export type SubscriptionPaymentGateway = 'razorpay' | 'stripe' | null;
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';

export function subscriptionPeriodEnd(now: Date, billingPeriod: SubscriptionBillingPeriod): Date {
    const periodEnd = new Date(now);
    if (billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    return periodEnd;
}

function subscriptionPromoEnd(now: Date, plan: BillingPlanCatalogRecord, billingPeriod: SubscriptionBillingPeriod): string | null {
    if (Number(plan.promo_price_inr || 0) <= 0 || Number(plan.promo_months || 0) <= 0 || billingPeriod !== 'monthly') {
        return null;
    }

    const promoEnd = new Date(now);
    promoEnd.setMonth(promoEnd.getMonth() + Number(plan.promo_months || 0));
    return promoEnd.toISOString();
}

function invoiceNumber(prefix: string, now: Date): string {
    return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export class SubscriptionExecutionAdapter {
    static readonly applicationWorkflows = BILLING_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = BILLING_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'subscription-execution.adapter',
        workflowAuthority: 'billing-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    constructor(private db: SupabaseClient) { }

    async activateMerchantSubscription(input: {
        userId: string;
        storeId: string;
        plan: BillingPlanCatalogRecord;
        billingPeriod: SubscriptionBillingPeriod;
        amountPaid: number;
        paymentGateway?: SubscriptionPaymentGateway;
        externalSubscriptionId?: string | null;
        razorpayOrderId?: string | null;
        razorpayPaymentId?: string | null;
        now?: Date;
    }) {
        const now = input.now || new Date();
        const periodEnd = subscriptionPeriodEnd(now, input.billingPeriod);
        const promoEndsAt = subscriptionPromoEnd(now, input.plan, input.billingPeriod);

        await this.db
            .from('subscriptions')
            .update({ status: 'cancelled', cancelled_at: now.toISOString() })
            .eq('store_id', input.storeId)
            .eq('status', 'active');

        const { data: subscription, error: subError } = await this.db
            .from('subscriptions')
            .insert({
                user_id: input.userId,
                store_id: input.storeId,
                site_id: input.storeId,
                plan: input.plan.slug,
                plan_id: input.plan.id,
                status: 'active',
                billing_period: input.billingPeriod,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                promo_ends_at: promoEndsAt,
                payment_gateway: input.paymentGateway || null,
                external_subscription_id: input.externalSubscriptionId || null,
                razorpay_order_id: input.razorpayOrderId || null,
                razorpay_payment_id: input.razorpayPaymentId || null,
                amount_paid: input.amountPaid,
                currency: 'INR',
                products_limit: input.plan.products_limit,
                stores_limit: 1,
            })
            .select()
            .single();

        if (subError || !subscription) {
            throw new Error('Failed to create subscription');
        }

        await this.db
            .from('sites')
            .update({ trial_status: input.amountPaid > 0 ? 'paid' : 'active', updated_at: now.toISOString() })
            .eq('id', input.storeId);

        await this.recordSubscriptionInvoice({
            userId: input.userId,
            storeId: input.storeId,
            subscriptionId: subscription.id,
            invoiceNumber: invoiceNumber('INV', now),
            description: `${input.plan.name} plan - ${input.billingPeriod === 'yearly' ? 'Annual' : 'Monthly'}`,
            amount: input.amountPaid,
            currency: 'INR',
            taxAmount: Math.round(input.amountPaid * 0.18),
            totalAmount: input.amountPaid + Math.round(input.amountPaid * 0.18),
            paymentGateway: input.paymentGateway || null,
            paymentId: input.razorpayPaymentId || input.externalSubscriptionId || input.razorpayOrderId || null,
            paymentStatus: 'paid',
            billingPeriod: input.billingPeriod,
            periodStart: now.toISOString(),
            periodEnd: periodEnd.toISOString(),
        });

        // Founding Merchant allocation — the SINGLE chokepoint (every paid activation
        // path funnels through this adapter). Non-fatal + idempotent: the SECURITY
        // DEFINER RPC re-checks eligibility (status='active' AND amount_paid>0 AND
        // sites.trial_status='paid') and a failure / {allocated:false} NEVER affects
        // the already-committed paid subscription. See docs/v1/FOUNDING_ALLOCATION_DEFINITION.md.
        let founding: Record<string, unknown> | null = null;
        if (input.amountPaid > 0) {
            try {
                const { data: allocation } = await this.db.rpc('allocate_founding_merchant', {
                    p_site_id: input.storeId,
                    p_subscription_id: subscription.id,
                    p_idempotency_key: `founding:${subscription.id}`,
                });
                founding = (allocation as Record<string, unknown>) ?? null;
            } catch {
                founding = null;
            }
        }

        return {
            id: subscription.id,
            plan: input.plan.slug,
            plan_name: input.plan.name,
            status: 'active',
            billing_period: input.billingPeriod,
            current_period_end: periodEnd.toISOString(),
            promo_ends_at: promoEndsAt,
            external_subscription_id: input.externalSubscriptionId || null,
            founding,
        };
    }

    async syncProviderSubscription(input: {
        externalSubscriptionId: string;
        status: SubscriptionStatus;
        currentPeriodStart?: string | null;
        currentPeriodEnd?: string | null;
    }) {
        const updates = {
            status: input.status,
            current_period_start: input.currentPeriodStart || undefined,
            current_period_end: input.currentPeriodEnd || undefined,
            cancelled_at: input.status === 'cancelled' ? new Date().toISOString() : null,
        };

        const { data, error } = await this.db
            .from('subscriptions')
            .update(updates)
            .eq('external_subscription_id', input.externalSubscriptionId)
            .select('id, user_id, store_id, external_subscription_id, status')
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to sync subscription: ${error.message}`);
        }

        return data;
    }

    async recordSubscriptionInvoice(input: {
        userId: string;
        storeId: string;
        subscriptionId?: string | null;
        invoiceNumber: string;
        description: string;
        amount: number;
        currency: string;
        taxAmount: number;
        totalAmount: number;
        paymentGateway: 'razorpay' | 'stripe' | null;
        paymentId?: string | null;
        paymentStatus: 'paid' | 'failed';
        billingPeriod?: SubscriptionBillingPeriod | null;
        periodStart: string;
        periodEnd: string;
    }) {
        const { data, error } = await this.db
            .from('billing_history')
            .insert({
                user_id: input.userId,
                store_id: input.storeId,
                site_id: input.storeId,
                subscription_id: input.subscriptionId || null,
                invoice_number: input.invoiceNumber,
                description: input.description,
                amount: input.amount,
                currency: input.currency,
                tax_amount: input.taxAmount,
                total_amount: input.totalAmount,
                payment_gateway: input.paymentGateway,
                payment_id: input.paymentId || null,
                payment_status: input.paymentStatus,
                billing_period: input.billingPeriod || null,
                period_start: input.periodStart,
                period_end: input.periodEnd,
            })
            .select('id')
            .single();

        if (error) {
            throw new Error(`Failed to record subscription invoice: ${error.message}`);
        }

        return data;
    }
}
