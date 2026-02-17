// ============================================================
// SESSION MANAGEMENT — JWT-based customer sessions
// Uses httpOnly cookies for security (no XSS exposure)
// ============================================================

import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

// ============================================================
// Types
// ============================================================

export interface CustomerSessionPayload extends JWTPayload {
    sub: string;       // customer ID
    storeId: string;
    email: string;
    name: string | null;
}

// ============================================================
// Constants
// ============================================================

const COOKIE_NAME = 'lb_customer_session';
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function getSecret(): Uint8Array {
    const secret = process.env.CUSTOMER_SESSION_SECRET;
    if (!secret) {
        throw new Error('[Session] CUSTOMER_SESSION_SECRET env var is required');
    }
    return new TextEncoder().encode(secret);
}

// ============================================================
// Create Session — signs JWT + sets cookie
// ============================================================

export async function createSession(customer: {
    id: string;
    storeId: string;
    email: string;
    fullName: string | null;
}): Promise<string> {
    const secret = getSecret();

    const token = await new SignJWT({
        sub: customer.id,
        storeId: customer.storeId,
        email: customer.email,
        name: customer.fullName,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL}s`)
        .sign(secret);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_TTL,
        path: '/',
    });

    return token;
}

// ============================================================
// Get Session — reads + verifies JWT from cookie
// ============================================================

export async function getSession(): Promise<CustomerSessionPayload | null> {
    try {
        const cookieStore = await cookies();
        const cookie = cookieStore.get(COOKIE_NAME);
        if (!cookie?.value) return null;

        const secret = getSecret();
        const { payload } = await jwtVerify(cookie.value, secret);

        return payload as CustomerSessionPayload;
    } catch {
        return null;
    }
}

// ============================================================
// Clear Session — removes cookie (logout)
// ============================================================

export async function clearSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });
}

// ============================================================
// Require Session — throws if not authenticated
// ============================================================

export async function requireSession(): Promise<CustomerSessionPayload> {
    const session = await getSession();
    if (!session) {
        throw new Error('Authentication required');
    }
    return session;
}
