import type { Context } from 'hono';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { enqueueOrderConfirmationEmail } from './order-confirmation-email';
import { verifySiteOwnership } from './auth-user';
import { getSupabaseAdmin, getSupabaseAdminUnguarded } from './supabase';
import { ConflictError, ForbiddenError, HumanRequiredError, NotFoundError } from './errors';
import {
    isProductionRuntime,
    livePaymentCredentialsAreRequired,
    resolvePaymentProviderMode,
    type LedgerPostingPlan,
    type PaymentProviderMode,
    type V1PaymentSessionProvider,
} from '@letbuyy/payments';

export type AppContext = Context<{ Bindings: Env }>;

export type PayableOrder = {
    id: string;
    store_id: string;
    total: number;
    currency?: string | null;
    payment_status?: string | null;
    status?: string | null;
};

export type ClientAmountFields = {
    amount?: number;
    amountMinorUnits?: number;
    amount_minor_units?: number;
};

export type JsonRecord = Record<string, unknown>;
export type PaymentJsonValue = null | boolean | number | string | PaymentJsonValue[] | { [key: string]: PaymentJsonValue };

export type PaymentSessionRow = {
    id: string;
    site_id: string;
    order_id: string;
    provider: V1PaymentSessionProvider;
    mode: PaymentProviderMode;
    status: string;
    amount_minor: number;
    currency: 'INR';
    provider_order_id?: string | null;
    provider_payment_id?: string | null;
    provider_session_id?: string | null;
    idempotency_key: string;
    client_action?: string | null;
    capture_ledger_transaction_id?: string | null;
    refund_ledger_transaction_id?: string | null;
    refunded_amount_minor?: number | null;
    refunded_at?: string | null;
    metadata?: JsonRecord | null;
};

export function resolvePlatformOrigin(c: AppContext): string {
    const rawDomain = c.env.LETBUYY_PLATFORM_DOMAIN
        || c.env.NEXT_PUBLIC_PLATFORM_DOMAIN
        || c.env.PLATFORM_ROOT_DOMAIN
        || 'letbuyy.com';
    const domain = rawDomain
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^\.+|\.+$/g, '');

    return `https://${domain || 'letbuyy.com'}`;
}

export function getRequestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

export function paymentProviderMode(c: AppContext, provider: V1PaymentSessionProvider, requested?: PaymentProviderMode): PaymentProviderMode {
    const envRecord = c.env as Env & Record<string, string | undefined>;
    const productionRuntime = isProductionRuntime({
        environment: envRecord.ENVIRONMENT || envRecord.APP_ENV || envRecord.NODE_ENV,
        vercelEnv: envRecord.VERCEL_ENV,
        mode: envRecord.LETBUYY_RUNTIME_MODE,
    });
    if (requested) return resolvePaymentProviderMode(requested, { productionRuntime });

    const providerKey = `LETBUYY_${provider.toUpperCase()}_MODE`;
    return resolvePaymentProviderMode(envRecord[providerKey] || c.env.LETBUYY_PAYMENT_MODE, { productionRuntime });
}

async function activeMerchantPaymentCredential(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    provider: V1PaymentSessionProvider,
    mode: PaymentProviderMode,
): Promise<{ id: string } | null> {
    if (mode !== 'live') return null;

    const { data } = await db
        .from('payment_credentials')
        .select('id')
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('mode', mode)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();

    return data as { id: string } | null;
}

export function paymentSetupRequiredResponse(c: AppContext) {
    return c.json(
        {
            error: {
                code: 'PAYMENT_SETUP_REQUIRED',
                message: 'Payment provider setup is required before live payments can be enabled.',
            },
        },
        503,
    );
}

export async function requireLivePaymentCredential(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    provider: V1PaymentSessionProvider,
    mode: PaymentProviderMode,
): Promise<{ id: string } | null> {
    const credential = await activeMerchantPaymentCredential(db, siteId, provider, mode);
    if (livePaymentCredentialsAreRequired({ provider, mode, merchantCredentialPresent: Boolean(credential) })) {
        // [HUMAN-REQUIRED] HR-MERCHANT-PSP-LIVE: merchant-owned live PSP credentials
        // must be captured and encrypted before live payment rails are enabled.
        throw new HumanRequiredError('Payment provider setup is required before live payments can be enabled.', {
            provider,
            site_id: siteId,
        });
    }
    return credential;
}

export async function emitPaymentEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        paymentId: string;
        orderId: string;
        eventType: string;
        payload: JsonRecord;
        actorId?: string | null;
        requestId: string;
        idempotencyKey: string;
    },
): Promise<void> {
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'order',
        aggregateId: input.orderId,
        eventType: input.eventType,
        payload: {
            order_id: input.orderId,
            payment_id: input.paymentId,
            provider_event_id: String(input.payload.provider_event_id || input.idempotencyKey),
            ...input.payload,
        },
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
        actorId: input.actorId || null,
    });
}

function toPaymentLedgerRpcLines(lines: LedgerPostingPlan['lines']) {
    return lines.map((line) => ({
        account_code: line.accountCode,
        side: line.side,
        amount_minor: line.amountMinor,
        memo: line.memo,
    }));
}

export async function postPaymentLedger(
    db: ReturnType<typeof getSupabaseAdmin>,
    plan: LedgerPostingPlan,
    metadata: JsonRecord,
    requestId: string,
): Promise<string> {
    const { data, error } = await db.rpc('post_settlement_ledger_transaction', {
        p_site_id: plan.siteId,
        p_source_type: plan.sourceType,
        p_source_id: plan.sourceId,
        p_idempotency_key: String(plan.idempotencyKey),
        p_lines: toPaymentLedgerRpcLines(plan.lines),
        p_metadata: metadata,
        p_request_id: requestId,
    });

    if (error || !data) {
        throw new Error(`Payment canonical ledger post failed: ${error?.message || 'unknown error'}`);
    }
    return String(data);
}

export async function loadOwnedPaymentSession(
    c: AppContext,
    paymentId: string,
    userId: string,
    sessionStoreId?: string,
): Promise<PaymentSessionRow> {
    const db = getSupabaseAdmin(c);
    const { data: payment } = await getSupabaseAdminUnguarded(c)
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .is('deleted_at', null)
        .single();

    if (!payment) {
        throw new NotFoundError('Payment not found');
    }

    const row = payment as PaymentSessionRow;
    if (!(await verifySiteOwnership(db, row.site_id, userId, sessionStoreId))) {
        throw new ForbiddenError('Not authorized for this payment');
    }
    return row;
}

export async function assertProviderPaymentNotReplayed(
    db: ReturnType<typeof getSupabaseAdmin>,
    // Phase M1 (DOC 03 row 11 "Payments"): Razorpay is the only live money-in
    // gateway with a provider-confirmed payment to replay-guard against.
    params: {
        provider: 'razorpay';
        providerPaymentId: string;
        providerOrderId?: string | null;
        orderId: string;
        siteId: string;
    },
): Promise<void> {
    const { data: existing, error } = await db
        .from('payment_transactions')
        .select('order_id, provider_order_id, provider_payment_id')
        .eq('site_id', params.siteId)
        .eq('gateway', params.provider)
        .eq('provider_payment_id', params.providerPaymentId)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to check payment replay state: ${error.message}`);
    }

    const replay = existing as { order_id?: string | null; provider_order_id?: string | null } | null;
    if (!replay) return;

    if (replay.order_id && replay.order_id !== params.orderId) {
        throw new ConflictError('Payment already verified for another order');
    }

    if (params.providerOrderId && replay.provider_order_id && replay.provider_order_id !== params.providerOrderId) {
        throw new ConflictError('Payment reference mismatch');
    }
}

export function requestedAmountMinorUnits(input: ClientAmountFields): number | null {
    if (typeof input.amountMinorUnits === 'number') return input.amountMinorUnits;
    if (typeof input.amount_minor_units === 'number') return input.amount_minor_units;
    if (typeof input.amount === 'number') return Math.round(input.amount * 100);
    return null;
}

export function amountMismatchBody() {
    return {
        error: {
            code: 'AMOUNT_MISMATCH',
            message: 'Order amount changed. Please refresh checkout and try again.',
        },
    };
}

export function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

export function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function orderPaidTotalPayload(order: JsonRecord): { amount_minor: number; currency: 'INR' } | undefined {
    const currency = (stringOrNull(order.currency) || 'INR').toUpperCase();
    if (currency !== 'INR') return undefined;

    const total = numberOrNull(order.total);
    if (total === null || total < 0) return undefined;

    return { amount_minor: Math.round(total * 100), currency: 'INR' };
}

export async function emitOrderPaidEvent(
    env: Env,
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        order: unknown;
        fallbackOrder?: unknown;
        actorId?: string | null;
        requestId: string;
        idempotencyKey: string;
    },
): Promise<void> {
    const order = asRecord(input.order);
    const fallbackOrder = asRecord(input.fallbackOrder);
    const orderId = stringOrNull(order.id) || stringOrNull(fallbackOrder.id);
    const siteId = stringOrNull(order.site_id) || stringOrNull(order.store_id) || stringOrNull(fallbackOrder.site_id) || stringOrNull(fallbackOrder.store_id);

    if (!orderId || !siteId) return;

    const total = orderPaidTotalPayload({ ...fallbackOrder, ...order });
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: siteId,
        aggregateType: 'order',
        aggregateId: orderId,
        eventType: 'order.paid',
        payload: {
            site_id: siteId,
            order_id: orderId,
            order_number: stringOrNull(order.order_number) || stringOrNull(fallbackOrder.order_number) || undefined,
            customer_id: stringOrNull(order.customer_id) || stringOrNull(fallbackOrder.customer_id) || undefined,
            ...(total ? { total } : {}),
        },
        idempotencyKey: `order.paid:${siteId}:${orderId}:${input.idempotencyKey}`,
        requestId: input.requestId,
        actorId: input.actorId || null,
    });

    await enqueueOrderConfirmationEmail(env, db, {
        orderId,
        storeId: siteId,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
    }).catch((error) => {
        console.error(JSON.stringify({
            level: 'error',
            event: 'order_confirmation_email_dispatch_failed',
            order_id: orderId,
            store_id: siteId,
            request_id: input.requestId,
            error: error instanceof Error ? error.message : 'unknown error',
        }));
    });
}

export async function loadPayableOrder(
    c: AppContext,
    orderId: string,
    userId: string,
    sessionStoreId?: string
): Promise<PayableOrder> {
    const db = getSupabaseAdmin(c);

    const { data: order } = await getSupabaseAdminUnguarded(c)
        .from('orders')
        .select('id, store_id, total, currency, payment_status, status')
        .eq('id', orderId)
        .is('deleted_at', null)
        .single();

    if (!order) {
        throw new NotFoundError('Order not found');
    }

    const payableOrder = order as PayableOrder;

    if (!(await verifySiteOwnership(db, payableOrder.store_id, userId, sessionStoreId))) {
        throw new ForbiddenError('Not authorized to pay this order');
    }

    if (payableOrder.payment_status === 'paid') {
        throw new ConflictError('Order is already paid');
    }

    if (payableOrder.status === 'cancelled' || payableOrder.status === 'refunded') {
        throw new ConflictError('Order is not payable');
    }

    const total = Number(payableOrder.total);

    if (!Number.isFinite(total) || total <= 0) {
        throw new ConflictError('Order does not have a payable total');
    }

    return {
        ...payableOrder,
        total,
        currency: payableOrder.currency || 'INR',
    };
}
