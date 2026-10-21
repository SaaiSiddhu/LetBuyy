import 'server-only';
import { cookies,headers as currentRequestHeaders } from 'next/headers';
import {
    LETBUYY_PRODUCTION_API_BASE_URL,
    apiClientInputToLetbuyyApiPath,
    createLetbuyyApiClient,
    resolveLetbuyyApiBaseUrl,
    type LetbuyyApiClient,
} from '@letbuyy/api-client';
import { storefrontApiBaseUrlCandidates } from './base-url';
import { isStorefrontInternalOnlyPath } from './internal-only-paths';
import {
    createLetbuyyInternalAppHeaders,
    getLetbuyyInternalAuthSecret,
    LETBUYY_CUSTOMER_SESSION_COOKIE,
    LETBUYY_STOREFRONT_GATE_COOKIE,
    LETBUYY_STOREFRONT_PREVIEW_COOKIE,
} from '@letbuyy/auth-core';

export { isStorefrontInternalOnlyPath };

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

function storefrontApiBaseUrl() {
    return resolveLetbuyyApiBaseUrl(storefrontApiBaseUrlCandidates(), {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    });
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
    if(cleanPath.startsWith('/storefront/')){
        // Host-only HTTP-only visitor proofs cross only the server -> canonical
        // Gateway hop. A missing request context supplies no visitor authority.
        try{
            const jar=await cookies();
            const incoming=await currentRequestHeaders();
            for(const [cookie,header]of [[LETBUYY_STOREFRONT_GATE_COOKIE,'X-LetBuyy-Storefront-Gate'],[LETBUYY_STOREFRONT_PREVIEW_COOKIE,'X-LetBuyy-Storefront-Preview']]as const){
                const value=jar.get(cookie)?.value||incoming.get(header);if(value)headers.set(header,value);
            }
        }catch{/* anonymous requests outside an active Next request have no proof */}
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

    return fetch(`${storefrontApiBaseUrl()}${cleanPath}`, requestInit);
}

async function signStorefrontInternalRequest(headers: Headers): Promise<void> {
    const secret = getLetbuyyInternalAuthSecret({
        INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
        LETBUYY_INTERNAL_API_SECRET: process.env.LETBUYY_INTERNAL_API_SECRET,
    });

    if (!secret) return;

    const headerPlan = await createLetbuyyInternalAppHeaders({ app: 'storefront', secret });
    if (!headerPlan.ok || !headerPlan.headers) return;
    Object.entries(headerPlan.headers).forEach(([key, value]) => headers.set(key, value));
}

export function createStorefrontApiClient(defaultInit: StorefrontApiFetchInit = {}): LetbuyyApiClient {
    const baseUrl = storefrontApiBaseUrl();

    return createLetbuyyApiClient({
        baseUrl,
        fetch: async (input, init) => storefrontApiFetch(apiClientInputToLetbuyyApiPath(input, baseUrl), {
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
