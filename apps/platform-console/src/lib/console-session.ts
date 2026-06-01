import {
    LETBUYY_PLATFORM_MAGIC_LINK_TTL_SECONDS,
    LETBUYY_PLATFORM_SESSION_COOKIE,
    LETBUYY_PLATFORM_SESSION_TTL_SECONDS,
    createLetbuyyPlatformMagicLinkToken,
    createLetbuyyPlatformSessionToken,
    verifyLetbuyyPlatformMagicLinkToken,
    verifyLetbuyyPlatformSessionToken,
    type LetbuyyPlatformMagicLinkPayload,
    type LetbuyyPlatformSessionPayload,
} from '@letbuyy/auth-core';

export const CONSOLE_SESSION_COOKIE = LETBUYY_PLATFORM_SESSION_COOKIE;
export const CONSOLE_SESSION_MAX_AGE_SECONDS = LETBUYY_PLATFORM_SESSION_TTL_SECONDS;

export type ConsoleSession = LetbuyyPlatformSessionPayload;
export type ConsoleMagicLinkPayload = LetbuyyPlatformMagicLinkPayload;

function isSafeSecret(secret: string) {
    return secret.length >= 16 && !secret.startsWith('dev-only-placeholder');
}

export function getConsoleSessionSecret() {
    const secret = process.env.PLATFORM_CONSOLE_SESSION_SECRET || process.env.AUTH_SECRET || '';

    if (process.env.NODE_ENV === 'production') {
        return isSafeSecret(secret) ? secret : null;
    }

    return secret || 'dev-only-console-session-secret';
}

export async function createConsoleSessionCookieValue(input: {
    email: string;
    userId?: string | null;
    mfaVerified: boolean;
}) {
    return createLetbuyyPlatformSessionToken(input, getConsoleSessionSecret(), {
        ttlSeconds: CONSOLE_SESSION_MAX_AGE_SECONDS,
    });
}

export async function readConsoleSession(cookieValue: string | undefined | null): Promise<ConsoleSession | null> {
    const verification = await verifyLetbuyyPlatformSessionToken(cookieValue, getConsoleSessionSecret());
    return verification.accepted ? verification.payload ?? null : null;
}

export async function createConsoleMagicLinkToken(email: string) {
    return createLetbuyyPlatformMagicLinkToken(email, getConsoleSessionSecret(), {
        ttlSeconds: LETBUYY_PLATFORM_MAGIC_LINK_TTL_SECONDS,
    });
}

export async function readConsoleMagicLinkToken(token: string | undefined | null): Promise<ConsoleMagicLinkPayload | null> {
    const verification = await verifyLetbuyyPlatformMagicLinkToken(token, getConsoleSessionSecret());
    return verification.accepted ? verification.payload ?? null : null;
}
