'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MaterialIcon } from '@letbuyy/ui'
import { getStorefrontBaseUrl } from '@/lib/public-urls'
import {
    EDITOR_LEGACY_SELECTION_MESSAGE,
    EDITOR_SELECTION_MESSAGE,
    EDITOR_SECTION_SELECT_MESSAGE,
    EDITOR_SCROLL_MESSAGE,
    INSPECTOR_SECTION_HOVERED,
    INSPECTOR_HOVER_CLEARED,
    INSPECTOR_ADD_SECTION_INTENT,
} from '@letbuyy/theme-engine/editor-bridge-protocol'
import PreviewInspectorOverlay from './PreviewInspectorOverlay'

interface CenterPanelProps {
    storeName: string
    viewport: 'desktop' | 'tablet' | 'mobile'
    previewToken: string | null
    previewError: string | null
    isPreviewRefreshing: boolean
    selectedSectionId: string | null
    onSelectSection?: (sectionId: string) => void
    /** Called when the pointer enters or leaves a section in the preview.
     *  Receives the hovered sectionId on enter, null on leave. */
    onHoverSection?: (sectionId: string | null) => void
    /**
     * Called when the user clicks an insert-before/after button in the preview.
     * The preview never mutates sections (RISK-DUAL-N01) — it sends this intent and the
     * editor decides whether/how to open the add-section panel.
     */
    onAddSectionIntent?: (adjacentSectionId: string, position: 'before' | 'after') => void
}

export default function CenterPanel({
    storeName,
    viewport,
    previewToken,
    previewError,
    isPreviewRefreshing,
    selectedSectionId,
    onSelectSection,
    onHoverSection,
    onAddSectionIntent,
}: CenterPanelProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const iframeLoadedRef = useRef(false)
    const storefrontBaseUrl = getStorefrontBaseUrl()

    /** Tracks which section the preview is currently hovering — displayed in the overlay chip. */
    const [hoveredSection, setHoveredSection] = useState<{ sectionId: string; sectionType: string } | null>(null)

    const previewUrl = useMemo(() => {
        if (!storefrontBaseUrl || !storeName) return ''

        const url = new URL('/preview', storefrontBaseUrl)
        url.searchParams.set('subdomain', storeName)
        url.searchParams.set('editor', '1')
        url.searchParams.set('viewport', viewport)
        if (previewToken) url.searchParams.set('theme_preview_token', previewToken)
        return url.toString()
    }, [previewToken, storefrontBaseUrl, storeName, viewport])

    /**
     * The explicit origin the preview iframe is allowed to post messages from.
     * Derived from previewUrl so it is always consistent with the iframe src.
     * Null when previewUrl is empty (no preview configured yet).
     */
    const previewOrigin = useMemo((): string | null => {
        if (!previewUrl) return null
        try { return new URL(previewUrl).origin } catch { return null }
    }, [previewUrl])

    // Post the current selection into the preview iframe — but ONLY after it has finished loading.
    // The iframe renders the storefront on a different origin (the storefront base URL); posting before
    // navigation settles targets an about:blank window still on the parent origin, which the browser
    // rejects with "target origin does not match the recipient window's origin". Gating on the load event
    // (and re-posting on selection change once loaded) removes that error without losing the message.
    const postSelectionToPreview = useCallback(() => {
        const frame = iframeRef.current
        if (!frame?.contentWindow || !previewOrigin || !iframeLoadedRef.current) return
        const targetOrigin = previewOrigin
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
        // Emit an explicit scroll message so the preview can distinguish scroll intent from
        // selection state. The bridge triggers smooth scroll on both LEGACY_SELECTION and SCROLL;
        // having the explicit message lets preview-side flash logic distinguish the two.
        if (selectedSectionId) {
            frame.contentWindow.postMessage(
                { type: EDITOR_SCROLL_MESSAGE, sectionId: selectedSectionId },
                targetOrigin
            )
        }
    }, [previewOrigin, selectedSectionId])

    // The iframe remounts whenever previewUrl changes (key={previewUrl}); mark it not-yet-loaded until
    // its onLoad fires again so we never post to a still-navigating frame.
    // Also clear hover state so a stale chip doesn't linger across navigations.
    useEffect(() => {
        iframeLoadedRef.current = false
        setHoveredSection(null)
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
            // SECURITY: reject messages from any origin other than the preview iframe.
            // previewOrigin is null when no preview is configured; in that case there is
            // nothing to listen for, so all messages are ignored.
            if (!previewOrigin || event.origin !== previewOrigin) return

            // Shape guard: we only act on plain objects with a string type field.
            if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return
            const message = event.data as Record<string, unknown>
            if (typeof message.type !== 'string') return

            switch (message.type) {
                case EDITOR_SECTION_SELECT_MESSAGE: {
                    // Preview clicked a section — select it in the editor tree.
                    const sectionId = typeof message.sectionId === 'string' ? message.sectionId : ''
                    if (sectionId) onSelectSection?.(sectionId)
                    break
                }
                case INSPECTOR_SECTION_HOVERED: {
                    // Preview hover entered a section — update overlay chip + notify parent.
                    const sectionId = typeof message.sectionId === 'string' ? message.sectionId : ''
                    const sectionType = typeof message.sectionType === 'string' ? message.sectionType : sectionId
                    if (sectionId) {
                        setHoveredSection({ sectionId, sectionType })
                        onHoverSection?.(sectionId)
                    }
                    break
                }
                case INSPECTOR_HOVER_CLEARED: {
                    // Preview hover left a section — clear the overlay chip + notify parent.
                    setHoveredSection(null)
                    onHoverSection?.(null)
                    break
                }
                case INSPECTOR_ADD_SECTION_INTENT: {
                    // Preview insert-button clicked — delegate to editor (RISK-DUAL-N01: preview
                    // never mutates sections; this is intent-only).
                    const adjacentSectionId = typeof message.adjacentSectionId === 'string'
                        ? message.adjacentSectionId : ''
                    const pos = message.position
                    const position = pos === 'before' || pos === 'after' ? pos : null
                    if (adjacentSectionId && position) onAddSectionIntent?.(adjacentSectionId, position)
                    break
                }
                default:
                    // Unknown message type — ignore silently; never eval/navigate from payload.
                    break
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [previewOrigin, onSelectSection, onHoverSection, onAddSectionIntent])

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

                    {/* Inspector hover chip — pointer-enhancement overlay; keyboard a11y is
                        handled by the section tree (which already has keyboard selection). */}
                    <PreviewInspectorOverlay hoveredSection={hoveredSection} />

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
