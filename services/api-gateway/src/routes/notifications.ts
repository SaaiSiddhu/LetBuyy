import { Hono } from 'hono';
import {MerchantInboxQuerySchema} from '@letbuyy/shared-types';
import {AppError,NotFoundError,ValidationError} from '../lib/errors';
import { z } from 'zod';
import {
    isValidWebhookTarget,
    NotificationSendSchema,
    planNotificationRoute,
    type NotificationChannel,
    type NotificationSendInput,
} from '@letbuyy/notification-core';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { validate } from '../middleware/validation';
import { sha256Hex } from '../lib/crypto';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';

const router = new Hono<{ Bindings: Env }>();

const DeviceTokenPlatformSchema = z.enum(['android', 'ios', 'web', 'macos', 'windows']);

const DeviceTokenRegistrationSchema = z.object({
    token: z.string().trim().min(8).max(4096),
    platform: DeviceTokenPlatformSchema,
    device_name: z.string().trim().max(120).optional(),
});

const DeviceTokenDeleteSchema = z.object({
    token: z.string().trim().min(1).max(4096),
});

const WebhookCreateSchema = z.object({
    site_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    target_url: z.string().url(),
    event_types: z.array(z.string().trim().min(1).max(120)).min(1).max(100).default(['*']),
    signing_secret: z.string().min(32).max(256).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const WebhookUpdateSchema = z.object({
    status: z.enum(['active', 'paused', 'disabled']).optional(),
    target_url: z.string().url().optional(),
    event_types: z.array(z.string().trim().min(1).max(120)).min(1).max(100).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

function objectRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function isUuid(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createWebhookSigningSecret(): string {
    return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
}

function recipientFingerprint(input: NotificationSendInput['recipient']): string {
    return [
        input.actor_id ? `actor:${input.actor_id}` : '',
        input.email ? `email:${input.email.toLowerCase()}` : '',
        input.phone ? `phone:${input.phone}` : '',
        input.push_token ? `push:${input.push_token}` : '',
    ].filter(Boolean).join('|') || 'anonymous';
}

async function recipientHash(input: NotificationSendInput['recipient']): Promise<string> {
    return sha256Hex(recipientFingerprint(input));
}

async function emitNotificationEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        logId: string;
        eventType: 'notification.sent' | 'notification.failed';
        payload: Record<string, unknown>;
        idempotencyKey: string;
        actorId: string;
        requestId?: string | null;
    },
) {
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'notification',
        aggregateId: input.logId,
        eventType: input.eventType,
        payload: {
            site_id: input.siteId,
            notification_log_id: input.logId,
            ...input.payload,
        },
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId || null,
        actorId: input.actorId,
    });
}

async function verifyOptionalStoreOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    authUser: { id: string; email: string; storeId?: string },
    storeId: unknown,
): Promise<boolean> {
    if (!storeId) return true;
    if (typeof storeId !== 'string') return false;

    const customUser = await resolveCustomUser(db, authUser);
    return Boolean(customUser && await verifySiteOwnership(db, storeId, customUser.id, authUser.storeId));
}

// Canonical account inbox: the signed actor owns every read and read-state write.
router.get('/', async c=>{
    const parsed=MerchantInboxQuerySchema.safeParse(c.req.query());
    if(!parsed.success)throw new ValidationError('Invalid inbox filters.');
    const q=parsed.data;
    let query=getSupabaseAdmin(c).from('notifications')
        .select('id,user_id,type,title,message,data,is_read,action_url,created_at',{count:'exact'})
        .eq('user_id',c.get('auth').user.id).is('deleted_at',null)
        .order('created_at',{ascending:false}).order('id',{ascending:false})
        .range((q.page-1)*q.limit,q.page*q.limit-1);
    if(q.is_read!==undefined)query=query.eq('is_read',q.is_read==='true');
    if(q.type)query=query.eq('type',q.type);
    if(q.source)query=query.eq('data->>source','letbuyy_platform');
    if(q.category)query=query.eq('data->>category',q.category);
    const {data,error,count}=await query;
    if(error)throw new AppError('Account inbox unavailable. Retry to reload.',503,'INBOX_UNAVAILABLE');
    return c.json(paginated(data||[],count||0,q.page,q.limit));
});
router.get('/count',async c=>{
    const q=MerchantInboxQuerySchema.safeParse(c.req.query());if(!q.success)throw new ValidationError('Invalid inbox filters.');
    let query=getSupabaseAdmin(c).from('notifications').select('id',{count:'exact',head:true})
        .eq('user_id',c.get('auth').user.id).is('deleted_at',null).eq('is_read',false);
    if(q.data.source)query=query.eq('data->>source','letbuyy_platform');
    if(q.data.category)query=query.eq('data->>category',q.data.category);
    const {error,count}=await query;if(error)throw new AppError('Unread count unavailable.',503,'INBOX_UNAVAILABLE');
    return c.json({count:count||0});
});
router.patch('/:id/read',async c=>{
    const id=z.string().uuid().safeParse(c.req.param('id'));if(!id.success)throw new ValidationError('Invalid inbox message.');
    const {data,error}=await getSupabaseAdmin(c).from('notifications').update({is_read:true})
        .eq('id',id.data).eq('user_id',c.get('auth').user.id).is('deleted_at',null).select('id').maybeSingle();
    if(error)throw new AppError('Read status could not be saved. Retry safely.',503,'INBOX_UNAVAILABLE');
    if(!data)throw new NotFoundError('Inbox message not found.');
    return c.json(success({marked:true}));
});
router.post('/read-all',async c=>{
    const {error}=await getSupabaseAdmin(c).from('notifications').update({is_read:true})
        .eq('user_id',c.get('auth').user.id).is('deleted_at',null).eq('is_read',false);
    if(error)throw new AppError('Read status could not be saved. Retry safely.',503,'INBOX_UNAVAILABLE');
    return c.json(success({marked:true}));
});

// GET /notifications/preferences — Get notification preferences
router.get('/preferences', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!(await verifyOptionalStoreOwnership(db, auth.user, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let query = db
        .from('notification_preferences')
        .select('*')
        .eq('user_id', auth.user.id);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// PUT /notifications/preferences — Upsert notification preferences
router.put('/preferences', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.channel || !body.category) {
        return c.json({ error: { code: 'VALIDATION', message: 'channel and category are required' } }, 400);
    }

    if (!(await verifyOptionalStoreOwnership(db, auth.user, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // notification_preferences dedupes user+store+channel+category through an
    // expression unique index (COALESCE(store_id, sentinel)) so a NULL
    // (global) store_id can't be inserted twice. PostgREST's upsert() only
    // ever emits a bare ON CONFLICT (col, col, ...) column list, which can
    // never match an expression index — every call here 500ed. The RPC does
    // the same insert with the matching expression conflict target.
    const { data, error } = await db.rpc('upsert_notification_preference', {
        p_user_id: auth.user.id,
        p_store_id: body.store_id || null,
        p_channel: body.channel,
        p_category: body.category,
        p_enabled: body.enabled ?? true,
    });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /notifications/send — V1 sandbox-default notification router
router.post('/send', validate('json', NotificationSendSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as NotificationSendInput;
    const db = getSupabaseAdmin(c);

    if (!(await verifyOptionalStoreOwnership(db, auth.user, body.site_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const existing = await db
        .from('notification_logs')
        .select('*')
        .eq('site_id', body.site_id)
        .eq('idempotency_key', body.idempotency_key)
        .maybeSingle();

    if (existing.error) {
        return c.json({ error: { code: 'DB_ERROR', message: existing.error.message } }, 500);
    }
    if (existing.data) return c.json(success({ log: existing.data, replayed: true }));

    const routePlan = planNotificationRoute({
        recipient: body.recipient,
        explicitChannel: body.message.channel || null,
        preferredChannels: body.preferred_channels || null,
    });
    const selectedChannel = routePlan.selected_channel;
    const hash = await recipientHash(body.recipient);
    const now = new Date();
    const suppressions = selectedChannel
        ? await db
            .from('notification_suppressions')
            .select('id, reason, expires_at')
            .eq('site_id', body.site_id)
            .eq('recipient_hash', hash)
            .eq('channel', selectedChannel)
            .eq('category', body.category)
            .is('deleted_at', null)
        : { data: [], error: null };

    if (suppressions.error) {
        return c.json({ error: { code: 'DB_ERROR', message: suppressions.error.message } }, 500);
    }

    const activeSuppression = (suppressions.data || []).find((row) => {
        const expiresAt = typeof row.expires_at === 'string' ? new Date(row.expires_at) : null;
        return !expiresAt || expiresAt.getTime() > now.getTime();
    });

    let preferenceDisabled = false;
    if (selectedChannel && isUuid(body.recipient.actor_id)) {
        const preference = await db
            .from('notification_preferences')
            .select('enabled')
            .eq('user_id', body.recipient.actor_id)
            .eq('store_id', body.site_id)
            .eq('channel', selectedChannel)
            .eq('category', body.category)
            .maybeSingle();
        if (preference.error) {
            return c.json({ error: { code: 'DB_ERROR', message: preference.error.message } }, 500);
        }
        preferenceDisabled = preference.data?.enabled === false;
    }

    const blockedReason = !selectedChannel
        ? 'no_reachable_channel'
        : activeSuppression
            ? 'suppressed'
            : preferenceDisabled
                ? 'preference_disabled'
                : null;
    const status = blockedReason ? (blockedReason === 'suppressed' || blockedReason === 'preference_disabled' ? 'suppressed' : 'failed') : 'sent';
    const logRow = {
        site_id: body.site_id,
        user_id: isUuid(body.recipient.actor_id) ? body.recipient.actor_id : null,
        channel: selectedChannel || 'email',
        category: body.category,
        template_key: body.message.template_key,
        event_type: body.event_type || null,
        recipient: body.recipient,
        subject: body.message.subject || null,
        body: body.message.body || null,
        status,
        provider: selectedChannel ? `sandbox_${selectedChannel}` : null,
        idempotency_key: body.idempotency_key,
        request_id: c.req.header('X-Request-ID') || null,
        metadata: {
            ...body.metadata,
            route_plan: routePlan,
            blocked_reason: blockedReason,
        },
        error_message: blockedReason,
        created_by: auth.user.id,
        updated_by: auth.user.id,
    };

    const { data: log, error: logError } = await db
        .from('notification_logs')
        .insert(logRow)
        .select('*')
        .single();

    if (logError || !log) {
        return c.json({ error: { code: 'DB_ERROR', message: logError?.message || 'Notification log write failed' } }, 500);
    }

    if (status === 'sent' && selectedChannel === 'in_app' && isUuid(body.recipient.actor_id)) {
        await db.from('notifications').insert({
            user_id: body.recipient.actor_id,
            type: 'system',
            title: body.message.subject || body.message.template_key,
            message: body.message.body || null,
            data: {
                notification_log_id: (log as Record<string, unknown>).id,
                template_key: body.message.template_key,
                metadata: body.metadata,
            },
            action_url: typeof body.metadata.action_url === 'string' ? body.metadata.action_url : null,
        });
    }

    await emitNotificationEvent(db, {
        siteId: body.site_id,
        logId: String((log as Record<string, unknown>).id),
        eventType: status === 'sent' ? 'notification.sent' : 'notification.failed',
        payload: {
            channel: selectedChannel,
            category: body.category,
            template_key: body.message.template_key,
            status,
            blocked_reason: blockedReason,
        },
        idempotencyKey: `notification.${status}:${body.site_id}:${body.idempotency_key}`,
        actorId: auth.user.id,
        requestId: c.req.header('X-Request-ID') || null,
    });

    return c.json(success({ log, route: routePlan }), status === 'sent' ? 202 : 200);
});

// GET /notifications/delivery-logs — Merchant-scoped notification delivery evidence
router.get('/delivery-logs', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const siteId = c.req.query('site_id') || auth.user.storeId;
    const channel = c.req.query('channel');
    const status = c.req.query('status');
    const page = Math.max(parseInt(c.req.query('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '25'), 1), 100);
    const offset = (page - 1) * limit;

    if (!siteId) {
        return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    }

    if (!(await verifyOptionalStoreOwnership(db, auth.user, siteId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let query = db
        .from('notification_logs')
        .select('id, site_id, user_id, channel, category, template_key, event_type, status, provider, attempt_count, error_message, metadata, created_at, updated_at', { count: 'exact' })
        .eq('site_id', siteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (channel) query = query.eq('channel', channel);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /notifications/webhooks — Merchant-owned outbound webhook subscriptions
router.get('/webhooks', async (c) => {
    const auth = c.get('auth');
    const siteId = c.req.query('site_id');
    const db = getSupabaseAdmin(c);

    if (!(await verifyOptionalStoreOwnership(db, auth.user, siteId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let query = db
        .from('webhook_subscriptions')
        .select('id, site_id, name, target_url, event_types, status, failure_count, last_success_at, last_failure_at, replay_window_seconds, metadata, created_at, updated_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (siteId) query = query.eq('site_id', siteId);

    const { data, error } = await query;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

    return c.json(success({ subscriptions: data || [] }));
});

// POST /notifications/webhooks — Create a signed outbound webhook subscription
router.post('/webhooks', validate('json', WebhookCreateSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as z.infer<typeof WebhookCreateSchema>;
    const db = getSupabaseAdmin(c);

    if (!(await verifyOptionalStoreOwnership(db, auth.user, body.site_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (!isValidWebhookTarget(body.target_url)) {
        return c.json({ error: { code: 'VALIDATION', message: 'Webhook target URL must use HTTPS' } }, 400);
    }

    const signingSecret = body.signing_secret || createWebhookSigningSecret();
    const { data, error } = await db
        .from('webhook_subscriptions')
        .insert({
            site_id: body.site_id,
            name: body.name,
            target_url: body.target_url,
            event_types: body.event_types,
            signing_secret: signingSecret,
            metadata: body.metadata,
            created_by: auth.user.id,
            updated_by: auth.user.id,
        })
        .select('id, site_id, name, target_url, event_types, status, replay_window_seconds, metadata, created_at')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

    return c.json(success({ subscription: data, signing_secret: signingSecret }), 201);
});

// PATCH /notifications/webhooks/:id — Update a merchant-owned webhook subscription
router.patch('/webhooks/:id', validate('json', WebhookUpdateSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as z.infer<typeof WebhookUpdateSchema>;
    const db = getSupabaseAdmin(c);
    const subscriptionId = c.req.param('id');

    const current = await db
        .from('webhook_subscriptions')
        .select('id, site_id')
        .eq('id', subscriptionId)
        .is('deleted_at', null)
        .maybeSingle();
    if (current.error) return c.json({ error: { code: 'DB_ERROR', message: current.error.message } }, 500);
    if (!current.data) return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook subscription not found' } }, 404);
    if (!(await verifyOptionalStoreOwnership(db, auth.user, current.data.site_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (body.target_url && !isValidWebhookTarget(body.target_url)) {
        return c.json({ error: { code: 'VALIDATION', message: 'Webhook target URL must use HTTPS' } }, 400);
    }

    const { data, error } = await db
        .from('webhook_subscriptions')
        .update({
            ...body,
            updated_by: auth.user.id,
        })
        .eq('id', subscriptionId)
        .select('id, site_id, name, target_url, event_types, status, replay_window_seconds, metadata, updated_at')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

    return c.json(success({ subscription: data }));
});

// DELETE /notifications/webhooks/:id — Soft-delete a merchant-owned webhook subscription
router.delete('/webhooks/:id', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const subscriptionId = c.req.param('id');

    const current = await db
        .from('webhook_subscriptions')
        .select('id, site_id')
        .eq('id', subscriptionId)
        .is('deleted_at', null)
        .maybeSingle();
    if (current.error) return c.json({ error: { code: 'DB_ERROR', message: current.error.message } }, 500);
    if (!current.data) return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook subscription not found' } }, 404);
    if (!(await verifyOptionalStoreOwnership(db, auth.user, current.data.site_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('webhook_subscriptions')
        .update({ status: 'disabled', deleted_at: new Date().toISOString(), updated_by: auth.user.id })
        .eq('id', subscriptionId);

    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

    return c.json(success({ deleted: true }));
});

// POST /notifications/device-tokens — Register or refresh a merchant mobile push token
router.post('/device-tokens', validate('json', DeviceTokenRegistrationSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as z.infer<typeof DeviceTokenRegistrationSchema>;
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('device_tokens')
        .upsert(
            {
                user_id: auth.user.id,
                token: body.token,
                platform: body.platform,
                device_name: body.device_name || null,
                last_used_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,token' },
        )
        .select('id, user_id, token, platform, device_name, last_used_at, created_at')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// DELETE /notifications/device-tokens — Remove a merchant mobile push token
router.delete('/device-tokens', validate('json', DeviceTokenDeleteSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as z.infer<typeof DeviceTokenDeleteSchema>;
    const db = getSupabaseAdmin(c);

    const { error } = await db
        .from('device_tokens')
        .delete()
        .eq('user_id', auth.user.id)
        .eq('token', body.token);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ deleted: true }));
});

// POST /notifications/email-log — Record a transactional email delivery result
router.post('/email-log', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.recipient_email || !body.email_type || !body.subject || !body.status) {
        return c.json({ error: { code: 'VALIDATION', message: 'recipient_email, email_type, subject, and status are required' } }, 400);
    }

    const { data, error } = await db
        .from('email_logs')
        .insert({
            recipient_email: body.recipient_email,
            email_type: body.email_type,
            subject: body.subject,
            status: body.status,
            error_message: body.error_message || null,
            metadata: {
                ...objectRecord(body.metadata),
                actor_user_id: auth.user.id,
                actor_source: auth.user.authSource || 'supabase',
            },
        })
        .select('id')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// POST /notifications/onboarding-failure-log — Record failed onboarding attempt metadata
router.post('/onboarding-failure-log', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.requested_name || !body.site_type || !body.failure_reason) {
        return c.json({ error: { code: 'VALIDATION', message: 'requested_name, site_type, and failure_reason are required' } }, 400);
    }

    const requestedSubdomain = (body.requested_subdomain || body.requested_name)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');

    const { data, error } = await db
        .from('onboarding_attempts')
        .insert({
            requested_name: body.requested_name,
            requested_subdomain: requestedSubdomain,
            site_type: body.site_type,
            status: 'failed',
            failure_reason: body.failure_reason,
            error_details: {
                ...objectRecord(body.error_details),
                raw_error_detail: typeof body.error_details === 'string' ? body.error_details : undefined,
                actor_user_id: auth.user.id,
                actor_source: auth.user.authSource || 'supabase',
            },
        })
        .select('id')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// DELETE /notifications/:id — Delete a notification
router.get('/:id',async c=>{
    const id=z.string().uuid().safeParse(c.req.param('id'));if(!id.success)throw new ValidationError('Invalid inbox message.');
    const parsed=MerchantInboxQuerySchema.safeParse(c.req.query());if(!parsed.success)throw new ValidationError('Invalid inbox filters.');
    let query=getSupabaseAdmin(c).from('notifications').select('id,user_id,type,title,message,data,is_read,action_url,created_at')
        .eq('id',id.data).eq('user_id',c.get('auth').user.id).is('deleted_at',null);
    if(parsed.data.source)query=query.eq('data->>source','letbuyy_platform');
    const {data,error}=await query.maybeSingle();
    if(error)throw new AppError('Inbox message unavailable.',503,'INBOX_UNAVAILABLE');
    if(!data)throw new NotFoundError('Inbox message not found.');return c.json(success(data));
});
router.delete('/:id',async c=>{
    const id=z.string().uuid().safeParse(c.req.param('id'));if(!id.success)throw new ValidationError('Invalid inbox message.');
    const {data,error}=await getSupabaseAdmin(c).from('notifications').update({deleted_at:new Date().toISOString()})
        .eq('id',id.data).eq('user_id',c.get('auth').user.id).is('deleted_at',null).select('id').maybeSingle();
    if(error)throw new AppError('Inbox message could not be dismissed.',503,'INBOX_UNAVAILABLE');
    if(!data)throw new NotFoundError('Inbox message not found.');return c.json(success({deleted:true}));
});

export default router;
