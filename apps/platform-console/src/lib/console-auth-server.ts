import 'server-only';

import { createHmac } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchConsoleApi, type ConsoleDataResponse } from './console-api';
import {
    CONSOLE_SESSION_COOKIE,
    CONSOLE_SESSION_MAX_AGE_SECONDS,
    createConsoleSessionCookieValue,
    readConsoleSession,
    type ConsoleSession,
} from './console-session';

type ConsoleAuditAction =
    | 'platform_console_login_magic_sent'
    | 'platform_console_login_magic_verified'
    | 'platform_console_login_local_magic_verified'
    | 'platform_console_mfa_verified'
    | 'platform_console_logout';

const textEncoder = new TextEncoder();

function configured(value: string | undefined) {
    if (!value) return false;
    if (value.includes('replace-with')) return false;
    if (value.startsWith('dev-only-placeholder')) return false;
    return true;
}

export function normalizeConsoleEmail(email: string) {
    return email.trim().toLowerCase();
}

export function getAllowedConsoleEmails() {
    return (process.env.PLATFORM_CONSOLE_ALLOWED_EMAILS || '')
        .split(',')
        .map((email) => normalizeConsoleEmail(email))
        .filter(Boolean);
}

export function isConsoleEmailAllowed(email: string) {
    const allowedEmails = getAllowedConsoleEmails();
    if (allowedEmails.length === 0) return false;
    return allowedEmails.includes(normalizeConsoleEmail(email));
}

export async function getConsoleSessionFromCookies() {
    const cookieStore = await cookies();
    return readConsoleSession(cookieStore.get(CONSOLE_SESSION_COOKIE)?.value);
}

export async function setConsoleSessionCookie(input: {
    email: string;
    userId?: string | null;
    mfaVerified: boolean;
}) {
    const cookieValue = await createConsoleSessionCookieValue(input);
    if (!cookieValue) return false;

    const cookieStore = await cookies();
    cookieStore.set(CONSOLE_SESSION_COOKIE, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: CONSOLE_SESSION_MAX_AGE_SECONDS,
    });

    return true;
}

export async function clearConsoleSessionCookie() {
    const cookieStore = await cookies();
    cookieStore.set(CONSOLE_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
    });
}

export async function requireConsoleSession(options: { mfa?: boolean } = {}) {
    const session = await getConsoleSessionFromCookies();

    if (!session) {
        redirect('/login');
    }

    if (options.mfa && !session.mfaVerified) {
        redirect('/mfa');
    }

    return session;
}

function decodeBase32(secret: string) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const normalized = secret.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
    if (!normalized || /[^A-Z2-7]/.test(normalized)) {
        return textEncoder.encode(secret);
    }

    const bytes: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of normalized) {
        value = (value << 5) | alphabet.indexOf(char);
        bits += 5;

        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Uint8Array.from(bytes);
}

function hotp(secret: Uint8Array, counter: number) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const digest = createHmac('sha1', Buffer.from(secret)).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0xf;
    const code = (
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff)
    ) % 1_000_000;

    return code.toString().padStart(6, '0');
}

export function verifyConsoleTotp(code: string) {
    const normalizedCode = code.trim();
    const devCode = process.env.PLATFORM_CONSOLE_DEV_MFA_CODE;

    if (process.env.NODE_ENV !== 'production' && devCode && normalizedCode === devCode) {
        return true;
    }

    const secret = process.env.PLATFORM_CONSOLE_TOTP_SECRET;
    if (!secret || !/^\d{6}$/.test(normalizedCode)) return false;

    const secretBytes = decodeBase32(secret);
    const counter = Math.floor(Date.now() / 30_000);

    for (let offset = -1; offset <= 1; offset += 1) {
        if (hotp(secretBytes, counter + offset) === normalizedCode) {
            return true;
        }
    }

    return false;
}

export async function writeConsoleAuditLog(input: {
    action: ConsoleAuditAction;
    email: string;
    session?: ConsoleSession | null;
    requestHeaders?: Headers;
}) {
    if (!configured(process.env.PLATFORM_CONSOLE_API_TOKEN)) {
        return;
    }

    const forwardedFor = input.requestHeaders?.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || input.requestHeaders?.get('x-real-ip') || null;
    const userAgent = input.requestHeaders?.get('user-agent') || null;

    try {
        const response = await fetchConsoleApi<ConsoleDataResponse<{ id: string }>>('/internal/console/audit-logs', {
            method: 'POST',
            body: {
                actor_id: input.session?.userId || null,
                actor_type: 'super_admin',
                actor_email: normalizeConsoleEmail(input.email),
                action: input.action,
                resource_type: 'platform_console_session',
                metadata: {
                    mfa_verified: input.session?.mfaVerified || false,
                },
                ip_address: ipAddress,
                user_agent: userAgent,
            },
        });

        if (response.error) {
            console.error('[platform-console] audit API failed:', response.error);
        }
    } catch (error) {
        console.error('[platform-console] audit API failed:', error instanceof Error ? error.message : 'unknown');
    }
}
