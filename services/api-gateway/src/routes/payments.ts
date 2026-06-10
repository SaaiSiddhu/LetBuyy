import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { dbErrorBody, getSupabaseAdmin } from '../lib/supabase';
import { ForbiddenError, ConflictError, HumanRequiredError, NotFoundError } from '../lib/errors';
import { validate } from '../middleware/validation';
import { PaymentExecutionAdapter } from '../execution/payment-execution.adapter';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { stepUpErrorBody, verifySensitiveActionStepUp } from '../lib/security-controls';
import { SubscriptionExecutionAdapter } from '../execution/subscription-execution.adapter';
import { createRazorpayOrder, fetchRazorpayPayment } from '@letbuyy/infrastructure/razorpay-adapter';
import { createStripeCheckoutSessionWithFetch } from '@letbuyy/infrastructure/stripe-adapter';
import {
    RazorpayOrderSchema,
    RazorpayVerifySchema,
    StripeCheckoutSchema,
} from '../schemas/order.schema';
import {
    CancelSubscriptionSchema,
    CreateSubscriptionOrderSchema,
    PlanListQuerySchema,
    RecoverSubscriptionPaymentSchema,
    StoreSubscriptionQuerySchema,
    VerifySubscriptionSchema,
    type CancelSubscriptionInput,
    type BillingPlanCatalogRecord,
    type CreateSubscriptionOrderInput,
    type PlanListQueryInput,
    type RecoverSubscriptionPaymentInput,
    type StoreSubscriptionQueryInput,
    type VerifySubscriptionInput,
    applyStorePlanTierDefaults,
    planBillingAmountMinor,
    razorpayBillingSignaturePayload,
} from '@letbuyy/billing-core';
import { createMerchantSubscriptionCheckout } from '../lib/subscription-checkout';
import {
    CreatePaymentSessionSchema,
    PaymentCaptureSchema,
    PaymentRefundSchema,
    PaymentVoidSchema,
    type CreatePaymentSessionInput,
    type PaymentCaptureInput,
    type PaymentRefundInput,
    type PaymentVoidInput,
} from '../schemas/payment.schema';
import {
    buildPaymentCaptureLedgerPosting,
    buildPaymentRefundLedgerPosting,
    buildSandboxPaymentSessionPlan,
    inrMoney,
    normalizeV1PaymentSessionProvider,
} from '@letbuyy/payments';
import {
    amountMismatchBody,
    asRecord,
    assertProviderPaymentNotReplayed,
    emitOrderPaidEvent,
    emitPaymentEvent,
    getRequestId,
    loadOwnedPaymentSession,
    loadPayableOrder,
    paymentProviderMode,
    paymentSetupRequiredResponse,
    postPaymentLedger,
    requestedAmountMinorUnits,
    requireLivePaymentCredential,
    resolvePlatformOrigin,
    stringOrNull,
    type PaymentJsonValue,
    type PaymentSessionRow,
} from '../lib/payment-route-support';

const router = new Hono<{ Bindings: Env }>();

// GET /payments/plans — Fetch active subscription plans through the worker boundary
router.get('/plans', validate('query', PlanListQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as PlanListQueryInput;
    const db = getSupabaseAdmin(c);

    let request = db
        .from('plans')
        .select('*')
        .eq('site_type', query.site_type)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (query.slug) {
        request = request.eq('slug', query.slug);
    }

    const { data, error } = await request;

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: (data || []).map((plan) => applyStorePlanTierDefaults(plan as BillingPlanCatalogRecord)) });
});

// POST /payments/sessions — V1 provider-agnostic merchant-owned payment session
router.post('/sessions', validate('json', CreatePaymentSessionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreatePaymentSessionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    const order = await loadPayableOrder(c, body.order_id, customUser.id, auth.user.storeId);
    const provider = normalizeV1PaymentSessionProvider(body.provider);
    const mode = paymentProviderMode(c, provider, body.mode);

    let credential: { id: string } | null = null;
    try {
        credential = await requireLivePaymentCredential(db, order.store_id, provider, mode);
    } catch (error) {
        if (error instanceof HumanRequiredError) {
            return paymentSetupRequiredResponse(c);
        }
        throw error;
    }

    const amountMinorUnits = Math.round(order.total * 100);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: order.store_id,
        key: body.idempotency_key,
        scope: `payment.session:${body.order_id}`,
        requestBody: body,
        requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as never, claim.statusCode as never);
    }

    try {
        const plan = buildSandboxPaymentSessionPlan({
            provider,
            mode,
            orderId: body.order_id,
            amount: inrMoney(amountMinorUnits),
            idempotencyKey: body.idempotency_key,
            merchantCredentialPresent: Boolean(credential),
            metadata: {
                ...(body.metadata || {}),
                channel: asRecord(body.metadata).channel || 'web',
                tokenization_requested: body.tokenize === true,
            },
        });
        const expiresAt = new Date(Date.now() + (plan.expiresInSeconds * 1000)).toISOString();

        const { data: insertedPayment, error: insertError } = await db
            .from('payments')
            .insert({
                site_id: order.store_id,
                order_id: body.order_id,
                provider: plan.provider,
                mode: plan.mode,
                status: plan.status,
                amount_minor: plan.amount.amountMinor,
                currency: plan.amount.currency,
                provider_order_id: plan.providerOrderId,
                provider_session_id: plan.providerSessionId,
                idempotency_key: String(plan.idempotencyKey),
                credential_id: credential?.id || null,
                client_action: plan.clientAction,
                expires_at: expiresAt,
                metadata: plan.metadata,
                request_id: requestId,
                created_by: customUser.id,
                updated_by: customUser.id,
            })
            .select('*')
            .single();

        if (insertError || !insertedPayment) {
            await idempotency.fail(claim.id);
            return c.json(dbErrorBody('Failed to create payment session'), 500);
        }

        const payment = insertedPayment as PaymentSessionRow;

        if (provider === 'razorpay' || provider === 'cashfree') {
            await new PaymentExecutionAdapter(db).attachPaymentReference({
                orderId: body.order_id,
                provider,
                providerOrderId: payment.provider_order_id || plan.providerOrderId,
                requestId,
                idempotencyKey: body.idempotency_key,
            });
        }

        await emitPaymentEvent(db, {
            siteId: order.store_id,
            paymentId: payment.id,
            orderId: body.order_id,
            eventType: plan.status === 'authorized' ? 'payment.authorized' : 'payment.pending',
            payload: {
                provider,
                provider_event_id: payment.provider_session_id || `payment.session:${payment.id}`,
                payment_status: plan.status === 'authorized' ? 'authorized' : 'pending',
                mode,
                status: plan.status,
                amount_minor: plan.amount.amountMinor,
                currency: plan.amount.currency,
                provider_order_id: payment.provider_order_id,
                provider_session_id: payment.provider_session_id,
                client_action: payment.client_action,
            },
            actorId: customUser.id,
            requestId,
            idempotencyKey: `payment.session:${payment.id}:${body.idempotency_key}`,
        });

        const responseBody: PaymentJsonValue = {
            data: {
                payment_id: payment.id,
                provider,
                mode,
                status: plan.status,
                amount_minor: plan.amount.amountMinor,
                currency: plan.amount.currency,
                provider_order_id: payment.provider_order_id ?? null,
                provider_session_id: payment.provider_session_id ?? null,
                client_action: payment.client_action ?? null,
                expires_at: expiresAt,
            },
        };

        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 201,
            resourceType: 'payment',
            resourceId: payment.id,
        });

        return c.json(responseBody, 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /payments/:id/capture — capture a V1 payment session after provider proof and canonical ledger posting
router.post('/:paymentId/capture', validate('json', PaymentCaptureSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as PaymentCaptureInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);

    if (!customUser) throw new ForbiddenError('User profile not found');

    const payment = await loadOwnedPaymentSession(c, c.req.param('paymentId'), customUser.id, auth.user.storeId);
    if (payment.status === 'captured' && payment.capture_ledger_transaction_id) {
        return c.json({ data: { captured: true, payment } });
    }
    if (payment.status === 'voided' || payment.status === 'refunded' || payment.status === 'failed') {
        throw new ConflictError('Payment cannot be captured in its current state');
    }

    const captureScope = ['payment.capture', payment.id].join(':');
    const captureLedgerKey = ['payment.capture', payment.id, body.idempotency_key].join(':');
    const providerPaymentId = body.provider_payment_id || payment.provider_payment_id || null;
    if (!providerPaymentId) {
        throw new ConflictError('Provider payment id is required before capture can be recorded');
    }
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: payment.site_id,
        key: body.idempotency_key,
        scope: captureScope,
        requestBody: body,
        requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as never, claim.statusCode as never);
    }

    try {
        const ledgerTransactionId = await postPaymentLedger(
            db,
            buildPaymentCaptureLedgerPosting({
                siteId: payment.site_id,
                orderId: payment.order_id,
                providerPaymentId,
                grossAmountMinor: payment.amount_minor,
                platformFeeMinor: 0,
                gstMinor: 0,
                idempotencyKey: captureLedgerKey,
            }),
            {
                payment_id: payment.id,
                provider: payment.provider,
                provider_mode: payment.mode,
                provider_order_id: payment.provider_order_id || null,
                provider_payment_id: providerPaymentId,
                fee_assessment: 'deferred_to_payout_statement',
            },
            requestId,
        );

        const { data: updated, error } = await db
            .from('payments')
            .update({
                status: 'captured',
                provider_payment_id: providerPaymentId,
                captured_at: new Date().toISOString(),
                capture_ledger_transaction_id: ledgerTransactionId,
                metadata: { ...(payment.metadata || {}), ...(body.metadata || {}) },
                request_id: requestId,
                updated_by: customUser.id,
            })
            .eq('id', payment.id)
            .select('*')
            .single();

        if (error || !updated) {
            await idempotency.fail(claim.id);
            return c.json(dbErrorBody('Failed to capture payment'), 500);
        }

        await db.from('payment_attempts').insert({
            site_id: payment.site_id,
            order_id: payment.order_id,
            payment_id: payment.id,
            provider: payment.provider,
            attempt_type: 'capture',
            status: 'succeeded',
            amount: payment.amount_minor / 100,
            currency: payment.currency,
            provider_order_id: payment.provider_order_id,
            provider_payment_id: providerPaymentId,
            provider_session_id: payment.provider_session_id,
            idempotency_key: body.idempotency_key,
            request_id: requestId,
            metadata: body.metadata,
            created_by: customUser.id,
            updated_by: customUser.id,
        });

        await emitPaymentEvent(db, {
            siteId: payment.site_id,
            paymentId: payment.id,
            orderId: payment.order_id,
            eventType: 'payment.captured',
            payload: {
                provider: payment.provider,
                provider_event_id: providerPaymentId,
                payment_status: 'paid',
                mode: payment.mode,
                provider_payment_id: providerPaymentId,
                amount_minor: payment.amount_minor,
                currency: payment.currency,
                ledger_transaction_id: ledgerTransactionId,
            },
            actorId: customUser.id,
            requestId,
            idempotencyKey: captureLedgerKey,
        });

        const responseBody = { data: { captured: true, payment: updated } };
        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 200,
            resourceType: 'payment',
            resourceId: payment.id,
        });

        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /payments/:id/void — void a V1 payment session without mutating ledger truth
router.post('/:paymentId/void', validate('json', PaymentVoidSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as PaymentVoidInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);

    if (!customUser) throw new ForbiddenError('User profile not found');

    const payment = await loadOwnedPaymentSession(c, c.req.param('paymentId'), customUser.id, auth.user.storeId);
    if (payment.status === 'captured' || payment.status === 'refunded') {
        throw new ConflictError('Captured or refunded payments cannot be voided');
    }

    const { data: updated, error } = await db
        .from('payments')
        .update({
            status: 'voided',
            voided_at: new Date().toISOString(),
            failure_code: 'PAYMENT_VOIDED',
            failure_message: body.reason || 'Payment voided',
            metadata: { ...(payment.metadata || {}), ...(body.metadata || {}) },
            request_id: requestId,
            updated_by: customUser.id,
        })
        .eq('id', payment.id)
        .select('*')
        .single();

    if (error || !updated) {
        return c.json(dbErrorBody('Failed to void payment'), 500);
    }

    await db.from('payment_attempts').insert({
        site_id: payment.site_id,
        order_id: payment.order_id,
        payment_id: payment.id,
        provider: payment.provider,
        attempt_type: 'void',
        status: 'succeeded',
        amount: payment.amount_minor / 100,
        currency: payment.currency,
        provider_order_id: payment.provider_order_id,
        provider_payment_id: payment.provider_payment_id,
        provider_session_id: payment.provider_session_id,
        idempotency_key: body.idempotency_key,
        request_id: requestId,
        failure_reason: body.reason || null,
        metadata: body.metadata,
        created_by: customUser.id,
        updated_by: customUser.id,
    });

    await emitPaymentEvent(db, {
        siteId: payment.site_id,
        paymentId: payment.id,
        orderId: payment.order_id,
        eventType: 'payment.failed',
        payload: {
            provider: payment.provider,
            provider_event_id: `payment.void:${payment.id}`,
            payment_status: 'failed',
            mode: payment.mode,
            failure_code: 'PAYMENT_VOIDED',
            failure_message: body.reason || 'Payment voided',
        },
        actorId: customUser.id,
        requestId,
        idempotencyKey: `payment.void:${payment.id}:${body.idempotency_key}`,
    });

    return c.json({ data: { voided: true, payment: updated } });
});

// POST /payments/:id/refund — record a provider-confirmed refund and canonical F6 ledger entry
router.post('/:paymentId/refund', validate('json', PaymentRefundSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as PaymentRefundInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);

    if (!customUser) throw new ForbiddenError('User profile not found');

    const payment = await loadOwnedPaymentSession(c, c.req.param('paymentId'), customUser.id, auth.user.storeId);
    if (payment.status !== 'captured') {
        throw new ConflictError('Only captured payments can be refunded');
    }

    const providerRefundId = body.provider_refund_id || stringOrNull(body.metadata?.provider_refund_id) || null;
    if (!providerRefundId) {
        throw new ConflictError('Provider refund id is required before refund can be recorded');
    }
    const alreadyRefundedMinor = Math.max(0, Number(payment.refunded_amount_minor || 0));
    const refundAmountMinor = body.amount_minor || (payment.amount_minor - alreadyRefundedMinor);
    if (refundAmountMinor <= 0) {
        throw new ConflictError('Refund amount must be positive');
    }
    const cumulativeRefundMinor = alreadyRefundedMinor + refundAmountMinor;
    if (cumulativeRefundMinor > payment.amount_minor) {
        throw new ConflictError('Refund amount cannot exceed captured amount');
    }
    const fullyRefunded = cumulativeRefundMinor === payment.amount_minor;

    const stepUp = verifySensitiveActionStepUp({
        action: 'refund.approve',
        actorId: customUser.id,
        siteId: payment.site_id,
        token: c.req.header('X-Step-Up-Token') || (body.metadata?.step_up_token as string | undefined),
        verifiedAt: c.req.header('X-Step-Up-Verified-At') || (body.metadata?.step_up_verified_at as string | undefined),
    });
    if (!stepUp.ok) {
        return c.json(stepUpErrorBody(stepUp), 428);
    }

    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: payment.site_id,
        key: body.idempotency_key,
        scope: `payment.refund:${payment.id}`,
        requestBody: body,
        requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as never, claim.statusCode as never);
    }

    try {
        const ledgerTransactionId = await postPaymentLedger(
            db,
            buildPaymentRefundLedgerPosting({
                siteId: payment.site_id,
                paymentId: payment.id,
                providerRefundId,
                refundAmountMinor,
                idempotencyKey: `payment.refund:${payment.id}:${body.idempotency_key}`,
            }),
            {
                payment_id: payment.id,
                provider: payment.provider,
                provider_mode: payment.mode,
                provider_payment_id: payment.provider_payment_id || null,
                provider_refund_id: providerRefundId,
                refund_amount_minor: refundAmountMinor,
                cumulative_refund_amount_minor: cumulativeRefundMinor,
            },
            requestId,
        );

        const { data: updated, error } = await db
            .from('payments')
            .update({
                status: fullyRefunded ? 'refunded' : 'captured',
                refunded_at: fullyRefunded ? new Date().toISOString() : payment.refunded_at || null,
                refunded_amount_minor: cumulativeRefundMinor,
                refund_ledger_transaction_id: ledgerTransactionId,
                metadata: {
                    ...(payment.metadata || {}),
                    ...(body.metadata || {}),
                    ...stepUp.metadata,
                    provider_refund_id: providerRefundId,
                    refund_amount_minor: refundAmountMinor,
                    cumulative_refund_amount_minor: cumulativeRefundMinor,
                    refund_reason: body.reason || null,
                },
                request_id: requestId,
                updated_by: customUser.id,
            })
            .eq('id', payment.id)
            .select('*')
            .single();

        if (error || !updated) {
            await idempotency.fail(claim.id);
            return c.json(dbErrorBody('Failed to refund payment'), 500);
        }

        await db.from('payment_attempts').insert({
            site_id: payment.site_id,
            order_id: payment.order_id,
            payment_id: payment.id,
            provider: payment.provider,
            attempt_type: 'refund',
            status: 'succeeded',
            amount: refundAmountMinor / 100,
            currency: payment.currency,
            provider_order_id: payment.provider_order_id,
            provider_payment_id: payment.provider_payment_id,
            provider_session_id: payment.provider_session_id,
            idempotency_key: body.idempotency_key,
            request_id: requestId,
            failure_reason: body.reason || null,
            metadata: {
                ...(body.metadata || {}),
                ...stepUp.metadata,
                provider_refund_id: providerRefundId,
                ledger_transaction_id: ledgerTransactionId,
            },
            created_by: customUser.id,
            updated_by: customUser.id,
        });

        await emitPaymentEvent(db, {
            siteId: payment.site_id,
            paymentId: payment.id,
            orderId: payment.order_id,
            eventType: 'payment.refunded',
            payload: {
                provider: payment.provider,
                provider_event_id: providerRefundId,
                payment_status: fullyRefunded ? 'refunded' : 'partially_refunded',
                mode: payment.mode,
                amount_minor: refundAmountMinor,
                cumulative_refund_amount_minor: cumulativeRefundMinor,
                currency: payment.currency,
                reason: body.reason || null,
                ledger_transaction_id: ledgerTransactionId,
            },
            actorId: customUser.id,
            requestId,
            idempotencyKey: `payment.refund:${payment.id}:${body.idempotency_key}`,
        });

        const responseBody = { data: { refunded: true, fully_refunded: fullyRefunded, payment: updated } };
        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 200,
            resourceType: 'payment',
            resourceId: payment.id,
        });

        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// GET /payments/subscription — Store-scoped billing state for merchant admin
router.get('/subscription', validate('query', StoreSubscriptionQuerySchema), async (c) => {
    const auth = c.get('auth');
    const { store_id } = c.get('validatedQuery') as StoreSubscriptionQueryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data: store } = await db
        .from('sites')
        .select('id, trial_status, trial_ends_at, site_type')
        .eq('id', store_id)
        .single();

    if (!store) throw new NotFoundError('Store not found');

    const { data: subscription, error } = await db
        .from('subscriptions')
        .select('id, plan, status, billing_period, current_period_end, promo_ends_at, amount_paid, created_at, updated_at, external_subscription_id')
        .eq('store_id', store_id)
        .in('status', ['active', 'past_due', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({
        data: {
            store: {
                id: store.id,
                trial_status: store.trial_status || 'active',
                trial_ends_at: store.trial_ends_at || null,
                site_type: store.site_type || 'store',
            },
            subscription: subscription || null,
        },
    });
});

// GET /payments/subscription/history — Store-scoped billing/invoice history for merchant admin
router.get('/subscription/history', validate('query', StoreSubscriptionQuerySchema), async (c) => {
    const auth = c.get('auth');
    const { store_id } = c.get('validatedQuery') as StoreSubscriptionQueryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data, error } = await db
        .from('subscriptions')
        .select('id, amount_paid, status, billing_period, created_at')
        .eq('store_id', store_id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: data || [] });
});

// POST /payments/subscription/cancel — Cancel active store subscription
router.post('/subscription/cancel', validate('json', CancelSubscriptionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CancelSubscriptionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data, error } = await db
        .from('subscriptions')
        .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancel_reason: body.reason || 'merchant_requested',
        })
        .eq('store_id', body.store_id)
        .eq('status', 'active')
        .select('id, plan, status, current_period_end, cancelled_at')
        .limit(1);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: { cancelled: true, subscriptions: data || [] } });
});

// POST /payments/subscription/order — Create a Razorpay order for merchant subscription checkout
router.post('/subscription/order', validate('json', CreateSubscriptionOrderSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateSubscriptionOrderInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const checkout = await createMerchantSubscriptionCheckout({
        db,
        env: c.env,
        userId: customUser.id,
        storeId: body.store_id,
        siteType: body.site_type,
        planSlug: body.plan_slug,
        billingPeriod: body.billing_period,
        approvedUsageCharges: body.approved_usage_charges,
    });

    return c.json(checkout.body, checkout.status);
});

// POST /payments/subscription/recover — Create a checkout to recover a failed subscription payment
router.post('/subscription/recover', validate('json', RecoverSubscriptionPaymentSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as RecoverSubscriptionPaymentInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data: subscription, error } = await db
        .from('subscriptions')
        .select('id, plan, status, billing_period')
        .eq('store_id', body.store_id)
        .in('status', ['past_due', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) return c.json(dbErrorBody(), 500);
    if (!subscription) {
        return c.json(
            { error: { code: 'SUBSCRIPTION_RECOVERY_UNAVAILABLE', message: 'No failed subscription payment needs recovery' } },
            409,
        );
    }

    const billingPeriod = body.billing_period === 'yearly' || subscription.billing_period === 'yearly' ? 'yearly' : 'monthly';
    const checkout = await createMerchantSubscriptionCheckout({
        db,
        env: c.env,
        userId: customUser.id,
        storeId: body.store_id,
        siteType: 'store',
        planSlug: String(subscription.plan || 'business'),
        billingPeriod,
        approvedUsageCharges: [],
    });
    const data = checkout.body.data;

    if (data && typeof data === 'object' && !Array.isArray(data)) {
        return c.json({
            data: {
                ...(data as Record<string, unknown>),
                recovery: {
                    subscription_id: String(subscription.id),
                    previous_status: String(subscription.status),
                    plan_slug: String(subscription.plan || 'business'),
                    next_step: (data as Record<string, unknown>).activated === true ? 'activated' : 'checkout',
                },
            },
        }, checkout.status);
    }

    return c.json(checkout.body, checkout.status);
});

// POST /payments/subscription/verify — Verify Razorpay and activate a merchant subscription
router.post('/subscription/verify', validate('json', VerifySubscriptionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as VerifySubscriptionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data: store } = await db
        .from('sites')
        .select('id, site_type')
        .eq('id', body.store_id)
        .single();

    if (!store) throw new NotFoundError('Store not found');

    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
        return c.json({ error: { code: 'PAYMENT_UNAVAILABLE', message: 'Payment gateway is not configured' } }, 503);
    }

    const expected = await hmacSha256Hex(
        c.env.RAZORPAY_KEY_SECRET,
        razorpayBillingSignaturePayload({
            orderId: body.razorpay_order_id,
            subscriptionId: body.razorpay_subscription_id,
            paymentId: body.razorpay_payment_id,
        })
    );

    if (!timingSafeEqualHex(expected, body.razorpay_signature)) {
        return c.json({ error: { code: 'PAYMENT_SIGNATURE_INVALID', message: 'Payment verification failed' } }, 400);
    }

    const { data: rawPlan } = await db
        .from('plans')
        .select('*')
        .eq('site_type', body.site_type)
        .eq('slug', body.plan_slug)
        .eq('is_active', true)
        .single();

    if (!rawPlan) {
        throw new NotFoundError('Plan not found');
    }

    const plan = applyStorePlanTierDefaults(rawPlan as BillingPlanCatalogRecord) as BillingPlanCatalogRecord & Record<string, unknown>;

    const amountPaid = planBillingAmountMinor(plan, body.billing_period).amountMinor;

    // SECURITY: a valid HMAC only proves Razorpay signed (order|subscription)+payment ids
    // — NOT that money was captured, nor how much. Without a server-side capture check a
    // merchant can replay ANY valid signature (e.g. from a ₹1 order, or a cheaper plan's
    // payment) to self-activate any plan for free. Confirm the payment was actually
    // captured for at least the plan price and is bound to the submitted order.
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
        return c.json({ error: { code: 'PAYMENT_VERIFICATION_FAILED', message: 'Plan price could not be determined' } }, 400);
    }
    const capturedPayment = await fetchRazorpayPayment(
        { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
        body.razorpay_payment_id,
    );
    const capturedStatus = (capturedPayment.status || '').toLowerCase();
    const capturedAmount = typeof capturedPayment.amount === 'number' ? capturedPayment.amount : null;
    const captureOk = !capturedPayment.error && capturedStatus === 'captured';
    const amountOk = capturedAmount !== null && capturedAmount >= amountPaid;
    // One-time order mode: the captured payment must belong to the submitted order.
    const orderBindingOk = !body.razorpay_order_id
        || !capturedPayment.order_id
        || capturedPayment.order_id === body.razorpay_order_id;
    if (!captureOk || !amountOk || !orderBindingOk) {
        return c.json(
            { error: { code: 'PAYMENT_VERIFICATION_FAILED', message: 'Payment could not be verified with the provider' } },
            400,
        );
    }

    let subscription;
    try {
        subscription = await new SubscriptionExecutionAdapter(db).activateMerchantSubscription({
            userId: customUser.id,
            storeId: body.store_id,
            plan,
            billingPeriod: body.billing_period,
            amountPaid,
            paymentGateway: 'razorpay',
            externalSubscriptionId: body.razorpay_subscription_id || body.razorpay_order_id || null,
            razorpayOrderId: body.razorpay_order_id || null,
            razorpayPaymentId: body.razorpay_payment_id,
        });
    } catch {
        return c.json(dbErrorBody('Failed to create subscription'), 500);
    }

    return c.json({
        data: {
            subscription,
            message: `Successfully subscribed to ${plan.name} plan!`,
        },
    }, 201);
});

// POST /payments/razorpay/order — Create a Razorpay order
router.post('/razorpay/order', validate('json', RazorpayOrderSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as {
        order_id: string;
        idempotency_key: string;
        amount?: number;
        amount_minor_units?: number;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
        return c.json(
            { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
            503
        );
    }

    const order = await loadPayableOrder(c, body.order_id, customUser.id, auth.user.storeId);
    const amountMinorUnits = Math.round(order.total * 100);
    const requestedMinorUnits = requestedAmountMinorUnits(body);
    if (requestedMinorUnits !== null && requestedMinorUnits !== amountMinorUnits) {
        return c.json(amountMismatchBody(), 400);
    }

    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: order.store_id,
        key: body.idempotency_key,
        scope: `payment.razorpay.order:${body.order_id}`,
        requestBody: body,
        requestId: getRequestId(c),
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as never, claim.statusCode as never);
    }

    try {
        const razorpayOrder = await createRazorpayOrder(
            { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
            {
                amount: amountMinorUnits,
                currency: order.currency || 'INR',
                receipt: body.order_id,
                notes: {
                    order_id: body.order_id,
                    idempotency_key: body.idempotency_key || '',
                },
            }
        );

        if (!razorpayOrder.id) {
            await idempotency.fail(claim.id);
            return c.json(
                { error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment order' } },
                502
            );
        }

        const paymentService = new PaymentExecutionAdapter(db);
        await paymentService.attachPaymentReference({
            orderId: body.order_id,
            provider: 'razorpay',
            providerOrderId: razorpayOrder.id,
            requestId: getRequestId(c),
            idempotencyKey: body.idempotency_key,
        });

        const responseBody = {
            data: {
                razorpay_order_id: razorpayOrder.id,
                amount: razorpayOrder.amount ?? amountMinorUnits,
                currency: razorpayOrder.currency || order.currency || 'INR',
                key_id: c.env.RAZORPAY_KEY_ID,
            },
        };

        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 200,
            resourceType: 'order',
            resourceId: body.order_id,
        });

        return c.json(responseBody);
    } catch (err) {
        await idempotency.fail(claim.id);
        throw err;
    }
});

// POST /payments/razorpay/verify — Verify payment signature
// CRITICAL FIX: Added ownership check + double-payment guard
router.post('/razorpay/verify', validate('json', RazorpayVerifySchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        order_id: string;
        idempotency_key: string;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    if (!c.env.RAZORPAY_KEY_SECRET) {
        return c.json(
            { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
            503
        );
    }

    // CRITICAL FIX #1: Fetch order and verify ownership
    const { data: order } = await db
        .from('orders')
        .select('id, store_id, total, payment_status, status, payment_id')
        .eq('id', body.order_id)
        .is('deleted_at', null)
        .single();

    if (!order) {
        throw new NotFoundError('Order not found');
    }

    if (!(await verifySiteOwnership(db, order.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized to verify this payment');
    }

    // CRITICAL FIX #2: Prevent double-payment
    if (order.payment_status === 'paid') {
        throw new ConflictError('Payment already verified for this order');
    }

    // Verify HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(c.env.RAZORPAY_KEY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const payload = `${body.razorpay_order_id}|${body.razorpay_payment_id}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    if (!timingSafeEqualHex(expectedSig, body.razorpay_signature)) {
        return c.json(
            { error: { code: 'PAYMENT_ERROR', message: 'Invalid payment signature' } },
            400
        );
    }

    // SECURITY: fail closed — the order MUST have been bound to a server-created Razorpay
    // order (via POST /razorpay/order → attachPaymentReference) before it can be verified.
    // A null payment_id means no provider order was created for this order, so any signature
    // presented here is being replayed from a different order. Reject.
    if (!order.payment_id || order.payment_id !== body.razorpay_order_id) {
        throw new ConflictError('Payment reference mismatch');
    }

    await assertProviderPaymentNotReplayed(db, {
        provider: 'razorpay',
        providerPaymentId: body.razorpay_payment_id,
        providerOrderId: body.razorpay_order_id,
        orderId: order.id,
    });

    const paymentService = new PaymentExecutionAdapter(db);
    const updated = await paymentService.confirmPayment({
        orderId: order.id,
        provider: 'razorpay',
        providerPaymentId: body.razorpay_payment_id,
        providerOrderId: body.razorpay_order_id,
        providerEventId: `razorpay:protected:${body.razorpay_payment_id}`,
        requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
        idempotencyKey: body.idempotency_key,
    });
    await emitOrderPaidEvent(c.env, db, {
        order: updated,
        fallbackOrder: order,
        actorId: customUser.id,
        requestId: getRequestId(c),
        idempotencyKey: body.idempotency_key,
    });

    return c.json({ data: { verified: true, order: updated } });
});

// POST /payments/stripe/checkout — Create a Stripe checkout session
router.post('/stripe/checkout', validate('json', StripeCheckoutSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as {
        order_id: string;
        success_url?: string;
        cancel_url?: string;
        idempotency_key: string;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    if (!c.env.STRIPE_SECRET_KEY) {
        return c.json(
            { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Stripe is not configured' } },
            503
        );
    }

    try {
        const order = await loadPayableOrder(c, body.order_id, customUser.id, auth.user.storeId);
        const unitAmount = Math.round(order.total * 100);

        const session = await createStripeCheckoutSessionWithFetch({
            secretKey: c.env.STRIPE_SECRET_KEY,
            orderId: body.order_id,
            amountMinorUnits: unitAmount,
            currency: order.currency || 'INR',
            successUrl: body.success_url || `${resolvePlatformOrigin(c)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: body.cancel_url || `${resolvePlatformOrigin(c)}/checkout/cancel`,
            idempotencyKey: body.idempotency_key,
            name: `LetBuyy order ${body.order_id}`,
        });

        if (!session.id) {
            return c.json(
                {
                    error: {
                        code: 'PAYMENT_ERROR',
                        message: 'Failed to create Stripe checkout session',
                    },
                },
                500
            );
        }

        // Update order with Stripe session ID
        const paymentService = new PaymentExecutionAdapter(db);
        await paymentService.attachPaymentReference({
            orderId: body.order_id,
            provider: 'stripe',
            providerOrderId: String(session.id),
            requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
            idempotencyKey: body.idempotency_key,
        });

        return c.json({
            data: {
                session_id: session.id,
                session_url: session.url,
            },
        });
    } catch (err) {
        return c.json(
            { error: { code: 'PAYMENT_ERROR', message: 'Stripe service unavailable' } },
            503
        );
    }
});

export default router;
