import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveCustomUser } from '../lib/auth-user';
import { KmsHumanRequiredError, decryptTextAesGcm, encryptFieldWithKms, resolveKmsProviderFromEnv, sha256Hex } from '../lib/crypto';
import { createManualDataSubjectRequest, updateDataSubjectRequest } from '../lib/internal-compliance';
import { signSensitiveActionStepUp, stepUpErrorBody, verifySensitiveActionStepUp } from '../lib/security-controls';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { verifyTotpCode } from '../lib/totp';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

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

    const existing = await db
        .from('step_up_challenges')
        .select('id')
        .eq('site_id', tenant.siteId)
        .eq('idempotency_key', body.idempotency_key)
        .is('deleted_at', null)
        .maybeSingle();
    if (existing.error) throw new Error(`Step-up challenge lookup failed: ${existing.error.message}`);

    const challengeId = String((existing.data as { id?: string } | null)?.id || crypto.randomUUID());
    const signed = await signSensitiveActionStepUp({
        action: body.action,
        actorId: customUser.id,
        siteId: tenant.siteId,
        challengeId,
        signingSecret,
    });
    const values = {
        site_id: tenant.siteId,
        actor_id: customUser.id,
        action: body.action,
        status: 'verified',
        challenge_token_hash: await sha256Hex(signed.token),
        verified_at: signed.verifiedAt,
        expires_at: signed.expiresAt,
        idempotency_key: body.idempotency_key,
        metadata: {
            mode: 'crypto',
            method: 'totp',
            step_up_crypto: 'hmac-sha256',
            factor_id: factor.id,
            jti: signed.jti,
        },
        created_by: tenant.userId,
        updated_by: tenant.userId,
    };
    const result = existing.data
        ? await db
            .from('step_up_challenges')
            .update(values)
            .eq('id', challengeId)
            .select('id, site_id, action, status, verified_at, expires_at')
            .single()
        : await db
            .from('step_up_challenges')
            .insert({ id: challengeId, ...values })
            .select('id, site_id, action, status, verified_at, expires_at')
            .single();

    const { data, error } = result;
    if (error || !data) throw new Error(`Step-up challenge create failed: ${error?.message || 'unknown error'}`);
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: tenant.siteId,
        aggregateType: 'auth',
        aggregateId: data.id,
        eventType: 'auth.stepup',
        idempotencyKey: `auth.stepup:${data.id}`,
        actorId: customUser.id,
        requestId: c.req.header('X-Request-ID') || null,
        payload: { site_id: tenant.siteId, action: body.action, status: 'verified', method: 'totp' },
    });

    return c.json(success({
        challenge: data,
        step_up_token: signed.token,
        verified_at: signed.verifiedAt,
        expires_at: signed.expiresAt,
    }), 201);
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
        });
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

    const request = await createManualDataSubjectRequest(db, {
        site_id: tenant.siteId,
        request_type: 'erasure',
        subject_type: 'customer',
        subject_email: email,
        source: 'manual',
        reason: body.reason,
        idempotency_key: body.idempotency_key,
        actor_id: customUser?.id || auth.user.id,
        actor_email: auth.user.email,
        actor_type: 'system',
        request_id: c.req.header('X-Request-ID') || null,
        metadata: stepUp.metadata,
    });
    const redactedAt = new Date().toISOString();
    const redactedEmail = `redacted-${await sha256Hex(`${tenant.siteId}:${email}`)}@redacted.invalid`;
    await Promise.all([
        db.from('store_customers').update({
            email: redactedEmail,
            full_name: null,
            phone: null,
            status: 'disabled',
            accepts_marketing: false,
            tags: [],
            notes: null,
            deleted_at: redactedAt,
        }).eq('store_id', tenant.siteId).eq('email', email),
        db.from('customer_addresses').delete().eq('store_id', tenant.siteId).eq('customer_email', email),
        db.from('customer_credentials').delete().eq('store_id', tenant.siteId).eq('email_or_phone', email),
        db.from('orders').update({ customer_email: redactedEmail, customer_name: 'Redacted customer', customer_phone: null }).eq('store_id', tenant.siteId).eq('customer_email', email),
    ]);
    await updateDataSubjectRequest(db, String(request.id), {
        status: 'fulfilled',
        reason: body.reason,
        fulfillment_summary: 'Customer PII erased from customer, address, credential, and order contact fields.',
        actor_id: customUser?.id || auth.user.id,
        actor_email: auth.user.email,
        actor_type: 'system',
        request_id: c.req.header('X-Request-ID') || null,
        metadata: stepUp.metadata,
    });
    await emitCustomerDsrEvent(db, {
        siteId: tenant.siteId,
        requestId: String(request.id),
        subjectEmail: email,
        requestType: 'erasure',
        idempotencyKey: `customer.dsr_requested:${request.id}`,
        actorId: customUser?.id || auth.user.id,
        traceId: c.req.header('X-Request-ID') || null,
    });

    return c.json(success({ request_id: request.id, erased: true, redacted_at: redactedAt }));
});

export default router;
