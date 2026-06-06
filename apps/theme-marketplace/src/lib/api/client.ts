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
    const headers = new Headers();
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value;

    if (options.requireSession && !sessionToken) {
        throw new Error('Authentication required');
    }

    if (sessionToken) {
        const headerPlan = await createLetbuyyInternalSessionHeaders(
            sessionToken,
            getLetbuyyInternalAuthSecret({
                INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
                AUTH_SECRET: process.env.AUTH_SECRET,
            }),
        );

        if (!headerPlan.ok || !headerPlan.headers) {
            throw new Error(headerPlan.reason || 'Authentication required');
        }

        Object.entries(headerPlan.headers).forEach(([key, value]) => headers.set(key, value));
    }

    return createLetbuyyApiClient({
        baseUrl: themeMarketplaceApiBaseUrl(),
        apiVersionPath: '/v1',
        headers,
    });
}
