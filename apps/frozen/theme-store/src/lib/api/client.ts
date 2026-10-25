import 'server-only';
import { cookies } from 'next/headers';
import {
    LETBUYY_MERCHANT_SESSION_COOKIE,
    createLetbuyyInternalSessionHeaders,
    getLetbuyyInternalAuthSecret,
} from '@letbuyy/auth-core';
import { createLetbuyyApiClient, resolveLetbuyyApiBaseUrl, type LetbuyyApiClient } from '@letbuyy/api-client';

export interface ThemeMarketplaceApiClientOptions {
    requireSession?: boolean;
}

function themeMarketplaceApiBaseUrl(): string {
    return resolveLetbuyyApiBaseUrl([
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL,
    ], {
        includeVersionPath: false,
        requireConfigured: true,
        errorMessage: 'Marketplace API base URL is not configured. Set LETBUYY_API_URL (or NEXT_PUBLIC_API_URL / API_URL); refusing to fall back to a hardcoded staging host.',
    });
}

export async function createThemeMarketplaceApiClient(
    options: ThemeMarketplaceApiClientOptions = {},
): Promise<LetbuyyApiClient> {
    const baseUrl = themeMarketplaceApiBaseUrl();
    const headers = new Headers();
    let authenticatedFetch: typeof fetch | undefined;
    // Public discovery must work independently of an expired or unrelated
    // merchant session. Only authenticated operations cross the identity bridge.
    if (options.requireSession) {
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value;

        if (!sessionToken) throw new Error('Authentication required');

        const secret = getLetbuyyInternalAuthSecret({
            INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
            LETBUYY_INTERNAL_API_SECRET: process.env.LETBUYY_INTERNAL_API_SECRET,
        });
        const headerPlan = await createLetbuyyInternalSessionHeaders(sessionToken, secret);

        if (!headerPlan.ok || !headerPlan.headers) {
            throw new Error(headerPlan.reason || 'Authentication required');
        }

        const authority = new URL(baseUrl);
        if (!['http:', 'https:'].includes(authority.protocol) || authority.username || authority.password || authority.search || authority.hash) {
            throw new Error('The configured marketplace API authority is invalid');
        }
        const basePath = authority.pathname.replace(/\/+$/, '');
        const upstreamFetch = fetch;
        authenticatedFetch = async (input, init) => {
            const request = new Request(input, init);
            const target = new URL(request.url);
            if (target.origin !== authority.origin || target.username || target.password
                || (basePath && target.pathname !== basePath && !target.pathname.startsWith(`${basePath}/`))) {
                throw new Error('Authenticated marketplace requests must stay within the configured API origin and base path');
            }
            // The canonical bridge signs a single-use JTI. Never store that
            // proof in reusable SDK defaults or reuse it for library readback.
            const fresh = await createLetbuyyInternalSessionHeaders(sessionToken, secret);
            if (!fresh.ok || !fresh.headers) throw new Error(fresh.reason || 'Authentication required');
            const signedHeaders = new Headers(request.headers);
            Object.entries(fresh.headers).forEach(([key, value]) => signedHeaders.set(key, value));
            // Redirects must not forward the private bridge to another origin.
            return upstreamFetch(new Request(request, { headers: signedHeaders, redirect: 'manual' }));
        };
    }

    return createLetbuyyApiClient({
        baseUrl,
        apiVersionPath: '/v1',
        headers,
        fetch: authenticatedFetch,
    });
}
