import {
    LetbuyyApiError,
    createLetbuyyApiClient,
    type LetbuyyApiClient,
} from '@letbuyy/api-client';
import {
    LETBUYY_MERCHANT_SESSION_COOKIE,
    createLetbuyyInternalSessionHeaders,
    getLetbuyyInternalAuthSecret,
} from '@letbuyy/auth-core';
import { cookies } from 'next/headers';

const DEFAULT_API_BASE_URL = 'https://api.staging.letbuyy.store';

interface PlatformOperationsApiOptions {
    requireSession?: boolean;
}

function getApiBaseUrl(): string {
    return (
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL ||
        DEFAULT_API_BASE_URL
    ).replace(/\/v1\/?$/, '').replace(/\/$/, '');
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
        baseUrl: getApiBaseUrl(),
        apiVersionPath: '/v1',
        headers,
    });
}
