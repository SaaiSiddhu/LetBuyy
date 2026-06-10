import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveCustomUser } from '../lib/auth-user';
import { KmsHumanRequiredError, encryptFieldWithKms, resolveKmsProviderFromEnv, sha256Hex } from '../lib/crypto';
import { createManualDataSubjectRequest, updateDataSubjectRequest } from '../lib/internal-compliance';
import { stepUpErrorBody, verifySensitiveActionStepUp } from '../lib/security-controls';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
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
});

type DsrInput = z.infer<typeof DsrSchema>;
type StepUpChallengeInput = z.infer<typeof StepUpChallengeSchema>;
type JsonRecord = Record<string, unknown>;

function lowerEmail(value: string): string {
    return value.trim().toLowerCase();
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
    const token = `recorded-gap-step-up-${crypto.randomUUID()}`;
    const verifiedAt = new Date().toISOString();
    const { data, error } = await db
        .from('step_up_challenges')
        .upsert({
            site_id: tenant.siteId,
            actor_id: auth.user.id,
            action: body.action,
            status: 'verified',
            challenge_token_hash: await sha256Hex(token),
            verified_at: verifiedAt,
            idempotency_key: body.idempotency_key,
            metadata: { mode: 'recorded_gap' },
            created_by: tenant.userId,
            updated_by: tenant.userId,
        }, { onConflict: 'site_id,idempotency_key' })
        .select('id, site_id, action, status, verified_at')
        .single();

    if (error || !data) throw new Error(`Step-up challenge create failed: ${error?.message || 'unknown error'}`);
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: tenant.siteId,
        aggregateType: 'auth',
        aggregateId: data.id,
        eventType: 'auth.stepup',
        idempotencyKey: `auth.stepup:${data.id}`,
        actorId: auth.user.id,
        requestId: c.req.header('X-Request-ID') || null,
        payload: { site_id: tenant.siteId, action: body.action, status: 'verified' },
    });

    return c.json(success({ challenge: data, step_up_token: token, verified_at: verifiedAt }), 201);
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
    const stepUp = verifySensitiveActionStepUp({
        action: 'customer.dsr.erase',
        actorId: customUser?.id || auth.user.id,
        siteId: tenant.siteId,
        token: c.req.header('X-Step-Up-Token'),
        verifiedAt: c.req.header('X-Step-Up-Verified-At'),
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
