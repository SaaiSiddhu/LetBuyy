import 'server-only';

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
import { NextResponse } from 'next/server';

interface AppMarketplaceApiOptions {
    requireSession?: boolean;
}

function getApiBaseUrl(): string {
    const base =
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL;
    if (!base) {
        throw new Error(
            'Marketplace API base URL is not configured. Set LETBUYY_API_URL (or NEXT_PUBLIC_API_URL / API_URL); refusing to fall back to a hardcoded staging host.',
        );
    }
    return base.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

export async function createAppMarketplaceApiClient(
    options: AppMarketplaceApiOptions = {},
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

export function appMarketplaceErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
    if (error instanceof LetbuyyApiError) {
        return NextResponse.json(
            error.body ?? { error: { code: error.code, message: error.message } },
            { status: error.status },
        );
    }

    return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: fallbackMessage } },
        { status: 500 },
    );
}
