import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import type { Env } from '../index';

const MERCHANT_SESSION_AUDIENCE = 'letbuyy:merchant-session';
const DEFAULT_IDENTITY_ISSUER = 'https://accounts.letbuyy.com';

function decodeBase64UrlJson(value: string): Record<string, unknown> | null {
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function identityIssuer(env: Env): string {
    return String(env.LETBUYY_IDENTITY_ISSUER || DEFAULT_IDENTITY_ISSUER).replace(/\/+$/, '');
}

function parseIdentityPublicJwks(env: Env): JSONWebKeySet | null {
    const raw = env.LETBUYY_IDENTITY_PUBLIC_JWKS?.trim();
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as JSONWebKeySet | (JSONWebKeySet['keys'][number]);
        if (parsed && typeof parsed === 'object' && Array.isArray((parsed as JSONWebKeySet).keys)) {
            return parsed as JSONWebKeySet;
        }
        if (parsed && typeof parsed === 'object') {
            return { keys: [parsed as JSONWebKeySet['keys'][number]] };
        }
    } catch {
        return null;
    }

    return null;
}

export async function validateIdentityIssuedMerchantSessionToken(
    env: Env,
    token: string,
    userId: string,
): Promise<{ ok: boolean; reason?: string }> {
    if (token.length > 4096 || token.split('.').length !== 3 || !/^[A-Za-z0-9._~-]+$/.test(token)) {
        return { ok: false, reason: 'merchant session token is malformed' };
    }

    const [encodedHeader, encodedPayload] = token.split('.');
    const header = decodeBase64UrlJson(encodedHeader);
    const payload = decodeBase64UrlJson(encodedPayload);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (!header || !payload) return { ok: false, reason: 'merchant session token is malformed' };
    if (header.alg !== 'ES256' && header.alg !== 'EdDSA') {
        return { ok: false, reason: 'merchant session token must use an asymmetric algorithm' };
    }
    if (payload.sub !== userId) return { ok: false, reason: 'merchant session subject mismatch' };
    if (payload.aud !== MERCHANT_SESSION_AUDIENCE) return { ok: false, reason: 'merchant session audience mismatch' };
    if (payload.realm !== 'merchant' || payload.token_use !== 'merchant_session') {
        return { ok: false, reason: 'merchant session token use mismatch' };
    }
    if (payload.iss !== identityIssuer(env)) {
        return { ok: false, reason: 'merchant session issuer mismatch' };
    }
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
        return { ok: false, reason: 'merchant session token is expired' };
    }
    if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 60) {
        return { ok: false, reason: 'merchant session token issue time is invalid' };
    }
    if (typeof payload.jti !== 'string' || payload.jti.length < 16) {
        return { ok: false, reason: 'merchant session replay id is missing' };
    }

    const jwks = parseIdentityPublicJwks(env);
    if (!jwks) {
        return { ok: false, reason: 'identity public JWKS is required' };
    }

    try {
        const { payload: verifiedPayload, protectedHeader } = await jwtVerify(
            token,
            createLocalJWKSet(jwks),
            {
                issuer: identityIssuer(env),
                audience: MERCHANT_SESSION_AUDIENCE,
                algorithms: ['ES256', 'EdDSA'],
                subject: userId,
            },
        );

        if (protectedHeader.alg !== 'ES256' && protectedHeader.alg !== 'EdDSA') {
            return { ok: false, reason: 'merchant session token must use an asymmetric algorithm' };
        }
        if (verifiedPayload.realm !== 'merchant' || verifiedPayload.token_use !== 'merchant_session') {
            return { ok: false, reason: 'merchant session token use mismatch' };
        }
        if (typeof verifiedPayload.jti !== 'string' || verifiedPayload.jti.length < 16) {
            return { ok: false, reason: 'merchant session replay id is missing' };
        }
    } catch {
        return { ok: false, reason: 'merchant session signature verification failed' };
    }

    return { ok: true };
}
