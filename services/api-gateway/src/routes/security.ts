import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveCustomUser } from '../lib/auth-user';
import { KmsHumanRequiredError, decryptTextAesGcm, encryptTextAesGcm, encryptFieldWithKms, resolveKmsProviderFromEnv, sha256Hex } from '../lib/crypto';
import { createManualDataSubjectRequest, updateDataSubjectRequest } from '../lib/internal-compliance';
import { signSensitiveActionStepUp, stepUpErrorBody, verifySensitiveActionStepUp } from '../lib/security-controls';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { verifyTotpCode } from '../lib/totp';
import { validate } from '../middleware/validation';
import { AppError } from '../lib/errors';

const router = new Hono<{ Bindings: Env }>();
router.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });

const DsrSchema = z.object({
    store_id: z.string().uuid(),
    email: z.string().email(),
    idempotency_key: z.string().min(8).max(200),
    reason: z.string().trim().min(8).max(1000),
});

const StepUpChallengeSchema = z.object({
    store_id: z.string().uuid(),
    action: z.enum(['refund.approve', 'payout.release', 'customer.dsr.export', 'customer.dsr.erase']),
    idempotency_key: z.string().min(8).max(200),
    factor_id: z.string().uuid(),
    code: z.string().min(6).max(12),
});

type DsrInput = z.infer<typeof DsrSchema>;
type StepUpChallengeInput = z.infer<typeof StepUpChallengeSchema>;
type JsonRecord = Record<string, unknown>;

interface StepUpFactorRow extends JsonRecord {
    id: string;
    custom_user_id: string;
    factor_type: 'totp' | 'passkey';
    status: 'pending' | 'active' | 'disabled';
    secret_ciphertext: string;
}

function lowerEmail(value: string): string {
    return value.trim().toLowerCase();
}

function configuredSecret(value: string | undefined): string | null {
    if (!value || value.startsWith('SKIP_NEEDS_HUMAN_') || value.includes('replace-with')) return null;
    return value;
}

async function loadActiveStepUpFactor(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        customUserId: string;
        factorId: string;
    },
): Promise<StepUpFactorRow | null> {
    const { data, error } = await db
        .from('merchant_2fa_factors')
        .select('id, custom_user_id, factor_type, status, secret_ciphertext')
        .eq('id', input.factorId)
        .eq('custom_user_id', input.customUserId)
        .eq('factor_type', 'totp')
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw new Error(`Step-up factor lookup failed: ${error.message}`);
    return (data as unknown as StepUpFactorRow | null) || null;
}

async function emitCustomerDsrEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        requestId: string;
        subjectEmail: string;
        requestType: 'access' | 'erasure';
        idempotencyKey: string;
        actorId?: string | null;
        traceId?: string | null;
    },
) {
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'customer',
        aggregateId: input.requestId,
        eventType: 'customer.dsr_requested',
        idempotencyKey: input.idempotencyKey,
        actorId: input.actorId || null,
        requestId: input.traceId || null,
        payload: {
            site_id: input.siteId,
            customer_id: input.requestId,
            customer_email_hash: await sha256Hex(input.subjectEmail),
            request_type: input.requestType,
        },
    });
}

async function loadCustomerDsrPayload(db: ReturnType<typeof getSupabaseAdmin>, siteId: string, email: string): Promise<JsonRecord> {
    const [customer, orders, addresses, credentials] = await Promise.all([
        db.from('store_customers').select('*').eq('store_id', siteId).eq('email', email).maybeSingle(),
        db.from('orders').select('*').eq('store_id', siteId).eq('customer_email', email).order('created_at', { ascending: false }).limit(250),
        db.from('customer_addresses').select('*').eq('store_id', siteId).eq('customer_email', email).order('created_at', { ascending: false }).limit(100),
        db.from('customer_credentials').select('id,email_or_phone,last_login_at,login_count,created_at,updated_at').eq('store_id', siteId).eq('email_or_phone', email).maybeSingle(),
    ]);

    if (customer.error || orders.error || addresses.error || credentials.error) {
        throw new Error('Unable to build customer DSR export');
    }

    return {
        generated_at: new Date().toISOString(),
        site_id: siteId,
        customer: customer.data || null,
        orders: orders.data || [],
        addresses: addresses.data || [],
        credentials: credentials.data || null,
    };
}

async function persistDsrExport(
    c: Context<{ Bindings: Env }>,
    input: {
        siteId: string;
        requestId: string;
        email: string;
        exportType: 'access' | 'erasure';
        payload: JsonRecord;
        actorId?: string | null;
    },
) {
    const db = getSupabaseAdmin(c);
    const kms = resolveKmsProviderFromEnv(c.env);
    const encryptedPayload = await encryptFieldWithKms(kms, JSON.stringify(input.payload));
    const encryptedEmail = await encryptFieldWithKms(kms, input.email);
    const { data, error } = await db
        .from('customer_dsr_exports')
        .insert({
            site_id: input.siteId,
            request_id: input.requestId,
            subject_email_hash: await sha256Hex(input.email),
            encrypted_subject_email: encryptedEmail,
            export_type: input.exportType,
            encrypted_payload: encryptedPayload,
            payload_digest: await sha256Hex(JSON.stringify(input.payload)),
            created_by: input.actorId || null,
            updated_by: input.actorId || null,
        })
        .select('id, site_id, request_id, export_type, payload_digest, created_at')
        .single();

    if (error || !data) throw new Error(`DSR export persistence failed: ${error?.message || 'unknown error'}`);
    return data;
}

router.post('/step-up/challenges', validate('json', StepUpChallengeSchema), async (c) => {
    const body = c.get('validatedBody') as StepUpChallengeInput;
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) return c.json({ error: { code: 'STEP_UP_PROFILE_REQUIRED', message: 'Merchant profile is required for step-up verification.' } }, 403);

    const signingSecret = configuredSecret(c.env.STEP_UP_SIGNING_SECRET);
    if (!signingSecret) {
        return c.json({ error: { code: 'STEP_UP_SIGNING_SECRET_REQUIRED', message: 'Step-up signing is not configured for this environment.' } }, 503);
    }
    const totpEncryptionSecret = configuredSecret(c.env.TOTP_ENCRYPTION_KEY);
    if (!totpEncryptionSecret) {
        return c.json({ error: { code: 'TWO_FACTOR_UNAVAILABLE', message: 'Two-factor verification is not configured for this environment.' } }, 503);
    }

    const factor = await loadActiveStepUpFactor(db, { customUserId: customUser.id, factorId: body.factor_id });
    if (!factor) return c.json({ error: { code: 'STEP_UP_FACTOR_REQUIRED', message: 'An active TOTP factor is required for step-up verification.' } }, 428);
    const totpSecret = await decryptTextAesGcm(totpEncryptionSecret, factor.secret_ciphertext);
    const accepted = await verifyTotpCode({ secret: totpSecret, code: body.code });
    if (!accepted) return c.json({ error: { code: 'STEP_UP_CODE_INVALID', message: 'Step-up verification code is invalid.' } }, 400);

    const challengeId = crypto.randomUUID();
    const signed = await signSensitiveActionStepUp({
        action: body.action, actorId: customUser.id, siteId: tenant.siteId, challengeId, signingSecret,
    });
    const resultCiphertext = await encryptTextAesGcm(totpEncryptionSecret, JSON.stringify({
        actor: customUser.id, site: tenant.siteId, factor: factor.id, action: body.action, key: body.idempotency_key,
        challengeId, step_up_token: signed.token, verified_at: signed.verifiedAt, expires_at: signed.expiresAt,
    }));
    const { data, error } = await db.rpc('issue_merchant_step_up_v1', {
        p_site: tenant.siteId, p_actor: customUser.id, p_factor: factor.id, p_action: body.action, p_key: body.idempotency_key,
        p_factor_sha256: await sha256Hex(factor.secret_ciphertext),
        p_proof: { id: challengeId, token_sha256: await sha256Hex(signed.token), verified_at: signed.verifiedAt,
            expires_at: signed.expiresAt, jti: signed.jti, result_ciphertext: resultCiphertext, request_id: c.req.header('X-Request-ID') || null },
    });
    if (error || !data || typeof data !== 'object') throw new AppError('Approval could not be saved. Retry the same request.', 503, 'STEP_UP_STATE_UNAVAILABLE');
    const result = data as { accepted: boolean; code?: string; challenge: { id: string }; result_ciphertext: string };
    if (!result.accepted) {
        const code = result.code || 'STEP_UP_INVALID';
        throw new AppError('Approval changed or expired. Verify your authenticator again.',
            code === 'STEP_UP_OWNER_REQUIRED' ? 403 : ['STEP_UP_FACTOR_REQUIRED', 'STEP_UP_EXPIRED'].includes(code) ? 428 : 409, code);
    }
    const recovered = JSON.parse(await decryptTextAesGcm(totpEncryptionSecret, result.result_ciphertext)) as {
        actor: string; site: string; factor: string; action: string; key: string; challengeId: string;
        step_up_token: string; verified_at: string; expires_at: string;
    };
    if (recovered.actor !== customUser.id || recovered.site !== tenant.siteId || recovered.factor !== factor.id
        || recovered.action !== body.action || recovered.key !== body.idempotency_key || recovered.challengeId !== result.challenge.id) throw new Error('Challenge retry binding mismatch');
    return c.json(success({ challenge: result.challenge, step_up_token: recovered.step_up_token,
        verified_at: recovered.verified_at, expires_at: recovered.expires_at }), 201);
});

router.post('/dsr/export', validate('json', DsrSchema), async (c) => {
    const body = c.get('validatedBody') as DsrInput;
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const customUser = await resolveCustomUser(db, auth.user);
    const email = lowerEmail(body.email);

    try {
        const request = await createManualDataSubjectRequest(db, {
            site_id: tenant.siteId,
            request_type: 'access',
            subject_type: 'customer',
            subject_email: email,
            source: 'manual',
            reason: body.reason,
            idempotency_key: body.idempotency_key,
            actor_id: customUser?.id || auth.user.id,
            actor_email: auth.user.email,
            actor_type: 'system',
            request_id: c.req.header('X-Request-ID') || null,
        });
        const payload = await loadCustomerDsrPayload(db, tenant.siteId, email);
        const exportRow = await persistDsrExport(c, {
            siteId: tenant.siteId,
            requestId: String(request.id),
            email,
            exportType: 'access',
            payload,
            actorId: customUser?.id || auth.user.id,
        });
        await updateDataSubjectRequest(db, String(request.id), {
            status: 'fulfilled',
            reason: body.reason,
            fulfillment_summary: 'Customer data export generated with encrypted payload storage.',
            actor_id: customUser?.id || auth.user.id,
            actor_email: auth.user.email,
            actor_type: 'system',
            request_id: c.req.header('X-Request-ID') || null,
        }, tenant.siteId);
        await emitCustomerDsrEvent(db, {
            siteId: tenant.siteId,
            requestId: String(request.id),
            subjectEmail: email,
            requestType: 'access',
            idempotencyKey: `customer.dsr_requested:${request.id}`,
            actorId: customUser?.id || auth.user.id,
            traceId: c.req.header('X-Request-ID') || null,
        });
        return c.json(success({ request_id: request.id, export: exportRow, payload }));
    } catch (error) {
        if (error instanceof KmsHumanRequiredError) {
            return c.json({ error: { code: 'KMS_PROVIDER_SETUP_REQUIRED', message: 'Field encryption provider setup is required.' } }, 503);
        }
        throw error;
    }
});

router.post('/dsr/erase', validate('json', DsrSchema), async (c) => {
    const body = c.get('validatedBody') as DsrInput;
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const customUser = await resolveCustomUser(db, auth.user);
    const email = lowerEmail(body.email);
    const stepUp = await verifySensitiveActionStepUp({
        action: 'customer.dsr.erase',
        actorId: customUser?.id || auth.user.id,
        siteId: tenant.siteId,
        token: c.req.header('X-Step-Up-Token'),
        verifiedAt: c.req.header('X-Step-Up-Verified-At'),
        signingSecret: c.env.STEP_UP_SIGNING_SECRET,
    });
    if (!stepUp.ok) return c.json(stepUpErrorBody(stepUp), 428);

    // Retention, deletion exceptions and approval ownership remain undecided.
    // The request, audit and requested-event commit together, with no PII write.
    const { data, error } = await db.rpc('request_merchant_erasure_review_v1', {
        p_site: tenant.siteId, p_actor: customUser?.id || auth.user.id,
        p_email: email, p_reason: body.reason, p_key: body.idempotency_key,
        p_request_id: c.req.header('X-Request-ID') || null,
    });
    if (error || !data || typeof data !== 'object') throw new AppError('The review request could not be saved. Retry the same request.', 503, 'DSR_REVIEW_UNAVAILABLE');
    const result = data as { accepted: boolean; code?: string };
    if (!result.accepted) throw new AppError('The request needs review. No erasure was performed.', result.code === 'DSR_NOT_FOUND' ? 404 : 409, result.code || 'DSR_REVIEW_REQUIRED');
    return c.json(success(data), 202);
});

export default router;
