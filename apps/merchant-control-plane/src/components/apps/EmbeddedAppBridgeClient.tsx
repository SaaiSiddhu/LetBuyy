'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    createAdminUiExtensionBridgeContext,
    createAdminUiExtensionFramePolicy,
    listEnabledAdminUiExtensions,
} from '@letbuyy/extension-host'
import type { AdminUiExtensionHostRegistration } from '@letbuyy/extension-host'
import type { AdminAppBridgeSession, AppExtensionRegistration } from '@letbuyy/shared-types'
import { MaterialIcon, useToast } from '@letbuyy/ui'

interface EmbeddedAppBridgeClientProps {
    session: AdminAppBridgeSession
    store: string
    adminExtensions?: AppExtensionRegistration[]
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

function toastVariant(tone: unknown) {
    if (tone === 'success' || tone === 'warning') return tone
    if (tone === 'error') return 'critical'
    return 'info'
}

export default function EmbeddedAppBridgeClient({ session, store, adminExtensions = [] }: EmbeddedAppBridgeClientProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const { notify } = useToast()
    const [height, setHeight] = useState(720)
    const [isReady, setReady] = useState(false)
    const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null)
    const registeredAdminExtensions = useMemo(
        () => listEnabledAdminUiExtensions(adminExtensions),
        [adminExtensions],
    )
    const activeExtension = useMemo<AdminUiExtensionHostRegistration | null>(() => {
        if (registeredAdminExtensions.length === 0) return null
        return registeredAdminExtensions.find((extension) => extension.id === selectedExtensionId)
            || registeredAdminExtensions[0]
    }, [registeredAdminExtensions, selectedExtensionId])
    const activeEmbed = activeExtension
        ? {
            title: activeExtension.title,
            label: activeExtension.title,
            url: activeExtension.url,
            origin: activeExtension.origin,
            target: activeExtension.target,
            capabilities: activeExtension.capabilities,
        }
        : session.embed
    const framePolicy = createAdminUiExtensionFramePolicy()
    const context = useMemo(() => (
        activeExtension
            ? createAdminUiExtensionBridgeContext({ session, extension: activeExtension, store })
            : {
                store,
                store_id: session.bridge.store_id,
                installation_id: session.bridge.installation_id,
                app_id: session.bridge.app_id,
                api_base_url: session.bridge.api_base_url,
                capabilities: session.bridge.capabilities,
            }
    ), [activeExtension, session, store])

    useEffect(() => {
        function postToApp(message: Record<string, unknown>) {
            iframeRef.current?.contentWindow?.postMessage(message, activeEmbed.origin)
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
            if (event.origin !== activeEmbed.origin) return
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
                notify({
                    title: typeof payload.title === 'string' ? payload.title : 'App notification',
                    description: typeof payload.message === 'string' ? payload.message : undefined,
                    variant: toastVariant(payload.tone),
                })
                return
            }

            if (message.type === 'letbuyy:bridge.api.request') {
                void handleApiRequest(message.requestId, message.payload)
            }
        }

        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [activeEmbed.origin, context, notify, session.bridge.access_token, session.bridge.api_base_url, session.bridge.store_id, session.bridge.token_type])

    return (
        <section className="admin-app-embed" aria-label={activeEmbed.title}>
            <header className="admin-app-embed__header">
                <div>
                    <p className="admin-app-embed__eyebrow">{activeExtension ? 'Admin UI extension' : 'Installed app'}</p>
                    <h1>{activeEmbed.title}</h1>
                </div>
                <div className={`admin-app-embed__status ${isReady ? 'ready' : ''}`}>
                    <MaterialIcon name={isReady ? 'verified' : 'sync'} />
                    {isReady ? 'Bridge connected' : 'Connecting'}
                </div>
            </header>

            {registeredAdminExtensions.length > 0 ? (
                <div className="mb-[var(--lb-space-4)] flex flex-wrap gap-[var(--lb-space-2)]" role="tablist" aria-label="Admin app extensions">
                    {registeredAdminExtensions.map((extension) => {
                        const selected = activeExtension?.id === extension.id
                        return (
                            <button
                                key={extension.id}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                className={`inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border px-[var(--lb-space-3)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] transition-colors duration-[var(--lb-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] ${selected ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]' : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[var(--lb-color-text-subdued)] hover:text-[var(--lb-color-text)]'}`}
                                onClick={() => {
                                    setReady(false)
                                    setSelectedExtensionId(extension.id)
                                }}
                            >
                                <MaterialIcon name="view_in_ar" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
                                {extension.title}
                            </button>
                        )
                    })}
                </div>
            ) : null}

            <div className="admin-app-embed__frame-shell">
                <iframe
                    ref={iframeRef}
                    src={activeEmbed.url}
                    title={activeEmbed.title}
                    className="admin-app-embed__frame"
                    sandbox={framePolicy.sandbox}
                    allow={framePolicy.allow}
                    referrerPolicy={framePolicy.referrerPolicy}
                    height={height}
                />
            </div>
        </section>
    )
}
