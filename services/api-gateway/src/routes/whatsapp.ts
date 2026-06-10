import { Hono } from 'hono';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { validate } from '../middleware/validation';
import {
    createWhatsAppCommerceAdapter,
    type WhatsAppCommerceProvider,
    type WhatsAppCommerceProviderMode,
    type WhatsAppTemplateKey,
} from '@letbuyy/infrastructure/whatsapp-commerce-adapter';
import type { WhatsAppCapability, WhatsAppMessage, WhatsAppTemplate } from '@letbuyy/shared-types';

const router = new Hono<{ Bindings: Env }>();
export const whatsappInboundRouter = new Hono<{ Bindings: Env }>();
type WhatsAppContext = Context<{ Bindings: Env }>;

const StoreScopedQuerySchema = z.object({
    store_id: z.string().uuid(),
});

const WhatsAppTemplateSchema = z.enum([
    'order_update',
    'order_paid',
    'order_shipped',
    'order_delivered',
    'shipping_update',
    'cod_confirmation',
    'abandoned_cart',
    'custom_message',
]);
const WhatsAppTimelineQuerySchema = StoreScopedQuerySchema.extend({
    customer_email: z.string().email().optional(),
    customer_phone: z.string().min(5).max(40).optional(),
});

const WhatsAppOptInSchema = z.object({
    store_id: z.string().uuid(),
    customer_email: z.string().email().optional().nullable(),
    customer_phone: z.string().min(5).max(40),
    consent_status: z.enum(['opted_in', 'opted_out']),
    consent_source: z.enum(['checkout', 'order', 'webhook', 'manual']).default('manual'),
    dpdp_purpose: z.string().trim().min(1).max(160).default('order_lifecycle_notifications'),
    idempotency_key: z.string().min(8).max(160),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const WhatsAppSendSchema = z.object({
    store_id: z.string().uuid(),
    order_id: z.string().uuid().optional().nullable(),
    customer_email: z.string().email().optional().nullable(),
    customer_phone: z.string().min(5).max(40).optional().nullable(),
    template: WhatsAppTemplateSchema,
    variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    message: z.string().min(1).max(1200).optional().nullable(),
    idempotency_key: z.string().min(8).max(160).optional().nullable(),
}).refine((value) => Boolean(value.customer_email || value.customer_phone), {
    message: 'customer_email or customer_phone is required',
});

type WhatsAppSendInput = z.infer<typeof WhatsAppSendSchema>;
type WhatsAppTimelineQuery = z.infer<typeof WhatsAppTimelineQuerySchema>;
type WhatsAppOptInInput = z.infer<typeof WhatsAppOptInSchema>;

interface StoreCustomerPhoneRow {
    id?: string | null;
    store_id?: string | null;
    email?: string | null;
    full_name?: string | null;
    phone?: string | null;
}

interface WhatsAppMessageRow {
    id: string;
    store_id: string;
    customer_email?: string | null;
    customer_phone: string;
    direction: 'outbound' | 'inbound';
    template?: WhatsAppTemplateKey | null;
    message: string;
    provider: string;
    provider_message_id?: string | null;
    status: WhatsAppMessage['status'];
    idempotency_key?: string | null;
    metadata?: unknown;
    created_by?: string | null;
    updated_by?: string | null;
    deleted_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

interface WaSessionRow {
    id: string;
    site_id: string;
    customer_phone: string;
    order_id?: string | null;
    status: string;
}

interface InboundResolution {
    storeId: string;
    customerEmail: string | null;
}

async function verifyStoreOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    authUser: WorkerAuthUser,
) {
    const customUser = await resolveCustomUser(db, authUser);
    return customUser ? verifySiteOwnership(db, storeId, customUser.id, authUser.storeId) : false;
}

function configuredProviderMode(c: WhatsAppContext): WhatsAppCommerceProviderMode | undefined {
    return c.env.WHATSAPP_PROVIDER_MODE === 'live' ? 'live' : c.env.WHATSAPP_PROVIDER_MODE === 'sandbox' ? 'sandbox' : undefined;
}

function configuredProvider(c: WhatsAppContext): WhatsAppCommerceProvider | undefined {
    if (c.env.WHATSAPP_PROVIDER === 'twilio' || c.env.WHATSAPP_PROVIDER === 'manual') return c.env.WHATSAPP_PROVIDER;
    if (c.env.WHATSAPP_PROVIDER === 'letbuyy_sandbox') return 'letbuyy_sandbox';
    return undefined;
}

function adapterFor(c: WhatsAppContext) {
    return createWhatsAppCommerceAdapter({
        mode: configuredProviderMode(c),
        provider: configuredProvider(c),
        accountSid: c.env.TWILIO_ACCOUNT_SID,
        authToken: c.env.TWILIO_AUTH_TOKEN,
        from: c.env.TWILIO_WHATSAPP_FROM,
        webhookSecret: c.env.WHATSAPP_WEBHOOK_SECRET,
        environment: c.env.ENVIRONMENT,
        appEnv: c.env.APP_ENV,
        nodeEnv: c.env.NODE_ENV,
    });
}

function templatePayload(template: {
    key: WhatsAppTemplateKey;
    label: string;
    description: string;
    requiredVariables: string[];
}): WhatsAppTemplate {
    return {
        key: template.key,
        label: template.label,
        description: template.description,
        required_variables: template.requiredVariables,
    };
}

function messagePayload(row: WhatsAppMessageRow): WhatsAppMessage {
    return {
        id: row.id,
        store_id: row.store_id,
        customer_email: row.customer_email || null,
        customer_phone: row.customer_phone,
        direction: row.direction,
        template: row.template || null,
        message: row.message,
        provider: row.provider,
        provider_message_id: row.provider_message_id || null,
        status: row.status,
        metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
        created_by: row.created_by || null,
        updated_by: row.updated_by || null,
        deleted_by: row.deleted_by || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        deleted_at: row.deleted_at || null,
    };
}

function capabilityPayload(c: WhatsAppContext, storeId: string): WhatsAppCapability {
    const adapter = adapterFor(c);
    return {
        store_id: storeId,
        available: adapter.available,
        provider: adapter.provider,
        provider_mode: adapter.mode,
        unavailable_reason: adapter.unavailableReason,
        templates: adapter.templates.map(templatePayload),
    };
}

function normalizeEmail(value: string | null | undefined): string | null {
    const text = value?.trim().toLowerCase();
    return text || null;
}

function normalizePhone(value: string | null | undefined): string {
    return (value || '').replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '').trim();
}

async function loadCustomerForSend(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    email: string | null,
) {
    if (!email) return { data: null as StoreCustomerPhoneRow | null, error: null };
    const { data, error } = await db
        .from('store_customers')
        .select('id,store_id,email,full_name,phone')
        .eq('store_id', storeId)
        .eq('email', email)
        .maybeSingle();
    return { data: data as StoreCustomerPhoneRow | null, error };
}

async function ensureCustomerExists(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    email: string | null,
) {
    if (!email) return { exists: true, error: null };
    const customer = await loadCustomerForSend(db, storeId, email);
    if (customer.error) return { exists: false, error: customer.error };
    if (customer.data) return { exists: true, error: null };
    const { data, error } = await db
        .from('orders')
        .select('id')
        .eq('store_id', storeId)
        .eq('customer_email', email)
        .limit(1);
    return { exists: (data || []).length > 0, error };
}

function isMissingOptionalWhatsAppTable(error: { message?: string } | null | undefined): boolean {
    const text = error?.message?.toLowerCase() || '';
    return text.includes('schema cache') || text.includes('does not exist') || text.includes('could not find');
}

async function resolveRecipientPhone(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    email: string | null,
    explicitPhone: string | null | undefined,
) {
    const normalizedExplicit = normalizePhone(explicitPhone);
    if (normalizedExplicit) return { phone: normalizedExplicit, customer: null as StoreCustomerPhoneRow | null, error: null };
    const customer = await loadCustomerForSend(db, storeId, email);
    if (customer.error) return { phone: '', customer: null, error: customer.error };
    return { phone: normalizePhone(customer.data?.phone), customer: customer.data, error: null };
}

async function hasActiveWhatsAppOptIn(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: { storeId: string; phone: string; email: string | null },
) {
    const { data, error } = await db
        .from('wa_optins')
        .select('id, consent_status, revoked_at')
        .eq('site_id', input.storeId)
        .eq('customer_phone', input.phone)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (isMissingOptionalWhatsAppTable(error)) return { optedIn: false, error: null };
        return { optedIn: false, error };
    }

    if (!data && input.email) {
        const emailResult = await db
            .from('wa_optins')
            .select('id, consent_status, revoked_at')
            .eq('site_id', input.storeId)
            .eq('customer_email', input.email)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (emailResult.error) {
            if (isMissingOptionalWhatsAppTable(emailResult.error)) return { optedIn: false, error: null };
            return { optedIn: false, error: emailResult.error };
        }
        const emailRow = emailResult.data as { consent_status?: string | null; revoked_at?: string | null } | null;
        return { optedIn: emailRow?.consent_status === 'opted_in' && !emailRow.revoked_at, error: null };
    }

    const row = data as { consent_status?: string | null; revoked_at?: string | null } | null;
    return { optedIn: row?.consent_status === 'opted_in' && !row.revoked_at, error: null };
}

async function mirrorWhatsAppMessage(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        customerEmail: string | null;
        customerPhone: string;
        direction: 'outbound' | 'inbound';
        template: WhatsAppTemplateKey | null;
        message: string;
        provider: string;
        providerMessageId: string | null;
        status: string;
        orderId?: string | null;
        eventType?: string | null;
        idempotencyKey?: string | null;
        metadata?: Record<string, unknown>;
        actorId?: string | null;
    },
) {
    const { error } = await db
        .from('whatsapp_messages')
        .insert({
            site_id: input.siteId,
            customer_email: input.customerEmail,
            customer_phone: input.customerPhone,
            direction: input.direction,
            template_key: input.template,
            body: input.message,
            provider: input.provider,
            provider_message_id: input.providerMessageId,
            status: input.status,
            order_id: input.orderId || null,
            event_type: input.eventType || null,
            idempotency_key: input.idempotencyKey || null,
            metadata: input.metadata || {},
            created_by: input.actorId || null,
            updated_by: input.actorId || null,
        });

    if (error && !isMissingOptionalWhatsAppTable(error)) return error;
    return null;
}

async function upsertWaSession(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        customerPhone: string;
        orderId?: string | null;
        sessionType: 'lifecycle' | 'cod_confirmation' | 'cart_abandonment';
        idempotencyKey: string;
        actorId?: string | null;
    },
) {
    const { error } = await db
        .from('wa_sessions')
        .upsert({
            site_id: input.siteId,
            customer_phone: input.customerPhone,
            order_id: input.orderId || null,
            session_type: input.sessionType,
            status: 'open',
            last_message_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            idempotency_key: input.idempotencyKey,
            created_by: input.actorId || null,
            updated_by: input.actorId || null,
        }, { onConflict: 'site_id,idempotency_key' });

    if (error && !isMissingOptionalWhatsAppTable(error)) return error;
    return null;
}

async function emitWhatsAppEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        messageId: string;
        eventType: 'wa.message_received' | 'wa.cod_confirmed';
        idempotencyKey: string;
        orderId?: string | null;
        requestId?: string | null;
        payload?: Record<string, unknown>;
    },
) {
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'whatsapp',
        aggregateId: input.messageId,
        eventType: input.eventType,
        payload: {
            site_id: input.siteId,
            message_id: input.messageId,
            order_id: input.orderId || undefined,
            ...input.payload,
        },
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId || null,
        actorId: null,
    });
}

function isAffirmativeCodReply(message: string): boolean {
    return /^(yes|y|confirm|confirmed|1)$/i.test(message.trim());
}

async function closeCodSessionFromReply(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: { siteId: string; phone: string; messageId: string; replyText: string; providerMessageId: string | null },
) {
    const { data, error } = await db
        .from('wa_sessions')
        .select('id, site_id, customer_phone, order_id, status')
        .eq('site_id', input.siteId)
        .eq('customer_phone', input.phone)
        .eq('session_type', 'cod_confirmation')
        .eq('status', 'open')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (isMissingOptionalWhatsAppTable(error)) return { handled: false, confirmed: false, orderId: null };
        throw new Error('COD session lookup failed');
    }

    const session = data as WaSessionRow | null;
    if (!session?.order_id) return { handled: false, confirmed: false, orderId: null };

    const confirmed = isAffirmativeCodReply(input.replyText);
    const now = new Date().toISOString();
    await db
        .from('wa_sessions')
        .update({
            status: confirmed ? 'closed' : 'closed',
            last_message_at: now,
            metadata: {
                reply_text: input.replyText,
                provider_message_id: input.providerMessageId,
                confirmed,
            },
        })
        .eq('id', session.id);

    await db
        .from('cod_confirmation_requests')
        .update({
            status: confirmed ? 'confirmed' : 'rejected',
            confirmed_at: confirmed ? now : null,
            response_payload: {
                reply_text: input.replyText,
                provider_message_id: input.providerMessageId,
                whatsapp_message_id: input.messageId,
                confirmed,
            },
        })
        .eq('site_id', input.siteId)
        .eq('order_id', session.order_id)
        .in('status', ['requested', 'expired']);

    await db
        .from('orders')
        .update(confirmed
            ? {
                status: 'confirmed',
                cod_confirmation_status: 'confirmed',
                cod_confirmed_at: now,
                fulfillment_state: 'unfulfilled',
            }
            : {
                status: 'cancelled',
                cod_confirmation_status: 'rejected',
                fulfillment_state: 'cancelled',
            })
        .eq('id', session.order_id)
        .eq('store_id', input.siteId);

    if (confirmed) {
        await emitWhatsAppEvent(db, {
            siteId: input.siteId,
            messageId: input.messageId,
            eventType: 'wa.cod_confirmed',
            orderId: session.order_id,
            idempotencyKey: `wa.cod_confirmed:${input.siteId}:${session.order_id}:${input.providerMessageId || input.messageId}`,
            payload: { reply_text: input.replyText },
        });
    }

    return { handled: true, confirmed, orderId: session.order_id };
}

function defaultVariables(body: WhatsAppSendInput, customer: StoreCustomerPhoneRow | null): Record<string, string | number | boolean | null> {
    return {
        customer_name: customer?.full_name || body.customer_email || 'customer',
        ...body.variables,
    };
}

function headersRecord(c: WhatsAppContext): Record<string, string | undefined> {
    const headers: Record<string, string | undefined> = {};
    c.req.raw.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
    });
    return headers;
}

function parseFormEncoded(rawBody: string): Record<string, string> {
    const form = new URLSearchParams(rawBody);
    const result: Record<string, string> = {};
    form.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}

async function parseInboundRequest(c: WhatsAppContext) {
    const rawBody = await c.req.text();
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
        const parsed = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
        const form: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (value !== null && value !== undefined) form[key] = String(value);
        }
        return { rawBody, form };
    }
    return { rawBody, form: parseFormEncoded(rawBody) };
}

async function resolveInboundCustomer(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: { storeId?: string | null; customerEmail?: string | null; fromPhone: string },
): Promise<{ resolution: InboundResolution | null; error: { message?: string } | null }> {
    const explicitStoreId = input.storeId?.trim();
    const explicitEmail = normalizeEmail(input.customerEmail);
    if (explicitStoreId) {
        if (explicitEmail) return { resolution: { storeId: explicitStoreId, customerEmail: explicitEmail }, error: null };
        const { data, error } = await db
            .from('customer_whatsapp_messages')
            .select('store_id,customer_email')
            .eq('store_id', explicitStoreId)
            .eq('customer_phone', input.fromPhone)
            .eq('direction', 'outbound')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return { resolution: null, error };
        return { resolution: { storeId: explicitStoreId, customerEmail: normalizeEmail((data as { customer_email?: string | null } | null)?.customer_email) }, error: null };
    }

    const { data, error } = await db
        .from('customer_whatsapp_messages')
        .select('store_id,customer_email')
        .eq('customer_phone', input.fromPhone)
        .eq('direction', 'outbound')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) return { resolution: null, error };
    const row = data as { store_id?: string | null; customer_email?: string | null } | null;
    if (!row?.store_id) return { resolution: null, error: null };
    return { resolution: { storeId: row.store_id, customerEmail: normalizeEmail(row.customer_email) }, error: null };
}

async function requireWhatsAppWebhookSignature(c: WhatsAppContext, form: Record<string, string>, rawBody: string): Promise<boolean> {
    return adapterFor(c).verifyInboundWebhook({
        url: c.req.url,
        headers: headersRecord(c),
        form,
        rawBody,
    });
}

router.get('/status', validate('query', StoreScopedQuerySchema), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as z.infer<typeof StoreScopedQuerySchema>;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, query.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    return c.json(success(capabilityPayload(c, query.store_id)));
});

router.get('/templates', validate('query', StoreScopedQuerySchema), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as z.infer<typeof StoreScopedQuerySchema>;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, query.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    return c.json(success(adapterFor(c).templates.map(templatePayload)));
});

router.get('/timeline', validate('query', WhatsAppTimelineQuerySchema), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as WhatsAppTimelineQuery;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, query.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let builder = db
        .from('customer_whatsapp_messages')
        .select('id,store_id,customer_email,customer_phone,direction,template,message,provider,provider_message_id,status,metadata,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at')
        .eq('store_id', query.store_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

    if (query.customer_email) builder = builder.eq('customer_email', normalizeEmail(query.customer_email));
    if (query.customer_phone) builder = builder.eq('customer_phone', normalizePhone(query.customer_phone));

    const { data, error } = await builder;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load WhatsApp timeline' } }, 500);

    return c.json(success(((data || []) as WhatsAppMessageRow[]).map(messagePayload)));
});

router.post('/optins', validate('json', WhatsAppOptInSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as WhatsAppOptInInput;
    const db = getSupabaseAdmin(c);
    const email = normalizeEmail(body.customer_email);
    const phone = normalizePhone(body.customer_phone);

    if (!(await verifyStoreOwnership(db, body.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('wa_optins')
        .upsert({
            site_id: body.store_id,
            customer_email: email,
            customer_phone: phone,
            consent_status: body.consent_status,
            consent_source: body.consent_source,
            dpdp_purpose: body.dpdp_purpose,
            accepted_at: body.consent_status === 'opted_in' ? now : null,
            revoked_at: body.consent_status === 'opted_out' ? now : null,
            idempotency_key: body.idempotency_key,
            metadata: body.metadata,
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        }, { onConflict: 'site_id,idempotency_key' })
        .select('id, site_id, customer_email, customer_phone, consent_status, consent_source, dpdp_purpose, accepted_at, revoked_at, created_at')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to record WhatsApp consent' } }, 500);
    return c.json(success({ optin: data }), 201);
});

router.post('/send', validate('json', WhatsAppSendSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as WhatsAppSendInput;
    const db = getSupabaseAdmin(c);
    const email = normalizeEmail(body.customer_email);

    if (!(await verifyStoreOwnership(db, body.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const exists = await ensureCustomerExists(db, body.store_id, email);
    if (exists.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer' } }, 500);
    if (!exists.exists) return c.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);

    if (body.idempotency_key) {
        const { data, error } = await db
            .from('customer_whatsapp_messages')
            .select('id,store_id,customer_email,customer_phone,direction,template,message,provider,provider_message_id,status,metadata,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at')
            .eq('store_id', body.store_id)
            .eq('idempotency_key', body.idempotency_key)
            .maybeSingle();
        if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to check WhatsApp idempotency' } }, 500);
        if (data) {
            const existing = messagePayload(data as WhatsAppMessageRow);
            return c.json(success({
                message: existing,
                provider_message_id: existing.provider_message_id,
                status: existing.status,
                sandbox: existing.provider === 'letbuyy_sandbox',
            }));
        }
    }

    const recipient = await resolveRecipientPhone(db, body.store_id, email, body.customer_phone);
    if (recipient.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer phone' } }, 500);
    if (!recipient.phone) {
        return c.json({ error: { code: 'CUSTOMER_PHONE_REQUIRED', message: 'Customer phone is required for WhatsApp messages' } }, 400);
    }

    const consent = await hasActiveWhatsAppOptIn(db, {
        storeId: body.store_id,
        phone: recipient.phone,
        email,
    });
    if (consent.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load WhatsApp consent' } }, 500);
    if (!consent.optedIn) {
        return c.json({ error: { code: 'WA_CONSENT_REQUIRED', message: 'WhatsApp consent is required before sending this message' } }, 403);
    }

    const adapter = adapterFor(c);
    if (!adapter.available) {
        return c.json({ error: { code: 'WHATSAPP_UNAVAILABLE', message: 'WhatsApp messages are temporarily unavailable' } }, 503);
    }

    let result;
    try {
        result = await adapter.sendTemplate({
            storeId: body.store_id,
            customerEmail: email,
            toPhone: recipient.phone,
            template: body.template,
            variables: defaultVariables(body, recipient.customer),
            message: body.message,
            idempotencyKey: body.idempotency_key,
        });
    } catch (error) {
        return c.json({ error: { code: 'WHATSAPP_SEND_FAILED', message: 'WhatsApp message could not be sent' } }, 502);
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const { data, error } = await db
        .from('customer_whatsapp_messages')
        .insert({
            store_id: body.store_id,
            customer_email: email,
            customer_phone: recipient.phone,
            direction: 'outbound',
            template: body.template,
            message: result.body,
            provider: result.provider,
            provider_message_id: result.providerMessageId,
            status: result.status,
            idempotency_key: body.idempotency_key || null,
            metadata: {
                ...result.metadata,
                provider_mode: result.providerMode,
            },
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        })
        .select('id,store_id,customer_email,customer_phone,direction,template,message,provider,provider_message_id,status,metadata,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to record WhatsApp message' } }, 500);

    const message = messagePayload(data as WhatsAppMessageRow);
    const mirrorError = await mirrorWhatsAppMessage(db, {
        siteId: body.store_id,
        customerEmail: email,
        customerPhone: recipient.phone,
        direction: 'outbound',
        template: body.template,
        message: result.body,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        status: result.status,
        orderId: body.order_id || null,
        eventType: `wa.${body.template}`,
        idempotencyKey: body.idempotency_key || null,
        metadata: {
            ...result.metadata,
            provider_mode: result.providerMode,
        },
        actorId: customUser?.id || null,
    });
    if (mirrorError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to record WhatsApp message' } }, 500);

    if (body.template === 'cod_confirmation' || body.template === 'order_paid' || body.template === 'order_shipped' || body.template === 'order_delivered') {
        const sessionError = await upsertWaSession(db, {
            siteId: body.store_id,
            customerPhone: recipient.phone,
            orderId: body.order_id || null,
            sessionType: body.template === 'cod_confirmation' ? 'cod_confirmation' : 'lifecycle',
            idempotencyKey: body.idempotency_key || `${body.template}:${body.store_id}:${result.providerMessageId}`,
            actorId: customUser?.id || null,
        });
        if (sessionError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to record WhatsApp session' } }, 500);
    }

    return c.json(success({
        message,
        provider_message_id: result.providerMessageId,
        status: result.status,
        sandbox: result.sandbox,
    }), 201);
});

whatsappInboundRouter.post('/', async (c) => {
    const { form, rawBody } = await parseInboundRequest(c);
    const adapter = adapterFor(c);
    const verified = await requireWhatsAppWebhookSignature(c, form, rawBody);
    if (!verified) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid WhatsApp webhook signature' } }, 401);
    }

    const inbound = adapter.parseInboundWebhook(form);
    if (!inbound.fromPhone || !inbound.body.trim()) {
        return c.json({ error: { code: 'VALIDATION', message: 'WhatsApp inbound message is incomplete' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { resolution, error: resolutionError } = await resolveInboundCustomer(db, {
        storeId: inbound.storeId,
        customerEmail: inbound.customerEmail,
        fromPhone: inbound.fromPhone,
    });
    if (resolutionError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to resolve WhatsApp customer' } }, 500);
    }
    if (!resolution) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'WhatsApp conversation was not found' } }, 404);
    }

    if (inbound.providerMessageId) {
        const existing = await db
            .from('customer_whatsapp_messages')
            .select('id,store_id,customer_email,customer_phone,direction,template,message,provider,provider_message_id,status,metadata,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at')
            .eq('store_id', resolution.storeId)
            .eq('provider_message_id', inbound.providerMessageId)
            .eq('direction', 'inbound')
            .maybeSingle();
        if (existing.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to check WhatsApp idempotency' } }, 500);
        if (existing.data) {
            return c.json(success({
                received: true,
                replayed: true,
                message: messagePayload(existing.data as WhatsAppMessageRow),
            }));
        }
    }

    const { data, error } = await db
        .from('customer_whatsapp_messages')
        .insert({
            store_id: resolution.storeId,
            customer_email: resolution.customerEmail,
            customer_phone: inbound.fromPhone,
            direction: 'inbound',
            template: null,
            message: inbound.body.trim(),
            provider: adapter.provider,
            provider_message_id: inbound.providerMessageId || null,
            status: 'received',
            metadata: inbound.metadata,
        })
        .select('id,store_id,customer_email,customer_phone,direction,template,message,provider,provider_message_id,status,metadata,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to record WhatsApp reply' } }, 500);

    const message = messagePayload(data as WhatsAppMessageRow);
    const mirrorError = await mirrorWhatsAppMessage(db, {
        siteId: resolution.storeId,
        customerEmail: resolution.customerEmail,
        customerPhone: inbound.fromPhone,
        direction: 'inbound',
        template: null,
        message: inbound.body.trim(),
        provider: adapter.provider,
        providerMessageId: inbound.providerMessageId || null,
        status: 'received',
        eventType: 'wa.message_received',
        idempotencyKey: inbound.providerMessageId ? `wa.inbound:${resolution.storeId}:${inbound.providerMessageId}` : null,
        metadata: inbound.metadata,
    });
    if (mirrorError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to record WhatsApp reply' } }, 500);

    await emitWhatsAppEvent(db, {
        siteId: resolution.storeId,
        messageId: message.id,
        eventType: 'wa.message_received',
        idempotencyKey: `wa.message_received:${resolution.storeId}:${inbound.providerMessageId || message.id}`,
        payload: {
            provider: adapter.provider,
            customer_phone: inbound.fromPhone,
        },
    });

    const codResult = await closeCodSessionFromReply(db, {
        siteId: resolution.storeId,
        phone: inbound.fromPhone,
        messageId: message.id,
        replyText: inbound.body,
        providerMessageId: inbound.providerMessageId || null,
    });

    return c.json(success({
        received: true,
        message,
        cod_confirmation: codResult,
    }), 201);
});

export default router;
