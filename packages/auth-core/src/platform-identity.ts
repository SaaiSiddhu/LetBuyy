/** Public verification of the sole Identity issuer. This module cannot mint a
 * human credential: Console and Gateway receive public keys only. */
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import type { LetbuyyPlatformSessionPayload } from './index';

export const PLATFORM_SESSION_AUDIENCE = 'letbuyy:platform-session';
export const PLATFORM_MAGIC_AUDIENCE = 'letbuyy:platform-magic-link';
export const PLATFORM_SESSION_TTL = 8 * 60 * 60;
export const PLATFORM_MAGIC_TTL = 15 * 60;
export const DEFAULT_PLATFORM_ISSUER = 'https://accounts.letbuyy.com';
export interface PlatformIdentityConfig { issuer?: string; publicJwks?: string }
export type PlatformSession = LetbuyyPlatformSessionPayload & { userId: string; sessionId: string };
export interface PlatformMagic { email: string; userId: string; jti: string; issuedAt: number; exp: number }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const privateFields = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'];

function publicKeys(raw: string | undefined) {
    if (!raw || raw.length > 65536) throw new Error('Public Identity keys are unavailable');
    const parsed = JSON.parse(raw) as JSONWebKeySet;
    if (!Array.isArray(parsed.keys) || !parsed.keys.length || parsed.keys.length > 16) throw new Error('Invalid Identity keys');
    const ids = new Set<string>();
    for (const key of parsed.keys) {
        if (privateFields.some(field => field in key) || typeof key.kid !== 'string' || !key.kid || ids.has(key.kid)
            || (key.use !== undefined && key.use !== 'sig') || (key.key_ops && key.key_ops.some(op => op !== 'verify'))
            || !(key.kty === 'EC' && key.crv === 'P-256' && key.alg === 'ES256'
                || key.kty === 'OKP' && key.crv === 'Ed25519' && key.alg === 'EdDSA')) throw new Error('Invalid public Identity key');
        ids.add(key.kid);
    }
    return createLocalJWKSet(parsed);
}
async function verified(token: string | null | undefined, config: PlatformIdentityConfig, magic: boolean, nowSeconds: number) {
    if (!token || token.length > 4096 || token.split('.').length !== 3) return null;
    try {
        const issuer = (config.issuer || DEFAULT_PLATFORM_ISSUER).replace(/\/+$/, '');
        const result = await jwtVerify(token, publicKeys(config.publicJwks), {
            issuer, audience: magic ? PLATFORM_MAGIC_AUDIENCE : PLATFORM_SESSION_AUDIENCE,
            algorithms: ['ES256', 'EdDSA'], typ: 'JWT', currentDate: new Date(nowSeconds * 1000), requiredClaims: ['sub', 'jti', 'iat', 'exp'],
        });
        const p = result.payload;
        if (!uuid.test(p.sub || '') || !uuid.test(p.jti || '') || !result.protectedHeader.kid
            || p.aud !== (magic ? PLATFORM_MAGIC_AUDIENCE : PLATFORM_SESSION_AUDIENCE)
            || p.realm !== 'platform' || p.token_use !== (magic ? 'platform_magic_link' : 'platform_session')
            || typeof p.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) || p.email.length > 254
            || p.email !== p.email.trim().toLowerCase() || !Number.isSafeInteger(p.iat) || !Number.isSafeInteger(p.exp)
            || p.iat! > nowSeconds + 30 || p.exp! <= p.iat! || p.exp! - p.iat! > (magic ? PLATFORM_MAGIC_TTL : PLATFORM_SESSION_TTL)) return null;
        return p as typeof p & { sub: string; jti: string; email: string; iat: number; exp: number };
    } catch { return null; }
}
export async function verifyIdentityPlatformSession(token: string | null | undefined, config: PlatformIdentityConfig, nowSeconds = Math.floor(Date.now() / 1000)): Promise<PlatformSession | null> {
    const p = await verified(token, config, false, nowSeconds);
    if (!p || typeof p.mfa_verified !== 'boolean' || (p.mfa_verified
        ? !Number.isSafeInteger(p.mfa_verified_at) || Number(p.mfa_verified_at) < p.iat || Number(p.mfa_verified_at) >= p.exp || Number(p.mfa_verified_at) > nowSeconds + 30
        : p.mfa_verified_at !== null)) return null;
    return { type: 'platform_session', email: p.email, userId: p.sub, sessionId: p.jti, mfaVerified: p.mfa_verified,
        mfaVerifiedAt: p.mfa_verified_at as number | null, issuedAt: p.iat, exp: p.exp };
}
export async function verifyIdentityPlatformMagic(token: string | null | undefined, config: PlatformIdentityConfig, nowSeconds = Math.floor(Date.now() / 1000)): Promise<PlatformMagic | null> {
    const p = await verified(token, config, true, nowSeconds);
    return p ? { email: p.email, userId: p.sub, jti: p.jti, issuedAt: p.iat, exp: p.exp } : null;
}

// Body-bound first-party transport authentication. This is never a human
// credential; Identity must independently verify the magic link/session/factor
// and claim the request id in the durable existing replay owner before effects.
const encoder = new TextEncoder();
async function bodyDigest(body: string) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(body)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function bridgeMac(secret: string, timestamp: string, jti: string, body: string) {
    if (secret.length < 32 || secret.startsWith('dev-only-') || secret.startsWith('SKIP_NEEDS_HUMAN') || secret.includes('replace-with')) throw new Error('Identity bridge is unavailable');
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`letbuyy:console-identity:v1\nPOST\n/api/operator/console\n${timestamp}\n${jti}\n${await bodyDigest(body)}`));
    return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function createConsoleIdentityProof(body: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
    const timestamp = String(nowSeconds), jti = crypto.randomUUID();
    return { 'X-LetBuyy-Console-Time': timestamp, 'X-LetBuyy-Console-JTI': jti,
        'X-LetBuyy-Console-Proof': await bridgeMac(secret, timestamp, jti, body) };
}
export async function verifyConsoleIdentityProof(body: string, headers: Headers, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string | null> {
    const time = headers.get('X-LetBuyy-Console-Time') || '', jti = headers.get('X-LetBuyy-Console-JTI') || '', proof = headers.get('X-LetBuyy-Console-Proof') || '';
    if (!/^\d{10}$/.test(time) || !uuid.test(jti) || !/^[0-9a-f]{64}$/.test(proof) || Number(time) < nowSeconds - 60 || Number(time) > nowSeconds + 30) return null;
    try {
        const expected = await bridgeMac(secret, time, jti, body);
        let mismatch = 0; for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ proof.charCodeAt(i);
        return mismatch === 0 ? jti : null;
    } catch { return null; }
}
