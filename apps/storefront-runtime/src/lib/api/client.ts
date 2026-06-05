import 'server-only';
import { cookies } from 'next/headers';
import {
    createLetbuyyApiClient,
    type LetbuyyApiClient,
} from '@letbuyy/api-client';
import {
    getLetbuyyInternalAuthSecret,
    hmacSha256Hex,
    LETBUYY_CUSTOMER_SESSION_COOKIE,
} from '@letbuyy/auth-core';

const DEFAULT_API_BASE_URL = 'https://api.letbuyy.store/v1';

type StorefrontApiFetchInit = RequestInit & {
    next?: {
        revalidate?: number | false;
        tags?: string[];
    };
};

export function storefrontReadInit(revalidate: number, tags: string[] = []): StorefrontApiFetchInit {
    return {
        next: {
            revalidate,
            tags,
        },
    };
}

function getApiBaseUrl() {
    const configuredUrl = (
        process.env.LETBUYY_API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        DEFAULT_API_BASE_URL
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

export async function storefrontApiFetch(path: string, init: StorefrontApiFetchInit = {}) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const headers = new Headers(init.headers);

    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    headers.set('X-Client', 'storefront-web');
    headers.set('X-Request-ID', headers.get('X-Request-ID') || crypto.randomUUID());
    if (cleanPath.startsWith('/storefront/customer/') && !headers.has('X-LetBuyy-Customer-Session')) {
        const cookieStore = await cookies();
        const customerSession = cookieStore.get(LETBUYY_CUSTOMER_SESSION_COOKIE)?.value;
        if (customerSession) {
            headers.set('X-LetBuyy-Customer-Session', customerSession);
        }
    }
    if (isStorefrontInternalOnlyPath(cleanPath)) {
        await signStorefrontInternalRequest(headers);
    }

    const requestInit: StorefrontApiFetchInit = {
        ...init,
        headers,
    };

    if (!requestInit.cache && !requestInit.next) {
        requestInit.cache = 'no-store';
    }

    return fetch(`${getApiBaseUrl()}${cleanPath}`, requestInit);
}

function isStorefrontInternalOnlyPath(path: string): boolean {
    return path === '/storefront/customer/by-email'
        || path === '/storefront/customer/status'
        || path === '/storefront/customer/password'
        || path === '/storefront/customer/login-success'
        || path === '/storefront/customer/order-credential'
        || path === '/storefront/customer/order-credential/login'
        || path === '/storefront/customer/order-credential/login-success'
        || path === '/storefront/customer/order-stats'
        || /^\/storefront\/[^/]+\/orders\/contact$/.test(path);
}

async function signStorefrontInternalRequest(headers: Headers): Promise<void> {
    const secret = getLetbuyyInternalAuthSecret({
        INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
        AUTH_SECRET: process.env.AUTH_SECRET,
    });

    if (!secret) return;

    const app = 'storefront';
    const timestamp = Date.now().toString();
    const signature = await hmacSha256Hex(secret, `app.${app}.${timestamp}`);
    headers.set('X-LetBuyy-Internal-App', app);
    headers.set('X-LetBuyy-Internal-Timestamp', timestamp);
    headers.set('X-LetBuyy-Internal-Signature', signature);
}

export function createStorefrontApiClient(defaultInit: StorefrontApiFetchInit = {}): LetbuyyApiClient {
    const baseUrl = getApiBaseUrl();

    return createLetbuyyApiClient({
        baseUrl,
        fetch: async (input, init) => storefrontApiFetch(apiClientInputToStorefrontApiPath(input, baseUrl), {
            ...defaultInit,
            ...init,
            headers: mergeHeaders(defaultInit.headers, init?.headers),
        }),
    });
}

export class StorefrontApiRequestError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly payload: unknown
    ) {
        super(message);
        this.name = 'StorefrontApiRequestError';
    }
}

export async function internalStorefrontApiFetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.LETBUYY_INTERNAL_API_SECRET;

    if (internalSecret) {
        headers.set('X-Internal-API-Secret', internalSecret);
    }

    return storefrontApiFetch(path, {
        ...init,
        headers,
    });
}

export async function readStorefrontApiJson(response: Response) {
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            payload?.error?.message ||
            payload?.message ||
            `Storefront API request failed with status ${response.status}`;
        throw new StorefrontApiRequestError(message, response.status, payload);
    }

    return payload;
}

function mergeHeaders(base: HeadersInit | undefined, override: HeadersInit | undefined): Headers {
    const headers = new Headers(base);

    if (override) {
        new Headers(override).forEach((value, key) => headers.set(key, value));
    }

    return headers;
}

function apiClientInputToStorefrontApiPath(input: RequestInfo | URL, baseUrl: string): string {
    const rawUrl = input instanceof Request ? input.url : input.toString();
    const url = new URL(rawUrl);
    const base = new URL(baseUrl);
    const basePath = base.pathname.replace(/\/$/, '');
    const pathname = basePath && url.pathname.startsWith(basePath)
        ? url.pathname.slice(basePath.length) || '/'
        : url.pathname;

    return `${pathname}${url.search}`;
}
