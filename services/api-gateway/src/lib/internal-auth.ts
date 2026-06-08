import type { Context } from 'hono';
import type { Env } from '../index';
import {
    bytesToHex,
    getLetbuyyInternalAuthSecret,
    hmacSha256Hex,
    isFreshLetbuyyInternalTimestamp,
    timingSafeEqualHex,
    verifyLetbuyyInternalSessionHeaders,
    verifyLetbuyySignedPayload,
} from '@letbuyy/auth-core';

export function getInternalAuthSecret(env: Env): string | undefined {
    return getLetbuyyInternalAuthSecret(env);
}

export function getInternalAuthSecrets(env: Env): string[] {
    const secrets = [
        getLetbuyyInternalAuthSecret(env),
        env.WORKER_INTERNAL_API_SECRET,
    ].filter((secret): secret is string => Boolean(secret));

    return Array.from(new Set(secrets));
}

export { bytesToHex, hmacSha256Hex, timingSafeEqualHex };

export function isFreshInternalTimestamp(timestampHeader: string | undefined): boolean {
    return isFreshLetbuyyInternalTimestamp(timestampHeader);
}

export async function verifySignedPayload(env: Env, payload: string, signature: string | undefined): Promise<boolean> {
    for (const secret of getInternalAuthSecrets(env)) {
        if (await verifyLetbuyySignedPayload(secret, payload, signature)) return true;
    }

    return false;
}

export async function verifyInternalSessionHeaders(
    env: Env,
    input: {
        sessionToken?: string | null;
        timestamp?: string | null;
        signature?: string | null;
    },
) {
    let lastVerification: Awaited<ReturnType<typeof verifyLetbuyyInternalSessionHeaders>> | null = null;

    for (const secret of getInternalAuthSecrets(env)) {
        const verification = await verifyLetbuyyInternalSessionHeaders({
            ...input,
            secret,
        });
        if (verification.accepted) return verification;
        lastVerification = verification;
    }

    return lastVerification || {
        accepted: false,
        status: 'misconfigured' as const,
        kind: 'merchant' as const,
        reason: 'Internal auth secret is not configured',
    };
}

export async function verifyInternalAppRequest(c: Context<{ Bindings: Env }>, expectedApp: string): Promise<boolean> {
    const app = c.req.header('X-LetBuyy-Internal-App');
    const timestamp = c.req.header('X-LetBuyy-Internal-Timestamp');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');

    if (app !== expectedApp || !isFreshInternalTimestamp(timestamp)) {
        return false;
    }

    return verifySignedPayload(c.env, `app.${app}.${timestamp}`, signature);
}
