import {
    LETBUYY_PRODUCTION_API_BASE_URL,
    LetbuyyApiError,
    createLetbuyyApiClient,
    resolveLetbuyyApiBaseUrl,
    type LetbuyyApiClient,
} from '@letbuyy/api-client';
import {
    LETBUYY_MERCHANT_SESSION_COOKIE,
    createLetbuyyInternalSessionHeaders,
    getLetbuyyInternalAuthSecret,
} from '@letbuyy/auth-core';
import { cookies } from 'next/headers';

interface PlatformOperationsApiOptions {
    requireSession?: boolean;
}

function platformOperationsApiBaseUrl(): string {
    const configuredApiUrl =
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL;

    if (!configuredApiUrl && process.env.NODE_ENV !== 'production') {
        throw new Error('Platform operations API base URL is not configured. Set LETBUYY_API_URL or NEXT_PUBLIC_API_URL for this environment.');
    }

    return resolveLetbuyyApiBaseUrl([configuredApiUrl], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
        includeVersionPath: false,
    });
}

export async function createPlatformOperationsApiClient(
    options: PlatformOperationsApiOptions = {},
): Promise<LetbuyyApiClient> {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value;
    const headers = new Headers();

    if (options.requireSession && !sessionToken) {
        throw new LetbuyyApiError({
            status: 401,
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
        });
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
            throw new LetbuyyApiError({
                status: headerPlan.status === 'misconfigured' ? 500 : 401,
                code: headerPlan.status === 'misconfigured' ? 'SERVER_MISCONFIGURED' : 'UNAUTHORIZED',
                message: headerPlan.reason || 'Authentication required',
            });
        }

        Object.entries(headerPlan.headers).forEach(([key, value]) => headers.set(key, value));
    }

    return createLetbuyyApiClient({
        baseUrl: platformOperationsApiBaseUrl(),
        apiVersionPath: '/v1',
        headers,
    });
}
