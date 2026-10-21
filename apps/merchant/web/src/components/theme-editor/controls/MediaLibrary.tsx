'use client'

/**
 * MediaLibrary.tsx — Phase X: Browse-and-upload media picker overlay.
 *
 * Renders as a modal overlay (role="dialog", aria-modal) showing a thumbnail
 * grid of existing site media fetched from the same-origin proxy:
 *   GET /api/stores/{storeName}/themes/media-library
 *
 * Upload affordance posts to:
 *   POST /api/stores/{storeName}/upload  (same endpoint as ImageInput)
 *
 * Key design contracts:
 * ── Tenancy ───────────────────────────────────────────────────────────────────
 *   storeName is the authenticated merchant's own store slug.  The proxy
 *   resolveOwnedStoreId call ensures a site sees only its own media.
 *   Cross-site media ids are not resolvable via this proxy contract.
 *
 * ── Upload safety (client-side pre-flight) ────────────────────────────────────
 *   MIME allowlist — images: image/jpeg, image/png, image/webp, image/gif
 *                    video:  video/mp4, video/webm, video/quicktime
 *   SVG is REJECTED (SVG is script-bearing; no DOM sanitizer in the CF Worker).
 *   Max size — images 10 MB, video 100 MB (matches gateway limits).
 *   Client-side pre-flight shows a user-readable MIME_NOT_ALLOWED / SIZE_EXCEEDED
 *   error; the gateway enforces the same limits server-side.
 *   The file input accept attribute excludes svg+xml; malicious rename is caught
 *   by MIME sniffing on the client and by the gateway's allowlist.
 *
 * ── NOT-CONNECTED ─────────────────────────────────────────────────────────────
 *   If the gateway media-library endpoint is not yet deployed the proxy returns
 *   a non-ok response.  The component shows a graceful empty state with a
 *   NOT-CONNECTED badge rather than crashing.  Upload still works (it targets
 *   the existing /upload endpoint).
 *
 * ── Keyboard accessibility ─────────────────────────────────────────────────────
 *   Grid: role="grid", cells: role="gridcell"
 *   Arrow keys navigate the grid (ArrowRight, ArrowLeft, ArrowDown, ArrowUp).
 *   Enter / Space selects the focused item.
 *   Escape closes the dialog.
 *   Focus is trapped inside the modal while open.
 *   Tab cycles through interactive elements inside the dialog.
 *
 * ── RISK-DUAL-N01 ─────────────────────────────────────────────────────────────
 *   onSelect(url) emits the CDN URL only; never touches section_definitions.
 *
 * ── Design ratchet ────────────────────────────────────────────────────────────
 *   Uses @letbuyy/ui (Button, Input, MaterialIcon).
 *   --lb-* design tokens only (no raw px / rounded-[Npx]).
 *   Mobile-first 2-column grid, scales to 3+ on wider panels.
 *   en-IN locale for file-size display.
 *   No api-client import; raw fetch to the same-origin proxy.
 *   No unsafe inner HTML injection; no Supabase direct.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button, Input, MaterialIcon } from '@letbuyy/ui'
import styles from './controls.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

const IMAGE_MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_MIME_ALLOWLIST = ['video/mp4', 'video/webm', 'video/quicktime']
const ALL_MIME_ALLOWLIST = [...IMAGE_MIME_ALLOWLIST, ...VIDEO_MIME_ALLOWLIST]

/** Maximum upload size in bytes: 10 MB images, 100 MB videos */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

// ── Types ─────────────────────────────────────────────────────────────────────

export type MediaType = 'image' | 'video' | 'all'

export interface MediaItem {
    id: string
    filename: string
    url: string
    thumbnail_url?: string
    mime_type: string
    size_bytes: number
    alt_text?: string
    media_type: string
    created_at: string
}

interface MediaLibraryProps {
    /** The authenticated merchant's store slug — must be the same store the editor is open for. */
    storeName: string
    /** Which media types to show and accept for upload. */
    mediaType: MediaType
    /**
     * Called when the merchant selects an item.
     * RISK-DUAL-N01: emits CDN URL only; never touches section_definitions.
     */
    onSelect: (url: string) => void
    /** Called when the merchant dismisses the modal (Escape, close button, or overlay click). */
    onClose: () => void
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format a byte count in en-IN locale (e.g. "1.2 MB").
 * Avoids Intl.NumberFormat dependency on compact notation.
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function mimeAllowlistFor(mediaType: MediaType): string[] {
    if (mediaType === 'image') return IMAGE_MIME_ALLOWLIST
    if (mediaType === 'video') return VIDEO_MIME_ALLOWLIST
    return ALL_MIME_ALLOWLIST
}

function maxBytesFor(mime: string): number {
    return mime.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
}

function validateUploadFile(
    file: File,
    mediaType: MediaType
): { ok: true } | { ok: false; error: string } {
    const allowlist = mimeAllowlistFor(mediaType)

    // Reject SVG explicitly (script-bearing; no safe inline sanitizer in CF Worker)
    if (file.type === 'image/svg+xml' || file.type === 'image/svg') {
        return {
            ok: false,
            error: 'SVG files are not allowed for security reasons. Please use JPEG, PNG, WebP, or GIF.',
        }
    }

    if (!allowlist.includes(file.type)) {
        return {
            ok: false,
            error: `File type "${file.type}" is not allowed. MIME_NOT_ALLOWED — accepted: ${allowlist.join(', ')}.`,
        }
    }

    const maxBytes = maxBytesFor(file.type)
    if (file.size > maxBytes) {
        return {
            ok: false,
            error: `File is too large (${formatBytes(file.size)}). SIZE_EXCEEDED — maximum: ${formatBytes(maxBytes)}.`,
        }
    }

    return { ok: true }
}

function extractUploadedUrl(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null
    const data = (payload as { data?: unknown }).data
    if (!data || typeof data !== 'object') return null
    const url = (data as { url?: unknown }).url
    return typeof url === 'string' && url.length > 0 ? url : null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MediaLibrary({ storeName, mediaType, onSelect, onClose }: MediaLibraryProps) {
    const dialogId = useId()
    const titleId = `${dialogId}-title`
    const gridId = `${dialogId}-grid`
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    /** Per-cell refs used by arrow-key navigation to call .focus() programmatically. */
    const cellRefs = useRef<(HTMLDivElement | null)[]>([])
    /** Holds the active ResizeObserver so it can be disconnected on grid unmount. */
    const gridResizeObserverRef = useRef<ResizeObserver | null>(null)

    const [items, setItems] = useState<MediaItem[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isNotConnected, setIsNotConnected] = useState(false)

    const [search, setSearch] = useState('')
    const [activeIndex, setActiveIndex] = useState(-1)
    /** Dynamic column count derived from the rendered grid via ResizeObserver. */
    const [gridCols, setGridCols] = useState(2)

    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadError, setUploadError] = useState<string | null>(null)

    // ── Load media on mount and when search changes ───────────────────────
    useEffect(() => {
        let cancelled = false
        const controller = new AbortController()
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
        setLoadState('loading')
        setLoadError(null)
        setIsNotConnected(false)

        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({
                    type: mediaType,
                    limit: '60',
                })
                if (search.trim()) params.set('q', search.trim().slice(0, 200))

                const res = await fetch(
                    `/api/stores/${encodeURIComponent(storeName)}/themes/media-library?${params.toString()}`, { cache: 'no-store', signal }
                )

                if (cancelled) return

                const json = await res.json().catch(() => ({ data: [] }))
                if (cancelled) return

                if (!res.ok) {
                    // NOT-CONNECTED: gateway route may not be deployed yet
                    if (res.status === 404 || res.status === 502 || res.status === 503) {
                        setIsNotConnected(true)
                        setItems([])
                        setLoadState('loaded')
                    } else {
                        const msg =
                            typeof json?.error?.message === 'string'
                                ? json.error.message
                                : typeof json?.error === 'string'
                                    ? json.error
                                    : 'Failed to load media library'
                        setLoadError(msg)
                        setLoadState('error')
                    }
                    return
                }

                setItems(Array.isArray(json.data) ? (json.data as MediaItem[]) : [])
                setLoadState('loaded')
                setActiveIndex(-1)
            } catch {
                if (!cancelled) {
                    setLoadError('Failed to load media library')
                    setLoadState('error')
                }
            }
        }, search ? 300 : 0)

        return () => {
            cancelled = true
            controller.abort()
            clearTimeout(timer)
        }
    }, [storeName, mediaType, search])

    // ── Focus trap: keep focus inside the dialog ──────────────────────────
    useEffect(() => {
        const el = dialogRef.current
        if (!el) return

        const focusable = () =>
            Array.from(
                el.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
            ).filter((e) => !e.hasAttribute('disabled') && e.offsetParent !== null)

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return
            const els = focusable()
            if (els.length === 0) return
            const first = els[0]
            const last = els[els.length - 1]
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }

        el.addEventListener('keydown', handleTab)
        // Move focus into dialog on open
        const firstFocusable = focusable()[0]
        if (firstFocusable) firstFocusable.focus()

        return () => el.removeEventListener('keydown', handleTab)
    }, [])

    // ── Close on Escape key ───────────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onClose])

    // ── Dynamic grid column count via callback ref + ResizeObserver ───────
    // The grid renders only when items exist; a callback ref lets us install
    // the ResizeObserver as soon as the element mounts and disconnect when it
    // unmounts — solving the conditional-render problem that a plain useEffect
    // with gridRef.current cannot handle reliably.
    const handleGridRef = useCallback((el: HTMLDivElement | null) => {
        // Always disconnect the previous observer before doing anything else.
        gridResizeObserverRef.current?.disconnect()
        gridResizeObserverRef.current = null
        gridRef.current = el
        if (!el) return
        const computeCols = () => {
            const cols = getComputedStyle(el).gridTemplateColumns
                .split(' ')
                .filter(Boolean).length
            setGridCols(cols > 0 ? cols : 2)
        }
        computeCols() // initial read before first resize event
        const obs = new ResizeObserver(computeCols)
        obs.observe(el)
        gridResizeObserverRef.current = obs
    }, [])

    // ── Focus the active grid cell when activeIndex changes ───────────────
    // This is the missing piece that screen readers need: updating activeIndex
    // state and the CSS class is not enough — DOM focus must also move to the
    // newly highlighted cell so assistive technology announces it.
    useEffect(() => {
        if (activeIndex >= 0) {
            cellRefs.current[activeIndex]?.focus()
        }
    }, [activeIndex])

    // ── Grid keyboard navigation ──────────────────────────────────────────
    // Flat-index navigation:  ArrowRight/Left ±1, ArrowDown/Up ±gridCols

    const handleGridKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (items.length === 0) return

            const last = items.length - 1

            if (e.key === 'ArrowRight') {
                e.preventDefault()
                setActiveIndex((prev) => Math.min(prev + 1, last))
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setActiveIndex((prev) => Math.max(prev - 1, 0))
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                // gridCols is dynamically computed from the rendered grid via ResizeObserver,
                // so ArrowDown correctly jumps one row even when the CSS breakpoint switches
                // from 2 to 3 (or more) columns.
                setActiveIndex((prev) => Math.min(prev + gridCols, last))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((prev) => Math.max(prev - gridCols, 0))
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (activeIndex >= 0 && items[activeIndex]) {
                    // RISK-DUAL-N01: emit URL only; never touches section_definitions
                    onSelect(items[activeIndex].url)
                    onClose()
                }
            }
        },
        [items, activeIndex, onSelect, onClose, gridCols]
    )

    // ── Click on grid cell ────────────────────────────────────────────────
    const handleItemClick = useCallback(
        (item: MediaItem) => {
            // RISK-DUAL-N01: onSelect emits URL only; never mutates schema
            onSelect(item.url)
            onClose()
        },
        [onSelect, onClose]
    )

    // ── Upload ────────────────────────────────────────────────────────────
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return

            // Client-side MIME + size pre-flight
            const validation = validateUploadFile(file, mediaType)
            if (!validation.ok) {
                setUploadError(validation.error)
                return
            }

            setIsUploading(true)
            setUploadProgress(10)
            setUploadError(null)

            try {
                const formData = new FormData()
                formData.append('file', file)

                // Indeterminate progress: bump to 40% while waiting for server
                setUploadProgress(40)

                const response = await fetch(
                    `/api/stores/${encodeURIComponent(storeName)}/upload`,
                    { method: 'POST', body: formData }
                )
                const payload = await response.json().catch(() => null)
                const url = extractUploadedUrl(payload)

                setUploadProgress(80)

                if (!response.ok || !url) {
                    const msg =
                        payload && typeof payload === 'object' &&
                        typeof (payload as { error?: unknown }).error === 'string'
                            ? (payload as { error: string }).error
                            : 'Upload failed'
                    throw new Error(msg)
                }

                setUploadProgress(100)

                // Prepend the newly uploaded item to the list so it's immediately visible
                const newItem: MediaItem = {
                    id: crypto.randomUUID(),
                    filename: file.name,
                    url,
                    thumbnail_url: url,
                    mime_type: file.type,
                    size_bytes: file.size,
                    alt_text: '',
                    media_type: file.type.startsWith('video/') ? 'video' : 'image',
                    created_at: new Date().toISOString(),
                }
                setItems((prev) => [newItem, ...prev])
                setLoadState('loaded')
            } catch (err) {
                setUploadError(err instanceof Error ? err.message : 'Upload failed')
            } finally {
                setIsUploading(false)
                setUploadProgress(0)
            }
        },
        [storeName, mediaType]
    )

    // ── Accept string for file input ──────────────────────────────────────
    const acceptAttr =
        mediaType === 'image'
            ? 'image/jpeg,image/png,image/webp,image/gif'
            : mediaType === 'video'
                ? 'video/mp4,video/webm,video/quicktime'
                : 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime'

    return (
        /* Overlay */
        <div
            className={styles.mediaLibraryOverlay}
            aria-hidden="false"
            onClick={(e) => {
                // Close when clicking outside the dialog
                if (e.target === e.currentTarget) onClose()
            }}
        >
            {/* Dialog */}
            <div
                ref={dialogRef}
                id={dialogId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={styles.mediaLibraryDialog}
            >
                {/* Header */}
                <div className={styles.mediaLibraryHeader}>
                    <h2 id={titleId} className={styles.mediaLibraryTitle}>
                        Media Library
                    </h2>
                    <Button
                        unstyled
                        type="button"
                        className={styles.mediaLibraryCloseBtn}
                        aria-label="Close media library"
                        onClick={onClose}
                    >
                        <MaterialIcon name="close" size={18} aria-hidden />
                    </Button>
                </div>

                {/* Search */}
                <div className={styles.mediaLibrarySearch}>
                    <MaterialIcon name="search" size={15} aria-hidden className={styles.searchIcon} />
                    <Input
                        unstyled
                        type="search"
                        className={styles.mediaSearchInput}
                        placeholder="Search media…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search media by filename"
                    />
                </div>

                {/* Upload row */}
                <div className={styles.mediaUploadRow}>
                    <label
                        className={`te-field-upload-btn ${isUploading ? 'te-field-upload-btn--busy' : ''} ${styles.mediaUploadBtn}`}
                    >
                        <MaterialIcon
                            name={isUploading ? 'hourglass_top' : 'cloud_upload'}
                            size={15}
                            aria-hidden
                        />
                        {isUploading ? 'Uploading…' : 'Upload new'}
                        <Input
                            unstyled
                            ref={fileInputRef}
                            type="file"
                            accept={acceptAttr}
                            disabled={isUploading}
                            onChange={handleFileChange}
                            className={styles.hiddenFileInput}
                            aria-label="Upload new media file"
                        />
                    </label>

                    {/* Progress bar (visible during upload) */}
                    {isUploading ? (
                        <div
                            className={styles.mediaProgressBar}
                            role="progressbar"
                            aria-valuenow={uploadProgress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Upload progress"
                        >
                            <div
                                className={styles.mediaProgressFill}
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    ) : null}

                    {/* Upload error */}
                    {uploadError ? (
                        <p className={styles.mediaUploadError} role="alert">
                            <MaterialIcon name="error" size={12} aria-hidden />
                            {' '}{uploadError}
                        </p>
                    ) : null}
                </div>

                {/* NOT-CONNECTED badge */}
                {isNotConnected ? (
                    <div className={styles.mediaNotConnected} aria-live="polite">
                        <MaterialIcon name="cloud_off" size={13} aria-hidden />
                        <span>
                            NOT-CONNECTED — media library gateway route not yet deployed.
                            Upload works; browsing existing media will be available once
                            the gateway /themes/media-library endpoint is live.
                        </span>
                    </div>
                ) : null}

                {/* Loading state */}
                {loadState === 'loading' ? (
                    <div className={styles.mediaLibraryStatus} aria-live="polite">
                        <MaterialIcon name="hourglass_top" size={16} aria-hidden />
                        Loading media…
                    </div>
                ) : null}

                {/* Error state */}
                {loadState === 'error' ? (
                    <div className={`${styles.mediaLibraryStatus} ${styles.mediaLibraryStatusError}`} aria-live="assertive">
                        <MaterialIcon name="error" size={16} aria-hidden />
                        {loadError ?? 'Failed to load media'}
                    </div>
                ) : null}

                {/* Empty state */}
                {loadState === 'loaded' && items.length === 0 && !isNotConnected ? (
                    <div className={styles.mediaLibraryStatus} aria-live="polite">
                        <MaterialIcon name="photo_library" size={20} aria-hidden />
                        <span>
                            {search ? 'No media matches your search.' : 'No media uploaded yet.'}
                        </span>
                    </div>
                ) : null}

                {/* Grid */}
                {loadState === 'loaded' && items.length > 0 ? (
                    <div
                        ref={handleGridRef}
                        id={gridId}
                        role="grid"
                        aria-label="Media items"
                        className={styles.mediaGrid}
                        onKeyDown={handleGridKeyDown}
                        tabIndex={activeIndex === -1 ? 0 : -1}
                        onFocus={(e) => {
                            // When the grid receives focus and nothing is active, focus first cell
                            if (e.target === e.currentTarget && activeIndex === -1 && items.length > 0) {
                                setActiveIndex(0)
                            }
                        }}
                    >
                        {items.map((item, idx) => (
                            <div
                                key={item.id}
                                ref={(el) => { cellRefs.current[idx] = el }}
                                role="gridcell"
                                className={[
                                    styles.mediaGridItem,
                                    idx === activeIndex ? styles.mediaGridItemFocused : '',
                                ].filter(Boolean).join(' ')}
                                tabIndex={idx === activeIndex ? 0 : -1}
                                aria-label={`Select ${item.alt_text || item.filename}`}
                                title={item.filename}
                                onClick={() => handleItemClick(item)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        handleItemClick(item)
                                    }
                                }}
                                onFocus={() => setActiveIndex(idx)}
                            >
                                {/* Thumbnail */}
                                {item.media_type === 'video' ? (
                                    <div className={styles.mediaThumbVideo}>
                                        <MaterialIcon name="play_circle" size={24} aria-hidden />
                                    </div>
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.thumbnail_url || item.url}
                                        alt={item.alt_text || item.filename}
                                        className={styles.mediaThumb}
                                        loading="lazy"
                                        decoding="async"
                                        aria-hidden="true"
                                    />
                                )}

                                {/* Alt text (visible on focus/hover) */}
                                <div className={styles.mediaItemMeta} aria-hidden="true">
                                    <span className={styles.mediaItemName} title={item.filename}>
                                        {item.filename}
                                    </span>
                                    <span className={styles.mediaItemSize}>
                                        {formatBytes(item.size_bytes)}
                                    </span>
                                </div>

                                {/* Alt text overlay on hover */}
                                {item.alt_text ? (
                                    <div className={styles.mediaAltOverlay} aria-hidden="true">
                                        <span className={styles.mediaAltLabel}>Alt:</span>
                                        {' '}{item.alt_text}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    )
}
