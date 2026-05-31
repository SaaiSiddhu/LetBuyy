import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
    LetbuyyApiError,
    createLetbuyyApiClient,
    type LetbuyyApiClient,
} from '@letbuyy/api-client'

const DEFAULT_API_BASE_URL = 'https://api.letbuyy.store/v1'
const textEncoder = new TextEncoder()

interface WorkerFetchInit extends RequestInit {
    requireSession?: boolean
}

export class WorkerRequestError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly payload: unknown
    ) {
        super(message)
        this.name = 'WorkerRequestError'
    }
}

function getApiBaseUrl() {
    const configuredUrl = (
        process.env.LETBUYY_API_BASE_URL ||
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        DEFAULT_API_BASE_URL
    ).replace(/\/$/, '')

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

function getInternalAuthSecret(): string {
    return process.env.INTERNAL_API_SECRET || process.env.AUTH_SECRET || ''
}

function bytesToHex(bytes: ArrayBuffer): string {
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload))
    return bytesToHex(signature)
}

export async function workerFetch(path: string, init: WorkerFetchInit = {}) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    const headers = new Headers(init.headers)
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('lb_session')?.value

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
        const secret = getInternalAuthSecret()
        if (!secret) {
            return new Response(JSON.stringify({ error: { code: 'SERVER_MISCONFIGURED', message: 'Internal auth secret is not configured' } }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const timestamp = Date.now().toString()
        const payload = `session.${sessionToken}.${timestamp}`
        const signature = await hmacSha256Hex(secret, payload)

        headers.set('X-LetBuyy-Internal-Session-Token', sessionToken)
        headers.set('X-LetBuyy-Internal-Timestamp', timestamp)
        headers.set('X-LetBuyy-Internal-Signature', signature)
    }

    return fetch(`${getApiBaseUrl()}${cleanPath}`, {
        ...init,
        headers,
        cache: 'no-store',
    })
}

export function createWorkerApiClient(): LetbuyyApiClient {
    const baseUrl = getApiBaseUrl()

    return createLetbuyyApiClient({
        baseUrl,
        fetch: async (input, init) => workerFetch(apiClientInputToWorkerPath(input, baseUrl), {
            ...init,
            requireSession: true,
        }),
    })
}

export async function readWorkerJson(response: Response) {
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
        const message =
            payload?.error?.message ||
            payload?.message ||
            `Worker request failed with status ${response.status}`
        throw new WorkerRequestError(message, response.status, payload)
    }

    return payload
}

export function workerErrorResponse(error: unknown, fallbackMessage = 'Internal server error') {
    if (error instanceof LetbuyyApiError) {
        const payload = error.body && typeof error.body === 'object'
            ? error.body
            : { error: { code: error.code, message: error.message } }
        return NextResponse.json(payload, { status: error.status })
    }

    if (error instanceof WorkerRequestError) {
        const payload = error.payload && typeof error.payload === 'object'
            ? error.payload
            : { error: { code: 'WORKER_REQUEST_FAILED', message: error.message } }
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

function apiClientInputToWorkerPath(input: RequestInfo | URL, baseUrl: string): string {
    const rawUrl = input instanceof Request ? input.url : input.toString()
    const url = new URL(rawUrl)
    const base = new URL(baseUrl)
    const basePath = base.pathname.replace(/\/$/, '')
    const pathname = basePath && url.pathname.startsWith(basePath)
        ? url.pathname.slice(basePath.length) || '/'
        : url.pathname

    return `${pathname}${url.search}`
}
