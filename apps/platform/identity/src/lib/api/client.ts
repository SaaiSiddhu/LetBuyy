import {
    LETBUYY_PRODUCTION_API_BASE_URL,
    createLetbuyyApiClient,
    LetbuyyApiError,
    resolveLetbuyyApiBaseUrl,
    type HttpMethod,
    type LetbuyyRequestOptions,
} from '@letbuyy/api-client'
import {
    createLetbuyyInternalAppHeaders,
    createLetbuyyInternalSessionHeaders,
    getLetbuyyInternalAuthSecret,
} from '@letbuyy/auth-core'
import { getSessionCookie } from '../auth/cookies'

interface IdentityApiRequestInit extends RequestInit {
    requireSession?: boolean
    sessionToken?: string
    responseType?: 'json' | 'text'
}

interface IdentityApiErrorPayload {
    error?: string | {
        code?: string
        message?: string
    }
}

interface IdentityApiResponse<T = unknown> {
    ok: boolean
    status: number
    statusText: string
    json(): Promise<T | null>
    text(): Promise<string>
}

function responseFromPayload<T>(input: {
    ok: boolean
    status: number
    statusText: string
    payload: T | null
}): IdentityApiResponse<T> {
    return {
        ok: input.ok,
        status: input.status,
        statusText: input.statusText,
        async json() {
            return input.payload
        },
        async text() {
            return typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload)
        },
    }
}

function getApiError(payload: unknown): { code?: string; message?: string } | null {
    if (!payload || typeof payload !== 'object' || !('error' in payload)) return null

    const { error } = payload as IdentityApiErrorPayload
    if (!error) return null

    if (typeof error === 'string') return { message: error }
    return {
        code: error.code,
        message: error.message,
    }
}

export function getIdentityApiFailureMessage(payload: unknown, fallback: string): string {
    const error = getApiError(payload)

    if (process.env.NODE_ENV !== 'production' && error?.code === 'SERVER_MISCONFIGURED') {
        return 'Auth service is not configured locally. Set INTERNAL_API_SECRET for the identity app and API worker, then restart the dev server.'
    }

    return fallback
}

function identityApiBaseUrl(): string {
    const configuredApiUrl =
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL

    if (!configuredApiUrl && process.env.NODE_ENV !== 'production') {
        throw new Error('Identity API base URL is not configured. Set LETBUYY_API_URL or NEXT_PUBLIC_API_URL for this environment.')
    }

    return resolveLetbuyyApiBaseUrl([configuredApiUrl], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    })
}

function parseRequestBody(body: BodyInit | null | undefined): unknown {
    if (body === undefined || body === null) return undefined
    if (typeof body !== 'string') return body

    try {
        return JSON.parse(body)
    } catch {
        return body
    }
}

export async function identityApiRequest<T = unknown>(
    path: string,
    init: IdentityApiRequestInit = {},
): Promise<IdentityApiResponse<T>> {
    const headers = new Headers(init.headers)
    const useSessionAuth = Boolean(init.requireSession || init.sessionToken)
    const sessionToken = useSessionAuth ? init.sessionToken || await getSessionCookie() : undefined

    if (useSessionAuth && !sessionToken) {
        return responseFromPayload({
            ok: false,
            status: 401,
            statusText: 'Authentication required',
            payload: { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } } as T,
        })
    }

    const secret = getLetbuyyInternalAuthSecret({
        INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
        LETBUYY_INTERNAL_API_SECRET: process.env.LETBUYY_INTERNAL_API_SECRET,
    })
    if (!secret) {
        return responseFromPayload({
            ok: false,
            status: 500,
            statusText: 'Internal auth secret is not configured',
            payload: { error: { code: 'SERVER_MISCONFIGURED', message: 'Internal auth secret is not configured' } } as T,
        })
    }

    if (useSessionAuth) {
        const headerPlan = await createLetbuyyInternalSessionHeaders(sessionToken, secret)
        if (!headerPlan.ok || !headerPlan.headers) {
            return responseFromPayload({
                ok: false,
                status: 401,
                statusText: headerPlan.reason || 'Authentication required',
                payload: { error: { code: 'UNAUTHORIZED', message: headerPlan.reason || 'Authentication required' } } as T,
            })
        }

        Object.entries(headerPlan.headers).forEach(([key, value]) => headers.set(key, value))
    } else {
        const headerPlan = await createLetbuyyInternalAppHeaders({ app: 'accounts', secret })
        if (!headerPlan.ok || !headerPlan.headers) {
            return responseFromPayload({
                ok: false,
                status: 500,
                statusText: headerPlan.reason || 'Internal auth secret is not configured',
                payload: { error: { code: 'SERVER_MISCONFIGURED', message: headerPlan.reason || 'Internal auth secret is not configured' } } as T,
            })
        }

        Object.entries(headerPlan.headers).forEach(([key, value]) => headers.set(key, value))
    }

    const api = createLetbuyyApiClient({
        baseUrl: identityApiBaseUrl(),
        headers,
    })

    const requestOptions: LetbuyyRequestOptions = {
        method: init.method as HttpMethod | undefined,
        body: parseRequestBody(init.body),
        // The SDK's automatic key must not replace a durable task key supplied
        // by Accounts (store creation, MFA commands and retried completions).
        idempotencyKey: headers.get('X-Idempotency-Key') || headers.get('Idempotency-Key') || undefined,
        signal: init.signal || AbortSignal.timeout(15000),
        responseType: init.responseType,
    }

    try {
        const payload = await api.request<T>(path, requestOptions)
        return responseFromPayload({
            ok: true,
            status: 200,
            statusText: 'OK',
            payload,
        })
    } catch (error) {
        if (error instanceof LetbuyyApiError) {
            return responseFromPayload({
                ok: false,
                status: error.status,
                statusText: error.message,
                payload: error.body as T | null,
            })
        }

        throw error
    }
}
