const DEFAULT_API_BASE_URL = 'https://api.letbuyy.store/v1';

export type WorkerJsonEnvelope<TData> = {
    success?: boolean;
    data?: TData;
    error?: string | {
        code?: string;
        message?: string;
    };
    message?: string;
};

function getPublicApiBaseUrl() {
    const configuredUrl = (
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

export function workerErrorMessage(
    payload: WorkerJsonEnvelope<unknown>,
    fallback: string,
): string {
    if (typeof payload.error === 'string') return payload.error;
    if (payload.error?.message) return payload.error.message;
    if (payload.message) return payload.message;
    return fallback;
}

export async function storefrontWorkerFetch(
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
        `${getPublicApiBaseUrl()}/storefront/${encodeURIComponent(subdomain)}${cleanPath}`,
        {
            ...init,
            headers,
            cache: init.cache || 'no-store',
        },
    );
}

export async function readWorkerJson<TData>(
    response: Response,
): Promise<WorkerJsonEnvelope<TData>> {
    return response.json().catch(() => ({})) as Promise<WorkerJsonEnvelope<TData>>;
}
