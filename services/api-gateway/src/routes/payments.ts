import {publicSubscriptionBillingRecord} from '../lib/subscription-checkout-source';
import {verifyCanonicalRazorpayCapture} from '../lib/payment-capture-proof';
import {commitCanonicalPaymentCapture} from '../execution/payment-capture-execution.adapter';
import {originalRefundCredentials,verifyRazorpayRefundProof} from '../lib/payment-refund-proof';
import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { verifyRazorpayPayment } from '../lib/provider-payment-verification';
import { dbErrorBody, getSupabaseAdmin } from '../lib/supabase';
import { AppError, ForbiddenError, ConflictError, HumanRequiredError, NotFoundError } from '../lib/errors';
import { validate } from '../middleware/validation';
import { PaymentExecutionAdapter, readCaptureResult } from '../execution/payment-execution.adapter';
import { FIXED_PUBLIC_ERROR_MESSAGES } from '../lib/public-errors';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { stepUpErrorBody } from '../lib/security-controls';
import { verifyMerchantStepUp } from '../lib/merchant-step-up';
import { SubscriptionExecutionAdapter } from '../execution/subscription-execution.adapter';
import { createRazorpayOrder, createRazorpayPaymentProvider, fetchRazorpayPayment } from '@letbuyy/infrastructure/razorpay-adapter';
import {
    RazorpayOrderSchema,
    RazorpayVerifySchema,
} from '../schemas/order.schema';
import {
    CancelSubscriptionSchema,
    CreateSubscriptionOrderSchema,
    PlanListQuerySchema,
    RecoverSubscriptionPaymentSchema,
    StoreSubscriptionQuerySchema,
    ValidateSubscriptionCouponSchema,
    VerifySubscriptionSchema,
    type CancelSubscriptionInput,
    type ValidateSubscriptionCouponInput,
    type BillingPlanCatalogRecord,
    type CreateSubscriptionOrderInput,
    type PlanListQueryInput,
    type RecoverSubscriptionPaymentInput,
    type StoreSubscriptionQueryInput,
    type VerifySubscriptionInput,
    applyFoundingLockToPlan,
    applyStorePlanTierDefaults,
    planBillingAmountMinor,
} from '@letbuyy/billing-core';
import { createMerchantSubscriptionCheckout, previewSubscriptionCoupon, recordSubscriptionCouponRedemption } from '../lib/subscription-checkout';
import {readSubscriptionCheckoutSource,verifyNativeSubscriptionInvoice} from '../lib/subscription-checkout-source';
import {resolveFoundingCheckoutLock} from '../lib/founding-pricing';
import { sendFoundingMerchantWelcomeEmail } from '../lib/founding-merchant-email';
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
    buildSandboxPaymentSessionPlan,
    inrMoney,
    toInrMinorUnits,
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
    requestedAmountMinorUnits,
    requireLivePaymentCredential,
    stringOrNull,
    type PaymentJsonValue,
    type PaymentSessionRow,
} from '../lib/payment-route-support';

const router = new Hono<{ Bindings: Env }>();

// GET /payments/plans — Fetch active subscription plans through the worker boundary
router.get('/plans', validate('query', PlanListQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as PlanListQueryInput;
    const db = getSupabaseAdmin(c);

    if(query.store_id){
        const auth=c.get('auth');
        if(!auth?.user)throw new ForbiddenError('Sign in to view store pricing');
        const user=await resolveCustomUser(db,auth.user);
        if(!user||!(await verifySiteOwnership(db,query.store_id,user.id,auth.user.storeId)))throw new ForbiddenError('Not authorized for this store');
    }

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

    const plans=await Promise.all((data||[]).map(async raw=>{
        const plan=applyStorePlanTierDefaults(raw as BillingPlanCatalogRecord);
        const effective=query.store_id?applyFoundingLockToPlan(plan,await resolveFoundingCheckoutLock(db,query.store_id,plan)):plan;
        const monthly=planBillingAmountMinor(effective,'monthly').amountMinor,yearly=planBillingAmountMinor(effective,'yearly').amountMinor;
        if(!Number.isSafeInteger(monthly)||monthly<0||!Number.isSafeInteger(yearly)||yearly<0)throw new AppError('Subscription pricing is temporarily unavailable.',503,'SUBSCRIPTION_PRICING_UNAVAILABLE');
        return {...effective,currency:'INR',billing_amount_monthly_minor:monthly,billing_amount_yearly_minor:yearly};
    }));
    return c.json({data:plans});
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

        if (provider === 'razorpay') {
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
    const providerPaymentId = body.provider_payment_id || payment.provider_payment_id || null;
    if (!providerPaymentId) {
        throw new ConflictError('Provider payment id is required before capture can be recorded');
    }
    const proof=await verifyCanonicalRazorpayCapture(c,payment,providerPaymentId);
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
        const responseBody=await commitCanonicalPaymentCapture(db,{
            proof,actorId:customUser.id,claimId:claim.id,requestHash:claim.requestHash,
            requestId,metadata:body.metadata,
        });

        return c.json(responseBody as never);
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
router.post('/:paymentId/refund', validate('json', PaymentRefundSchema), async (c): Promise<Response> => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as PaymentRefundInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);

    if (!customUser) throw new ForbiddenError('User profile not found');

    const payment = await loadOwnedPaymentSession(c, c.req.param('paymentId'), customUser.id, auth.user.storeId);
    const manualProviderRefundId = body.provider_refund_id || stringOrNull(body.metadata?.provider_refund_id) || null;

    const stepUp = await verifyMerchantStepUp(db, {
        action: 'refund.approve',
        actorId: customUser.id,
        siteId: payment.site_id,
        token: c.req.header('X-Step-Up-Token') || (body.metadata?.step_up_token as string | undefined),
        verifiedAt: c.req.header('X-Step-Up-Verified-At') || (body.metadata?.step_up_verified_at as string | undefined),
        signingSecret: c.env.STEP_UP_SIGNING_SECRET,
    });
    if (!stepUp.ok) {
        return c.json(stepUpErrorBody(stepUp), 428);
    }

    // Existing final receipts remain readable through the live owner/MFA and
    // canonical reservation checks below. Every new provider action or manual
    // reference must instead use the exact original payment connection.
    const {data:existingRefund,error:existingRefundError}=await db.from('payment_attempts')
        .select('status,amount').eq('site_id',payment.site_id).eq('payment_id',payment.id)
        .eq('attempt_type','refund').eq('idempotency_key',body.idempotency_key).is('deleted_at',null).maybeSingle();
    if(existingRefundError)throw new AppError('Refund history is temporarily unavailable.',503,'REFUND_UNAVAILABLE');
    const refundCredentials=payment.provider==='razorpay'&&existingRefund?.status!=='succeeded'
        ?await originalRefundCredentials(c,payment):null;
    let manualRefundStatus:'processed'|'created'|'failed'|null=null;
    if(manualProviderRefundId&&refundCredentials){
        const expected=body.amount_minor??(existingRefund?toInrMinorUnits(existingRefund.amount):payment.amount_minor-(payment.refunded_amount_minor||0));
        manualRefundStatus=await verifyRazorpayRefundProof(refundCredentials,payment,manualProviderRefundId,expected);
    }
    const idempotency = new IdempotencyExecutionAdapter(db);
    // Approval credentials are transient; a fresh valid proof does not change
    // the financial command's identity. Preserve every other metadata field.
    const intentBody = body.metadata && ('step_up_token' in body.metadata || 'step_up_verified_at' in body.metadata)
        ? { ...body, metadata: Object.fromEntries(Object.entries(body.metadata).filter(([key]) => !['step_up_token', 'step_up_verified_at'].includes(key))) }
        : body;
    const claim = await idempotency.begin({ siteId: payment.site_id, key: body.idempotency_key,
        scope: `payment.refund:${payment.id}`, requestBody: intentBody, requestId });
    const { data: reservationData, error: reservationError } = await db.rpc('reserve_owned_payment_refund_v1', {
        p_site_id: payment.site_id, p_step_up: stepUp.metadata, p_payment_id: payment.id,
        p_amount_minor: body.amount_minor ?? null, p_idempotency_key: body.idempotency_key,
        p_request_id: requestId, p_actor_id: customUser.id,
        p_metadata: { ...(body.reason ? { refund_reason: body.reason } : {}),
            ...(manualProviderRefundId ? { provider_refund_id: manualProviderRefundId } : {}),
            _requires_existing_claim: claim.kind === 'replay', ...stepUp.metadata },
    });
    if (reservationError || !reservationData) {
        if (claim.kind === 'claimed') await idempotency.fail(claim.id);
        return c.json({ error: { code: 'REFUND_RESERVATION_FAILED', message: 'Refund could not be safely reserved. Refresh payment status and retry with the same key.' } }, 409);
    }
    const reserved = asRecord(reservationData);
    if (reserved.accepted !== true) {
        if (claim.kind === 'claimed') await idempotency.fail(claim.id);
        const code = typeof reserved.code === 'string' ? reserved.code : 'REFUND_RESERVATION_FAILED';
        throw new AppError('Refund approval, ownership or source changed. Refresh and retry.', Number(reserved.status) || 409, code);
    }
    const reservation = asRecord(reserved.reservation);
    const completed = asRecord(reserved.completed);
    if (completed.payment) {
        const currentPayment = asRecord(completed.payment);
        if (currentPayment.id !== payment.id || currentPayment.site_id !== payment.site_id) throw new AppError('The committed refund needs review.', 409, 'REFUND_REVIEW_REQUIRED');
        const responseBody = { data: { refunded: true, fully_refunded: completed.fully_refunded === true,
            payment: { ...currentPayment, refund_ledger_transaction_id: completed.ledger_transaction_id } } };
        if (claim.kind === 'claimed') await idempotency.complete({ id: claim.id, responseBody: responseBody as unknown as PaymentJsonValue, statusCode: 200, resourceType: 'payment', resourceId: payment.id });
        c.header('X-Idempotent-Replay', 'true');
        return c.json(responseBody);
    }
    const refundAmountMinor = Number(reservation.amount_minor);
    if (!Number.isSafeInteger(refundAmountMinor) || refundAmountMinor <= 0) throw new AppError('The refund reservation needs review.', 409, 'REFUND_REVIEW_REQUIRED');
    const cumulativeRefundMinor = Number(asRecord(reserved.payment).refunded_amount_minor || 0) + refundAmountMinor;
    const fullyRefunded = cumulativeRefundMinor === payment.amount_minor;
    if (claim.kind === 'replay') {
        c.header('X-Idempotent-Replay', 'true');
        if (!['pending', 'processing'].includes(String(reservation.status))) throw new ConflictError('This refund attempt is already final. Refresh payment status.');
        const ref = stringOrNull(reservation.provider_refund_id);
        return c.json({ data: { pending: true, provider_refund_id: ref, refund_amount_minor: refundAmountMinor,
            payment_id: payment.id, reconciliation: ref ? 'provider_webhook_required' : 'operator_attention_required' } }, 202);
    }
    if (!manualProviderRefundId && payment.provider !== 'razorpay') {
        await idempotency.fail(claim.id);
        throw new ConflictError('Provider refund id is required before refund can be recorded for non-Razorpay payments');
    }
    const refundAttemptId = stringOrNull(reservation.attempt_id);
    const attemptStatus = stringOrNull(reservation.status);
    if (!refundAttemptId) {
        await idempotency.fail(claim.id);
        return c.json(dbErrorBody('Refund reservation could not be read'), 500);
    }
    if(payment.credential_id){
        const {data:boundAttempt,error:bindingError}=await db.from('payment_attempts')
            .select('credential_id,credential_mode').eq('site_id',payment.site_id).eq('payment_id',payment.id).eq('id',refundAttemptId).single();
        if(bindingError||boundAttempt?.credential_id!==payment.credential_id||boundAttempt.credential_mode!==payment.mode){
            await idempotency.fail(claim.id);
            throw new AppError('The refund connection history needs review before provider contact.',409,'REFUND_CONNECTION_REVIEW');
        }
    }
    if (reservation.created !== true) {
        const providerRefundId = stringOrNull(reservation.provider_refund_id);
        if (manualProviderRefundId && providerRefundId && providerRefundId !== manualProviderRefundId) {
            await idempotency.fail(claim.id);
            return c.json({ error: { code: 'REFUND_REFERENCE_MISMATCH', message: 'This refund attempt is already bound to a different provider refund reference.' } }, 409);
        }
        if (manualProviderRefundId && ['pending', 'processing', 'succeeded'].includes(attemptStatus || '')) {
            // A previous request may have reserved the confirmed provider refund
            // before a transient database failure. Re-enter the atomic finalizer;
            // it safely replays if the prior transaction actually committed.
        } else {
            if (attemptStatus === 'pending' || attemptStatus === 'processing') {
                const responseBody = {
                    data: {
                        pending: true,
                        provider_refund_id: providerRefundId,
                        refund_amount_minor: refundAmountMinor,
                        payment_id: payment.id,
                        reconciliation: providerRefundId ? 'provider_webhook_required' : 'operator_attention_required',
                    },
                };
                await idempotency.complete({ id: claim.id, responseBody, statusCode: 202, resourceType: 'payment', resourceId: payment.id });
                return c.json(responseBody, 202);
            }
            await idempotency.fail(claim.id);
            return c.json({ error: { code: 'REFUND_ATTEMPT_FINAL', message: 'This idempotency key already belongs to a completed refund attempt.' } }, 409);
        }
    }

    // For Razorpay payments without a manual provider_refund_id, call Razorpay API to create the refund.
    // Non-Razorpay providers must supply provider_refund_id (validated above).
    let providerRefundId: string;
    if (manualProviderRefundId) {
        providerRefundId = manualProviderRefundId;
    } else {
        // payment.provider === 'razorpay' is guaranteed here (non-razorpay without id was rejected above)
        if (!payment.provider_payment_id) {
            await idempotency.fail(claim.id);
            await db.from('payment_attempts').update({ status: 'failed', failure_reason: 'Provider payment reference is missing' }).eq('site_id', payment.site_id).eq('id', refundAttemptId);
            return c.json({ error: { code: 'REFUND_PROVIDER_PAYMENT_ID_MISSING', message: 'Cannot initiate refund: provider payment id is not recorded for this payment.' } }, 409);
        }
        if(!refundCredentials)throw new AppError('The original refund connection is unavailable.',503,'REFUND_CONNECTION_UNAVAILABLE');
        const razorpayProvider = createRazorpayPaymentProvider(refundCredentials);
        const razorpayRefundKey = [
            'payment_refund',
            payment.id,
            body.idempotency_key,
        ].join(':');
        const refundResult = await razorpayProvider.refund({
            paymentId: payment.provider_payment_id,
            storeId: payment.site_id,
            orderId: payment.order_id,
            amount: inrMoney(refundAmountMinor),
            idempotencyKey: razorpayRefundKey,
            metadata: { reason: body.reason || null, internal_payment_ref: payment.id, site_id: payment.site_id },
        });
        if (refundResult.status === 'pending') {
            const providerRefundId = refundResult.references.providerRefundId;
            const { error: attemptError } = await db.from('payment_attempts').update({
                ...(providerRefundId ? { provider_event_id: `refund.created:${providerRefundId}` } : {}),
                request_id: requestId,
                metadata: {
                    ...(body.reason ? { refund_reason: body.reason } : {}),
                    ...stepUp.metadata,
                    ...(providerRefundId ? { provider_refund_id: providerRefundId } : {}),
                    refund_amount_minor: refundAmountMinor,
                },
            }).eq('site_id', payment.site_id).eq('id', refundAttemptId);
            if (attemptError) {
                // Complete the claim even if the attempt write failed: the provider already
                // accepted the refund request, so an HTTP retry must never call it again.
                const responseBody = {
                    data: {
                        pending: true,
                        provider_refund_id: providerRefundId || null,
                        refund_amount_minor: refundAmountMinor,
                        payment_id: payment.id,
                        reconciliation: 'operator_attention_required',
                    },
                };
                await idempotency.complete({
                    id: claim.id,
                    responseBody,
                    statusCode: 202,
                    resourceType: 'payment',
                    resourceId: payment.id,
                });
                return c.json(responseBody, 202);
            }
            const responseBody = {
                data: {
                    pending: true,
                    provider_refund_id: providerRefundId || null,
                    refund_amount_minor: refundAmountMinor,
                    payment_id: payment.id,
                    reconciliation: providerRefundId ? 'provider_webhook_required' : 'operator_attention_required',
                },
            };
            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 202,
                resourceType: 'payment',
                resourceId: payment.id,
            });
            return c.json(responseBody, 202);
        }
        if (refundResult.status !== 'refunded' || !refundResult.references.providerRefundId) {
            await db.from('payment_attempts').update({
                status: 'failed',
                failure_reason: refundResult.failureMessage || 'Provider reported refund failure',
                ...(refundResult.references.providerRefundId ? {
                    provider_event_id: `refund.failed:${refundResult.references.providerRefundId}`,
                    metadata: { provider_refund_id: refundResult.references.providerRefundId, refund_amount_minor: refundAmountMinor },
                } : {}),
            }).eq('site_id', payment.site_id).eq('id', refundAttemptId);
            await idempotency.fail(claim.id);
            return c.json({
                error: {
                    code: refundResult.failureCode || 'RAZORPAY_REFUND_FAILED',
                    message: refundResult.failureMessage || 'Razorpay refund creation failed. No ledger entry was written.',
                },
            }, 502);
        }
        providerRefundId = refundResult.references.providerRefundId;
        const { error: referenceError } = await db.from('payment_attempts').update({
            metadata: {
                ...(body.reason ? { refund_reason: body.reason } : {}),
                ...stepUp.metadata,
                provider_refund_id: providerRefundId,
                refund_amount_minor: refundAmountMinor,
            },
        }).eq('site_id', payment.site_id).eq('id', refundAttemptId);
        if (referenceError) {
            const responseBody = { data: { pending: true, provider_refund_id: providerRefundId, refund_amount_minor: refundAmountMinor, payment_id: payment.id, reconciliation: 'operator_attention_required' } };
            await idempotency.complete({ id: claim.id, responseBody, statusCode: 202, resourceType: 'payment', resourceId: payment.id });
            return c.json(responseBody, 202);
        }
    }

    if (payment.provider === 'razorpay') {
        // Even a provider create returning processed is read back against its
        // original account before granting a financial reversal.
        if(!refundCredentials)throw new AppError('The original refund connection is unavailable.',503,'REFUND_CONNECTION_UNAVAILABLE');
        const verifiedRefundStatus=manualRefundStatus??await verifyRazorpayRefundProof(refundCredentials,payment,providerRefundId,refundAmountMinor);
        if(verifiedRefundStatus!=='processed'){
            const {error:pendingError}=await db.from('payment_attempts').update({
                status:verifiedRefundStatus==='failed'?'failed':'pending',
                metadata:{...(body.reason?{refund_reason:body.reason}:{}),...stepUp.metadata,
                    provider_refund_id:providerRefundId,refund_amount_minor:refundAmountMinor},
            }).eq('site_id',payment.site_id).eq('id',refundAttemptId);
            if(pendingError)throw new AppError('Refund acknowledgement needs review. Retry the same request.',503,'REFUND_UNAVAILABLE');
            if(verifiedRefundStatus==='failed'){
                await idempotency.fail(claim.id);
                throw new AppError('The provider reports this refund failed. No reversal was recorded.',409,'REFUND_PROVIDER_FAILED');
            }
            const responseBody={data:{pending:true,provider_refund_id:providerRefundId,
                refund_amount_minor:refundAmountMinor,payment_id:payment.id,
                reconciliation:'provider_webhook_required'}};
            await idempotency.complete({id:claim.id,responseBody,statusCode:202,resourceType:'payment',resourceId:payment.id});
            return c.json(responseBody,202);
        }
        const providerEventId = `refund.processed:${providerRefundId}`;
        try {
            const { data: reconciliation, error } = await db.rpc('reconcile_payment_refund_attempt', {
                p_payment_id: payment.id,
                p_attempt_id: refundAttemptId,
                p_provider_refund_id: providerRefundId,
                p_provider_event_id: providerEventId,
                p_event_type: 'refund.processed',
                p_status: 'processed',
                p_amount_minor: refundAmountMinor,
                p_currency: payment.currency,
                p_request_id: requestId,
            });
            if (error || !reconciliation) throw new Error(error?.message || 'Refund reconciliation returned no result');

            const result = asRecord(reconciliation);
            const rawTotalRefundedMinor = Number(result.refunded_amount_minor);
            const totalRefundedMinor = Number.isSafeInteger(rawTotalRefundedMinor) ? rawTotalRefundedMinor : cumulativeRefundMinor;
            const fullyRefundedNow = result.fully_refunded === true;
            const ledgerTransactionId = stringOrNull(result.ledger_transaction_id);
            await emitPaymentEvent(db, {
                siteId: payment.site_id,
                paymentId: payment.id,
                orderId: payment.order_id,
                eventType: 'payment.refunded',
                payload: {
                    provider: payment.provider,
                    provider_event_id: providerEventId,
                    provider_refund_id: providerRefundId,
                    payment_status: fullyRefundedNow ? 'refunded' : 'paid',
                    mode: payment.mode,
                    amount_minor: refundAmountMinor,
                    cumulative_refund_amount_minor: totalRefundedMinor,
                    currency: payment.currency,
                    reason: body.reason || null,
                    ledger_transaction_id: ledgerTransactionId,
                },
                actorId: customUser.id,
                requestId,
                idempotencyKey: `payment.refund:${payment.id}:${providerRefundId}`,
            });

            const responseBody = {
                data: {
                    refunded: true,
                    fully_refunded: fullyRefundedNow,
                    payment: {
                        ...payment,
                        status: fullyRefundedNow ? 'refunded' : 'captured',
                        refunded_amount_minor: totalRefundedMinor,
                        refund_ledger_transaction_id: ledgerTransactionId,
                        metadata: payment.metadata as unknown as PaymentJsonValue,
                    },
                },
            };
            await idempotency.complete({ id: claim.id, responseBody: responseBody as PaymentJsonValue, statusCode: 200, resourceType: 'payment', resourceId: payment.id });
            return c.json(responseBody);
        } catch {
            // The provider already confirmed the refund. Freeze this request key and
            // leave the durable pending attempt for the signed webhook to reconcile.
            const responseBody = {
                data: {
                    pending: true,
                    provider_refund_id: providerRefundId,
                    refund_amount_minor: refundAmountMinor,
                    payment_id: payment.id,
                    reconciliation: 'provider_webhook_required',
                },
            };
            await idempotency.complete({ id: claim.id, responseBody, statusCode: 202, resourceType: 'payment', resourceId: payment.id });
            return c.json(responseBody, 202);
        }
    }

    const { data: reconciliation, error: reconciliationError } = await db.rpc('finalize_manual_payment_refund_attempt', {
        p_payment_id: payment.id,
        p_attempt_id: refundAttemptId,
        p_provider_refund_id: providerRefundId,
        p_amount_minor: refundAmountMinor,
        p_currency: payment.currency,
        p_request_id: requestId,
        p_actor_id: customUser.id,
    });
    if (reconciliationError || !reconciliation) {
        // The external provider is already confirmed. Release this HTTP claim so
        // the same key can reclaim the reservation and safely retry the finalizer.
        await idempotency.fail(claim.id);
        return c.json({
            error: {
                code: 'REFUND_RECONCILIATION_PENDING',
                message: 'The provider refund reference is reserved, but local reconciliation is incomplete. Retry this request with the same idempotency key and provider refund reference.',
            },
        }, 503);
    }

    const result = asRecord(reconciliation);
    const totalRefundedMinor = Number(result.refunded_amount_minor);
    const fullyRefundedNow = result.fully_refunded === true;
    const ledgerTransactionId = stringOrNull(result.ledger_transaction_id);
    const responseBody = {
        data: {
            refunded: true,
            fully_refunded: fullyRefundedNow,
            payment: {
                ...payment,
                status: fullyRefundedNow ? 'refunded' : 'captured',
                refunded_amount_minor: Number.isSafeInteger(totalRefundedMinor) ? totalRefundedMinor : cumulativeRefundMinor,
                refunded_at: fullyRefundedNow ? new Date().toISOString() : payment.refunded_at || null,
                refund_ledger_transaction_id: ledgerTransactionId,
                metadata: payment.metadata as unknown as PaymentJsonValue,
            },
        },
    };
    await idempotency.complete({ id: claim.id, responseBody: responseBody as PaymentJsonValue, statusCode: 200, resourceType: 'payment', resourceId: payment.id });
    return c.json(responseBody);
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
        .select('id, plan, status, billing_period, current_period_start, current_period_end, promo_ends_at, amount_paid, currency, products_limit, payment_gateway, created_at, updated_at, external_subscription_id')
        .eq('store_id', store_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    const { count: productCount, error: productError } = await db
        .from('products').select('id', { count: 'exact', head: true })
        .eq('store_id', store_id).is('deleted_at', null);
    if (productError || productCount === null) return c.json(dbErrorBody(), 500);
    const limitKnown = Boolean(subscription && ['active', 'trialing'].includes(subscription.status));
    return c.json({
        data: {
            product_usage: { count: productCount, limit_known: limitKnown, limit: limitKnown ? subscription?.products_limit ?? null : null },
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
        .from('billing_history')
        .select('id, subscription_id, invoice_number, description, amount, currency, tax_amount, total_amount, payment_status, billing_period, period_start, period_end, created_at, subscription_tax_snapshot')
        .eq('store_id', store_id)
        .not('subscription_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: (data || []).map(row => ({ ...publicSubscriptionBillingRecord(row), amount_paid: row.amount, status: row.payment_status })) });
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
        idempotencyKey: c.req.header('X-Idempotency-Key') || '',
        userId: customUser.id,
        storeId: body.store_id,
        siteType: body.site_type,
        planSlug: body.plan_slug,
        billingPeriod: body.billing_period,
        approvedUsageCharges: body.approved_usage_charges,
        couponCode: body.coupon_code,
    });

    return c.json(checkout.body, checkout.status);
});

// POST /payments/subscription/coupon — Validate a subscription coupon (read-only preview)
router.post('/subscription/coupon', validate('json', ValidateSubscriptionCouponSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as ValidateSubscriptionCouponInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const preview = await previewSubscriptionCoupon({
        db,
        storeId: body.store_id,
        siteType: body.site_type,
        planSlug: body.plan_slug,
        billingPeriod: body.billing_period,
        couponCode: body.coupon_code,
    });

    return c.json(preview.body, preview.status);
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
        idempotencyKey: c.req.header('X-Idempotency-Key') || '',
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

    const reference=body.razorpay_subscription_id||body.razorpay_order_id||'';
    const source=await readSubscriptionCheckoutSource(db,{actor:customUser.id,site:body.store_id,reference,
        payment:body.razorpay_payment_id,planSlug:body.plan_slug,period:body.billing_period});
    const proof=await verifyRazorpayPayment(c.env.RAZORPAY_KEY_SECRET,{providerOrderId:reference,
        storedProviderOrderId:source.subscription_checkout_reference,providerPaymentId:body.razorpay_payment_id,
        signature:body.razorpay_signature,referenceKind:body.razorpay_subscription_id?'subscription':'order'});
    if(!proof.ok)return c.json({error:{code:'PAYMENT_SIGNATURE_INVALID',message:'Payment verification failed'}},400);
    const retainedInvoice=source.retained_invoice_evidence;
    const plan=source.plan;let amountPaid=retainedInvoice?.gross_minor??source.amount;
    const nativeInvoice=source.subscription_checkout.mode==='razorpay_subscription'&&!source.legacy_completed
        ?await verifyNativeSubscriptionInvoice({keyId:c.env.RAZORPAY_KEY_ID,keySecret:c.env.RAZORPAY_KEY_SECRET},source,
            {paymentId:body.razorpay_payment_id,subscriptionId:body.razorpay_subscription_id||'',orderId:body.razorpay_order_id}):null;
    if(nativeInvoice)amountPaid=nativeInvoice.gross_minor;
    let captureOk=false,amountOk=false,orderBindingOk=false;
    if(nativeInvoice){
        captureOk=true;amountOk=true;orderBindingOk=true;
    }else if(retainedInvoice){
        captureOk=retainedInvoice.payment_id===body.razorpay_payment_id
            &&retainedInvoice.subscription_reference===body.razorpay_subscription_id&&source.currency==='INR';
        amountOk=retainedInvoice.gross_minor===amountPaid;
        orderBindingOk=!body.razorpay_order_id||retainedInvoice.order_id===body.razorpay_order_id;
    }else{
        const capturedPayment = await fetchRazorpayPayment(
            { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },body.razorpay_payment_id);
        const capturedStatus=(capturedPayment.status||'').toLowerCase();
        captureOk=!capturedPayment.error&&capturedStatus==='captured'&&capturedPayment.id===body.razorpay_payment_id&&capturedPayment.currency===source.currency;
        amountOk=typeof capturedPayment.amount==='number'&&capturedPayment.amount===amountPaid;
        orderBindingOk=!body.razorpay_order_id||capturedPayment.order_id===body.razorpay_order_id;
    }
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
            razorpayOrderId: nativeInvoice?.order_id || body.razorpay_order_id || null,
            razorpayPaymentId: body.razorpay_payment_id,
            taxSource: source,
            ...(nativeInvoice?{verifiedInvoice:nativeInvoice}:{}),
        });
    } catch (error) {
        if(error instanceof AppError)throw error;
        return c.json(dbErrorBody('Failed to create subscription'), 500);
    }

    // Record the coupon redemption now that payment is verified and the plan is active
    // (best-effort + idempotent on the payment id — never blocks activation).
    const savedCoupon=source.subscription_checkout_request?.coupon_code;
    if (typeof savedCoupon==='string'&&savedCoupon) {
        await recordSubscriptionCouponRedemption({
            db,
            storeId: body.store_id,
            userId: customUser.id,
            siteType: body.site_type,
            planSlug: body.plan_slug,
            billingPeriod: body.billing_period,
            couponCode: savedCoupon,
            checkoutSource: source,
            razorpayOrderId: body.razorpay_order_id || null,
            razorpayPaymentId: body.razorpay_payment_id,
        });
    }

    // Founding welcome + price-lock confirmation email (best-effort; the allocation
    // itself already happened atomically inside activateMerchantSubscription).
    const foundingResult = (subscription as { founding?: { allocated?: boolean; founding_number?: number; allocation_source?: string; locked_monthly_price?: number } } | null)?.founding;
    if (foundingResult?.allocated) {
        const email = (customUser as { email?: string }).email;
        if (email) {
            await sendFoundingMerchantWelcomeEmail(c.env, {
                to: email,
                foundingNumber: Number(foundingResult.founding_number || 0),
                allocationSource: String(foundingResult.allocation_source || 'PUBLIC'),
                planName: plan.name,
                lockedMonthlyInr: Math.round(Number(foundingResult.locked_monthly_price || 0) / 100),
            }).catch(() => undefined);
        }
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

    // D-PLATFORM-CHARGE: signature AND fail-closed reference binding now live in ONE verifier, so a
    // platform charge against billing_history is checked by exactly this code with a different
    // stored reference. The behaviour here is unchanged: signature first, then the binding, then the
    // replay guard, then confirm. What was inline is now named; nothing was reordered.
    //
    // The binding is the part worth restating: a valid signature only proves Razorpay signed
    // something. `order.payment_id` is what the server stored when IT created the provider order, so
    // requiring the presented id to equal it is what stops a real payment being applied to an order
    // it was not created for.
    const verification = await verifyRazorpayPayment(c.env.RAZORPAY_KEY_SECRET, {
        providerOrderId: body.razorpay_order_id,
        providerPaymentId: body.razorpay_payment_id,
        signature: body.razorpay_signature,
        storedProviderOrderId: order.payment_id,
    });
    if (!verification.ok) {
        if (verification.reason === 'reference_mismatch') throw new ConflictError('Payment reference mismatch');
        return c.json(
            { error: { code: 'PAYMENT_ERROR', message: 'Invalid payment signature' } },
            400
        );
    }

    await assertProviderPaymentNotReplayed(c, {
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

    // F-PAY4-1: an order that could no longer be fulfilled when this capture landed was recorded once,
    // cancelled and left with a refund owed by migration 252. It is never announced as paid.
    const capture = readCaptureResult(updated);
    if (!capture.fulfillable) {
        return c.json({
            error: {
                code: 'PAYMENT_CAPTURED_ORDER_UNFULFILLABLE',
                message: FIXED_PUBLIC_ERROR_MESSAGES.PAYMENT_CAPTURED_ORDER_UNFULFILLABLE,
            },
        }, 409);
    }

    // Keyed on the provider payment, so this path and the webhook announcing the same payment produce
    // one order.paid event, not two.
    await emitOrderPaidEvent(c.env, db, {
        order: updated,
        fallbackOrder: order,
        actorId: customUser.id,
        requestId: getRequestId(c),
        idempotencyKey: `razorpay:${body.razorpay_payment_id}`,
    });

    return c.json({ data: { verified: true, order: updated } });
});

export default router;
