import type { Context } from 'hono';
import type { Env } from '../index';
import {
    bytesToHex,
    getLetbuyyInternalAuthSecret,
    hmacSha256Hex,
    internalAppSigningPayload,
    internalIdentitySigningPayload,
    isFreshLetbuyyInternalTimestamp,
    isSafeLetbuyyInternalJti,
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
        env.INTERNAL_API_SECRET_PREVIOUS,
        env.LETBUYY_INTERNAL_API_SECRET_PREVIOUS,
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

const consumedInternalJtis = new Map<string, number>();

function consumeInternalJti(input: {
    kind: string;
    jti: string | null | undefined;
    signature: string | null | undefined;
    nowMs?: number;
    maxAgeMs?: number;
}): boolean {
    if (!isSafeLetbuyyInternalJti(input.jti) || !input.signature) return false;

    const now = input.nowMs ?? Date.now();
    const maxAgeMs = input.maxAgeMs ?? 5 * 60_000;
    for (const [key, expiresAt] of consumedInternalJtis.entries()) {
        if (expiresAt <= now) consumedInternalJtis.delete(key);
    }

    const key = `${input.kind}:${input.jti}:${input.signature}`;
    if (consumedInternalJtis.has(key)) return false;
    consumedInternalJtis.set(key, now + maxAgeMs);
    return true;
}

export function _testResetInternalAuthReplayCache(): void {
    consumedInternalJtis.clear();
}

export async function verifyInternalSessionHeaders(
    env: Env,
    input: {
        sessionToken?: string | null;
        timestamp?: string | null;
        signature?: string | null;
        jti?: string | null;
    },
) {
    let lastVerification: Awaited<ReturnType<typeof verifyLetbuyyInternalSessionHeaders>> | null = null;

    for (const secret of getInternalAuthSecrets(env)) {
        const verification = await verifyLetbuyyInternalSessionHeaders({
            ...input,
            secret,
        });
        if (verification.accepted) {
            if (!consumeInternalJti({
                kind: 'session',
                jti: input.jti,
                signature: input.signature,
            })) {
                return {
                    accepted: false,
                    status: 'replayed' as const,
                    kind: 'merchant' as const,
                    reason: 'Internal session signature replay was rejected',
                };
            }
            return verification;
        }
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
    const jti = c.req.header('X-LetBuyy-Internal-JTI');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');

    if (app !== expectedApp || !isFreshInternalTimestamp(timestamp) || !isSafeLetbuyyInternalJti(jti)) {
        return false;
    }

    const signed = await verifySignedPayload(c.env, internalAppSigningPayload(app, String(timestamp), jti), signature);
    return signed && consumeInternalJti({ kind: `app:${app}`, jti, signature });
}

export async function verifyInternalIdentityPayload(
    env: Env,
    input: {
        userId: string;
        email: string;
        storeId?: string;
        timestamp?: string;
        jti?: string;
        signature?: string;
    },
): Promise<boolean> {
    if (!isFreshInternalTimestamp(input.timestamp) || !isSafeLetbuyyInternalJti(input.jti)) {
        return false;
    }

    const payload = internalIdentitySigningPayload(
        input.userId,
        input.email,
        input.storeId || '',
        String(input.timestamp),
        input.jti,
    );
    const signed = await verifySignedPayload(env, payload, input.signature);
    return signed && consumeInternalJti({ kind: 'identity', jti: input.jti, signature: input.signature });
}
