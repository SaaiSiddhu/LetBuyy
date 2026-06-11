import { Hono } from 'hono';
import {
    EmailRenderSchema,
    EmailSendSchema,
    planEmailProviderFailover,
    renderEmailTemplate,
    type EmailMode,
    type EmailProvider,
    type EmailSendInput,
} from '@letbuyy/notification-core';
import { DEFAULT_PLATFORM_DOMAIN } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { sha256Hex } from '../lib/crypto';
import { HumanRequiredError } from '../lib/errors';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

type EmailEventType = 'email.delivered' | 'email.bounced' | 'email.complained';

function emailMode(env: Env): EmailMode {
    return env.LETBUYY_EMAIL_MODE === 'live' ? 'live' : 'sandbox';
}

function liveEmailProviderDispatchAvailable(): boolean {
    return false;
}

function assertEmailProviderReady(env: Env) {
    if (emailMode(env) !== 'live') return;
    if (liveEmailProviderDispatchAvailable()) return;

    // [HUMAN-REQUIRED] HR-ESP-LIVE: live ESP dispatch, domains, API keys, SPF/DKIM/DMARC, and sender verification must be installed before live sends.
    throw new HumanRequiredError('Email provider dispatch is required before live email delivery can be enabled.');
}

function fromDomain(value: string | undefined): string | null {
    const domain = value?.split('@')[1]?.trim().toLowerCase();
    return domain && domain.includes('.') ? domain : null;
}

function defaultSenderDomain(env: Env): string {
    return (
        fromDomain(env.RESEND_FROM_EMAIL)
        || env.NEXT_PUBLIC_PLATFORM_DOMAIN
        || env.LETBUYY_PLATFORM_DOMAIN
        || env.PLATFORM_ROOT_DOMAIN
        || DEFAULT_PLATFORM_DOMAIN
    )
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .replace(/^\.+|\.+$/g, '') || DEFAULT_PLATFORM_DOMAIN;
}

async function recipientHash(email: string): Promise<string> {
    return sha256Hex(`email:${email.trim().toLowerCase()}`);
}

async function verifyEmailSiteOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    authUser: { id: string; email: string; storeId?: string },
    siteId: string,
): Promise<boolean> {
    const customUser = await resolveCustomUser(db, authUser);
    return Boolean(customUser && await verifySiteOwnership(db, siteId, customUser.id, authUser.storeId));
}

function coerceFailedProviders(value: unknown): Set<string> {
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((item): item is string => typeof item === 'string'));
}

function chooseProvider(input: {
    providers: EmailProvider[];
    failedProviders: Set<string>;
}): { provider: EmailProvider | null; attempts: Array<Record<string, unknown>> } {
    let selected: EmailProvider | null = null;
    const attempts = input.providers.map((provider) => {
        if (selected) return { provider, status: 'skipped' };
        if (input.failedProviders.has(provider)) return { provider, status: 'failed', reason: 'sandbox_failover_fixture' };
        selected = provider;
        return { provider, status: 'delivered' };
    });

    return { provider: selected, attempts };
}

async function emitEmailEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        emailId: string;
        eventType: EmailEventType;
        templateKey: string;
        provider: string | null;
        recipientHash: string;
        idempotencyKey: string;
        actorId: string;
        requestId?: string | null;
        payload?: Record<string, unknown>;
    },
) {
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'email',
        aggregateId: input.emailId,
        eventType: input.eventType,
        payload: {
            site_id: input.siteId,
            email_id: input.emailId,
            template_key: input.templateKey,
            provider: input.provider || undefined,
            recipient_hash: input.recipientHash,
            ...input.payload,
        },
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId || null,
        actorId: input.actorId,
    });
}

function emailSetupError(c: import('hono').Context<{ Bindings: Env }>) {
    return c.json({
        error: {
            code: 'EMAIL_PROVIDER_SETUP_REQUIRED',
            message: 'Email provider setup is not enabled for this environment.',
        },
    }, 503);
}

router.post('/render', validate('json', EmailRenderSchema), async (c) => {
    const body = c.get('validatedBody') as Parameters<typeof renderEmailTemplate>[0];
    return c.json(success({ rendered: renderEmailTemplate(body) }));
});

router.post('/send', validate('json', EmailSendSchema), async (c) => {
    try {
        assertEmailProviderReady(c.env);
    } catch (error) {
        if (error instanceof HumanRequiredError) return emailSetupError(c);
        throw error;
    }

    const auth = c.get('auth');
    const body = c.get('validatedBody') as EmailSendInput;
    const db = getSupabaseAdmin(c);

    if (!(await verifyEmailSiteOwnership(db, auth.user, body.site_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const existing = await db
        .from('email_logs')
        .select('*')
        .eq('site_id', body.site_id)
        .eq('idempotency_key', body.idempotency_key)
        .maybeSingle();
    if (existing.error) return c.json({ error: { code: 'DB_ERROR', message: existing.error.message } }, 500);
    if (existing.data) return c.json(success({ log: existing.data, replayed: true }));

    const hash = await recipientHash(body.to);
    const now = new Date();
    const suppressions = await db
        .from('email_suppressions')
        .select('id, reason, expires_at')
        .eq('site_id', body.site_id)
        .eq('email_hash', hash)
        .is('deleted_at', null);
    if (suppressions.error) return c.json({ error: { code: 'DB_ERROR', message: suppressions.error.message } }, 500);

    const activeSuppression = (suppressions.data || []).find((row) => {
        const expiresAt = typeof row.expires_at === 'string' ? new Date(row.expires_at) : null;
        return !expiresAt || expiresAt.getTime() > now.getTime();
    });

    const requestedDomain = (body.sender_domain || fromDomain(body.from) || defaultSenderDomain(c.env)).toLowerCase();
    const senderDomain = await db
        .from('sender_domains')
        .select('domain, status, from_rewrite_domain')
        .eq('site_id', body.site_id)
        .eq('domain', requestedDomain)
        .is('deleted_at', null)
        .maybeSingle();
    if (senderDomain.error) return c.json({ error: { code: 'DB_ERROR', message: senderDomain.error.message } }, 500);

    const rendered = renderEmailTemplate({
        template_key: body.template_key,
        locale: body.locale,
        subject: body.subject,
        body: body.body,
        context: body.context,
    });
    const mode = emailMode(c.env);
    const failover = planEmailProviderFailover({
        mode,
        preferredProvider: body.provider_preference || null,
    });
    const failedProviders = coerceFailedProviders(body.metadata.sandbox_failed_providers);
    const delivery = activeSuppression
        ? { provider: null, attempts: [] }
        : chooseProvider({ providers: failover.providers, failedProviders });
    const delivered = Boolean(delivery.provider);
    const status = activeSuppression ? 'suppressed' : delivered ? 'delivered' : 'failed';
    const eventType: EmailEventType = activeSuppression
        ? 'email.bounced'
        : delivered
            ? 'email.delivered'
            : 'email.bounced';
    const fromEmail = senderDomain.data?.status === 'verified'
        ? body.from || c.env.RESEND_FROM_EMAIL || `notifications@${requestedDomain}`
        : senderDomain.data?.from_rewrite_domain
            ? `notifications@${senderDomain.data.from_rewrite_domain}`
            : body.from || c.env.RESEND_FROM_EMAIL || `notifications@${defaultSenderDomain(c.env)}`;

    const { data: log, error: logError } = await db
        .from('email_logs')
        .insert({
            site_id: body.site_id,
            recipient_email: body.to,
            recipient_hash: hash,
            email_type: body.template_key,
            template_key: body.template_key,
            locale: body.locale,
            subject: rendered.subject,
            status,
            provider: delivery.provider,
            provider_message_id: delivery.provider ? `email_sandbox_${crypto.randomUUID()}` : null,
            provider_attempts: delivery.attempts,
            idempotency_key: body.idempotency_key,
            request_id: c.req.header('X-Request-ID') || null,
            metadata: {
                ...body.metadata,
                mode,
                failover,
                from_email: fromEmail,
                sender_domain: {
                    requested: requestedDomain,
                    status: senderDomain.data?.status || 'unregistered',
                    rewritten: fromEmail !== (body.from || c.env.RESEND_FROM_EMAIL || `notifications@${requestedDomain}`),
                },
                suppression_id: activeSuppression?.id || null,
                html: rendered.html,
                text: rendered.text,
            },
            error_message: activeSuppression?.reason || (!delivered ? 'provider_failover_exhausted' : null),
            created_by: auth.user.id,
            updated_by: auth.user.id,
        })
        .select('*')
        .single();

    if (logError || !log) {
        return c.json({ error: { code: 'DB_ERROR', message: logError?.message || 'Email log write failed' } }, 500);
    }

    await emitEmailEvent(db, {
        siteId: body.site_id,
        emailId: String((log as Record<string, unknown>).id),
        eventType,
        templateKey: body.template_key,
        provider: delivery.provider,
        recipientHash: hash,
        idempotencyKey: `${eventType}:${body.site_id}:${body.idempotency_key}`,
        actorId: auth.user.id,
        requestId: c.req.header('X-Request-ID') || null,
        payload: {
            status,
            suppression_reason: activeSuppression?.reason || null,
        },
    });

    return c.json(success({
        log,
        rendered,
        provider: delivery.provider,
        failover,
        suppressed: Boolean(activeSuppression),
    }), delivered ? 202 : 200);
});

export default router;
