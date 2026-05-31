export const CONSOLE_SESSION_COOKIE = 'lb_console_session';
export const CONSOLE_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type ConsoleSession = {
    type: 'console_session';
    email: string;
    userId: string | null;
    mfaVerified: boolean;
    issuedAt: number;
    exp: number;
};

type ConsoleMagicLinkPayload = {
    type: 'console_magic_link';
    email: string;
    exp: number;
};

type SignedPayload = Record<string, unknown> & {
    exp: number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array) {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

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

async function hmacSha256(data: string, secret: string) {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
    return new Uint8Array(signature);
}

function constantTimeEqual(a: string, b: string) {
    if (a.length !== b.length) return false;

    let diff = 0;
    for (let index = 0; index < a.length; index += 1) {
        diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }

    return diff === 0;
}

export async function signConsolePayload(payload: SignedPayload) {
    const secret = getConsoleSessionSecret();
    if (!secret) return null;

    const encodedPayload = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
    const signature = base64UrlEncode(await hmacSha256(encodedPayload, secret));
    return `${encodedPayload}.${signature}`;
}

export async function readSignedConsolePayload<T extends SignedPayload>(token: string | undefined | null) {
    const secret = getConsoleSessionSecret();
    if (!token || !secret) return null;

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expectedSignature = base64UrlEncode(await hmacSha256(encodedPayload, secret));
    if (!constantTimeEqual(signature, expectedSignature)) return null;

    try {
        const payload = JSON.parse(textDecoder.decode(base64UrlDecode(encodedPayload))) as T;
        if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

export async function createConsoleSessionCookieValue(input: {
    email: string;
    userId?: string | null;
    mfaVerified: boolean;
}) {
    const now = Math.floor(Date.now() / 1000);
    return signConsolePayload({
        type: 'console_session',
        email: input.email,
        userId: input.userId || null,
        mfaVerified: input.mfaVerified,
        issuedAt: now,
        exp: now + CONSOLE_SESSION_MAX_AGE_SECONDS,
    });
}

export async function readConsoleSession(cookieValue: string | undefined | null): Promise<ConsoleSession | null> {
    const payload = await readSignedConsolePayload<ConsoleSession>(cookieValue);

    if (
        !payload ||
        payload.type !== 'console_session' ||
        typeof payload.email !== 'string' ||
        typeof payload.mfaVerified !== 'boolean'
    ) {
        return null;
    }

    return payload;
}

export async function createConsoleMagicLinkToken(email: string) {
    const now = Math.floor(Date.now() / 1000);
    return signConsolePayload({
        type: 'console_magic_link',
        email,
        exp: now + 15 * 60,
    });
}

export async function readConsoleMagicLinkToken(token: string | undefined | null) {
    const payload = await readSignedConsolePayload<ConsoleMagicLinkPayload>(token);

    if (!payload || payload.type !== 'console_magic_link' || typeof payload.email !== 'string') {
        return null;
    }

    return payload;
}
