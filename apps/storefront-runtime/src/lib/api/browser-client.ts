import {
    apiClientInputToLetbuyyApiPath,
    resolveLetbuyyApiBaseUrl,
} from '@letbuyy/api-client';

export type StorefrontApiJsonEnvelope<TData> = {
    success?: boolean;
    data?: TData;
    error?: string | {
        code?: string;
        message?: string;
    };
    message?: string;
};

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
    const headers = new Headers(init.headers);

    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    headers.set('X-Client', 'storefront-web');
    headers.set('X-Request-ID', headers.get('X-Request-ID') || crypto.randomUUID());

    return fetch(
        storefrontBrowserProxyPath(subdomain, path),
        {
            ...init,
            headers,
            cache: init.cache || 'no-store',
        },
    );
}

function storefrontBrowserProxyPath(subdomain: string, inputPath: string): string {
    const sameOriginBaseUrl = resolveLetbuyyApiBaseUrl([browserOrigin()], {
        requireConfigured: true,
        errorMessage: 'Storefront browser API calls require a browser origin.',
        includeVersionPath: false,
    });
    const apiPath = apiClientInputToLetbuyyApiPath(
        new URL(inputPath.startsWith('/') ? inputPath : `/${inputPath}`, sameOriginBaseUrl),
        sameOriginBaseUrl,
    );

    return `/api/storefront/${encodeURIComponent(subdomain)}${apiPath}`;
}

function browserOrigin(): string {
    if (typeof window === 'undefined') {
        throw new Error('Storefront browser API calls require a browser origin.');
    }

    return window.location.origin;
}

export async function readStorefrontApiJson<TData>(
    response: Response,
): Promise<StorefrontApiJsonEnvelope<TData>> {
    return response.json().catch(() => ({})) as Promise<StorefrontApiJsonEnvelope<TData>>;
}
