import {
    createLetbuyyApiClient,
    LetbuyyApiError,
    type HttpMethod,
    type QueryValue,
} from '@letbuyy/api-client';

export type ConsolePagination = {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
};

export type ConsolePaginatedResponse<T> = {
    success: true;
    data: T[];
    meta: ConsolePagination;
};

export type ConsoleDataResponse<T> = {
    success: true;
    data: T;
};

type ConsoleApiResult<T> = {
    data?: T;
    error?: string;
};

type ConsoleApiRequest = {
    query?: Record<string, QueryValue>;
    method?: HttpMethod;
    body?: unknown;
};

export function consoleApiBaseUrl(): string {
    const configured =
        process.env.PLATFORM_CONSOLE_API_BASE_URL ||
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'https://api.letbuyy.store';
    const trimmed = configured.replace(/\/+$/, '');

    return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export async function fetchConsoleApi<T>(
    path: string,
    input: Record<string, QueryValue> | ConsoleApiRequest = {}
): Promise<ConsoleApiResult<T>> {
    const token = process.env.PLATFORM_CONSOLE_API_TOKEN;

    if (!token) {
        return { error: 'PLATFORM_CONSOLE_API_TOKEN is not configured.' };
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const request = 'query' in input || 'method' in input || 'body' in input
        ? input as ConsoleApiRequest
        : { query: input as Record<string, QueryValue> };
    const api = createLetbuyyApiClient({
        baseUrl: consoleApiBaseUrl(),
        token,
        headers: {
            'X-Request-ID': `platform-console-${Date.now()}`,
        },
        fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
    });

    try {
        const payload = await api.request<T>(normalizedPath, {
            method: request.method,
            query: request.query,
            body: request.body,
        });

        return { data: payload };
    } catch (error) {
        if (error instanceof LetbuyyApiError) {
            return { error: error.message || `Console API returned HTTP ${error.status}.` };
        }

        return {
            error: error instanceof Error ? error.message : 'Console API request failed.',
        };
    }
}

export function readSearchParam(
    params: Record<string, string | string[] | undefined> | undefined,
    key: string
): string {
    const value = params?.[key];
    return Array.isArray(value) ? value[0] || '' : value || '';
}

export function readPageParam(params: Record<string, string | string[] | undefined> | undefined): number {
    const value = Number(readSearchParam(params, 'page') || 1);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
    });
}

export function formatMoneyFromPaise(value: number | string | null | undefined, currency = 'INR'): string {
    const amount = Number(value || 0) / 100;

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}
