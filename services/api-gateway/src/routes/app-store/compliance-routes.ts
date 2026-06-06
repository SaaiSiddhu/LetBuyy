import type { Context, Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { findFirstOwnedSiteId, resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import {
    MANDATORY_COMPLIANCE_WEBHOOK_TOPICS,
    appStoreStringOrNull as stringOrNull,
    type MandatoryComplianceWebhookTopic,
} from '@letbuyy/app-engine';
import {
    appComplianceWebhookEventIdPrefix,
    buildAppComplianceWebhookPayload,
    dispatchAppLifecycleSubscriptions,
    getRequestId,
} from './shared';

const AppComplianceWebhookRequestSchema = z.object({
    store_id: z.string().min(1).optional(),
    idempotency_key: z.string().min(8).max(160).optional(),
    customer_id: z.string().min(1).max(160).optional(),
    customer_email: z.string().email().max(320).optional(),
    reason: z.string().min(1).max(500).optional(),
    requested_at: z.string().datetime().optional(),
    trigger_source: z.enum(['merchant', 'customer', 'system']).optional(),
}).strict();

type AppComplianceWebhookInput = z.infer<typeof AppComplianceWebhookRequestSchema>;

const COMPLIANCE_TOPIC_SET = new Set<string>(MANDATORY_COMPLIANCE_WEBHOOK_TOPICS);

export function isAppComplianceWebhookTopic(value: unknown): value is MandatoryComplianceWebhookTopic {
    return typeof value === 'string' && COMPLIANCE_TOPIC_SET.has(value);
}

export function appComplianceCustomerSubjectIsValid(input: AppComplianceWebhookInput): boolean {
    return Boolean(input.customer_id || input.customer_email);
}

function complianceWebhookBodyError(eventType: MandatoryComplianceWebhookTopic, input: AppComplianceWebhookInput): string | null {
    if (eventType.startsWith('customers/') && !appComplianceCustomerSubjectIsValid(input)) {
        return 'customer_id or customer_email is required for customer compliance webhooks';
    }
    return null;
}

async function emitAppComplianceWebhook(
    c: Context<{ Bindings: Env }>,
    eventType: MandatoryComplianceWebhookTopic,
) {
    const auth = c.get('auth');
    const body = await c.req.json().catch(() => ({}));
    const parsed = AppComplianceWebhookRequestSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid compliance webhook request' } }, 400);
    }

    const bodyError = complianceWebhookBodyError(eventType, parsed.data);
    if (bodyError) {
        return c.json({ error: { code: 'VALIDATION', message: bodyError } }, 400);
    }

    const idempotencyKey = c.req.header('X-Idempotency-Key') || parsed.data.idempotency_key;
    if (!idempotencyKey) {
        return c.json({ error: { code: 'VALIDATION', message: 'X-Idempotency-Key or idempotency_key is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);
    const now = new Date();

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const storeId = parsed.data.store_id || await findFirstOwnedSiteId(db, customUser.id);
    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }

    const { data: subscriptions, error } = await db
        .from('webhook_subscriptions')
        .select('id, target_url, signing_secret, event_types, metadata')
        .eq('site_id', storeId)
        .eq('status', 'active')
        .contains('event_types', [eventType])
        .contains('metadata', { source: 'app-platform' });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const appSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];
    if (appSubscriptions.length > 0 && (!c.env.WEBHOOK_SERVICE || !c.env.INTERNAL_API_SECRET)) {
        return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App compliance webhook delivery is not configured' } }, 503);
    }

    const payload = buildAppComplianceWebhookPayload({
        eventType,
        storeId,
        occurredAt: stringOrNull(parsed.data.requested_at) || now.toISOString(),
        requestId,
        triggerSource: parsed.data.trigger_source || 'merchant',
        actorId: customUser.id,
        customerId: parsed.data.customer_id || null,
        customerEmail: parsed.data.customer_email || null,
        reason: parsed.data.reason || null,
    });
    const delivered = await dispatchAppLifecycleSubscriptions(c.env, {
        eventType,
        installationId: storeId,
        eventIdPrefix: appComplianceWebhookEventIdPrefix({ eventType, storeId, idempotencyKey }),
        payload,
        requestId,
        subscriptions: appSubscriptions,
    });

    return c.json(success({
        event_type: eventType,
        store_id: storeId,
        idempotency_key: idempotencyKey,
        subscription_count: appSubscriptions.length,
        dispatched_count: delivered,
    }), 202);
}

export function registerAppStoreComplianceRoutes(router: Hono<{ Bindings: Env }>): void {
    router.post('/compliance/customers/data-request', authMiddleware, (c) => emitAppComplianceWebhook(c, 'customers/data_request'));

    router.post('/compliance/customers/redact', authMiddleware, (c) => emitAppComplianceWebhook(c, 'customers/redact'));

    router.post('/compliance/shop/redact', authMiddleware, (c) => emitAppComplianceWebhook(c, 'shop/redact'));
}
