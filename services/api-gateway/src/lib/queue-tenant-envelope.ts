import type { Env } from '../index';

interface QueueTenantEnvelope {
    siteId: string;
    issuedAt: string;
    signature: string;
}

type QueueTenantBody = Record<string, unknown> & {
    messageId?: string;
    siteId?: string | null;
    idempotencyKey?: string;
    tenantEnvelope?: QueueTenantEnvelope;
};

function queueTenantEnvelopeSecret(env: Pick<Env, 'QUEUE_TENANT_ENVELOPE_SECRET' | 'INTERNAL_API_SECRET'>): string | null {
    const secret = env.QUEUE_TENANT_ENVELOPE_SECRET || env.INTERNAL_API_SECRET;
    if (!secret || secret.includes('SKIP_NEEDS_HUMAN_') || secret.includes('replace-with')) return null;
    return secret;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function signQueueTenantEnvelope<TBody extends QueueTenantBody>(
    env: Pick<Env, 'QUEUE_TENANT_ENVELOPE_SECRET' | 'INTERNAL_API_SECRET'>,
    body: TBody,
): Promise<TBody> {
    if (!body.siteId) return body;
    const secret = queueTenantEnvelopeSecret(env);
    if (!secret) return body;

    const issuedAt = new Date().toISOString();
    const message = `${body.siteId}.${body.messageId || ''}.${body.idempotencyKey || ''}.${issuedAt}`;
    return {
        ...body,
        tenantEnvelope: {
            siteId: body.siteId,
            issuedAt,
            signature: await hmacSha256Hex(secret, message),
        },
    };
}
