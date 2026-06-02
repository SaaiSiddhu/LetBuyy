'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AdminAppBridgeSession } from '@letbuyy/shared-types'
import { MaterialIcon } from '@letbuyy/ui'

interface EmbeddedAppBridgeClientProps {
    session: AdminAppBridgeSession
    store: string
}

type ToastTone = 'info' | 'success' | 'warning' | 'error'

interface BridgeToast {
    message: string
    tone: ToastTone
}

type BridgeApiRequest = {
    method?: string
    path?: string
    body?: unknown
}

type BridgeMessage = {
    type?: string
    requestId?: string
    payload?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function boundedHeight(value: unknown) {
    const height = Number(value)
    if (!Number.isFinite(height)) return 720
    return Math.min(Math.max(Math.round(height), 480), 1400)
}

function normalizeApiRequest(payload: unknown): BridgeApiRequest | null {
    if (!isRecord(payload)) return null
    return {
        method: typeof payload.method === 'string' ? payload.method.toUpperCase() : 'GET',
        path: typeof payload.path === 'string' ? payload.path : undefined,
        body: payload.body,
    }
}

function normalizeBridgePath(rawPath: string | undefined) {
    if (!rawPath) return null
    if (/^https?:\/\//i.test(rawPath) || rawPath.includes('..') || rawPath.includes('//')) return null

    const normalized = rawPath.startsWith('/')
        ? rawPath
        : `/${rawPath.replace(/^\/+/, '')}`
    const path = normalized.startsWith('/v1/') ? normalized.slice(3) : normalized
    const allowedPrefixes = ['/products', '/orders', '/customers', '/themes', '/storefront']

    if (allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`))) {
        return path
    }
    return null
}

export default function EmbeddedAppBridgeClient({ session, store }: EmbeddedAppBridgeClientProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [height, setHeight] = useState(720)
    const [isReady, setReady] = useState(false)
    const [toast, setToast] = useState<BridgeToast | null>(null)
    const context = useMemo(() => ({
        store,
        store_id: session.bridge.store_id,
        installation_id: session.bridge.installation_id,
        app_id: session.bridge.app_id,
        api_base_url: session.bridge.api_base_url,
        capabilities: session.bridge.capabilities,
    }), [session.bridge.api_base_url, session.bridge.app_id, session.bridge.capabilities, session.bridge.installation_id, session.bridge.store_id, store])

    useEffect(() => {
        if (!toast) return undefined
        const timeout = window.setTimeout(() => setToast(null), 3200)
        return () => window.clearTimeout(timeout)
    }, [toast])

    useEffect(() => {
        function postToApp(message: Record<string, unknown>) {
            iframeRef.current?.contentWindow?.postMessage(message, session.embed.origin)
        }

        async function handleApiRequest(requestId: string | undefined, payload: unknown) {
            if (!requestId) return

            const request = normalizeApiRequest(payload)
            const path = normalizeBridgePath(request?.path)

            if (!request || !path || request.method !== 'GET') {
                postToApp({
                    type: 'letbuyy:bridge.api.response',
                    requestId,
                    payload: {
                        ok: false,
                        status: 400,
                        error: 'Only scoped gateway GET requests are allowed by the admin app bridge.',
                    },
                })
                return
            }

            try {
                const response = await fetch(`${session.bridge.api_base_url}/app-store/bridge/fetch`, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        Authorization: `${session.bridge.token_type} ${session.bridge.access_token}`,
                    },
                    body: JSON.stringify({
                        method: request.method,
                        path,
                        store_id: session.bridge.store_id,
                    }),
                })
                const envelope = await response.json().catch(() => null)
                const bridgePayload = envelope?.data || envelope

                postToApp({
                    type: 'letbuyy:bridge.api.response',
                    requestId,
                    payload: {
                        ok: response.ok && bridgePayload?.ok !== false,
                        status: typeof bridgePayload?.status === 'number' ? bridgePayload.status : response.status,
                        data: bridgePayload?.data ?? bridgePayload,
                        error: bridgePayload?.error,
                    },
                })
            } catch (error) {
                postToApp({
                    type: 'letbuyy:bridge.api.response',
                    requestId,
                    payload: {
                        ok: false,
                        status: 500,
                        error: error instanceof Error ? error.message : 'Bridge request failed',
                    },
                })
            }
        }

        function onMessage(event: MessageEvent<BridgeMessage>) {
            if (event.origin !== session.embed.origin) return
            if (event.source !== iframeRef.current?.contentWindow) return

            const message = event.data
            if (!message || typeof message.type !== 'string' || !message.type.startsWith('letbuyy:bridge.')) return

            if (message.type === 'letbuyy:bridge.ready') {
                setReady(true)
                postToApp({
                    type: 'letbuyy:bridge.context',
                    payload: context,
                })
                return
            }

            if (message.type === 'letbuyy:bridge.resize') {
                const payload = isRecord(message.payload) ? message.payload : {}
                setHeight(boundedHeight(payload.height))
                return
            }

            if (message.type === 'letbuyy:bridge.toast') {
                const payload = isRecord(message.payload) ? message.payload : {}
                setToast({
                    message: typeof payload.message === 'string' ? payload.message : 'App notification',
                    tone: payload.tone === 'success' || payload.tone === 'warning' || payload.tone === 'error' ? payload.tone : 'info',
                })
                return
            }

            if (message.type === 'letbuyy:bridge.api.request') {
                void handleApiRequest(message.requestId, message.payload)
            }
        }

        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [context, session.bridge.access_token, session.bridge.api_base_url, session.bridge.store_id, session.bridge.token_type, session.embed.origin, store])

    return (
        <section className="admin-app-embed" aria-label={session.embed.title}>
            <header className="admin-app-embed__header">
                <div>
                    <p className="admin-app-embed__eyebrow">Installed app</p>
                    <h1>{session.embed.title}</h1>
                </div>
                <div className={`admin-app-embed__status ${isReady ? 'ready' : ''}`}>
                    <MaterialIcon name={isReady ? 'verified' : 'sync'} />
                    {isReady ? 'Bridge connected' : 'Connecting'}
                </div>
            </header>

            <div className="admin-app-embed__frame-shell">
                <iframe
                    ref={iframeRef}
                    src={session.embed.url}
                    title={session.embed.title}
                    className="admin-app-embed__frame"
                    sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
                    height={height}
                />
            </div>

            {toast && (
                <div className={`admin-app-embed__toast ${toast.tone}`} role="status">
                    {toast.message}
                </div>
            )}
        </section>
    )
}
