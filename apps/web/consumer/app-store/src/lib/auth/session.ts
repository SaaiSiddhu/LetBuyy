import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

interface Session {
    userId: string;
    email: string;
    storeId?: string;
    storeName?: string;
}

/**
 * AUTH_SECRET must match the accounts app's AUTH_SECRET env var.
 * The accounts app signs JWTs with HS256 using this secret.
 */
const AUTH_SECRET = process.env.AUTH_SECRET || '';
const secret = new TextEncoder().encode(AUTH_SECRET);

/**
 * Verify and decode the SSO session cookie.
 * Uses jose's jwtVerify to validate the HS256 signature against AUTH_SECRET,
 * ensuring the token hasn't been tampered with and hasn't expired.
 */
export async function verifySession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('lb_session')?.value;

    if (!sessionCookie) return null;

    // If AUTH_SECRET is not set, fall back to decoding without verification (dev only)
    if (!AUTH_SECRET) {
        console.warn('[session] AUTH_SECRET not set — falling back to unverified decode (dev mode)');
        return decodeWithoutVerification(sessionCookie);
    }

    try {
        const { payload } = await jwtVerify(sessionCookie, secret, {
            algorithms: ['HS256'],
        });

        return {
            userId: (payload.sub || payload.user_id) as string,
            email: payload.email as string,
            storeId: payload.store_id as string | undefined,
            storeName: payload.store_name as string | undefined,
        };
    } catch (err) {
        console.error('[session] JWT verification failed:', (err as Error).message);
        return null;
    }
}

/**
 * DEV-ONLY fallback: decode JWT payload without verifying signature.
 * This is only used when AUTH_SECRET is not configured.
 */
function decodeWithoutVerification(token: string): Session | null {
    try {
        const parts = token.split('.');
        if (parts.length >= 2) {
            const payload = JSON.parse(atob(parts[1]));
            return {
                userId: payload.sub || payload.user_id,
                email: payload.email,
                storeId: payload.store_id,
                storeName: payload.store_name,
            };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Get session from request headers (set by middleware).
 */
export function getSessionFromHeaders(headers: Headers): string | null {
    return headers.get('x-lb-session');
}
