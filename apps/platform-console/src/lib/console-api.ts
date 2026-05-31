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

type ConsoleApiError = {
    error?: {
        code?: string;
        message?: string;
    };
};

type ConsoleApiResult<T> = {
    data?: T;
    error?: string;
};

type QueryValue = string | number | boolean | null | undefined;

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
    query: Record<string, QueryValue> = {}
): Promise<ConsoleApiResult<T>> {
    const token = process.env.PLATFORM_CONSOLE_API_TOKEN;

    if (!token) {
        return { error: 'PLATFORM_CONSOLE_API_TOKEN is not configured.' };
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${consoleApiBaseUrl()}${normalizedPath}`);

    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
    }

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-Request-ID': `platform-console-${Date.now()}`,
            },
            cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as T & ConsoleApiError;

        if (!response.ok) {
            return {
                error: payload.error?.message || payload.error?.code || `Console API returned HTTP ${response.status}.`,
            };
        }

        if (payload.error) {
            return { error: payload.error.message || payload.error.code || 'Console API returned an error.' };
        }

        return { data: payload };
    } catch (error) {
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
