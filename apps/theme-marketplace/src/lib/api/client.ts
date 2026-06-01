import 'server-only';
import { cookies } from 'next/headers';
import {
    LETBUYY_MERCHANT_SESSION_COOKIE,
    createLetbuyyInternalSessionHeaders,
    getLetbuyyInternalAuthSecret,
} from '@letbuyy/auth-core';
import { createLetbuyyApiClient, type LetbuyyApiClient } from '@letbuyy/api-client';

const DEFAULT_API_BASE_URL = 'http://localhost:8787';

export interface ThemeMarketplaceApiClientOptions {
    requireSession?: boolean;
}

function getApiBaseUrl(): string {
    return (
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL ||
        DEFAULT_API_BASE_URL
    ).replace(/\/$/, '');
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
        baseUrl: getApiBaseUrl(),
        apiVersionPath: '/v1',
        headers,
    });
}
