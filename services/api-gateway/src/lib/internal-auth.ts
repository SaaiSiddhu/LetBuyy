import type { Context } from 'hono';
import type { Env } from '../index';
import {
    bytesToHex,
    getLetbuyyInternalAuthSecret,
    hmacSha256Hex,
    isFreshLetbuyyInternalTimestamp,
    timingSafeEqualHex,
    verifyLetbuyySignedPayload,
} from '@letbuyy/auth-core';

export function getInternalAuthSecret(env: Env): string | undefined {
    return getLetbuyyInternalAuthSecret(env);
}

export { bytesToHex, hmacSha256Hex, timingSafeEqualHex };

export function isFreshInternalTimestamp(timestampHeader: string | undefined): boolean {
    return isFreshLetbuyyInternalTimestamp(timestampHeader);
}

export async function verifySignedPayload(env: Env, payload: string, signature: string | undefined): Promise<boolean> {
    const secret = getInternalAuthSecret(env);
    return verifyLetbuyySignedPayload(secret, payload, signature);
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
