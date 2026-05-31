import { cookies } from 'next/headers';
import {
    LETBUYY_MERCHANT_SESSION_COOKIE,
    createLetbuyyInternalSessionHeaders,
    getLetbuyyInternalAuthSecret,
} from '@letbuyy/auth-core';

const DEFAULT_WORKER_BASE_URL = 'http://localhost:8787/v1';
const INTERNAL_AUTH_MAX_BODY_BYTES = 1_000_000;

interface WorkerFetchInit extends RequestInit {
    requireSession?: boolean;
}

function getWorkerBaseUrl(): string {
    const configuredUrl = (
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL ||
        DEFAULT_WORKER_BASE_URL
    ).replace(/\/$/, '');

    try {
        const url = new URL(configuredUrl);
        const path = url.pathname.replace(/\/$/, '');

        if (path === '' || path === '/') {
            url.pathname = '/v1';
            return url.toString().replace(/\/$/, '');
        }

        if (!path.endsWith('/v1')) {
            url.pathname = `${path}/v1`;
            return url.toString().replace(/\/$/, '');
        }
    } catch {
        if (!configuredUrl.endsWith('/v1')) {
            return `${configuredUrl}/v1`;
        }
    }

    return configuredUrl;
}

export async function themeWorkerFetch(path: string, init: WorkerFetchInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value;

    if (init.requireSession && !sessionToken) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
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
            const isMisconfigured = headerPlan.status === 'misconfigured';
            return new Response(JSON.stringify({ error: { code: isMisconfigured ? 'SERVER_MISCONFIGURED' : 'UNAUTHORIZED', message: headerPlan.reason || 'Authentication required' } }), {
                status: isMisconfigured ? 500 : 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        Object.entries(headerPlan.headers).forEach(([key, value]) => headers.set(key, value));
    }

    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const bodyLength = typeof init.body === 'string' ? init.body.length : 0;
    if (bodyLength > INTERNAL_AUTH_MAX_BODY_BYTES) {
        return new Response(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } }), {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return fetch(`${getWorkerBaseUrl()}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
    });
}
