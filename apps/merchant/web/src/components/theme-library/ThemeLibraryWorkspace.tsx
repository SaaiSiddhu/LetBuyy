'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Banner,
    Button,
    ConfirmDialog,
    Input,
    Modal,
    Plus,
    Skeleton,
    useToast,
} from '@letbuyy/ui'
import { ThemeLibraryCard, type SiteThemeRecord } from './ThemeLibraryCard'

interface ThemeLibraryWorkspaceProps {
    /** The [store] route param (subdomain handle). Used for both API calls and editor links. */
    store: string
    /** Resolved storeId (UUID). When null the workspace is not yet ready to load. */
    storeId: string | null
    onChanged?: () => void
}

interface LibraryApiResponse {
    data?: SiteThemeRecord[] | { themes?: SiteThemeRecord[] }
    themes?: SiteThemeRecord[]
    success?: boolean
}

// ── Dialog state types ─────────────────────────────────────────────────────────

interface RenameDialogState {
    open: boolean
    slug: string
    currentName: string
    value: string
}

interface ConfirmActionState {
    open: boolean
    slug: string
    name: string
    action: 'archive' | 'delete'
}

interface CreateDialogState {
    open: boolean
    value: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function readThemeList(payload: LibraryApiResponse): SiteThemeRecord[] {
    if (Array.isArray(payload.data)) return payload.data
    if (payload.data && Array.isArray(payload.data.themes)) return payload.data.themes
    if (Array.isArray(payload.themes)) return payload.themes
    return []
}

function sortThemes(themes: SiteThemeRecord[]): SiteThemeRecord[] {
    // Published first, then draft/inactive, then archived
    const order = (t: SiteThemeRecord): number => {
        if (t.isCurrentlyPublished) return 0
        if (t.instance_status === 'archived') return 2
        return 1
    }
    return [...themes].sort((a, b) => order(a) - order(b))
}

function friendlyGatewayError(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        const rec = payload as Record<string, unknown>
        const errObj = rec.error && typeof rec.error === 'object'
            ? rec.error as Record<string, unknown>
            : null
        const msg = typeof rec.message === 'string'
            ? rec.message
            : typeof errObj?.message === 'string'
                ? errObj.message
                : null
        const code = typeof errObj?.code === 'string' ? errObj.code : null

        if (code === 'THEME_CURRENTLY_PUBLISHED') return 'Cannot archive your current theme.'
        if (code === 'CANNOT_DELETE_PUBLISHED_THEME') return 'Cannot delete the currently published theme.'
        if (code === 'THEME_LIMIT_REACHED') {
            const limit = typeof errObj?.limit === 'number' ? errObj.limit : null
            return limit !== null
                ? `Your plan allows up to ${limit} theme${limit === 1 ? '' : 's'}. Upgrade or archive an existing theme to add more.`
                : 'Theme limit reached on your current plan.'
        }
        if (msg) return msg
    }
    return fallback
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ThemeLibraryWorkspace
 *
 * Full library management workspace: lists all installed site themes with
 * current/draft/archived/inactive states, and provides create, duplicate,
 * rename, publish, archive, delete-unpublished, and rollback actions.
 *
 * All destructive actions are gated by ConfirmDialog. All API calls go through
 * same-origin /api/* proxies — never to the gateway or Supabase directly.
 * Uses @letbuyy/ui components and --lb-* design tokens throughout.
 *
 * Keyboard-accessible: action menus and modals are fully keyboard operable.
 * Mobile-first layout: stack at 360 px, cards wrap responsively at larger sizes.
 * Dates use en-IN locale; commerce amounts use INR (not applicable here).
 */
export function ThemeLibraryWorkspace({ store, storeId, onChanged }: ThemeLibraryWorkspaceProps) {
    const router = useRouter()
    const { notify } = useToast()

    // ── Library data ──────────────────────────────────────────────────────────
    const [publishDialog, setPublishDialog] = useState<string | null>(null)
    const [publishError, setPublishError] = useState<string | null>(null)
    const publishIntent = useRef<{ slug: string; body: Record<string, unknown> } | null>(null)
    const [loading, setLoading] = useState(false)
    const [themes, setThemes] = useState<SiteThemeRecord[]>([])
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [busySlug, setBusySlug] = useState<string | null>(null)

    // ── Dialog state ──────────────────────────────────────────────────────────
    const [renameDialog, setRenameDialog] = useState<RenameDialogState>({
        open: false, slug: '', currentName: '', value: '',
    })
    const [confirmAction, setConfirmAction] = useState<ConfirmActionState>({
        open: false, slug: '', name: '', action: 'archive',
    })
    const [createDialog, setCreateDialog] = useState<CreateDialogState>({
        open: false, value: '',
    })
    const [renameError, setRenameError] = useState<string | null>(null)
    const [createError, setCreateError] = useState<string | null>(null)
    const renameInputRef = useRef<HTMLInputElement>(null)
    const createInputRef = useRef<HTMLInputElement>(null)

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchLibrary = useCallback(async () => {
        if (!store) return
        setLoading(true)
        setFetchError(null)
        try {
            const res = await fetch(`/api/themes/library?store_name=${encodeURIComponent(store)}`)
            const payload = await res.json().catch(() => null) as LibraryApiResponse | null
            if (!res.ok || !payload) {
                const msg = friendlyGatewayError(payload, 'Could not load your theme library. Try refreshing.')
                setFetchError(msg)
                return
            }
            setThemes(sortThemes(readThemeList(payload)))
        } catch {
            setFetchError('Could not load your theme library. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => {
        if (storeId) void fetchLibrary()
    }, [fetchLibrary, storeId])

    // ── Publish ───────────────────────────────────────────────────────────────
    const handlePublish = useCallback((slug: string) => { publishIntent.current = null; setPublishError(null); setPublishDialog(slug) }, [])
    const performPublish = async () => {
        const slug = publishDialog
        if (!slug || busySlug) return
        setBusySlug(slug)
        setPublishError(null)
        const url = `/api/themes/${encodeURIComponent(slug)}/editor?store_name=${encodeURIComponent(store)}`
        try {
            if (!publishIntent.current) {
                const loadedResponse = await fetch(url, { cache: 'no-store' })
                const loaded = await loadedResponse.json()
                if (!loadedResponse.ok) throw new Error(friendlyGatewayError(loaded, 'The saved theme could not load.'))
                let version = loaded.version
                if (!loaded.draftConfig) {
                    const savedResponse = await fetch(`/api/themes/${encodeURIComponent(slug)}/editor/draft?store_name=${encodeURIComponent(store)}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ actorId: loaded.actorId, storeId, templateKey: 'index', draftConfig: loaded.templateConfig,
                            baseVersion: version, idempotencyKey: crypto.randomUUID() }),
                    })
                    const saved = await savedResponse.json()
                    if (!savedResponse.ok) throw new Error(friendlyGatewayError(saved, 'Theme save was not confirmed. Retry.'))
                    version = saved.version
                }
                publishIntent.current = { slug, body: { actorId: loaded.actorId, storeId, baseVersion: version, templateKey: 'index', idempotencyKey: crypto.randomUUID() } }
            }
            const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(publishIntent.current.body) })
            const payload = await res.json()
            if (!res.ok) throw new Error(friendlyGatewayError(payload, 'Publication was not confirmed. Retry to recover it.'))
            setPublishDialog(null); publishIntent.current = null
            notify({ title: 'Theme published', description: 'Your saved design is now live.', variant: 'success' })
            await fetchLibrary(); onChanged?.(); router.refresh()
        } catch (error) { const message = error instanceof Error ? error.message : 'Retry publication.'; setPublishError(message); notify({ title: 'Publication not confirmed', description: message, variant: 'critical' }) }
        finally { setBusySlug(null) }
    }

    // ── Duplicate ─────────────────────────────────────────────────────────────
    const handleDuplicate = useCallback(async (slug: string) => {
        if (busySlug) return
        setBusySlug(slug)
        try {
            const res = await fetch(`/api/themes/${encodeURIComponent(slug)}/duplicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_name: store }),
            })
            const data = await res.json().catch(() => null) as Record<string, unknown> | null
            if (!res.ok) {
                throw new Error(friendlyGatewayError(data, 'Theme duplicate failed. Try again.'))
            }
            notify({ title: 'Theme duplicated', variant: 'success', description: 'A copy has been added to your library.' })
            await fetchLibrary()
        } catch (err) {
            notify({
                title: 'Duplicate failed',
                description: err instanceof Error ? err.message : 'Theme duplicate failed.',
                variant: 'critical',
            })
        } finally {
            setBusySlug(null)
        }
    }, [busySlug, store, notify, fetchLibrary])

    // ── Rename ────────────────────────────────────────────────────────────────
    const openRenameDialog = useCallback((slug: string, currentName: string) => {
        setRenameError(null)
        setRenameDialog({ open: true, slug, currentName, value: currentName })
        requestAnimationFrame(() => renameInputRef.current?.select())
    }, [])

    const handleRenameSubmit = useCallback(async () => {
        const { slug, value } = renameDialog
        const trimmed = value.trim()
        if (!trimmed) { setRenameError('Name cannot be empty.'); return }
        if (trimmed.length > 120) { setRenameError('Name must be 120 characters or fewer.'); return }
        setRenameError(null)
        setBusySlug(slug)
        setRenameDialog((prev) => ({ ...prev, open: false }))
        try {
            const res = await fetch(`/api/themes/${encodeURIComponent(slug)}/rename`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_name: store, name: trimmed }),
            })
            const data = await res.json().catch(() => null) as Record<string, unknown> | null
            if (!res.ok) throw new Error(friendlyGatewayError(data, 'Theme rename failed.'))
            notify({ title: 'Theme renamed', variant: 'success' })
            await fetchLibrary()
        } catch (err) {
            notify({
                title: 'Rename failed',
                description: err instanceof Error ? err.message : 'Could not rename the theme.',
                variant: 'critical',
            })
        } finally {
            setBusySlug(null)
        }
    }, [renameDialog, store, notify, fetchLibrary])

    // ── Archive ───────────────────────────────────────────────────────────────
    const openArchiveConfirm = useCallback((slug: string, name: string) => {
        setConfirmAction({ open: true, slug, name, action: 'archive' })
    }, [])

    // ── Delete ────────────────────────────────────────────────────────────────
    const openDeleteConfirm = useCallback((slug: string, name: string) => {
        setConfirmAction({ open: true, slug, name, action: 'delete' })
    }, [])

    const handleConfirmDestructive = useCallback(async () => {
        const { slug, action } = confirmAction
        setConfirmAction((prev) => ({ ...prev, open: false }))
        setBusySlug(slug)
        try {
            if (action === 'archive') {
                const res = await fetch(`/api/themes/${encodeURIComponent(slug)}/archive`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ store_name: store }),
                })
                const data = await res.json().catch(() => null) as Record<string, unknown> | null
                if (!res.ok) throw new Error(friendlyGatewayError(data, 'Could not archive the theme.'))
                notify({ title: 'Theme archived', variant: 'success' })
            } else {
                const res = await fetch(
                    `/api/themes/${encodeURIComponent(slug)}?store_name=${encodeURIComponent(store)}`,
                    { method: 'DELETE' }
                )
                const data = await res.json().catch(() => null) as Record<string, unknown> | null
                if (!res.ok) throw new Error(friendlyGatewayError(data, 'Could not delete the theme.'))
                notify({ title: 'Theme deleted', variant: 'success' })
            }
            await fetchLibrary()
        } catch (err) {
            notify({
                title: action === 'archive' ? 'Archive failed' : 'Delete failed',
                description: err instanceof Error ? err.message : 'The action could not be completed.',
                variant: 'critical',
            })
        } finally {
            setBusySlug(null)
        }
    }, [confirmAction, store, notify, fetchLibrary])

    // ── Create ────────────────────────────────────────────────────────────────
    const openCreateDialog = useCallback(() => {
        setCreateError(null)
        setCreateDialog({ open: true, value: '' })
        requestAnimationFrame(() => createInputRef.current?.focus())
    }, [])

    const handleCreateSubmit = useCallback(async () => {
        const trimmed = createDialog.value.trim()
        if (!trimmed) { setCreateError('Theme name is required.'); return }
        if (trimmed.length > 120) { setCreateError('Name must be 120 characters or fewer.'); return }
        setCreateError(null)
        setCreateDialog((prev) => ({ ...prev, open: false }))
        setBusySlug('__creating__')
        try {
            const res = await fetch('/api/themes/library/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_name: store, name: trimmed }),
            })
            const data = await res.json().catch(() => null) as Record<string, unknown> | null
            if (!res.ok) throw new Error(friendlyGatewayError(data, 'Could not create the theme.'))
            notify({ title: 'Theme created', variant: 'success', description: `"${trimmed}" has been added to your library.` })
            await fetchLibrary()
        } catch (err) {
            notify({
                title: 'Create failed',
                description: err instanceof Error ? err.message : 'Could not create the theme.',
                variant: 'critical',
            })
        } finally {
            setBusySlug(null)
        }
    }, [createDialog, store, notify, fetchLibrary])

    // ── Rollback navigation ───────────────────────────────────────────────────
    const handleRollback = useCallback((slug: string) => {
        window.location.href = `/${store}/online-store/themes/${slug}/editor?tab=releases`
    }, [store])

    // ── Render ────────────────────────────────────────────────────────────────
    const confirmTitle = confirmAction.action === 'archive'
        ? `Archive "${confirmAction.name}"?`
        : `Delete "${confirmAction.name}"?`
    const confirmDescription = confirmAction.action === 'archive'
        ? 'Archived themes are hidden from your library but can be restored. You cannot archive your currently published theme.'
        : 'This theme will be permanently removed. You cannot delete your currently published theme.'
    const confirmLabel = confirmAction.action === 'archive' ? 'Archive theme' : 'Delete theme'

    return (
        <div
            className="theme-library-workspace flex flex-col gap-[var(--lb-space-5)]"
            aria-label="Installed themes"
        >
            {/* Section header */}
            <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)]">
                <h2 className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                    My themes
                </h2>
                <div className="flex items-center gap-[var(--lb-space-2)]">
                    {fetchError && !loading && (
                        <Button
                            unstyled
                            type="button"
                            className="text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-link)] underline hover:no-underline"
                            onClick={() => void fetchLibrary()}
                        >
                            Retry
                        </Button>
                    )}
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-sm)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)] disabled:opacity-50"
                        onClick={openCreateDialog}
                        disabled={!storeId || loading}
                        aria-label="Add a new blank theme"
                    >
                        <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Add theme
                    </Button>
                </div>
            </div>

            {/* Error banner */}
            {fetchError && !loading && (
                <Banner variant="critical" title="Could not load theme library">
                    {fetchError}
                </Banner>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div
                    className="grid gap-[var(--lb-space-3)] sm:grid-cols-2 lg:grid-cols-3"
                    aria-live="polite"
                    aria-busy="true"
                    aria-label="Loading themes"
                >
                    <Skeleton variant="card" />
                    <Skeleton variant="card" />
                    <Skeleton variant="card" />
                </div>
            )}

            {/* Empty state */}
            {!loading && !fetchError && themes.length === 0 && (
                <div
                    className="flex flex-col items-center gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] py-[var(--lb-space-8)] px-[var(--lb-space-6)] text-center"
                    role="status"
                    aria-label="No themes installed"
                >
                    <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                        No themes installed yet
                    </p>
                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        Add a blank theme or discover one from the theme store.
                    </p>
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-strong)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text-on-primary)] hover:opacity-90 focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)] disabled:opacity-50"
                        onClick={openCreateDialog}
                        disabled={!storeId}
                    >
                        <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Create blank theme
                    </Button>
                </div>
            )}

            {/* Theme grid */}
            {!loading && themes.length > 0 && (
                <div
                    className="grid gap-[var(--lb-space-3)] sm:grid-cols-2 lg:grid-cols-3"
                    role="list"
                    aria-label="Installed themes"
                >
                    {themes.map((theme) => (
                        <div key={theme.slug} role="listitem">
                            <ThemeLibraryCard
                                theme={theme}
                                store={store}
                                onPublish={handlePublish}
                                onDuplicate={handleDuplicate}
                                onRename={openRenameDialog}
                                onArchive={openArchiveConfirm}
                                onDelete={openDeleteConfirm}
                                onRollback={handleRollback}
                                busySlug={busySlug}
                            />
                        </div>
                    ))}
                </div>
            )}

            <Modal open={Boolean(publishDialog)} title="Publish this theme?" description="Your saved theme will replace the current storefront design. Storefront visibility and password protection stay as configured." onClose={() => { if (!busySlug) setPublishDialog(null) }} footer={<><Button variant="secondary" disabled={Boolean(busySlug)} onClick={() => setPublishDialog(null)}>Cancel</Button><Button disabled={Boolean(busySlug)} onClick={() => void performPublish()}>{busySlug ? 'Publishing…' : publishError ? 'Retry publication' : 'Publish'}</Button></>}>
                {publishError ? <Banner variant="critical" title="Publication not confirmed">{publishError}</Banner> : <p>{busySlug ? 'Saving and publishing your selected design…' : 'You can continue customizing this design after publication.'}</p>}
            </Modal>
            {/* ── Rename modal ─────────────────────────────────────────────── */}
            <Modal
                open={renameDialog.open}
                title="Rename theme"
                onClose={() => setRenameDialog((prev) => ({ ...prev, open: false }))}
                footer={
                    <div className="flex justify-end gap-[var(--lb-space-3)]">
                        <Button
                            unstyled
                            type="button"
                            className="inline-flex h-[var(--lb-size-control-md)] items-center rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                            onClick={() => setRenameDialog((prev) => ({ ...prev, open: false }))}
                        >
                            Cancel
                        </Button>
                        <Button
                            unstyled
                            type="button"
                            className="inline-flex h-[var(--lb-size-control-md)] items-center rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-strong)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-on-primary)] hover:opacity-90 focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                            onClick={() => void handleRenameSubmit()}
                        >
                            Save
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-[var(--lb-space-3)] p-[var(--lb-density-modal-padding)]">
                    <label
                        htmlFor="theme-rename-input"
                        className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]"
                    >
                        Theme name
                    </label>
                    <Input
                        ref={renameInputRef}
                        id="theme-rename-input"
                        type="text"
                        value={renameDialog.value}
                        maxLength={120}
                        onChange={(e) => {
                            setRenameError(null)
                            setRenameDialog((prev) => ({ ...prev, value: e.target.value }))
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleRenameSubmit()
                        }}
                        aria-describedby={renameError ? 'rename-error' : undefined}
                        aria-invalid={renameError ? 'true' : undefined}
                    />
                    {renameError && (
                        <p
                            id="rename-error"
                            role="alert"
                            className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-critical)]"
                        >
                            {renameError}
                        </p>
                    )}
                </div>
            </Modal>

            {/* ── Create theme modal ───────────────────────────────────────── */}
            <Modal
                open={createDialog.open}
                title="Create blank theme"
                description="Add a new blank theme to your library. You can customise it in the editor."
                onClose={() => setCreateDialog((prev) => ({ ...prev, open: false }))}
                footer={
                    <div className="flex justify-end gap-[var(--lb-space-3)]">
                        <Button
                            unstyled
                            type="button"
                            className="inline-flex h-[var(--lb-size-control-md)] items-center rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                            onClick={() => setCreateDialog((prev) => ({ ...prev, open: false }))}
                        >
                            Cancel
                        </Button>
                        <Button
                            unstyled
                            type="button"
                            className="inline-flex h-[var(--lb-size-control-md)] items-center rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-strong)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-on-primary)] hover:opacity-90 focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                            onClick={() => void handleCreateSubmit()}
                        >
                            Create
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-[var(--lb-space-3)] p-[var(--lb-density-modal-padding)]">
                    <label
                        htmlFor="theme-create-input"
                        className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]"
                    >
                        Theme name
                    </label>
                    <Input
                        ref={createInputRef}
                        id="theme-create-input"
                        type="text"
                        placeholder="My Store Theme"
                        value={createDialog.value}
                        maxLength={120}
                        onChange={(e) => {
                            setCreateError(null)
                            setCreateDialog((prev) => ({ ...prev, value: e.target.value }))
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleCreateSubmit()
                        }}
                        aria-describedby={createError ? 'create-error' : undefined}
                        aria-invalid={createError ? 'true' : undefined}
                    />
                    {createError && (
                        <p
                            id="create-error"
                            role="alert"
                            className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-critical)]"
                        >
                            {createError}
                        </p>
                    )}
                </div>
            </Modal>

            {/* ── Destructive confirm dialog ───────────────────────────────── */}
            <ConfirmDialog
                open={confirmAction.open}
                title={confirmTitle}
                description={confirmDescription}
                confirmLabel={confirmLabel}
                destructive
                onClose={() => setConfirmAction((prev) => ({ ...prev, open: false }))}
                onConfirm={() => void handleConfirmDestructive()}
            />
        </div>
    )
}
