import type { Context } from 'hono';
import type { Env } from '../../index';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { emitPaymentEvent } from '../../lib/payment-route-support';
import { AppError } from '../../lib/errors';

type AppContext = Context<{ Bindings: Env }>;
type Scope = { siteId: string; credentialId: string };

/** Both platform and merchant callbacks use the same canonical refund writer.
 * Only the merchant-signed path may present a bound credential. */
export async function reconcileInternalRefundEvent(c: AppContext,
    getRequestId: (c: AppContext) => string, body: Record<string, unknown>, merchantScope?: Scope) {
    const eventTypes = ['refund.created', 'refund.processed', 'refund.failed'];
    const statuses = ['created', 'processed', 'failed'];
    const paymentId = typeof body.providerPaymentId === 'string' ? body.providerPaymentId.trim() : '';
    const refundId = typeof body.providerRefundId === 'string' ? body.providerRefundId.trim() : '';
    const eventId = typeof body.providerEventId === 'string' ? body.providerEventId.trim() : '';
    const eventType = typeof body.eventType === 'string' ? body.eventType : '';
    const status = typeof body.status === 'string' ? body.status : '';
    const amountMinor = body.amountMinor;
    const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : '';
    if (body.provider !== 'razorpay' || !paymentId || paymentId.length > 200 || !refundId || refundId.length > 200
        || !eventId || eventId.length > 300 || !eventTypes.includes(eventType) || !statuses.includes(status)
        || !Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0 || currency !== 'INR'
        || (eventType === 'refund.created' && status !== 'created')
        || (eventType === 'refund.processed' && status !== 'processed')
        || (eventType === 'refund.failed' && status !== 'failed')) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Valid provider payment/refund/event references, lifecycle state and positive INR amount are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: payment, error: paymentError } = await db.rpc('resolve_payment_for_refund_provider_event', {
        p_provider: 'razorpay',
        p_provider_payment_id: paymentId,
    });
    if (paymentError) throw new Error(`Failed to resolve provider payment: ${paymentError.message}`);
    if (!payment) return merchantScope
        ? c.json({ success: false, error: { code: 'PAYMENT_ACCOUNT_MISMATCH' } }, 409)
        : c.json(success({ matched: false }));

    const paymentRow = payment as { id: string; site_id: string; order_id: string; provider: string; provider_payment_id: string; mode: string };
    if (merchantScope && paymentRow.site_id !== merchantScope.siteId) {
        return c.json({ success: false, error: { code: 'PAYMENT_ACCOUNT_MISMATCH' } }, 409);
    }
    const { data: boundPayment, error: bindingError } = await db.from('payments').select('credential_id')
        .eq('id', paymentRow.id).eq('site_id', paymentRow.site_id).eq('provider', 'razorpay')
        .is('deleted_at', null).maybeSingle();
    if (bindingError || !boundPayment) throw new AppError('Refund account binding is unavailable.', 503, 'PAYMENT_ACCOUNT_UNAVAILABLE');
    if (merchantScope ? boundPayment.credential_id !== merchantScope.credentialId : Boolean(boundPayment.credential_id)) {
        return c.json({ success: false, error: { code: 'PAYMENT_ACCOUNT_CALLBACK_UNBOUND',
            message: 'This refund requires the payment account that created it.' } }, 409);
    }
    const { data: exactAttempt, error: attemptError } = await db
        .from('payment_attempts')
        .select('id')
        .eq('site_id', paymentRow.site_id)
        .eq('payment_id', paymentRow.id)
        .eq('provider', paymentRow.provider)
        .eq('attempt_type', 'refund')
        .contains('metadata', { provider_refund_id: refundId })
        .is('deleted_at', null)
        .maybeSingle();
    if (attemptError) throw new Error(`Failed to resolve provider refund attempt: ${attemptError.message}`);
    let attempt = exactAttempt;
    if (!attempt) {
        const { data: pendingAttempts, error: pendingError } = await db
            .from('payment_attempts')
            .select('id, amount, currency, metadata')
            .eq('site_id', paymentRow.site_id)
            .eq('payment_id', paymentRow.id)
            .eq('provider', paymentRow.provider)
            .eq('attempt_type', 'refund')
            .eq('status', 'pending')
            .is('deleted_at', null);
        if (pendingError) throw new Error(`Failed to resolve pending provider refund attempt: ${pendingError.message}`);
        const candidates = (pendingAttempts || []).filter((row) => {
            const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
            return !metadata.provider_refund_id
                && row.currency === currency
                && Math.round(Number(row.amount) * 100) === amountMinor;
        });
        if (candidates.length !== 1) {
            return c.json({
                success: false,
                error: {
                    code: 'REFUND_ATTEMPT_UNRESOLVED',
                    message: 'Provider refund could not be matched to one reserved payment attempt; retry reconciliation.',
                    ambiguous: candidates.length > 1,
                },
            }, 409);
        }
        attempt = candidates[0];
    }

    const { data: result, error } = await db.rpc('reconcile_payment_refund_attempt', {
        p_payment_id: paymentRow.id,
        p_attempt_id: (attempt as { id: string }).id,
        p_provider_refund_id: refundId,
        p_provider_event_id: eventId,
        p_event_type: eventType,
        p_status: status,
        p_amount_minor: amountMinor,
        p_currency: currency,
        p_request_id: getRequestId(c),
    });
    if (error) throw new Error(`Provider refund reconciliation failed: ${error.message}`);

    const resultRecord = result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown>
        : {};
    if (resultRecord.outcome === 'processed') {
        await emitPaymentEvent(db, {
            siteId: paymentRow.site_id,
            paymentId: paymentRow.id,
            orderId: paymentRow.order_id,
            eventType: 'payment.refunded',
            payload: {
                provider: 'razorpay',
                provider_event_id: eventId,
                // The event contract carries the order's existing payment_status
                // union: a partial refund leaves the order paid until fully reversed.
                payment_status: resultRecord.fully_refunded === true ? 'refunded' : 'paid',
                mode: paymentRow.mode,
                amount_minor: amountMinor,
                cumulative_refund_amount_minor: resultRecord.refunded_amount_minor,
                currency,
                ledger_transaction_id: resultRecord.ledger_transaction_id,
                provider_refund_id: refundId,
            },
            requestId: getRequestId(c),
            idempotencyKey: `payment.refund:${paymentRow.id}:${refundId}`,
        });
    }

    return c.json(success({ matched: true, result }));
}
