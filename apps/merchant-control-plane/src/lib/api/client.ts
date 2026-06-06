import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
    LETBUYY_PRODUCTION_API_BASE_URL,
    LetbuyyApiError,
    apiClientInputToLetbuyyApiPath,
    createLetbuyyApiClient,
    resolveLetbuyyApiBaseUrl,
    type LetbuyyApiClient,
} from '@letbuyy/api-client'
import {
    LETBUYY_MERCHANT_SESSION_COOKIE,
    createLetbuyyInternalSessionHeaders,
    getLetbuyyInternalAuthSecret,
} from '@letbuyy/auth-core'

interface MerchantApiFetchInit extends RequestInit {
    requireSession?: boolean
}

export class MerchantApiRequestError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly payload: unknown
    ) {
        super(message)
        this.name = 'MerchantApiRequestError'
    }
}

function merchantApiBaseUrl() {
    return resolveLetbuyyApiBaseUrl([
        process.env.LETBUYY_API_BASE_URL ||
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_URL,
    ], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    })
}

export async function merchantApiFetch(path: string, init: MerchantApiFetchInit = {}) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    const headers = new Headers(init.headers)
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value

    if (init.requireSession && !sessionToken) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json')
    }
    headers.set('X-Client', 'admin-web')
    headers.set('X-Request-ID', headers.get('X-Request-ID') || crypto.randomUUID())

    if (sessionToken) {
        const headerPlan = await createLetbuyyInternalSessionHeaders(
            sessionToken,
            getLetbuyyInternalAuthSecret({
                INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
                AUTH_SECRET: process.env.AUTH_SECRET,
            }),
        )

        if (!headerPlan.ok || !headerPlan.headers) {
            const isMisconfigured = headerPlan.status === 'misconfigured'
            return new Response(JSON.stringify({ error: { code: isMisconfigured ? 'SERVER_MISCONFIGURED' : 'UNAUTHORIZED', message: headerPlan.reason || 'Authentication required' } }), {
                status: isMisconfigured ? 500 : 401,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        Object.entries(headerPlan.headers).forEach(([key, value]) => headers.set(key, value))
    }

    return fetch(`${merchantApiBaseUrl()}${cleanPath}`, {
        ...init,
        headers,
        cache: 'no-store',
    })
}

export function createMerchantApiClient(): LetbuyyApiClient {
    const baseUrl = merchantApiBaseUrl()

    return createLetbuyyApiClient({
        baseUrl,
        fetch: async (input, init) => merchantApiFetch(apiClientInputToLetbuyyApiPath(input, baseUrl), {
            ...init,
            requireSession: true,
        }),
    })
}

export async function readMerchantApiJson(response: Response) {
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
        const message =
            payload?.error?.message ||
            payload?.message ||
            `Merchant API request failed with status ${response.status}`
        throw new MerchantApiRequestError(message, response.status, payload)
    }

    return payload
}

export function merchantApiErrorResponse(error: unknown, fallbackMessage = 'Internal server error') {
    if (error instanceof LetbuyyApiError) {
        const payload = error.body && typeof error.body === 'object'
            ? error.body
            : { error: { code: error.code, message: error.message } }
        return NextResponse.json(payload, { status: error.status })
    }

    if (error instanceof MerchantApiRequestError) {
        const payload = error.payload && typeof error.payload === 'object'
            ? error.payload
            : { error: { code: 'MERCHANT_API_REQUEST_FAILED', message: error.message } }
        return NextResponse.json(payload, { status: error.status })
    }

    return NextResponse.json(
        {
            error: {
                code: 'INTERNAL_ERROR',
                message: fallbackMessage,
            },
        },
        { status: 500 }
    )
}
