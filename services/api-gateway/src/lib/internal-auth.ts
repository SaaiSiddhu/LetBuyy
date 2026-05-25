import type { Context } from 'hono';
import type { Env } from '../index';

const INTERNAL_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
const textEncoder = new TextEncoder();

export function getInternalAuthSecret(env: Env): string | undefined {
    return env.INTERNAL_API_SECRET || env.AUTH_SECRET;
}

export function bytesToHex(bytes: ArrayBuffer): string {
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualHex(left: string, right: string): boolean {
    if (left.length !== right.length) return false;

    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return mismatch === 0;
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
    return bytesToHex(signature);
}

export function isFreshInternalTimestamp(timestampHeader: string | undefined): boolean {
    if (!timestampHeader) return false;
    const timestamp = Number(timestampHeader);
    return Number.isFinite(timestamp) && Math.abs(Date.now() - timestamp) <= INTERNAL_AUTH_MAX_AGE_MS;
}

export async function verifySignedPayload(env: Env, payload: string, signature: string | undefined): Promise<boolean> {
    const secret = getInternalAuthSecret(env);
    if (!secret || !signature) return false;
    const expectedSignature = await hmacSha256Hex(secret, payload);
    return timingSafeEqualHex(expectedSignature, signature);
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
