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

// B7: Per-caller HMAC keyring.
// INTERNAL_API_KEYRING: JSON object mapping callerId → HMAC secret string.
// INTERNAL_AUTH_LEGACY_ACCEPT: controls the legacy single-secret fallback window.
// Sunset: set INTERNAL_AUTH_LEGACY_ACCEPT="false" after all callers are provisioned
// with per-caller keyring secrets and all runtimes have rotated (see HR-SECRET-ROTATION).

export function getInternalApiKeyring(env: Env): Record<string, string> {
    const raw = ((env as unknown as Record<string, string | undefined>).INTERNAL_API_KEYRING ?? '').trim();
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && (v as string).length > 0)
        ) as Record<string, string>;
    } catch {
        return {};
    }
}

export function isLegacyAcceptEnabled(env: Env): boolean {
    // Default ON — unset or empty means legacy single-secret acceptance is active.
    // Only explicit "false" / "0" / "off" / "no" / "disabled" disables legacy accept.
    const val = ((env as unknown as Record<string, string | undefined>).INTERNAL_AUTH_LEGACY_ACCEPT ?? '').trim().toLowerCase();
    return !['false', '0', 'off', 'no', 'disabled'].includes(val);
}

export function getSecretsForCaller(env: Env, callerId?: string | null): string[] {
    const keyring = getInternalApiKeyring(env);
    const callerSecret = callerId && keyring[callerId] ? [keyring[callerId]] : [];
    const legacySecrets = isLegacyAcceptEnabled(env) ? getInternalAuthSecrets(env) : [];
    return Array.from(new Set([...callerSecret, ...legacySecrets]));
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
    const callerId = c.req.header('X-LetBuyy-Internal-Caller');
    const timestamp = c.req.header('X-LetBuyy-Internal-Timestamp');
    const jti = c.req.header('X-LetBuyy-Internal-JTI');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');

    if (app !== expectedApp || !isFreshInternalTimestamp(timestamp) || !isSafeLetbuyyInternalJti(jti)) {
        return false;
    }

    const signingPayload = internalAppSigningPayload(app, String(timestamp), jti);
    for (const secret of getSecretsForCaller(c.env, callerId)) {
        if (await verifyLetbuyySignedPayload(secret, signingPayload, signature)) {
            return consumeInternalJti({ kind: `app:${app}`, jti, signature });
        }
    }
    return false;
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
