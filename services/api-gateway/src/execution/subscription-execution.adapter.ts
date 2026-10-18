import { z } from 'zod';
import { AppError } from '../lib/errors';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    BILLING_APPLICATION_WORKFLOWS,
    BILLING_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/shared-types';
import type { BillingPlanCatalogRecord, SubscriptionBillingPeriod } from '@letbuyy/billing-core';

export type SubscriptionPaymentGateway = 'razorpay' | 'stripe' | null;
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';

const SubscriptionActivationResultSchema=z.object({
    accepted:z.literal(true),replayed:z.boolean(),subscription:z.object({
        id:z.string().uuid(),plan:z.string(),status:z.enum(['active','cancelled','past_due','trialing']),
        billing_period:z.enum(['monthly','yearly']),current_period_end:z.string().nullable(),promo_ends_at:z.string().nullable(),
        external_subscription_id:z.string().nullable(),amount_paid:z.number().nullable(),
    }),
});

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

        const result = await this.db.rpc('activate_merchant_subscription_v1', {
            p_input: {
                user_id:input.userId,store_id:input.storeId,plan_id:input.plan.id,plan_slug:input.plan.slug,plan_name:input.plan.name,
                billing_period:input.billingPeriod,amount_paid:input.amountPaid,payment_gateway:input.paymentGateway??null,
                external_subscription_id:input.externalSubscriptionId??null,razorpay_order_id:input.razorpayOrderId??null,
                razorpay_payment_id:input.razorpayPaymentId??null,period_start:now.toISOString(),period_end:periodEnd.toISOString(),
                promo_ends_at:promoEndsAt,products_limit:input.plan.products_limit,
                invoice_number:invoiceNumber('INV',now),invoice_description:`${input.plan.name} plan - ${input.billingPeriod==='yearly'?'Annual':'Monthly'}`,
                tax_amount:Math.round(input.amountPaid*0.18),total_amount:input.amountPaid+Math.round(input.amountPaid*0.18),
            },
        });
        if(result.error)throw new AppError('Subscription activation is temporarily unavailable. Retry the same payment.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
        const parsed=SubscriptionActivationResultSchema.safeParse(result.data);
        if(!parsed.success) {
            const denied=z.object({accepted:z.literal(false),code:z.string()}).safeParse(result.data);
            const code=denied.success?denied.data.code:'SUBSCRIPTION_RESPONSE_UNAVAILABLE';
            const errors:Record<string,{status:number;message:string}>={
                SUBSCRIPTION_CHECKOUT_CONFLICT:{status:409,message:'This payment does not match the saved subscription checkout.'},
                SUBSCRIPTION_PAYMENT_CONFLICT:{status:409,message:'This payment is already bound to another subscription request.'},
                SUBSCRIPTION_OWNER_REQUIRED:{status:403,message:'The current store owner is required.'},
                SUBSCRIPTION_PLAN_CHANGED:{status:409,message:'The selected plan changed. Review the current plan.'},
                SUBSCRIPTION_CONTEXT_INVALID:{status:400,message:'Subscription activation details are invalid.'},
            };
            const error=errors[code]??{status:503,message:'Subscription activation state is unavailable.'};
            throw new AppError(error.message,error.status,code);
        }
        const row=parsed.data.subscription;
        // Founding allocation deliberately remains its existing nonfatal,
        // idempotent post-activation owner. A retry can recover it after reply loss.
        const founding=row.status==='active'&&Number(row.amount_paid||0)>0?await this.allocateFounding(input.storeId,row.id):null;
        return {
            id:row.id,plan:row.plan,plan_name:row.plan===input.plan.slug?input.plan.name:row.plan,status:row.status,
            billing_period:row.billing_period,current_period_end:row.current_period_end,promo_ends_at:row.promo_ends_at,
            external_subscription_id:row.external_subscription_id,founding,replayed:parsed.data.replayed,
        };
    }

    private async allocateFounding(storeId: string, subscriptionId: string): Promise<Record<string, unknown> | null> {
        try {
            const { data: allocation } = await this.db.rpc('allocate_founding_merchant', {
                p_site_id: storeId,
                p_subscription_id: subscriptionId,
                p_idempotency_key: `founding:${subscriptionId}`,
            });
            return (allocation as Record<string, unknown>) ?? null;
        } catch {
            return null;
        }
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
