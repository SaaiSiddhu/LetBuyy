'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Lock, MousePointer2 } from 'lucide-react'
import { Button } from '@letbuyy/ui'
import { getEditorPreviewBaseUrl, getStorefrontRootDomain } from '@/lib/public-urls'
import {
    EDITOR_LEGACY_SELECTION_MESSAGE,
    EDITOR_SELECTION_MESSAGE,
    EDITOR_SECTION_SELECT_MESSAGE,
    EDITOR_SCROLL_MESSAGE,
    EDITOR_VIEWPORT_MESSAGE,
    INSPECTOR_SECTION_HOVERED,
    INSPECTOR_HOVER_CLEARED,
    INSPECTOR_ADD_SECTION_INTENT,
    EDITOR_INSPECTOR_MODE_MESSAGE,
    EDITOR_READY_MESSAGE,
    editorPreviewContextMatches,
    readEditorPreviewSelection,
    type EditorPreviewContext,
    type EditorPreviewIdentityIndex,
} from '@letbuyy/theme-engine/editor-bridge-protocol'
import PreviewInspectorOverlay from './PreviewInspectorOverlay'
import { fitPreviewViewport } from './preview-viewport'

interface CenterPanelProps {
    storeName: string
    viewport: 'desktop' | 'tablet' | 'mobile'
    previewToken: string | null
    previewError: string | null
    isPreviewRefreshing: boolean
    selectedSectionId: string | null
    selectedBlockId: string | null
    previewContext: EditorPreviewContext | null
    identities: EditorPreviewIdentityIndex
    onRetryPreview: () => void
    retryDisabled?: boolean
    onSelectSection?: (sectionId: string) => void
    onSelectBlock?: (sectionId: string, blockId: string) => void
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
    selectedBlockId,
    previewContext,
    identities,
    onRetryPreview,
    retryDisabled = false,
    onSelectSection,
    onSelectBlock,
    onHoverSection,
    onAddSectionIntent,
}: CenterPanelProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const previewBodyRef = useRef<HTMLDivElement>(null)
    const [availableSize, setAvailableSize] = useState({ width: 0, height: 900 })
    const [inspectorEnabled, setInspectorEnabled] = useState(true)
    const [frameError, setFrameError] = useState<string | null>(null)
    const previewReadyRef = useRef(false)
    const viewportFit = fitPreviewViewport(viewport, availableSize.width, availableSize.height)

    useEffect(() => {
        const body = previewBodyRef.current
        if (!body) return
        let active = true
        const update = () => {
            if (!active) return
            const width = body.clientWidth, height = body.clientHeight
            setAvailableSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
        }
        const observer = new ResizeObserver(update)
        observer.observe(body)
        update()
        return () => { active = false; observer.disconnect() }
    }, [])

    // Viewport measurements are runtime geometry, carried through scoped CSS variables.
    useEffect(() => {
        const body = previewBodyRef.current
        if (!body) return
        body.style.setProperty('--lb-preview-viewport-width', `${viewportFit.width}px`)
        body.style.setProperty('--lb-preview-viewport-height', `${viewportFit.height}px`)
        body.style.setProperty('--lb-preview-viewport-scale', String(viewportFit.scale))
        body.style.setProperty('--lb-preview-viewport-visibility', availableSize.width > 0 ? 'visible' : 'hidden')
    }, [viewportFit.width, viewportFit.height, viewportFit.scale, availableSize.width])

    const iframeLoadedRef = useRef(false)
    const storefrontBaseUrl = getEditorPreviewBaseUrl()

    /** Tracks which section the preview is currently hovering — displayed in the overlay chip. */
    const [hoveredSection, setHoveredSection] = useState<{ sectionId: string; sectionType: string } | null>(null)

    const previewUrl = useMemo(() => {
        if (!storefrontBaseUrl || !storeName || !previewContext) return ''

        const url = new URL('/preview', storefrontBaseUrl)
        url.searchParams.set('subdomain', storeName)
        url.searchParams.set('editor', '1')
        url.searchParams.set('template', previewContext.templateKey)
        if (previewContext.resourceId) url.searchParams.set('resource_id', previewContext.resourceId)
        if (previewContext.page !== undefined) url.searchParams.set('page', String(previewContext.page))
        if (previewToken) url.searchParams.set('theme_preview_token', previewToken)
        return url.toString()
    }, [previewToken, storefrontBaseUrl, storeName, previewContext])

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
        if (!frame?.contentWindow || !previewOrigin || !previewContext || !iframeLoadedRef.current) return
        const targetOrigin = previewOrigin
        // Device changes resize the current signed document. Reapply after load
        // and verified READY as well, including when inspection is disabled.
        frame.contentWindow.postMessage({ type: EDITOR_VIEWPORT_MESSAGE, viewport, context: previewContext }, targetOrigin)
        frame.contentWindow.postMessage({ type: EDITOR_INSPECTOR_MODE_MESSAGE, enabled: inspectorEnabled, context: previewContext }, targetOrigin)
        if (!inspectorEnabled) return
        const blockPath = selectedSectionId && selectedBlockId && Object.hasOwn(identities, selectedSectionId)
            ? identities[selectedSectionId].blocks[selectedBlockId] || [] : []
        const selection = { sectionId: selectedSectionId, ...(selectedBlockId ? { blockId: selectedBlockId } : {}), blockPath, context: previewContext }
        // Emit the legacy name for backward compatibility with older preview iframes.
        frame.contentWindow.postMessage(
            { type: EDITOR_LEGACY_SELECTION_MESSAGE, selectedSectionId, ...selection },
            targetOrigin
        )
        // Also emit the modern name so preview iframes that only listen for the modern protocol work.
        frame.contentWindow.postMessage(
            { type: EDITOR_SELECTION_MESSAGE, selectedSectionId, ...selection },
            targetOrigin
        )
        // Emit an explicit scroll message so the preview can distinguish scroll intent from
        // selection state. The bridge triggers smooth scroll on both LEGACY_SELECTION and SCROLL;
        // having the explicit message lets preview-side flash logic distinguish the two.
        if (selectedSectionId) {
            frame.contentWindow.postMessage(
                { type: EDITOR_SCROLL_MESSAGE, ...selection },
                targetOrigin
            )
        }
    }, [previewOrigin, previewContext, identities, selectedSectionId, selectedBlockId, inspectorEnabled, viewport])

    // The iframe remounts whenever previewUrl changes (key={previewUrl}); mark it not-yet-loaded until
    // its onLoad fires again so we never post to a still-navigating frame.
    // Also clear hover state so a stale chip doesn't linger across navigations.
    useEffect(() => {
        iframeLoadedRef.current = false
        previewReadyRef.current = false
        setFrameError(null)
        setHoveredSection(null)
        if (!previewUrl) return
        const timer = window.setTimeout(() => {
            if (!previewReadyRef.current) setFrameError('The preview could not finish loading. Your saved draft is kept. Retry to open a fresh preview.')
        }, 20000)
        return () => window.clearTimeout(timer)
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
            if (!previewOrigin || event.origin !== previewOrigin || event.source !== iframeRef.current?.contentWindow) return

            // Shape guard: we only act on plain objects with a string type field.
            if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return
            const message = event.data as Record<string, unknown>
            if (typeof message.type !== 'string') return
            if (!editorPreviewContextMatches(message.context, previewContext)) return

            switch (message.type) {
                case EDITOR_READY_MESSAGE: {
                    iframeLoadedRef.current = true
                    previewReadyRef.current = true
                    setFrameError(null)
                    postSelectionToPreview()
                    break
                }
                case EDITOR_SECTION_SELECT_MESSAGE: {
                    // Preview clicked a section — select it in the editor tree.
                    const selected = readEditorPreviewSelection(message, identities)
                    if (selected?.blockId) onSelectBlock?.(selected.sectionId, selected.blockId)
                    else if (selected) onSelectSection?.(selected.sectionId)
                    break
                }
                case INSPECTOR_SECTION_HOVERED: {
                    // Preview hover entered a section — update overlay chip + notify parent.
                    const selected = readEditorPreviewSelection(message, identities)
                    if (selected) {
                        const sectionId = selected.sectionId
                        const sectionType = identities[sectionId].type
                        setHoveredSection({ sectionId, sectionType })
                        onHoverSection?.(sectionId)
                    }
                    break
                }
                case INSPECTOR_HOVER_CLEARED: {
                    if (!readEditorPreviewSelection(message, identities)) return
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
                    if (Object.hasOwn(identities, adjacentSectionId) && position) onAddSectionIntent?.(adjacentSectionId, position)
                    break
                }
                default:
                    // Unknown message type — ignore silently; never eval/navigate from payload.
                    break
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [previewOrigin, previewContext, identities, onSelectSection, onSelectBlock, onHoverSection, onAddSectionIntent, postSelectionToPreview])

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
                        <Lock size={14} aria-hidden="true" />
                        <span className="te-preview-url">{storeName}.{getStorefrontRootDomain()}</span>
                    </div>
                    <Button variant="ghost" size="sm" aria-label="Inspect preview" aria-pressed={inspectorEnabled} onClick={() => setInspectorEnabled(value => !value)}><MousePointer2 size={14} aria-hidden="true" />Inspect</Button>
                </div>

                <div ref={previewBodyRef} className="te-preview-body te-preview-body--iframe">
                    {previewUrl ? (
                        <iframe
                            ref={iframeRef}
                            key={previewUrl}
                            title={`${storeName} storefront preview`}
                            src={previewUrl}
                            onLoad={handlePreviewLoad}
                            onError={() => setFrameError('The preview could not be loaded. Your saved draft is kept.')}
                            className="te-preview-iframe"
                            sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="te-preview-state">Preparing preview…</div>
                    )}

                    {/* Inspector hover chip — pointer-enhancement overlay; keyboard a11y is
                        handled by the section tree (which already has keyboard selection). */}
                    <PreviewInspectorOverlay hoveredSection={hoveredSection} />

                    {(isPreviewRefreshing || previewError || frameError) && (
                        <div className="te-preview-status" role={previewError || frameError ? 'alert' : 'status'}>
                            <span>{previewError || frameError || 'Syncing preview…'}</span>
                            {(previewError || frameError) && <Button variant="secondary" size="sm" disabled={isPreviewRefreshing || retryDisabled} onClick={onRetryPreview}>Retry preview</Button>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
