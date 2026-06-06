import {
    createLetbuyyApiClient,
    LetbuyyApiError,
    type HttpMethod,
    type LetbuyyRequestOptions,
} from '@letbuyy/api-client'
import {
    createLetbuyyInternalSessionHeaders,
    getLetbuyyInternalAuthSecret,
    hmacSha256Hex,
} from '@letbuyy/auth-core'
import { getSessionCookie } from '../auth/cookies'

const DEFAULT_PRODUCTION_API_BASE_URL = 'https://api.letbuyy.store/v1'

interface IdentityApiRequestInit extends RequestInit {
    requireSession?: boolean
    sessionToken?: string
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
        return 'Auth service is not configured locally. Set INTERNAL_API_SECRET or AUTH_SECRET for the identity app and API worker, then restart the dev server.'
    }

    return fallback
}

function getApiBaseUrl(): string {
    const configuredApiUrl =
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL

    if (!configuredApiUrl && process.env.NODE_ENV !== 'production') {
        throw new Error('Identity API base URL is not configured. Set LETBUYY_API_URL or NEXT_PUBLIC_API_URL for this environment.')
    }

    const configuredUrl = (configuredApiUrl || DEFAULT_PRODUCTION_API_BASE_URL).replace(/\/$/, '')

    try {
        const url = new URL(configuredUrl)
        const path = url.pathname.replace(/\/$/, '')

        if (path === '' || path === '/') {
            url.pathname = '/v1'
            return url.toString().replace(/\/$/, '')
        }

        if (!path.endsWith('/v1')) {
            url.pathname = `${path}/v1`
            return url.toString().replace(/\/$/, '')
        }
    } catch {
        if (!configuredUrl.endsWith('/v1')) {
            return `${configuredUrl}/v1`
        }
    }

    return configuredUrl
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
        AUTH_SECRET: process.env.AUTH_SECRET,
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
        const timestamp = Date.now().toString()
        const app = 'accounts'
        const payload = `app.${app}.${timestamp}`
        const signature = await hmacSha256Hex(secret, payload)

        headers.set('X-LetBuyy-Internal-App', app)
        headers.set('X-LetBuyy-Internal-Timestamp', timestamp)
        headers.set('X-LetBuyy-Internal-Signature', signature)
    }

    const api = createLetbuyyApiClient({
        baseUrl: getApiBaseUrl(),
        headers,
    })

    const requestOptions: LetbuyyRequestOptions = {
        method: init.method as HttpMethod | undefined,
        body: parseRequestBody(init.body),
        signal: init.signal || undefined,
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
