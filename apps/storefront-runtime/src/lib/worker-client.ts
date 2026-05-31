import 'server-only';

const DEFAULT_API_BASE_URL = 'https://api.letbuyy.store/v1';

type WorkerFetchInit = RequestInit & {
    next?: {
        revalidate?: number | false;
        tags?: string[];
    };
};

export function storefrontReadInit(revalidate: number, tags: string[] = []): WorkerFetchInit {
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

export async function workerFetch(path: string, init: WorkerFetchInit = {}) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const headers = new Headers(init.headers);

    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    headers.set('X-Client', 'storefront-web');
    headers.set('X-Request-ID', headers.get('X-Request-ID') || crypto.randomUUID());

    const requestInit: WorkerFetchInit = {
        ...init,
        headers,
    };

    if (!requestInit.cache && !requestInit.next) {
        requestInit.cache = 'no-store';
    }

    return fetch(`${getApiBaseUrl()}${cleanPath}`, requestInit);
}

export class WorkerRequestError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly payload: unknown
    ) {
        super(message);
        this.name = 'WorkerRequestError';
    }
}

export async function internalWorkerFetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.LETBUYY_INTERNAL_API_SECRET;

    if (internalSecret) {
        headers.set('X-Internal-API-Secret', internalSecret);
    }

    return workerFetch(path, {
        ...init,
        headers,
    });
}

export async function readWorkerJson(response: Response) {
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            payload?.error?.message ||
            payload?.message ||
            `Worker request failed with status ${response.status}`;
        throw new WorkerRequestError(message, response.status, payload);
    }

    return payload;
}
