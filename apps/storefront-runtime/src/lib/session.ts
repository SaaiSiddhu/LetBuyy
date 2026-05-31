// ============================================================
// SESSION MANAGEMENT — JWT-based customer sessions
// Uses httpOnly cookies for security (no XSS exposure)
// ============================================================

import 'server-only';
import { cookies } from 'next/headers';
import {
    LETBUYY_CUSTOMER_SESSION_COOKIE,
    LETBUYY_CUSTOMER_SESSION_TTL_SECONDS,
    createCustomerSessionToken,
    verifyCustomerSessionToken,
    type LetbuyyCustomerSessionPayload,
} from '@letbuyy/auth-core';

// ============================================================
// Types
// ============================================================

export type CustomerSessionPayload = LetbuyyCustomerSessionPayload;

// ============================================================
// Constants
// ============================================================

const COOKIE_NAME = LETBUYY_CUSTOMER_SESSION_COOKIE;
const SESSION_TTL = LETBUYY_CUSTOMER_SESSION_TTL_SECONDS;

function getSecret(): string {
    const secret = process.env.CUSTOMER_SESSION_SECRET;
    if (!secret) {
        throw new Error('[Session] CUSTOMER_SESSION_SECRET env var is required');
    }
    return secret;
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
    const token = await createCustomerSessionToken(customer, getSecret());

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

        const verification = await verifyCustomerSessionToken(cookie.value, process.env.CUSTOMER_SESSION_SECRET);
        return verification.accepted && verification.payload ? verification.payload : null;
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
