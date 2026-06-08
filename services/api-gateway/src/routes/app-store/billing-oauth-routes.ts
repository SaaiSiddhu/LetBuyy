import type { Hono } from 'hono';
import type { Env } from '../../index';
import { findFirstOwnedSiteId, resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { readAppSpendSnapshot } from '../../lib/app-spend-controls';
import { isInternalApiSecretRequest } from '../../lib/internal-secret';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import {
    appOAuthClientId,
    buildAppOAuthRedirectUrl,
    buildAppLifecycleEventPayload,
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    normalizeAppInstallScopes,
    normalizeAppOAuthRedirectUri,
    parseAppStoreJsonRecord as parseJsonRecord,
    planAppWebhookSubscriptions,
    type AppEngineJsonRecord,
} from '@letbuyy/app-engine';
import {
    createAppAuthorizationCode,
    sha256Hex,
    timingSafeEqualHex,
    verifyAppAuthorizationCode,
} from '@letbuyy/auth-core';
import {
    ApproveAppBillingChargeSchema,
    CancelAppBillingChargeSchema,
    CreateAppBillingChargeSchema,
    DEFAULT_APP_REVENUE_SHARE_BPS,
    appBillingModeForPricingModel,
    isAppBillingTrialExpired,
    planAppBillingCharge,
    planAppBillingTrialWindow,
} from '@letbuyy/billing-core';
import { AppSpendControlUpdateSchema } from '@letbuyy/shared-types';
import {
    createRazorpayOrder,
    getRazorpayOrderNotes,
    hmacSha256Hex,
    timingSafeEqual,
} from '@letbuyy/infrastructure/razorpay-adapter';
import {
    appendAppOAuthTokenConfig,
    appBillingMode,
    appChargeProviderMode,
    appExtensionRegistryConfig,
    appLifecycleWebhookDefinitions,
    appOAuthConfig,
    appOAuthGrantType,
    appOAuthState,
    appPayoutRail,
    appPlatformTokenSecret,
    dispatchAppLifecycleSubscriptions,
    firstRelatedRecord,
    getRequestId,
    insertAppChargeOutbox,
    insertAppLifecycleOutbox,
    insertAppWebhookSubscriptions,
    mintAppOAuthRefreshToken,
    mintAppOAuthAccessToken,
    normalizeAppOAuthPkceChallenge,
    registerAppExtensionRegistry,
    verifyAppOAuthPkceVerifier,
    type AppBillingChargeRecord,
} from './shared';

const BILLING_PRICING_PLAN_SELECT = 'id, app_id, developer_id, plan_slug, name, description, pricing_model, billing_mode, currency, amount_minor, interval, trial_days, usage_meter, usage_unit, included_usage, usage_unit_amount_minor, features, limits, is_default, status, sort_order';

async function activateExpiredTrialCharge(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        charge: AppEngineJsonRecord;
        actorId?: string | null;
        requestId: string;
    },
): Promise<{ charge: AppEngineJsonRecord; activated: boolean; error?: { code: string; message: string } }> {
    const trialEndsAt = stringOrNull(input.charge.trial_ends_at);
    if (!isAppBillingTrialExpired({ status: stringOrNull(input.charge.status), trialEndsAt })) {
        return { charge: input.charge, activated: false };
    }

    const chargeId = stringOrNull(input.charge.id);
    if (!chargeId) {
        return { charge: input.charge, activated: false, error: { code: 'VALIDATION', message: 'Trial charge id is missing' } };
    }

    const now = new Date().toISOString();
    const billingStartsAt = stringOrNull(input.charge.billing_starts_at) || trialEndsAt || now;
    const metadata = parseJsonRecord(input.charge.metadata);
    const trialMetadata = parseJsonRecord(metadata.trial);
    const { data: activatedCharge, error } = await db
        .from('app_billing_charges')
        .update({
            status: 'active',
            activated_at: stringOrNull(input.charge.activated_at) || now,
            billing_starts_at: billingStartsAt,
            updated_by: input.actorId || null,
            metadata: {
                ...metadata,
                trial: {
                    ...trialMetadata,
                    status: 'completed',
                    completed_at: now,
                    billing_starts_at: billingStartsAt,
                },
            },
        })
        .eq('id', chargeId)
        .eq('status', 'trialing')
        .select()
        .single();

    if (error) {
        return { charge: input.charge, activated: false, error: { code: 'DB_ERROR', message: error.message } };
    }

    await insertAppChargeOutbox(db, {
        charge: activatedCharge as AppBillingChargeRecord,
        eventType: 'app.charge.activated',
        actorId: input.actorId || '',
        requestId: input.requestId,
    });

    return { charge: activatedCharge as AppEngineJsonRecord, activated: true };
}

export function registerAppStoreBillingOAuthRoutes(router: Hono<{ Bindings: Env }>): void {
    // POST /app-store/installations/:id/charges — Create a merchant-approved app charge
    router.post('/installations/:id/charges', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const installationId = c.req.param('id');
        const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        const requestId = getRequestId(c);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: installation, error: installationError } = await db
            .from('app_installations')
            .select('id, app_id, store_id, installed_by, status, config, marketplace_apps(id, developer_id, name, pricing_model, price_inr)')
            .eq('id', installationId)
            .eq('status', 'active')
            .maybeSingle();

        if (installationError) {
            return c.json({ error: { code: 'DB_ERROR', message: installationError.message } }, 500);
        }

        if (!installation) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App installation not found' } }, 404);
        }

        const storeId = stringOrNull(body.store_id || body.storeId) || installation.store_id;
        if (storeId !== installation.store_id) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Charge store_id does not match installation store' } }, 403);
        }

        const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const app = firstRelatedRecord(installation.marketplace_apps);
        const metadata = parseJsonRecord(body.metadata);
        const billingConfig = parseJsonRecord(parseJsonRecord(installation.config).billing);
        const requestedPricingPlanId = stringOrNull(body.pricing_plan_id || body.pricingPlanId || metadata.pricing_plan_id || billingConfig.selected_plan_id);
        let chargeBody: AppEngineJsonRecord = body;

        if (requestedPricingPlanId) {
            const { data: pricingPlan, error: pricingPlanError } = await db
                .from('app_pricing_plans')
                .select(BILLING_PRICING_PLAN_SELECT)
                .eq('id', requestedPricingPlanId)
                .eq('app_id', installation.app_id)
                .eq('status', 'active')
                .is('deleted_at', null)
                .maybeSingle();

            if (pricingPlanError) {
                return c.json({ error: { code: 'DB_ERROR', message: pricingPlanError.message } }, 500);
            }

            if (!pricingPlan) {
                return c.json({ error: { code: 'VALIDATION', message: 'Selected pricing plan is not available for this app' } }, 400);
            }

            const planBillingMode = stringOrNull(pricingPlan.billing_mode) || appBillingModeForPricingModel(pricingPlan.pricing_model);
            const planAmountMinor = Number(pricingPlan.amount_minor || pricingPlan.usage_unit_amount_minor || 0);
            if (!planBillingMode || !Number.isInteger(planAmountMinor) || planAmountMinor <= 0) {
                return c.json({ error: { code: 'VALIDATION', message: 'Selected pricing plan does not require a paid charge' } }, 400);
            }

            chargeBody = {
                ...body,
                billing_mode: planBillingMode,
                name: `${stringOrNull(app.name) || 'App'} ${stringOrNull(pricingPlan.name) || 'plan'}`,
                amount_minor: planAmountMinor,
                metadata: {
                    ...metadata,
                    pricing_plan_id: pricingPlan.id,
                    pricing_plan_slug: pricingPlan.plan_slug,
                    pricing_plan_trial_days: Number(pricingPlan.trial_days || 0),
                    pricing_plan_snapshot: pricingPlan,
                },
                pricing_plan_id: pricingPlan.id,
                trial_days: Number(pricingPlan.trial_days || 0),
            };
        }

        const input = CreateAppBillingChargeSchema.safeParse({
            ...chargeBody,
            store_id: installation.store_id,
            installation_id: installation.id,
            billing_mode: appBillingMode(chargeBody.billing_mode || chargeBody.billingMode),
            currency: 'INR',
        });
        if (!input.success) {
            return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid app charge' } }, 400);
        }

        const partnerId = stringOrNull(app.developer_id);
        if (!partnerId) {
            return c.json({ error: { code: 'VALIDATION', message: 'Installed app does not have a partner account' } }, 400);
        }

        const { data: existingCharge, error: existingError } = await db
            .from('app_billing_charges')
            .select('*')
            .eq('site_id', input.data.store_id)
            .eq('idempotency_key', input.data.idempotency_key)
            .maybeSingle();

        if (existingError) {
            return c.json({ error: { code: 'DB_ERROR', message: existingError.message } }, 500);
        }

        if (existingCharge) {
            const trialActivation = await activateExpiredTrialCharge(db, {
                charge: existingCharge as AppEngineJsonRecord,
                actorId: customUser.id,
                requestId,
            });
            if (trialActivation.error) {
                return c.json({ error: trialActivation.error }, 500);
            }
            const currentCharge = trialActivation.charge;
            return c.json(success({
                charge: currentCharge,
                approval: {
                    required: currentCharge.status === 'pending_merchant_approval',
                    url: currentCharge.approval_url,
                },
                billing: {
                    trial_transitioned: trialActivation.activated,
                },
            }));
        }

        const projectedSpend = input.data.billing_mode === 'usage' ? 0 : input.data.amount_minor;
        const spendSnapshot = await readAppSpendSnapshot(db, {
            siteId: installation.store_id,
            projectedAmountMinor: projectedSpend,
        });
        if (!spendSnapshot.ok) {
            return c.json({ error: { code: 'DB_ERROR', message: spendSnapshot.message } }, 500);
        }
        if (spendSnapshot.value.blocking) {
            return c.json({
                error: {
                    code: 'APP_SPEND_CAP_EXCEEDED',
                    message: 'This charge would exceed the monthly app spend cap for this store',
                    spend: spendSnapshot.value,
                },
            }, 402);
        }

        const chargeId = crypto.randomUUID();
        const providerMode = appChargeProviderMode(body.provider_mode || body.providerMode);
        const plan = planAppBillingCharge({
            appId: installation.app_id,
            installationId: installation.id,
            storeId: installation.store_id,
            partnerId,
            pricingPlanId: input.data.pricing_plan_id,
            billingMode: input.data.billing_mode,
            name: input.data.name,
            amountMinor: input.data.amount_minor,
            trialDays: input.data.trial_days,
            idempotencyKey: input.data.idempotency_key,
            approvalUrl: `/v1/app-store/charges/${chargeId}/approve`,
            metadata: {
                ...input.data.metadata,
                spend_control: {
                    projected_amount_minor: spendSnapshot.value.projected_amount_minor,
                    over_alert_threshold: spendSnapshot.value.over_alert_threshold,
                    over_cap: spendSnapshot.value.over_cap,
                },
            },
            revenueShareBps: Number(body.revenue_share_bps || body.revenueShareBps || DEFAULT_APP_REVENUE_SHARE_BPS),
            partnerGstBps: Number(body.partner_gst_bps || body.partnerGstBps || 1800),
            payoutRail: appPayoutRail(body.payout_rail || body.payoutRail),
            providerMode,
        });

        const { data: charge, error: chargeError } = await db
            .from('app_billing_charges')
            .insert({
                id: chargeId,
                site_id: plan.store_id,
                app_id: plan.app_id,
                partner_id: plan.partner_id,
                installation_id: plan.installation_id,
                pricing_plan_id: plan.pricing_plan_id,
                billing_mode: plan.billing_mode,
                status: plan.status,
                name: plan.name,
                amount_minor: plan.amount_minor,
                currency: plan.currency,
                trial_days: plan.trial_days,
                trial_starts_at: plan.trial_starts_at,
                trial_ends_at: plan.trial_ends_at,
                billing_starts_at: plan.billing_starts_at,
                revenue_share_bps: plan.payout.revenue_share_bps,
                partner_amount_minor: plan.payout.partner_amount_minor,
                platform_fee_minor: plan.payout.platform_fee_minor,
                partner_gst_bps: plan.payout.partner_gst_bps,
                partner_gst_minor: plan.payout.partner_gst_minor,
                payout_rail: plan.payout.payout_rail,
                provider: plan.payout.provider,
                provider_mode: plan.payout.provider_mode,
                approval_url: plan.approval_url,
                idempotency_key: plan.idempotency_key,
                metadata: plan.metadata,
                created_by: customUser.id,
                updated_by: customUser.id,
            })
            .select()
            .single();

        if (chargeError) {
            return c.json({ error: { code: 'DB_ERROR', message: chargeError.message } }, 500);
        }

        await insertAppChargeOutbox(db, {
            charge: charge as AppBillingChargeRecord,
            eventType: 'app.charge.created',
            actorId: customUser.id,
            requestId,
        });

        return c.json(success({
            charge,
            approval: {
                required: true,
                url: plan.approval_url,
            },
            payout_plan: plan.payout,
        }), 201);
    });

    // GET /app-store/stores/:storeId/spend-control — Merchant app spend control
    router.get('/stores/:storeId/spend-control', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const storeId = c.req.param('storeId');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const spendSnapshot = await readAppSpendSnapshot(db, { siteId: storeId });
        if (!spendSnapshot.ok) {
            return c.json({ error: { code: 'DB_ERROR', message: spendSnapshot.message } }, 500);
        }

        return c.json(success({
            control: spendSnapshot.value.control,
            spend: {
                period_start: spendSnapshot.value.period_start,
                period_end: spendSnapshot.value.period_end,
                current_amount_minor: spendSnapshot.value.current_amount_minor,
                projected_amount_minor: spendSnapshot.value.projected_amount_minor,
                over_cap: spendSnapshot.value.over_cap,
                over_alert_threshold: spendSnapshot.value.over_alert_threshold,
            },
        }));
    });

    // PATCH /app-store/stores/:storeId/spend-control — Upsert merchant app spend control
    router.patch('/stores/:storeId/spend-control', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const storeId = c.req.param('storeId');
        const input = AppSpendControlUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
        if (!input.success) {
            return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid spend control' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const { data: existingControl, error: existingControlError } = await db
            .from('app_spend_controls')
            .select('*')
            .eq('site_id', storeId)
            .is('deleted_at', null)
            .maybeSingle();

        if (existingControlError) {
            return c.json({ error: { code: 'DB_ERROR', message: existingControlError.message } }, 500);
        }

        const existingControlRecord = existingControl as Record<string, unknown> | null;
        const { data: control, error } = await db
            .from('app_spend_controls')
            .upsert({
                site_id: storeId,
                monthly_cap_minor: input.data.monthly_cap_minor ?? Number(existingControlRecord?.monthly_cap_minor || 0),
                alert_threshold_minor: input.data.alert_threshold_minor ?? Number(existingControlRecord?.alert_threshold_minor || 0),
                alerts_enabled: input.data.alerts_enabled ?? Boolean(existingControlRecord?.alerts_enabled ?? true),
                enforcement_mode: input.data.enforcement_mode || (typeof existingControlRecord?.enforcement_mode === 'string' ? existingControlRecord.enforcement_mode : 'block'),
                status: input.data.status || (typeof existingControlRecord?.status === 'string' ? existingControlRecord.status : 'active'),
                updated_by: customUser.id,
                created_by: typeof existingControlRecord?.created_by === 'string' ? existingControlRecord.created_by : customUser.id,
            }, { onConflict: 'site_id' })
            .select()
            .single();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        const spendSnapshot = await readAppSpendSnapshot(db, { siteId: storeId });
        if (!spendSnapshot.ok) {
            return c.json({ error: { code: 'DB_ERROR', message: spendSnapshot.message } }, 500);
        }

        return c.json(success({
            control,
            spend: {
                period_start: spendSnapshot.value.period_start,
                period_end: spendSnapshot.value.period_end,
                current_amount_minor: spendSnapshot.value.current_amount_minor,
                projected_amount_minor: spendSnapshot.value.projected_amount_minor,
                over_cap: spendSnapshot.value.over_cap,
                over_alert_threshold: spendSnapshot.value.over_alert_threshold,
            },
        }));
    });

    // POST /app-store/charges/:id/approve — Merchant approval activates an app charge
    router.post('/charges/:id/approve', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const chargeId = c.req.param('id');
        const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        const requestId = getRequestId(c);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: charge, error: chargeLookupError } = await db
            .from('app_billing_charges')
            .select('*')
            .eq('id', chargeId)
            .maybeSingle();

        if (chargeLookupError) {
            return c.json({ error: { code: 'DB_ERROR', message: chargeLookupError.message } }, 500);
        }

        if (!charge) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App charge not found' } }, 404);
        }

        const input = ApproveAppBillingChargeSchema.safeParse({
            ...body,
            charge_id: chargeId,
            store_id: stringOrNull(body.store_id || body.storeId) || charge.site_id,
            provider_mode: appChargeProviderMode(body.provider_mode || body.providerMode),
        });
        if (!input.success) {
            return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid app charge approval' } }, 400);
        }

        if (input.data.store_id !== charge.site_id) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Charge store_id does not match' } }, 403);
        }

        const ownsStore = await verifySiteOwnership(db, charge.site_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        if (charge.status === 'active') {
            return c.json(success({
                charge,
                billing: {
                    activated: false,
                    reason: 'already_active',
                },
            }));
        }

        if (charge.status === 'trialing') {
            const trialActivation = await activateExpiredTrialCharge(db, {
                charge: charge as AppEngineJsonRecord,
                actorId: customUser.id,
                requestId,
            });
            if (trialActivation.error) {
                return c.json({ error: trialActivation.error }, 500);
            }

            return c.json(success({
                charge: trialActivation.charge,
                billing: {
                    activated: trialActivation.activated,
                    trialing: !trialActivation.activated,
                    trial_ends_at: trialActivation.charge.trial_ends_at || null,
                    billing_starts_at: trialActivation.charge.billing_starts_at || null,
                },
                payout: {
                    ledger_event: trialActivation.activated ? 'app.charge.activated' : null,
                    queue: trialActivation.activated ? 'payment-events' : null,
                    rail: trialActivation.charge.payout_rail || charge.payout_rail,
                },
            }), trialActivation.activated ? 200 : 202);
        }

        if (charge.status !== 'pending_merchant_approval' && charge.status !== 'approved') {
            return c.json({ error: { code: 'CONFLICT', message: 'Only pending app charges can be approved' } }, 409);
        }

        const now = new Date().toISOString();
        const metadata = parseJsonRecord(charge.metadata);
        const storedProviderReference = stringOrNull(charge.provider_reference);
        const submittedProviderReference = stringOrNull(input.data.provider_reference);
        const submittedPaymentId = stringOrNull(input.data.provider_payment_id);
        const submittedSignature = stringOrNull(input.data.provider_signature);
        const providerReferenceForProof = submittedProviderReference || storedProviderReference;
        const hasSubmittedProviderProof = Boolean(submittedProviderReference || submittedPaymentId || submittedSignature);
        const hasCompleteProviderProof = Boolean(providerReferenceForProof && submittedPaymentId && submittedSignature);

        if (hasSubmittedProviderProof && !hasCompleteProviderProof) {
            return c.json({
                error: {
                    code: 'APP_BILLING_PROVIDER_PROOF_REQUIRED',
                    message: 'provider_reference, provider_payment_id, and provider_signature are required to activate an app charge',
                },
            }, 400);
        }

        if (hasCompleteProviderProof) {
            if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
                return c.json({
                    error: {
                        code: 'APP_BILLING_PROVIDER_UNCONFIGURED',
                        message: 'Razorpay is not configured for app billing verification',
                    },
                }, 503);
            }

            if (storedProviderReference && submittedProviderReference && submittedProviderReference !== storedProviderReference) {
                return c.json({
                    error: {
                        code: 'APP_BILLING_PROVIDER_REFERENCE_MISMATCH',
                        message: 'Provider reference does not match the approved app charge',
                    },
                }, 409);
            }

            const providerReference = providerReferenceForProof as string;
            const expectedSignature = await hmacSha256Hex(
                c.env.RAZORPAY_KEY_SECRET,
                `${providerReference}|${submittedPaymentId}`,
            );

            if (!timingSafeEqual(expectedSignature, submittedSignature as string)) {
                return c.json({
                    error: {
                        code: 'APP_BILLING_PROVIDER_SIGNATURE_INVALID',
                        message: 'App billing provider verification failed',
                    },
                }, 400);
            }

            const providerNotes = await getRazorpayOrderNotes(
                { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
                providerReference,
            );
            if (stringOrNull(providerNotes.charge_id) !== chargeId) {
                return c.json({
                    error: {
                        code: 'APP_BILLING_PROVIDER_REFERENCE_MISMATCH',
                        message: 'Provider order is not linked to this app charge',
                    },
                }, 409);
            }

            const trialWindow = planAppBillingTrialWindow({ trialDays: charge.trial_days, nowMs: Date.parse(now) });
            const { data: activatedCharge, error: updateError } = await db
                .from('app_billing_charges')
                .update({
                    status: trialWindow.status,
                    approved_by: customUser.id,
                    approved_at: charge.approved_at || now,
                    activated_at: trialWindow.activated_at,
                    trial_days: trialWindow.trial_days,
                    trial_starts_at: trialWindow.trial_starts_at,
                    trial_ends_at: trialWindow.trial_ends_at,
                    billing_starts_at: trialWindow.billing_starts_at,
                    provider_reference: providerReference,
                    provider_mode: input.data.provider_mode,
                    updated_by: customUser.id,
                    metadata: {
                        ...metadata,
                        approval: {
                            idempotency_key: input.data.idempotency_key,
                            provider_reference: providerReference,
                            provider_payment_id: submittedPaymentId,
                            provider_mode: input.data.provider_mode,
                            provider_status: 'verified',
                            approved_at: charge.approved_at || now,
                            activated_at: trialWindow.activated_at,
                        },
                        trial: {
                            days: trialWindow.trial_days,
                            status: trialWindow.status === 'trialing' ? 'started' : 'not_applicable',
                            starts_at: trialWindow.trial_starts_at,
                            ends_at: trialWindow.trial_ends_at,
                            billing_starts_at: trialWindow.billing_starts_at,
                        },
                    },
                })
                .eq('id', chargeId)
                .select()
                .single();

            if (updateError) {
                return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
            }

            if (trialWindow.activation_event_type) {
                await insertAppChargeOutbox(db, {
                    charge: activatedCharge as AppBillingChargeRecord,
                    eventType: trialWindow.activation_event_type,
                    actorId: customUser.id,
                    requestId,
                });
            }

            return c.json(success({
                charge: activatedCharge,
                billing: {
                    activated: trialWindow.status === 'active',
                    trialing: trialWindow.status === 'trialing',
                    trial_ends_at: trialWindow.trial_ends_at,
                    billing_starts_at: trialWindow.billing_starts_at,
                    provider: 'razorpay',
                    provider_reference: providerReference,
                    provider_payment_id: submittedPaymentId,
                    provider_mode: input.data.provider_mode,
                },
                payout: {
                    ledger_event: trialWindow.activation_event_type,
                    queue: trialWindow.activation_event_type ? 'payment-events' : null,
                    rail: activatedCharge.payout_rail,
                },
            }), trialWindow.status === 'trialing' ? 202 : 200);
        }

        if (storedProviderReference) {
            return c.json(success({
                charge,
                billing: {
                    activated: false,
                    payment_required: true,
                    provider: 'razorpay',
                    provider_reference: storedProviderReference,
                    razorpay_order_id: storedProviderReference,
                    amount: Number(charge.amount_minor || 0),
                    currency: charge.currency || 'INR',
                    key_id: c.env.RAZORPAY_KEY_ID || null,
                    provider_mode: charge.provider_mode || input.data.provider_mode,
                },
                payout: {
                    ledger_event: null,
                    queue: null,
                    rail: charge.payout_rail,
                },
            }), 202);
        }

        if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
            const trialWindow = planAppBillingTrialWindow({ trialDays: charge.trial_days, nowMs: Date.parse(now) });
            const startsSandboxTrial = input.data.provider_mode === 'test' && trialWindow.status === 'trialing';
            const { data: approvedCharge, error: approvalError } = await db
                .from('app_billing_charges')
                .update({
                    status: startsSandboxTrial ? 'trialing' : 'approved',
                    approved_by: customUser.id,
                    approved_at: charge.approved_at || now,
                    trial_days: startsSandboxTrial ? trialWindow.trial_days : Number(charge.trial_days || 0),
                    trial_starts_at: startsSandboxTrial ? trialWindow.trial_starts_at : charge.trial_starts_at,
                    trial_ends_at: startsSandboxTrial ? trialWindow.trial_ends_at : charge.trial_ends_at,
                    billing_starts_at: startsSandboxTrial ? trialWindow.billing_starts_at : charge.billing_starts_at,
                    provider_mode: input.data.provider_mode,
                    updated_by: customUser.id,
                    metadata: {
                        ...metadata,
                        approval: {
                            idempotency_key: input.data.idempotency_key,
                            provider_mode: input.data.provider_mode,
                            provider_status: startsSandboxTrial ? 'trial_started_sandbox' : 'unconfigured',
                            approved_at: charge.approved_at || now,
                        },
                        ...(startsSandboxTrial ? {
                            trial: {
                                days: trialWindow.trial_days,
                                status: 'started',
                                starts_at: trialWindow.trial_starts_at,
                                ends_at: trialWindow.trial_ends_at,
                                billing_starts_at: trialWindow.billing_starts_at,
                            },
                        } : {}),
                    },
                })
                .eq('id', chargeId)
                .select()
                .single();

            if (approvalError) {
                return c.json({ error: { code: 'DB_ERROR', message: approvalError.message } }, 500);
            }

            return c.json(success({
                charge: approvedCharge,
                billing: {
                    activated: false,
                    trialing: startsSandboxTrial,
                    trial_ends_at: startsSandboxTrial ? trialWindow.trial_ends_at : null,
                    billing_starts_at: startsSandboxTrial ? trialWindow.billing_starts_at : null,
                    reason: startsSandboxTrial ? 'sandbox_trial_started' : 'app_billing_provider_unconfigured',
                    required_action: startsSandboxTrial ? 'settle_trial_after_billing_start' : 'configure_razorpay_test_or_live_keys',
                    provider_mode: input.data.provider_mode,
                },
                payout: {
                    ledger_event: null,
                    queue: null,
                    rail: approvedCharge.payout_rail,
                },
            }), 202);
        }

        const providerOrder = await createRazorpayOrder(
            { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
            {
                amount: Number(charge.amount_minor || 0),
                currency: charge.currency || 'INR',
                receipt: `appchg_${chargeId.replace(/-/g, '').slice(0, 24)}`,
                notes: {
                    charge_id: chargeId,
                    app_id: charge.app_id,
                    installation_id: charge.installation_id,
                    site_id: charge.site_id,
                    pricing_plan_id: stringOrNull(charge.pricing_plan_id) || '',
                    billing_mode: charge.billing_mode,
                    trial_days: String(Number(charge.trial_days || 0)),
                    idempotency_key: input.data.idempotency_key,
                    request_id: requestId,
                },
            },
        );

        if (!providerOrder.id) {
            return c.json({
                error: {
                    code: 'APP_BILLING_PROVIDER_ERROR',
                    message: providerOrder.error?.description || 'Failed to create app billing payment order',
                },
            }, 502);
        }

        const { data: approvedCharge, error: approvalError } = await db
            .from('app_billing_charges')
            .update({
                status: 'approved',
                approved_by: customUser.id,
                approved_at: charge.approved_at || now,
                provider_reference: providerOrder.id,
                provider_mode: input.data.provider_mode,
                updated_by: customUser.id,
                metadata: {
                    ...metadata,
                    approval: {
                        idempotency_key: input.data.idempotency_key,
                        provider_reference: providerOrder.id,
                        provider_mode: input.data.provider_mode,
                        provider_status: 'payment_required',
                        approved_at: charge.approved_at || now,
                    },
                },
            })
            .eq('id', chargeId)
            .select()
            .single();

        if (approvalError) {
            return c.json({ error: { code: 'DB_ERROR', message: approvalError.message } }, 500);
        }

        return c.json(success({
            charge: approvedCharge,
            billing: {
                activated: false,
                payment_required: true,
                provider: 'razorpay',
                provider_reference: providerOrder.id,
                razorpay_order_id: providerOrder.id,
                amount: providerOrder.amount ?? Number(charge.amount_minor || 0),
                currency: providerOrder.currency || charge.currency || 'INR',
                key_id: c.env.RAZORPAY_KEY_ID,
                provider_mode: input.data.provider_mode,
            },
            payout: {
                ledger_event: null,
                queue: null,
                rail: approvedCharge.payout_rail,
            },
        }), 202);
    });

    // POST /app-store/charges/:id/cancel — Merchant declines a pending app charge
    router.post('/charges/:id/cancel', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const chargeId = c.req.param('id');
        const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: charge, error: chargeLookupError } = await db
            .from('app_billing_charges')
            .select('*')
            .eq('id', chargeId)
            .maybeSingle();

        if (chargeLookupError) {
            return c.json({ error: { code: 'DB_ERROR', message: chargeLookupError.message } }, 500);
        }

        if (!charge) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App charge not found' } }, 404);
        }

        const input = CancelAppBillingChargeSchema.safeParse({
            ...body,
            charge_id: chargeId,
            store_id: stringOrNull(body.store_id || body.storeId) || charge.site_id,
        });
        if (!input.success) {
            return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid app charge cancellation' } }, 400);
        }

        if (input.data.store_id !== charge.site_id) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Charge store_id does not match' } }, 403);
        }

        const ownsStore = await verifySiteOwnership(db, charge.site_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        if (charge.status === 'cancelled') {
            return c.json(success({
                charge,
                billing: {
                    declined: true,
                    reason: 'already_cancelled',
                },
            }));
        }

        if (charge.status === 'active' || charge.status === 'trialing') {
            return c.json({ error: { code: 'CONFLICT', message: 'Active app charges cannot be declined' } }, 409);
        }

        if (charge.status !== 'pending_merchant_approval' && charge.status !== 'approved') {
            return c.json({ error: { code: 'CONFLICT', message: 'Only pending app charges can be declined' } }, 409);
        }

        const now = new Date().toISOString();
        const metadata = parseJsonRecord(charge.metadata);
        const { data: cancelledCharge, error: cancelError } = await db
            .from('app_billing_charges')
            .update({
                status: 'cancelled',
                updated_by: customUser.id,
                metadata: {
                    ...metadata,
                    cancellation: {
                        idempotency_key: input.data.idempotency_key,
                        reason: input.data.reason || null,
                        cancelled_by: customUser.id,
                        cancelled_at: now,
                    },
                },
            })
            .eq('id', chargeId)
            .select()
            .single();

        if (cancelError) {
            return c.json({ error: { code: 'DB_ERROR', message: cancelError.message } }, 500);
        }

        return c.json(success({
            charge: cancelledCharge,
            billing: {
                declined: true,
                reason: input.data.reason || null,
            },
            payout: {
                ledger_event: null,
                queue: null,
                rail: cancelledCharge.payout_rail,
            },
        }));
    });

    // POST /app-store/charges/trials/activate-expired — Internal maintenance hook for completed trials
    router.post('/charges/trials/activate-expired', async (c) => {
        if (!isInternalApiSecretRequest(c.env, c.req)) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
        }

        const requestId = getRequestId(c);
        const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
        const rawLimit = Number(body.limit || 50);
        const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.round(rawLimit))) : 50;
        const now = new Date().toISOString();
        const db = getSupabaseAdmin(c);
        const { data: dueCharges, error } = await db
            .from('app_billing_charges')
            .select('*')
            .eq('status', 'trialing')
            .lte('trial_ends_at', now)
            .is('deleted_at', null)
            .order('trial_ends_at', { ascending: true })
            .limit(limit);

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        const activated: AppEngineJsonRecord[] = [];
        const errors: Array<{ charge_id: string | null; message: string }> = [];
        for (const charge of dueCharges || []) {
            const result = await activateExpiredTrialCharge(db, {
                charge: charge as AppEngineJsonRecord,
                requestId,
            });
            if (result.error) {
                errors.push({
                    charge_id: stringOrNull((charge as AppEngineJsonRecord).id),
                    message: result.error.message,
                });
            } else if (result.activated) {
                activated.push(result.charge);
            }
        }

        return c.json(success({
            activated_count: activated.length,
            error_count: errors.length,
            charges: activated,
            errors,
        }));
    });

    // POST /app-store/apps/:id/oauth/authorize — Install/authorize an app and issue a short-lived code
    router.post('/apps/:id/oauth/authorize', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const appId = c.req.param('id');
        const body = await c.req.json() as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        const requestId = getRequestId(c);
        const now = new Date();
        const nowSeconds = Math.floor(now.getTime() / 1000);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const storeId = stringOrNull(body.store_id) || await findFirstOwnedSiteId(db, customUser.id);
        if (!storeId) {
            return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
        }

        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const { data: app } = await db
            .from('marketplace_apps')
            .select('id, name, oauth_client_id, oauth_redirect_uris, api_scopes, app_webhooks(id, event, url, secret, is_active)')
            .eq('id', appId)
            .eq('status', 'published')
            .single();

        if (!app) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App not found or not available' } }, 404);
        }

        const scopes = normalizeAppInstallScopes(body.scopes, app.api_scopes || []);
        if (!scopes.ok) {
            return c.json({ error: { code: 'VALIDATION', message: scopes.message } }, 400);
        }

        const redirect = normalizeAppOAuthRedirectUri(body.redirect_uri || body.redirectUri, app.oauth_redirect_uris);
        if (!redirect.ok) {
            return c.json({ error: { code: 'VALIDATION', message: redirect.message } }, 400);
        }

        const pkce = normalizeAppOAuthPkceChallenge(
            body.code_challenge || body.codeChallenge,
            body.code_challenge_method || body.codeChallengeMethod,
        );
        if (!pkce.ok) {
            return c.json({ error: { code: 'VALIDATION', message: pkce.message } }, 400);
        }

        const appSecret = appPlatformTokenSecret(c.env);
        if (!appSecret) {
            return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App OAuth token secret is not configured' } }, 500);
        }

        const { data: installation, error } = await db
            .from('app_installations')
            .upsert(
                {
                    app_id: app.id,
                    store_id: storeId,
                    installed_by: customUser.id,
                    status: 'active',
                    scopes_granted: scopes.value,
                    config: parseJsonRecord(body.config),
                    installed_at: now.toISOString(),
                    uninstalled_at: null,
                },
                { onConflict: 'app_id,store_id' }
            )
            .select()
            .single();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        const state = appOAuthState(body.state);
        const clientId = appOAuthClientId(app);
        const authorizationCodeId = `app_oauth_code:${installation.id}:${crypto.randomUUID()}`;
        const authorizationCode = await createAppAuthorizationCode({
            appId: app.id,
            clientId,
            installationId: installation.id,
            storeId,
            installedBy: customUser.id,
            scopes: scopes.value,
            redirectUri: redirect.value,
            state,
        }, appSecret, { nowSeconds, tokenId: authorizationCodeId });
        const authorizationCodeHash = await sha256Hex(authorizationCode);
        const authorizationExpiresAt = new Date((nowSeconds + 15 * 60) * 1000).toISOString();
        const webhookDefinitions = appLifecycleWebhookDefinitions(app.app_webhooks, body);
        const defaultSigningSecret = crypto.randomUUID();
        const webhookSubscriptions = planAppWebhookSubscriptions({
            app,
            storeId,
            installationId: installation.id,
            installedBy: customUser.id,
            webhookDefinitions,
            defaultSigningSecret,
        });
        const insertedSubscriptions = await insertAppWebhookSubscriptions(db, webhookSubscriptions);
        const durableWebhookSubscriptions = webhookSubscriptions.map((subscription, index) => ({
            ...subscription,
            id: insertedSubscriptions[index]?.id,
        }));
        const registry = await registerAppExtensionRegistry(db, {
            body,
            appId: app.id,
            storeId,
            installationId: installation.id,
            installedBy: customUser.id,
            registeredAt: now.toISOString(),
        });

        if (!registry.ok) {
            return c.json({ error: { code: registry.code, message: registry.message } }, registry.status);
        }

        const registryConfig = appExtensionRegistryConfig(registry.value, now.toISOString());
        const finalConfig = {
            ...parseJsonRecord(body.config),
            oauth: {
                authorization_code: {
                    code_hash: authorizationCodeHash,
                    client_id: clientId,
                    redirect_uri: redirect.value,
                    code_challenge: pkce.value.codeChallenge,
                    code_challenge_method: pkce.value.codeChallengeMethod,
                    scopes: scopes.value,
                    state,
                    issued_at: now.toISOString(),
                    expires_at: authorizationExpiresAt,
                    redeemed_at: null,
                },
            },
            webhooks: {
                subscription_ids: insertedSubscriptions.map((subscription) => subscription.id),
            },
            ...(registryConfig ? { extension_registry: registryConfig } : {}),
        };
        const { data: finalInstallation, error: updateError } = await db
            .from('app_installations')
            .update({ config: finalConfig })
            .eq('id', installation.id)
            .select()
            .single();

        if (updateError) {
            return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
        }

        const lifecyclePayload = buildAppLifecycleEventPayload({
            app,
            installationId: installation.id,
            storeId,
            installedBy: customUser.id,
            scopes: scopes.value,
            occurredAt: now.toISOString(),
        });
        await insertAppLifecycleOutbox(db, {
            storeId,
            installationId: installation.id,
            eventType: 'app.installed',
            payload: lifecyclePayload,
            actorId: customUser.id,
            requestId,
        });

        await dispatchAppLifecycleSubscriptions(c.env, {
            db,
            eventType: 'app.installed',
            installationId: installation.id,
            siteId: storeId,
            actorId: customUser.id,
            payload: lifecyclePayload,
            requestId,
            subscriptions: durableWebhookSubscriptions,
        });

        return c.json(success({
            installation: finalInstallation || installation,
            authorization: {
                code: authorizationCode,
                redirect_uri: redirect.value,
                redirect_to: buildAppOAuthRedirectUrl(redirect.value, { code: authorizationCode, state }),
                state,
                scopes: scopes.value,
                expires_at: authorizationExpiresAt,
                installation_id: installation.id,
                app_id: app.id,
                store_id: storeId,
            },
            extension_registry: registry.value,
        }), 201);
    });

    // POST /app-store/oauth/token — Exchange an app authorization code for a scoped token
    router.post('/oauth/token', async (c) => {
        const body = await c.req.json() as AppEngineJsonRecord;
        const grantType = appOAuthGrantType(body.grant_type || body.grantType);
        if (!grantType) {
            return c.json({ error: { code: 'VALIDATION', message: 'grant_type must be authorization_code or refresh_token' } }, 400);
        }

        const appSecret = appPlatformTokenSecret(c.env);
        if (!appSecret) {
            return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App OAuth token secret is not configured' } }, 500);
        }

        if (grantType === 'refresh_token') {
            const refreshToken = stringOrNull(body.refresh_token || body.refreshToken);
            const clientId = stringOrNull(body.client_id || body.clientId);
            if (!refreshToken || !clientId) {
                return c.json({ error: { code: 'VALIDATION', message: 'refresh_token and client_id are required' } }, 400);
            }

            const refreshTokenHash = await sha256Hex(refreshToken);
            const db = getSupabaseAdmin(c);
            const { data: installation, error } = await db
                .from('app_installations')
                .select('id, app_id, store_id, installed_by, status, scopes_granted, config, marketplace_apps(id, name, oauth_client_id)')
                .eq('status', 'active')
                .contains('config', { oauth: { refresh_token_hash: refreshTokenHash } })
                .maybeSingle();

            if (error) {
                return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
            }

            if (!installation) {
                return c.json({ error: { code: 'INVALID_GRANT', message: 'Refresh token is invalid or revoked' } }, 400);
            }

            const app = firstRelatedRecord(installation.marketplace_apps);
            const expectedClientId = appOAuthClientId({
                id: stringOrNull(app.id) || installation.app_id,
                name: stringOrNull(app.name) || 'Installed app',
                oauth_client_id: stringOrNull(app.oauth_client_id),
            });
            if (expectedClientId !== clientId) {
                return c.json({ error: { code: 'INVALID_GRANT', message: 'Refresh token client mismatch' } }, 400);
            }

            const now = new Date();
            const oauth = appOAuthConfig(installation.config);
            const refreshExpiresAt = stringOrNull(oauth.refresh_token_expires_at);
            if (!refreshExpiresAt || Date.parse(refreshExpiresAt) <= now.getTime()) {
                return c.json({ error: { code: 'INVALID_GRANT', message: 'Refresh token is expired' } }, 400);
            }

            const previouslyGrantedScopes = stringArray(oauth.scopes).length > 0
                ? stringArray(oauth.scopes)
                : stringArray(installation.scopes_granted);
            const scopes = Array.isArray(body.scopes)
                ? normalizeAppInstallScopes(body.scopes, previouslyGrantedScopes)
                : { ok: true as const, value: previouslyGrantedScopes };
            if (!scopes.ok) {
                return c.json({ error: { code: 'VALIDATION', message: scopes.message } }, 400);
            }

            const minted = await mintAppOAuthAccessToken({
                appId: installation.app_id,
                installationId: installation.id,
                storeId: installation.store_id,
                installedBy: installation.installed_by,
                scopes: scopes.value,
                secret: appSecret,
                now,
            });
            const refreshed = await mintAppOAuthRefreshToken({ now });
            const finalConfig = appendAppOAuthTokenConfig({
                existingConfig: installation.config,
                accessTokenHash: minted.hash,
                refreshTokenHash: refreshed.hash,
                scopes: scopes.value,
                issuedAt: now.toISOString(),
                expiresAt: minted.response.expires_at,
                refreshExpiresAt: refreshed.expiresAt,
            });
            const { error: updateError } = await db
                .from('app_installations')
                .update({ config: finalConfig })
                .eq('id', installation.id);

            if (updateError) {
                return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
            }

            return c.json(success({
                ...minted.response,
                refresh_token: refreshed.token,
                refresh_expires_at: refreshed.expiresAt,
            }));
        }

        const code = stringOrNull(body.code);
        const clientId = stringOrNull(body.client_id || body.clientId);
        const redirectUri = stringOrNull(body.redirect_uri || body.redirectUri);
        const codeVerifier = stringOrNull(body.code_verifier || body.codeVerifier);
        if (!code || !clientId || !redirectUri || !codeVerifier) {
            return c.json({ error: { code: 'VALIDATION', message: 'code, client_id, redirect_uri, and code_verifier are required' } }, 400);
        }

        const verification = await verifyAppAuthorizationCode(code, appSecret);
        if (!verification.accepted || !verification.payload) {
            return c.json({ error: { code: 'INVALID_GRANT', message: verification.reason || 'Authorization code is invalid' } }, 400);
        }

        if (verification.payload.clientId !== clientId || verification.payload.redirectUri !== redirectUri) {
            return c.json({ error: { code: 'INVALID_GRANT', message: 'Authorization code client or redirect_uri mismatch' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data: installation, error } = await db
            .from('app_installations')
            .select('id, app_id, store_id, installed_by, status, scopes_granted, config')
            .eq('id', verification.payload.installationId)
            .eq('app_id', verification.payload.appId)
            .eq('store_id', verification.payload.storeId)
            .eq('status', 'active')
            .maybeSingle();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        if (!installation) {
            return c.json({ error: { code: 'INVALID_GRANT', message: 'App installation is not active' } }, 400);
        }

        const oauth = appOAuthConfig(installation.config);
        const authorizationCodeConfig = parseJsonRecord(oauth.authorization_code);
        const expectedCodeHash = stringOrNull(authorizationCodeConfig.code_hash);
        const codeHash = await sha256Hex(code);
        if (
            !expectedCodeHash ||
            !timingSafeEqualHex(expectedCodeHash, codeHash) ||
            stringOrNull(authorizationCodeConfig.redeemed_at)
        ) {
            return c.json({ error: { code: 'INVALID_GRANT', message: 'Authorization code has already been redeemed or is not recognized' } }, 400);
        }

        const pkceAccepted = await verifyAppOAuthPkceVerifier(
            codeVerifier,
            authorizationCodeConfig.code_challenge,
            authorizationCodeConfig.code_challenge_method,
        );
        if (!pkceAccepted) {
            return c.json({ error: { code: 'INVALID_GRANT', message: 'Authorization code verifier mismatch' } }, 400);
        }

        const now = new Date();
        const minted = await mintAppOAuthAccessToken({
            appId: verification.payload.appId,
            installationId: verification.payload.installationId,
            storeId: verification.payload.storeId,
            installedBy: verification.payload.installedBy,
            scopes: verification.payload.scopes,
            secret: appSecret,
            now,
        });
        const refreshed = await mintAppOAuthRefreshToken({ now });
        const finalConfig = appendAppOAuthTokenConfig({
            existingConfig: installation.config,
            accessTokenHash: minted.hash,
            refreshTokenHash: refreshed.hash,
            scopes: verification.payload.scopes,
            issuedAt: now.toISOString(),
            expiresAt: minted.response.expires_at,
            refreshExpiresAt: refreshed.expiresAt,
            authorizationCode: {
                ...authorizationCodeConfig,
                redeemed_at: now.toISOString(),
            },
        });
        const { error: updateError } = await db
            .from('app_installations')
            .update({ config: finalConfig })
            .eq('id', installation.id);

        if (updateError) {
            return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
        }

        return c.json(success({
            ...minted.response,
            refresh_token: refreshed.token,
            refresh_expires_at: refreshed.expiresAt,
        }));
    });

    // POST /app-store/oauth/token-exchange — Exchange a merchant session for an embedded app token
    router.post('/oauth/token-exchange', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const body = await c.req.json() as AppEngineJsonRecord;
        const installationId = stringOrNull(body.installation_id || body.installationId);
        const storeId = stringOrNull(body.store_id || body.storeId);
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        if (!installationId) {
            return c.json({ error: { code: 'VALIDATION', message: 'installation_id is required' } }, 400);
        }

        const { data: installation, error } = await db
            .from('app_installations')
            .select('id, app_id, store_id, installed_by, status, scopes_granted, config')
            .eq('id', installationId)
            .eq('status', 'active')
            .maybeSingle();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        if (!installation || (storeId && installation.store_id !== storeId)) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App installation not found' } }, 404);
        }

        const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const scopes = normalizeAppInstallScopes(body.scopes, installation.scopes_granted || []);
        if (!scopes.ok) {
            return c.json({ error: { code: 'VALIDATION', message: scopes.message } }, 400);
        }

        const appSecret = appPlatformTokenSecret(c.env);
        if (!appSecret) {
            return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App OAuth token secret is not configured' } }, 500);
        }

        const now = new Date();
        const minted = await mintAppOAuthAccessToken({
            appId: installation.app_id,
            installationId: installation.id,
            storeId: installation.store_id,
            installedBy: customUser.id,
            scopes: scopes.value,
            secret: appSecret,
            now,
            ttlSeconds: 15 * 60,
        });
        const finalConfig = appendAppOAuthTokenConfig({
            existingConfig: installation.config,
            accessTokenHash: minted.hash,
            scopes: scopes.value,
            issuedAt: now.toISOString(),
            expiresAt: minted.response.expires_at,
        });
        const { error: updateError } = await db
            .from('app_installations')
            .update({ config: finalConfig })
            .eq('id', installation.id);

        if (updateError) {
            return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
        }

        return c.json(success(minted.response));
    });
}
