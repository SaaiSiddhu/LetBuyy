import { LETBUYY_PRODUCTION_API_BASE_URL, resolveLetbuyyApiBaseUrl } from '@letbuyy/api-client';

export type StorefrontApiJsonEnvelope<TData> = {
    success?: boolean;
    data?: TData;
    error?: string | {
        code?: string;
        message?: string;
    };
    message?: string;
};

function storefrontPublicApiBaseUrl() {
    return resolveLetbuyyApiBaseUrl([
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_URL,
    ], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    });
}

export function storefrontApiErrorMessage(
    payload: StorefrontApiJsonEnvelope<unknown>,
    fallback: string,
): string {
    if (typeof payload.error === 'string') return payload.error;
    if (payload.error?.message) return payload.error.message;
    if (payload.message) return payload.message;
    return fallback;
}

export async function storefrontBrowserApiFetch(
    subdomain: string,
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const headers = new Headers(init.headers);

    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    headers.set('X-Client', 'storefront-web');
    headers.set('X-Request-ID', headers.get('X-Request-ID') || crypto.randomUUID());

    return fetch(
        `${storefrontPublicApiBaseUrl()}/storefront/${encodeURIComponent(subdomain)}${cleanPath}`,
        {
            ...init,
            headers,
            cache: init.cache || 'no-store',
        },
    );
}

export async function readStorefrontApiJson<TData>(
    response: Response,
): Promise<StorefrontApiJsonEnvelope<TData>> {
    return response.json().catch(() => ({})) as Promise<StorefrontApiJsonEnvelope<TData>>;
}
