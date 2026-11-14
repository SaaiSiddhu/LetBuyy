import {
    LETBUYY_PRODUCTION_API_BASE_URL,
    createLetbuyyApiClient,
    LetbuyyApiError,
    resolveLetbuyyApiBaseUrl,
    type HttpMethod,
    type QueryValue,
} from '@letbuyy/api-client';
export { formatIndiaDateTime as formatDateTime } from '@letbuyy/ui/formatting';

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
    status?: number;
    code?: string;
};

type ConsoleApiRequest = {
    query?: Record<string, QueryValue>;
    method?: HttpMethod;
    body?: unknown;
    /** Server-only forwarding of the real cookie, never a typed actor/MFA flag. */
    sessionToken?: string;
    previousSessionToken?: string;
    idempotencyKey?: string;
};

export function consoleApiBaseUrl(): string {
    return resolveLetbuyyApiBaseUrl([
        process.env.PLATFORM_CONSOLE_API_BASE_URL ||
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL,
    ], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    });
}

export async function fetchConsoleApi<T>(
    path: string,
    input: Record<string, QueryValue> | ConsoleApiRequest = {}
): Promise<ConsoleApiResult<T>> {
    const token = process.env.PLATFORM_CONSOLE_API_TOKEN;

    if (!token) {
        return { error: 'PLATFORM_CONSOLE_API_TOKEN is not configured.' };
    }

    const inputPath = path.startsWith('/') ? path : `/${path}`;
    if (/\/(?:\.|\.\.)(?:\/|$)|%2f|%5c|\\/i.test(inputPath)) return {error:'Invalid Console API path.',status:400,code:'VALIDATION'};
    // Operations handlers expect an authenticated human, not the server bridge
    // as a user bearer. The private facade binds the actual Console session and
    // admits only the existing workspace routes; frozen services stay absent.
    const normalizedPath = /^\/operations\/(rbac|risk|runtime|oncall|postmortems|marketplace-listings|support)(?:\/|$)/.test(inputPath)
        ? inputPath.replace(/^\/operations/, '/internal/console/operator') : inputPath;
    const request = 'query' in input || 'method' in input || 'body' in input || 'sessionToken' in input
        ? input as ConsoleApiRequest
        : { query: input as Record<string, QueryValue> };
    let sessionToken = request.sessionToken;
    if (sessionToken === undefined) {
        // This module also exports formatting/types. Resolve Next's request-only
        // API inside the server call, not while a shared export is imported.
        const { cookies } = await import('next/headers');
        const { CONSOLE_SESSION_COOKIE } = await import('./console-session');
        sessionToken = (await cookies()).get(CONSOLE_SESSION_COOKIE)?.value;
    }
    const api = createLetbuyyApiClient({
        baseUrl: consoleApiBaseUrl(),
        token,
        headers: {
            'X-Request-ID': `admin-web-${Date.now()}`,
            ...(request.idempotencyKey ? {'Idempotency-Key':request.idempotencyKey} : {}),
            ...(sessionToken ? { 'X-Platform-Console-Session': sessionToken } : {}),
            ...(request.previousSessionToken ? { 'X-Platform-Console-Previous-Session': request.previousSessionToken } : {}),
        },
        fetch: (url, init) => fetch(url, { ...init, cache: 'no-store',
            signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) }),
    });

    try {
        const payload = await api.request<T>(normalizedPath, {
            method: request.method,
            query: request.query,
            body: request.body,
            idempotencyKey: request.idempotencyKey,
        });

        return { data: payload };
    } catch (error) {
        if (error instanceof LetbuyyApiError) {
            return { error: error.message || `Console API returned HTTP ${error.status}.`, status: error.status, code: error.code };
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
    return Number.isSafeInteger(value) && value > 0 && value <= 10000 ? value : 1;
}

export function formatMoneyFromPaise(value: number | string | null | undefined, currency = 'INR'): string {
    const amount = Number(value || 0) / 100;

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}
