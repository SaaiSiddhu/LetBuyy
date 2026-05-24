import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const DEFAULT_WORKER_BASE_URL = 'http://localhost:8787/v1';
const INTERNAL_AUTH_MAX_BODY_BYTES = 1_000_000;
const textEncoder = new TextEncoder();

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

function getInternalAuthSecret(): string {
    return process.env.INTERNAL_API_SECRET || process.env.AUTH_SECRET || '';
}

function bytesToHex(bytes: ArrayBuffer): string {
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
    return bytesToHex(signature);
}

export async function appStoreWorkerFetch(path: string, init: WorkerFetchInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('lb_session')?.value;

    if (init.requireSession && !sessionToken) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (sessionToken) {
        const secret = getInternalAuthSecret();
        if (!secret) {
            return new Response(JSON.stringify({ error: { code: 'SERVER_MISCONFIGURED', message: 'Internal auth secret is not configured' } }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const timestamp = Date.now().toString();
        const payload = `session.${sessionToken}.${timestamp}`;
        const signature = await hmacSha256Hex(secret, payload);

        headers.set('X-LetBuyy-Internal-Session-Token', sessionToken);
        headers.set('X-LetBuyy-Internal-Timestamp', timestamp);
        headers.set('X-LetBuyy-Internal-Signature', signature);
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

export async function proxyWorkerJson(response: Response): Promise<NextResponse> {
    const contentType = response.headers.get('Content-Type') || '';
    const payload = contentType.includes('application/json')
        ? await response.json()
        : { error: { code: 'UPSTREAM_ERROR', message: await response.text() } };

    return NextResponse.json(payload, { status: response.status });
}
