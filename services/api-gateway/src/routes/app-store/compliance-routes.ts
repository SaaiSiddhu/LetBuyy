import type { Context, Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { findFirstOwnedSiteId, resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { upsertDataSubjectRequestFromComplianceWebhook } from '../../lib/internal-compliance';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import {
    MANDATORY_COMPLIANCE_WEBHOOK_TOPICS,
    appStoreStringOrNull as stringOrNull,
    type MandatoryComplianceWebhookTopic,
} from '@letbuyy/app-engine';
import type { ComplianceDataSubjectSource } from '@letbuyy/shared-types';
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
type AppComplianceTriggerSource = 'merchant' | 'customer' | 'app_uninstall' | 'system';

export type AppComplianceDispatchResult =
    | { ok: true; subscriptionCount: number; dispatchedCount: number; dataSubjectRequestId?: string | null }
    | { ok: false; status: 500 | 503; code: string; message: string };

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

export async function dispatchStoreAppComplianceWebhook(
    c: Context<{ Bindings: Env }>,
    input: {
        eventType: MandatoryComplianceWebhookTopic;
        storeId: string;
        idempotencyKey: string;
        triggerSource: AppComplianceTriggerSource;
        actorId?: string | null;
        customerId?: string | null;
        customerEmail?: string | null;
        reason?: string | null;
        requestedAt?: string | null;
        failClosed?: boolean;
    },
): Promise<AppComplianceDispatchResult> {
    const db = getSupabaseAdmin(c);
    const requestId = getRequestId(c);
    const now = new Date();
    const eventType = input.eventType;
    const payload = buildAppComplianceWebhookPayload({
        eventType,
        storeId: input.storeId,
        occurredAt: stringOrNull(input.requestedAt) || now.toISOString(),
        requestId,
        triggerSource: input.triggerSource,
        actorId: input.actorId || null,
        customerId: input.customerId || null,
        customerEmail: input.customerEmail || null,
        reason: input.reason || null,
    });

    const { data: subscriptions, error } = await db
        .from('webhook_subscriptions')
        .select('id, target_url, signing_secret, event_types, metadata')
        .eq('site_id', input.storeId)
        .eq('status', 'active')
        .contains('event_types', [eventType])
        .contains('metadata', { source: 'app-platform' });

    if (error) {
        return { ok: false, status: 500, code: 'DB_ERROR', message: 'Database operation failed' };
    }

    let dataSubjectRequestId: string | null = null;
    try {
        const dataSubjectRequest = await upsertDataSubjectRequestFromComplianceWebhook(db, {
            eventType: eventType as ComplianceDataSubjectSource,
            siteId: input.storeId,
            idempotencyKey: input.idempotencyKey,
            requestedAt: input.requestedAt || now.toISOString(),
            actorId: input.actorId || null,
            customerId: input.customerId || null,
            customerEmail: input.customerEmail || null,
            reason: input.reason || null,
            requestId,
            payload,
        });
        dataSubjectRequestId = typeof dataSubjectRequest.id === 'string' ? dataSubjectRequest.id : null;
    } catch {
        if (input.failClosed) {
            return { ok: false, status: 500, code: 'DB_ERROR', message: 'Database operation failed' };
        }
    }

    const appSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];
    const deliveryConfigured = Boolean(c.env.WEBHOOK_SERVICE && c.env.INTERNAL_API_SECRET);
    if (appSubscriptions.length > 0 && !deliveryConfigured) {
        const unavailable = {
            ok: false as const,
            status: 503 as const,
            code: 'SERVER_MISCONFIGURED',
            message: 'App compliance webhook delivery is not configured',
        };
        if (input.failClosed) return unavailable;
        return { ok: true, subscriptionCount: appSubscriptions.length, dispatchedCount: 0, dataSubjectRequestId };
    }

    const delivered = await dispatchAppLifecycleSubscriptions(c.env, {
        db,
        eventType,
        installationId: input.storeId,
        siteId: input.storeId,
        actorId: input.actorId || null,
        eventIdPrefix: appComplianceWebhookEventIdPrefix({
            eventType,
            storeId: input.storeId,
            idempotencyKey: input.idempotencyKey,
        }),
        payload,
        requestId,
        subscriptions: appSubscriptions,
    });

    return { ok: true, subscriptionCount: appSubscriptions.length, dispatchedCount: delivered, dataSubjectRequestId };
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

    const dispatch = await dispatchStoreAppComplianceWebhook(c, {
        eventType,
        storeId,
        idempotencyKey,
        triggerSource: parsed.data.trigger_source || 'merchant',
        actorId: customUser.id,
        customerId: parsed.data.customer_id || null,
        customerEmail: parsed.data.customer_email || null,
        reason: parsed.data.reason || null,
        requestedAt: parsed.data.requested_at || null,
        failClosed: true,
    });
    if (!dispatch.ok) {
        return c.json({ error: { code: dispatch.code, message: dispatch.message } }, dispatch.status);
    }

    return c.json(success({
        event_type: eventType,
        store_id: storeId,
        idempotency_key: idempotencyKey,
        subscription_count: dispatch.subscriptionCount,
        dispatched_count: dispatch.dispatchedCount,
        data_subject_request_id: dispatch.dataSubjectRequestId || null,
    }), 202);
}

export function registerAppStoreComplianceRoutes(router: Hono<{ Bindings: Env }>): void {
    router.post('/compliance/customers/data-request', authMiddleware, (c) => emitAppComplianceWebhook(c, 'customers/data_request'));

    router.post('/compliance/customers/redact', authMiddleware, (c) => emitAppComplianceWebhook(c, 'customers/redact'));

    router.post('/compliance/shop/redact', authMiddleware, (c) => emitAppComplianceWebhook(c, 'shop/redact'));
}
