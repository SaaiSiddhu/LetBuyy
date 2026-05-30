import { getSessionCookie } from '@/lib/auth/cookies'

const DEFAULT_WORKER_BASE_URL = 'http://localhost:8787/v1'
const textEncoder = new TextEncoder()

interface WorkerFetchInit extends RequestInit {
    requireSession?: boolean
    sessionToken?: string
}

interface WorkerErrorPayload {
    error?: string | {
        code?: string
        message?: string
    }
}

function getWorkerError(payload: unknown): { code?: string; message?: string } | null {
    if (!payload || typeof payload !== 'object' || !('error' in payload)) return null

    const { error } = payload as WorkerErrorPayload
    if (!error) return null

    if (typeof error === 'string') return { message: error }
    return {
        code: error.code,
        message: error.message,
    }
}

export function getAccountWorkerFailureMessage(payload: unknown, fallback: string): string {
    const error = getWorkerError(payload)

    if (process.env.NODE_ENV !== 'production' && error?.code === 'SERVER_MISCONFIGURED') {
        return 'Auth service is not configured locally. Set INTERNAL_API_SECRET or AUTH_SECRET for the identity app and API worker, then restart the dev server.'
    }

    return fallback
}

function getWorkerBaseUrl(): string {
    const configuredUrl = (
        process.env.LETBUYY_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL ||
        DEFAULT_WORKER_BASE_URL
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

export async function accountWorkerFetch(path: string, init: WorkerFetchInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    const useSessionAuth = Boolean(init.requireSession || init.sessionToken)
    const sessionToken = useSessionAuth ? init.sessionToken || await getSessionCookie() : undefined

    if (useSessionAuth && !sessionToken) {
        return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const secret = getInternalAuthSecret()
    if (!secret) {
        return new Response(JSON.stringify({ error: { code: 'SERVER_MISCONFIGURED', message: 'Internal auth secret is not configured' } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (useSessionAuth) {
        const signedSessionToken = sessionToken!
        const timestamp = Date.now().toString()
        const payload = `session.${signedSessionToken}.${timestamp}`
        const signature = await hmacSha256Hex(secret, payload)

        headers.set('X-LetBuyy-Internal-Session-Token', signedSessionToken)
        headers.set('X-LetBuyy-Internal-Timestamp', timestamp)
        headers.set('X-LetBuyy-Internal-Signature', signature)
    } else {
        const timestamp = Date.now().toString()
        const app = 'accounts'
        const payload = `app.${app}.${timestamp}`
        const signature = await hmacSha256Hex(secret, payload)

        headers.set('X-LetBuyy-Internal-App', app)
        headers.set('X-LetBuyy-Internal-Timestamp', timestamp)
        headers.set('X-LetBuyy-Internal-Signature', signature)
    }

    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }

    return fetch(`${getWorkerBaseUrl()}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
    })
}
