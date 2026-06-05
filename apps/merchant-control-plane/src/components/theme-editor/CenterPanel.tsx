'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MaterialIcon } from '@letbuyy/ui'

interface CenterPanelProps {
    storeName: string
    viewport: 'desktop' | 'tablet' | 'mobile'
    previewToken: string | null
    previewError: string | null
    isPreviewRefreshing: boolean
    selectedSectionId: string | null
    onSelectSection?: (sectionId: string) => void
}

function getStorefrontBaseUrl() {
    const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, '')
    if (configured) return configured

    return 'https://storefront.staging.letbuyy.store'
}

export default function CenterPanel({
    storeName,
    viewport,
    previewToken,
    previewError,
    isPreviewRefreshing,
    selectedSectionId,
    onSelectSection,
}: CenterPanelProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const storefrontBaseUrl = getStorefrontBaseUrl()
    const previewUrl = useMemo(() => {
        if (!storefrontBaseUrl || !storeName) return ''

        const url = new URL('/preview', storefrontBaseUrl)
        url.searchParams.set('subdomain', storeName)
        url.searchParams.set('editor', '1')
        url.searchParams.set('viewport', viewport)
        if (previewToken) url.searchParams.set('theme_preview_token', previewToken)
        return url.toString()
    }, [previewToken, storefrontBaseUrl, storeName, viewport])

    useEffect(() => {
        if (!iframeRef.current?.contentWindow || !previewUrl) return
        iframeRef.current.contentWindow.postMessage(
            {
                type: 'LETBUYY_THEME_EDITOR_SELECTION',
                selectedSectionId,
            },
            new URL(previewUrl).origin
        )
    }, [previewUrl, selectedSectionId])

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const message = event.data && typeof event.data === 'object'
                ? event.data as { type?: unknown; sectionId?: unknown }
                : null
            if (message?.type !== 'letbuyy:theme-editor:section-select') return
            if (typeof message.sectionId !== 'string' || !message.sectionId) return
            onSelectSection?.(message.sectionId)
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [onSelectSection])

    return (
        <div className="te-center-panel">
            <div className={`te-preview-frame te-preview-frame--${viewport}`}>
                <div className="te-preview-browser-bar">
                    <div className="te-preview-dots">
                        <span className="te-preview-dot te-preview-dot--red" />
                        <span className="te-preview-dot te-preview-dot--yellow" />
                        <span className="te-preview-dot te-preview-dot--green" />
                    </div>
                    <div className="te-preview-url-bar">
                        <MaterialIcon name="lock" size={14} />
                        <span className="te-preview-url">{storeName}.letbuyy.store</span>
                    </div>
                </div>

                <div className="te-preview-body te-preview-body--iframe">
                    {previewUrl ? (
                        <iframe
                            ref={iframeRef}
                            key={previewUrl}
                            title={`${storeName} storefront preview`}
                            src={previewUrl}
                            className="te-preview-iframe"
                            sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
                        />
                    ) : (
                        <div className="te-preview-state">Preparing preview…</div>
                    )}

                    {(isPreviewRefreshing || previewError) && (
                        <div className="te-preview-status" role={previewError ? 'alert' : 'status'}>
                            {previewError || 'Syncing preview…'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
