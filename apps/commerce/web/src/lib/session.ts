// ============================================================
// SESSION MANAGEMENT — JWT-based customer sessions
// Uses httpOnly cookies for security (no XSS exposure)
// ============================================================

import 'server-only';
import { cookies, headers } from 'next/headers';
import { resolveStorefrontAccessContext } from './storefront-access';
import { customerSessionMatchesRequestStore } from './customer-session-store-scope';
import {
    LETBUYY_CUSTOMER_SESSION_COOKIE,
    createHostOnlyShopperIdentityProvider,
    redeemCustomerFederationToken,
    type CustomerFederationTokenStore,
    type LetbuyyCustomerFederationRedemptionResult,
    type LetbuyyCustomerSessionPayload,
} from '@letbuyy/auth-core';

// ============================================================
// Types
// ============================================================

export type CustomerSessionPayload = LetbuyyCustomerSessionPayload;
export type CustomerFederationSessionResult = LetbuyyCustomerFederationRedemptionResult & {
    sessionToken?: string;
};

// ============================================================
// Constants
// ============================================================

const COOKIE_NAME = LETBUYY_CUSTOMER_SESSION_COOKIE;

function getSecret(): string {
    const secret = process.env.CUSTOMER_SESSION_SECRET;
    if (!secret) {
        throw new Error('[Session] CUSTOMER_SESSION_SECRET env var is required');
    }
    return secret;
}

type StorefrontSessionHeaders = { get(name: string): string | null };
type StorefrontCustomerCookieOptions = {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax';
    maxAge: number;
    path: '/';
};

interface StorefrontCustomerSessionScope {
    headers: StorefrontSessionHeaders;
    resolveStoreIdForHost: (host: string) => Promise<string | null>;
}

/** Issue the Commerce compatibility cookie only when the request host resolves to the signed store. */
export async function issueStorefrontCustomerSession(input: {
    customer: { id: string; storeId: string; email: string; fullName: string | null };
    scope: StorefrontCustomerSessionScope;
    secret: string | null | undefined;
    secure: boolean;
    setCookie: (name: string, value: string, options: StorefrontCustomerCookieOptions) => void;
}): Promise<string> {
    const matchesStore = await customerSessionMatchesRequestStore({
        headers: input.scope.headers,
        storeId: input.customer.storeId,
        resolveStoreIdForHost: input.scope.resolveStoreIdForHost,
    });
    if (!matchesStore) throw new Error('Store customer identity does not match this storefront');

    const provider = createHostOnlyShopperIdentityProvider(input.secret);
    const token = await provider.issueSessionToken(input.customer);
    input.setCookie(provider.cookie.name, token, {
        httpOnly: true,
        secure: input.secure,
        sameSite: provider.cookie.sameSite,
        maxAge: provider.cookie.ttlSeconds,
        path: provider.cookie.path,
    });
    return token;
}

/** Verify the Commerce compatibility cookie and bind its signed store to the current host. */
export async function verifyStorefrontCustomerSession(input: {
    token: string | null | undefined;
    scope: StorefrontCustomerSessionScope;
    secret: string | null | undefined;
}): Promise<CustomerSessionPayload | null> {
    const provider = createHostOnlyShopperIdentityProvider(input.secret);
    const verification = await provider.verifySessionToken(input.token);
    if (!verification.accepted || !verification.payload) return null;

    const matchesStore = await customerSessionMatchesRequestStore({
        headers: input.scope.headers,
        storeId: verification.payload.storeId,
        resolveStoreIdForHost: input.scope.resolveStoreIdForHost,
    });
    return matchesStore ? verification.payload : null;
}

function resolveStoreIdForHost(host: string): Promise<string | null> {
    return resolveStorefrontAccessContext(host).then(context => context?.site_id ?? null);
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
    const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
    const token = await issueStorefrontCustomerSession({
        customer,
        scope: { headers: requestHeaders, resolveStoreIdForHost },
        secret: getSecret(),
        secure: process.env.NODE_ENV === 'production',
        setCookie: (name, value, options) => cookieStore.set(name, value, options),
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
        const requestHeaders = await headers();
        return verifyStorefrontCustomerSession({
            token: cookie.value,
            scope: { headers: requestHeaders, resolveStoreIdForHost },
            secret: getSecret(),
        });
    } catch {
        return null;
    }
}

export async function createSessionFromFederationToken(
    token: string | null | undefined,
    tokenStore: CustomerFederationTokenStore,
): Promise<CustomerFederationSessionResult> {
    const redemption = await redeemCustomerFederationToken(token, getSecret(), tokenStore);
    if (!redemption.accepted || !redemption.customer) {
        return redemption;
    }

    const sessionToken = await createSession(redemption.customer);
    return {
        ...redemption,
        sessionToken,
    };
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
