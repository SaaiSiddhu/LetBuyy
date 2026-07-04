'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { MaterialIcon } from '@letbuyy/ui'
import { getStorefrontBaseUrl } from '@/lib/public-urls'
import {
    EDITOR_LEGACY_SELECTION_MESSAGE,
    EDITOR_SELECTION_MESSAGE,
    EDITOR_SECTION_SELECT_MESSAGE,
} from '@letbuyy/theme-engine/editor-bridge-protocol'

interface CenterPanelProps {
    storeName: string
    viewport: 'desktop' | 'tablet' | 'mobile'
    previewToken: string | null
    previewError: string | null
    isPreviewRefreshing: boolean
    selectedSectionId: string | null
    onSelectSection?: (sectionId: string) => void
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
    const iframeLoadedRef = useRef(false)
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

    // Post the current selection into the preview iframe — but ONLY after it has finished loading.
    // The iframe renders the storefront on a different origin (the storefront base URL); posting before
    // navigation settles targets an about:blank window still on the parent origin, which the browser
    // rejects with "target origin does not match the recipient window's origin". Gating on the load event
    // (and re-posting on selection change once loaded) removes that error without losing the message.
    const postSelectionToPreview = useCallback(() => {
        const frame = iframeRef.current
        if (!frame?.contentWindow || !previewUrl || !iframeLoadedRef.current) return
        const targetOrigin = new URL(previewUrl).origin
        // Emit the legacy name for backward compatibility with older preview iframes.
        frame.contentWindow.postMessage(
            { type: EDITOR_LEGACY_SELECTION_MESSAGE, selectedSectionId },
            targetOrigin
        )
        // Also emit the modern name so preview iframes that only listen for the modern protocol work.
        frame.contentWindow.postMessage(
            { type: EDITOR_SELECTION_MESSAGE, sectionId: selectedSectionId, selectedSectionId },
            targetOrigin
        )
    }, [previewUrl, selectedSectionId])

    // The iframe remounts whenever previewUrl changes (key={previewUrl}); mark it not-yet-loaded until
    // its onLoad fires again so we never post to a still-navigating frame.
    useEffect(() => {
        iframeLoadedRef.current = false
    }, [previewUrl])

    useEffect(() => {
        postSelectionToPreview()
    }, [postSelectionToPreview])

    const handlePreviewLoad = useCallback(() => {
        iframeLoadedRef.current = true
        postSelectionToPreview()
    }, [postSelectionToPreview])

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const message = event.data && typeof event.data === 'object'
                ? event.data as { type?: unknown; sectionId?: unknown }
                : null
            if (message?.type !== EDITOR_SECTION_SELECT_MESSAGE) return
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
                        <span className="te-preview-url">{storeName}.letbuyy.com</span>
                    </div>
                </div>

                <div className="te-preview-body te-preview-body--iframe">
                    {previewUrl ? (
                        <iframe
                            ref={iframeRef}
                            key={previewUrl}
                            title={`${storeName} storefront preview`}
                            src={previewUrl}
                            onLoad={handlePreviewLoad}
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
