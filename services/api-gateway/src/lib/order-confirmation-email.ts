import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import type { Env } from '../index';
import { signQueueTenantEnvelope } from './queue-tenant-envelope';

type OrderRow = {
    id: string;
    store_id: string;
    order_number?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    total?: number | string | null;
    currency?: string | null;
};

type OrderItemRow = {
    title?: string | null;
    name?: string | null;
    product_name?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    price?: number | string | null;
    total?: number | string | null;
};

function textValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency: string): string {
    return `${currency} ${numberValue(value).toFixed(2)}`;
}

function lineTitle(item: OrderItemRow): string {
    return textValue(item.title || item.name || item.product_name, 'Item');
}

function buildOrderConfirmationEmail(order: OrderRow, items: OrderItemRow[]) {
    const recipient = textValue(order.customer_email);
    if (!recipient) return null;

    const currency = textValue(order.currency, 'INR').toUpperCase();
    const orderLabel = textValue(order.order_number, order.id);
    const greetingName = textValue(order.customer_name, 'there');
    const itemLines = items.map((item) => {
        const quantity = numberValue(item.quantity) || 1;
        const total = item.total ?? Number(item.unit_price ?? item.price ?? 0) * quantity;
        return `- ${lineTitle(item)} x ${quantity}: ${money(total, currency)}`;
    });
    const text = [
        `Hi ${greetingName},`,
        '',
        `Your LetBuyy order ${orderLabel} is confirmed.`,
        '',
        ...(itemLines.length ? ['Items:', ...itemLines, ''] : []),
        `Total: ${money(order.total, currency)}`,
        '',
        'We will share fulfilment updates as the merchant processes your order.',
    ].join('\n');
    const htmlItems = items.map((item) => {
        const quantity = numberValue(item.quantity) || 1;
        const total = item.total ?? Number(item.unit_price ?? item.price ?? 0) * quantity;
        return `<li>${lineTitle(item)} x ${quantity} - ${money(total, currency)}</li>`;
    }).join('');

    return {
        to: recipient,
        subject: `Order ${orderLabel} confirmed`,
        text,
        html: [
            `<p>Hi ${greetingName},</p>`,
            `<p>Your LetBuyy order <strong>${orderLabel}</strong> is confirmed.</p>`,
            htmlItems ? `<ul>${htmlItems}</ul>` : '',
            `<p><strong>Total:</strong> ${money(order.total, currency)}</p>`,
            '<p>We will share fulfilment updates as the merchant processes your order.</p>',
        ].join(''),
        order_id: order.id,
        store_id: order.store_id,
        order_number: order.order_number,
    };
}

function configuredResend(env: Pick<Env, 'RESEND_API_KEY'>): boolean {
    const value = env.RESEND_API_KEY;
    return Boolean(value && !value.toLowerCase().includes('placeholder') && !value.toLowerCase().includes('skip_needs_human'));
}

export async function enqueueOrderConfirmationEmail(
    env: Pick<Env, 'NOTIFICATION_QUEUE' | 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL' | 'ENVIRONMENT' | 'INTERNAL_API_SECRET' | 'QUEUE_TENANT_ENVELOPE_SECRET'>,
    db: SupabaseClient,
    input: { orderId: string; storeId: string; requestId: string; idempotencyKey: string },
): Promise<void> {
    const { data: orderData } = await db
        .from('orders')
        .select('id, store_id, order_number, customer_name, customer_email, total, currency')
        .eq('id', input.orderId)
        .eq('store_id', input.storeId)
        .maybeSingle();

    const order = orderData as OrderRow | null;
    if (!order?.customer_email) return;

    const { data: itemData } = await db
        .from('order_items')
        .select('title, name, product_name, quantity, unit_price, price, total')
        .eq('order_id', input.orderId)
        .order('created_at', { ascending: true });
    const email = buildOrderConfirmationEmail(order, Array.isArray(itemData) ? itemData as OrderItemRow[] : []);
    if (!email) return;

    const queueBody = {
        messageId: `order-confirmation:${input.storeId}:${input.orderId}`,
        queueName: 'email',
        jobType: 'email.order_confirmation',
        siteId: input.storeId,
        idempotencyKey: `email.order_confirmation:${input.storeId}:${input.orderId}`,
        requestId: input.requestId,
        correlationId: input.requestId,
        payload: email,
    };

    if (env.NOTIFICATION_QUEUE) {
        await env.NOTIFICATION_QUEUE.send(await signQueueTenantEnvelope(env, queueBody));
        return;
    }

    if (!configuredResend(env)) {
        console.warn(JSON.stringify({
            level: 'warn',
            event: 'order_confirmation_email_skipped',
            reason: 'missing-notification-queue-and-resend',
            environment: env.ENVIRONMENT,
            order_id: input.orderId,
            store_id: input.storeId,
            request_id: input.requestId,
        }));
        return;
    }

    await sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>',
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
    });
}

// LB-10 — order cancelled / refunded customer emails. Mirrors enqueueOrderConfirmationEmail: render then
// enqueue an email.order_cancelled / email.order_refunded job (or send directly when no queue is bound).
export type OrderLifecycleEmailKind = 'cancelled' | 'refunded';

function buildOrderLifecycleEmail(order: OrderRow, kind: OrderLifecycleEmailKind, refundAmount?: number | string | null) {
    const recipient = textValue(order.customer_email);
    if (!recipient) return null;

    const currency = textValue(order.currency, 'INR').toUpperCase();
    const orderLabel = textValue(order.order_number, order.id);
    const greetingName = textValue(order.customer_name, 'there');

    if (kind === 'cancelled') {
        return {
            to: recipient,
            subject: `Order ${orderLabel} cancelled`,
            text: `Hi ${greetingName},\n\nYour LetBuyy order ${orderLabel} has been cancelled. If you were charged, your refund is being processed.`,
            html: [
                `<p>Hi ${greetingName},</p>`,
                `<p>Your LetBuyy order <strong>${orderLabel}</strong> has been cancelled. If you were charged, your refund is being processed.</p>`,
            ].join(''),
            order_id: order.id,
            store_id: order.store_id,
            order_number: order.order_number,
        };
    }

    const amount = money(refundAmount ?? order.total, currency);
    return {
        to: recipient,
        subject: `Refund issued for order ${orderLabel}`,
        text: `Hi ${greetingName},\n\nA refund of ${amount} for order ${orderLabel} has been issued and should reach your original payment method shortly.`,
        html: [
            `<p>Hi ${greetingName},</p>`,
            `<p>A refund of <strong>${amount}</strong> for order <strong>${orderLabel}</strong> has been issued and should reach your original payment method shortly.</p>`,
        ].join(''),
        order_id: order.id,
        store_id: order.store_id,
        order_number: order.order_number,
    };
}

export async function enqueueOrderLifecycleEmail(
    env: Pick<Env, 'NOTIFICATION_QUEUE' | 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL' | 'ENVIRONMENT' | 'INTERNAL_API_SECRET' | 'QUEUE_TENANT_ENVELOPE_SECRET'>,
    db: SupabaseClient,
    input: { orderId: string; storeId: string; requestId: string; kind: OrderLifecycleEmailKind; refundAmount?: number | string | null },
): Promise<void> {
    const { data: orderData } = await db
        .from('orders')
        .select('id, store_id, order_number, customer_name, customer_email, total, currency')
        .eq('id', input.orderId)
        .eq('store_id', input.storeId)
        .maybeSingle();

    const order = orderData as OrderRow | null;
    if (!order?.customer_email) return;

    const email = buildOrderLifecycleEmail(order, input.kind, input.refundAmount);
    if (!email) return;

    const jobType = input.kind === 'cancelled' ? 'email.order_cancelled' : 'email.order_refunded';
    const queueBody = {
        messageId: `order-${input.kind}:${input.storeId}:${input.orderId}`,
        queueName: 'email',
        jobType,
        siteId: input.storeId,
        idempotencyKey: `${jobType}:${input.storeId}:${input.orderId}`,
        requestId: input.requestId,
        correlationId: input.requestId,
        payload: email,
    };

    if (env.NOTIFICATION_QUEUE) {
        await env.NOTIFICATION_QUEUE.send(await signQueueTenantEnvelope(env, queueBody));
        return;
    }

    if (!configuredResend(env)) {
        console.warn(JSON.stringify({
            level: 'warn',
            event: 'order_lifecycle_email_skipped',
            reason: 'missing-notification-queue-and-resend',
            kind: input.kind,
            environment: env.ENVIRONMENT,
            order_id: input.orderId,
            store_id: input.storeId,
            request_id: input.requestId,
        }));
        return;
    }

    await sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>',
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
    });
}
