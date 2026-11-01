'use client'

/**
 * ThemeUpdatePanel — Phase AB: Tenant-safe theme version update UI.
 *
 * Surfaces update availability (current vs available version), a PREVIEW of
 * the per-template section diff (what changes, what merchant content is
 * preserved, what conflicts need confirmation), an explicit Confirm-update
 * action (calls the same-origin update proxy), and a Rollback action that
 * reuses the existing Phase P rollback proxy.
 *
 * RISK-DUAL-N01: the update mutates the store's template instance settings
 * (merged with the new bundle's definitions), never the shared
 * section_definitions catalog row in the DB. The merged ThemeDocument is
 * persisted only as a new release release_config via the gateway's
 * publishReleaseSnapshot path — this component emits zero section_definitions
 * mutations (pure read + submit).
 *
 * NO-DATA-LOSS LAW:
 *   - Merchant content is preserved via the Phase AB safe-update merge engine.
 *   - Conflicts (removed sections with merchant-authored content) are surfaced
 *     as a blocking requiresDuplicate warning — the merchant must explicitly
 *     confirm before an update is applied.
 *   - The Apply Update button is DISABLED until:
 *     (a) the diff has been previewed (diff !== null), AND
 *     (b) the confirm_diff_hash from the preview is in scope, AND
 *     (c) if requiresDuplicate=true, conflictsAcknowledged=true.
 *   This ensures NO SILENT APPLY ever occurs.
 *
 * States:
 *   no-update         — currentVersionId === availableVersionId (no update)
 *   available         — update is available, diff not yet fetched
 *   previewing        — GET /api/themes/:slug/update-preview in-flight
 *   conflicts         — preview returned requiresDuplicate=true
 *   updating          — POST /api/themes/:slug/update in-flight
 *   done              — update successfully applied
 *   error             — preview or update request failed
 *
 * Rollback action reuses the existing Phase P proxy:
 *   POST /api/themes/:themeId/releases/:releaseId/rollback
 *
 * Uses @letbuyy/ui components + --lb-* design tokens throughout.
 * No raw rounded-[Npx] Tailwind classes.
 * Mobile-first (~360px base).
 * Keyboard-accessible: all actions keyboard-operable, all interactive
 * elements have aria-label, aria-expanded, aria-disabled, aria-busy,
 * and role as appropriate.
 *
 * Foreign WIP isolation — does NOT import from:
 *   - apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx
 *   - apps/merchant/web/src/components/theme-editor/ExperiencePicker.tsx
 *   - apps/merchant/web/src/app/globals.css
 *   - packages/api-client/src/index.ts (@letbuyy/api-client)
 *   - apps/merchant/web/src/app/[store]/settings/localization/page.tsx
 */

import { useState, useCallback, useId, useEffect, useRef } from 'react'
import { useReadRequest } from '@/lib/api/use-read-request'
import { MerchantNavigationLink } from '@/components/MerchantNavigationLink'
import {
    AlertTriangle,
    ArrowUp,
    Badge,
    Banner,
    Button,
    Check,
    ChevronDown,
    ConfirmDialog,
    RefreshCw,
    RotateCcw,
    Skeleton,
    Table,
    useToast,
} from '@letbuyy/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

/** UI-state machine for the update workflow. */
export type UpdatePanelState =
    | 'no-update'
    | 'available'
    | 'previewing'
    | 'conflicts'
    | 'updating'
    | 'done'
    | 'error'

/** One section's change row in the diff table. */
export interface SectionDiffRow {
    /** Template key this diff row belongs to (e.g. 'index', 'product'). */
    templateKey: string
    /** Section type identifier (e.g. 'hero-banner', 'product-grid'). */
    sectionType: string
    /** What the update does to this section. */
    action: 'added' | 'removed' | 'retained' | 'incompatible'
    /**
     * Non-empty when action='removed' and the section had merchant-authored
     * content. These keys are listed so the merchant can decide whether to
     * duplicate before updating.
     */
    lostContent?: string[]
}

/** Full diff payload returned by GET /api/themes/:slug/update-preview. */
export interface ThemeUpdateDiff {
    /** Per-section rows across all templates. */
    rows: SectionDiffRow[]
    /** G4 gate result: whether current→target schema transition is supported. */
    compatible: boolean
    /**
     * True when a removed section has non-placeholder merchant-authored content.
     * The Apply button is disabled until conflictsAcknowledged=true.
     * NEVER silently overwritten — merchant must explicitly acknowledge.
     */
    requiresDuplicate: boolean
    /**
     * SHA-256 of the serialised diff (CAS guard).
     * Must be sent back as confirm_diff_hash in POST /api/themes/:slug/update.
     * Stale hash → gateway 409, forcing a fresh preview before re-applying.
     */
    diffHash: string
}

/** Props for ThemeUpdatePanel. */
export interface ThemeUpdatePanelProps {
    /** Owned store path segment for the existing library duplication workflow. */
    storeSlug: string
    /** Theme slug (used in API paths). */
    themeSlug: string
    /** Resolved store ID (UUID). Forwarded to the same-origin proxy. */
    storeId: string
    /** Current deployed version ID. */
    currentVersionId: string
    /**
     * Available (target) version ID. undefined means no update is available.
     * Panel renders in no-update state when undefined or equal to currentVersionId.
     */
    availableVersionId?: string
    /**
     * Base URL for API calls (default: '' = same-origin).
     * Proxy routes: /api/themes/[themeSlug]/update-preview and /api/themes/[themeSlug]/update
     */
    apiBase?: string
    /**
     * Release ID of the current live release.
     * Required for the Rollback action. When undefined, rollback button is hidden.
     */
    currentReleaseId?: string
    rollbackTargetReleaseId?: string
    rollbackTargetVersion?: number
    actorId?: string
    /** Called after the update is successfully applied (for caller to refresh). */
    onUpdateApplied?: () => void
    /** Called after a rollback is applied (for caller to refresh). */
    onRollbackApplied?: () => void
}

type RollbackIntent = { actorId: string; storeId: string; themeSlug: string; targetReleaseId: string;
    targetVersion: number; expectedCurrentReleaseId: string; idempotencyKey: string }

function parseRollbackIntent(raw: string | null, actorId: string, storeId: string, themeSlug: string): RollbackIntent | null {
    if (raw === null) return null
    const saved = JSON.parse(raw) as RollbackIntent
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!saved || Object.keys(saved).sort().join(',') !== 'actorId,expectedCurrentReleaseId,idempotencyKey,storeId,targetReleaseId,targetVersion,themeSlug'
        || saved.actorId !== actorId || saved.storeId !== storeId || saved.themeSlug !== themeSlug
        || ![saved.targetReleaseId, saved.expectedCurrentReleaseId, saved.idempotencyKey].every(value => typeof value === 'string' && uuid.test(value))
        || saved.targetReleaseId === saved.expectedCurrentReleaseId || !Number.isInteger(saved.targetVersion) || saved.targetVersion < 1) {
        throw new Error('Pending rollback metadata could not be confirmed. Keep it for recovery before restoring another release.')
    }
    return Object.freeze(saved)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function actionLabel(action: SectionDiffRow['action']): string {
    switch (action) {
        case 'added': return 'Added'
        case 'removed': return 'Removed'
        case 'retained': return 'Retained'
        case 'incompatible': return 'Incompatible'
    }
}

function actionBadgeVariant(action: SectionDiffRow['action']): 'success' | 'critical' | 'info' | 'warning' {
    switch (action) {
        case 'added': return 'success'
        case 'removed': return 'critical'
        case 'retained': return 'info'
        case 'incompatible': return 'warning'
    }
}

function friendlyError(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        const rec = payload as Record<string, unknown>
        const errObj = rec.error && typeof rec.error === 'object'
            ? rec.error as Record<string, unknown>
            : null
        const msg =
            typeof rec.message === 'string' ? rec.message
            : typeof errObj?.message === 'string' ? errObj.message
            : null
        if (msg) return msg
    }
    return fallback
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ThemeUpdatePanel
 *
 * Renders the full update workflow for a single installed theme:
 *  1. "Update available" badge (availableVersionId !== currentVersionId).
 *  2. "Preview update" button → GET /api/themes/:slug/update-preview.
 *  3. Section diff table (added/removed/retained/incompatible per row).
 *  4. requiresDuplicate warning — blocks Apply until explicitly acknowledged.
 *  5. "Apply update" button — DISABLED until preview previewed + hash present.
 *  6. "Rollback" button — POST /api/themes/:slug/releases/:releaseId/rollback (Phase P).
 *
 * NO-DATA-LOSS guarantee (proven by tests):
 *  - canApply computation requires diff !== null (preview must be fetched first).
 *  - canApply requires conflictsAcknowledged when requiresDuplicate is set.
 *  - Apply sends confirm_diff_hash (CAS guard); a stale hash returns 409.
 *  - RISK-DUAL-N01: no section_definitions mutation in this component.
 */
export default function ThemeUpdatePanel(props: ThemeUpdatePanelProps) {
    const scope = JSON.stringify([props.actorId, props.storeId, props.themeSlug, props.apiBase, props.currentVersionId, props.availableVersionId, props.currentReleaseId])
    return <ScopedThemeUpdatePanel key={scope} {...props} />
}

function ScopedThemeUpdatePanel({
    storeSlug,
    themeSlug,
    storeId,
    currentVersionId,
    availableVersionId,
    apiBase = '',
    currentReleaseId,
    rollbackTargetReleaseId,
    rollbackTargetVersion,
    actorId,
    onUpdateApplied,
    onRollbackApplied,
}: ThemeUpdatePanelProps) {
    const beginPreviewRead = useReadRequest(JSON.stringify([actorId, storeId, themeSlug, apiBase, availableVersionId]))
    const { notify } = useToast()
    const diffTableId = useId()

    const updateAvailable = Boolean(availableVersionId && availableVersionId !== currentVersionId)

    const [panelState, setPanelState] = useState<UpdatePanelState>(
        updateAvailable ? 'available' : 'no-update'
    )
    const [diff, setDiff] = useState<ThemeUpdateDiff | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [conflictsAcknowledged, setConflictsAcknowledged] = useState(false)
    const [showRollbackConfirm, setShowRollbackConfirm] = useState(false)
    const [rollingBack, setRollingBack] = useState(false)
    const [diffExpanded, setDiffExpanded] = useState(true)
    const [pendingRollback, setPendingRollback] = useState<RollbackIntent | null>(null)
    const rollbackIntentRef = useRef<RollbackIntent | null>(null)
    const [rollbackRecoveryError, setRollbackRecoveryError] = useState<string | null>(null)
    const [loadedRollbackStorageKey, setLoadedRollbackStorageKey] = useState<string | null>(null)
    const rollbackStorageKey = actorId ? `letbuyy:theme-rollback:v1:${actorId}:${storeId}:${themeSlug}` : null
    useEffect(() => {
        rollbackIntentRef.current = null
        setPendingRollback(null)
        setRollbackRecoveryError(null)
        setLoadedRollbackStorageKey(null)
        if (!rollbackStorageKey || !actorId) return
        try {
            const saved = parseRollbackIntent(window.localStorage.getItem(rollbackStorageKey), actorId, storeId, themeSlug)
            rollbackIntentRef.current = saved
            setPendingRollback(saved)
        } catch (error) {
            setRollbackRecoveryError(error instanceof Error ? error.message : 'Rollback recovery storage is unavailable. Retry loading releases.')
        } finally { setLoadedRollbackStorageKey(rollbackStorageKey) }
    }, [rollbackStorageKey, actorId, storeId, themeSlug])


    // ── canApply: Apply button gating (NO-DATA-LOSS enforcement) ─────────────
    //
    // NEVER enabled without:
    //  (a) a fetched diff with a diffHash (preview must run first)
    //  (b) compatible=true (G4 gate — incompatible schema blocked)
    //  (c) conflicts acknowledged if requiresDuplicate=true
    //  (d) panel in 'available' or 'conflicts' state (not while fetching/done)
    const canApply = Boolean(
        diff?.diffHash &&
        diff.compatible &&
        (panelState === 'available' || panelState === 'conflicts') &&
        (!diff.requiresDuplicate || conflictsAcknowledged)
    )

    // ── Preview update ────────────────────────────────────────────────────────

    const handlePreview = useCallback(async () => {
        if (panelState === 'previewing' || !availableVersionId) return
        const request = beginPreviewRead()

        setPanelState('previewing')
        setDiff(null)
        setErrorMessage(null)
        setConflictsAcknowledged(false)

        try {
            const url =
                `${apiBase}/api/themes/${encodeURIComponent(themeSlug)}/update-preview` +
                `?store_id=${encodeURIComponent(storeId)}` +
                `&target_version_id=${encodeURIComponent(availableVersionId)}`

            const res = await fetch(url, { credentials: 'same-origin', signal: request.signal })
            const payload = await res.json().catch(() => null) as Record<string, unknown> | null
            if (!request.isCurrent()) return

            if (!res.ok) {
                const msg = friendlyError(payload, 'Failed to preview the update. Try again.')
                setErrorMessage(msg)
                setPanelState('error')
                return
            }

            // Expect: { diff: ThemeUpdateDiff }
            const rawDiff = payload?.diff
            if (!rawDiff || typeof rawDiff !== 'object') {
                setErrorMessage('Preview response was unexpected. Refresh and try again.')
                setPanelState('error')
                return
            }

            const previewDiff = rawDiff as ThemeUpdateDiff
            setDiff(previewDiff)

            setPanelState(previewDiff.requiresDuplicate ? 'conflicts' : 'available')
        } catch (err) {
            if (!request.isCurrent()) return
            const msg = err instanceof Error ? err.message : 'Preview request failed.'
            setErrorMessage(msg)
            setPanelState('error')
        }
    }, [panelState, availableVersionId, apiBase, themeSlug, storeId, beginPreviewRead])

    // ── Apply update ─────────────────────────────────────────────────────────

    const handleApplyUpdate = useCallback(async () => {
        // Guard: must have diff + diffHash + be in correct state (canApply enforces this)
        if (!canApply || !diff?.diffHash || !availableVersionId) return

        setPanelState('updating')
        setErrorMessage(null)

        try {
            const url = `${apiBase}/api/themes/${encodeURIComponent(themeSlug)}/update`
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                // confirm_diff_hash = CAS guard: gateway rejects stale previews (409)
                body: JSON.stringify({
                    store_id: storeId,
                    target_bundle_version_id: availableVersionId,
                    confirm_diff_hash: diff.diffHash,
                    make_store_live: true,
                    idempotency_key: `update-${themeSlug}-${availableVersionId}-${storeId}`,
                }),
            })

            const payload = await res.json().catch(() => null) as Record<string, unknown> | null

            if (!res.ok) {
                const msg = friendlyError(payload, 'Update failed. Preview the diff again before retrying.')
                setErrorMessage(msg)
                // Reset to conflict state if merchant needs to re-preview after stale hash
                setPanelState(diff.requiresDuplicate ? 'conflicts' : 'available')
                return
            }

            setPanelState('done')
            notify({
                title: 'Theme updated',
                description: 'Your theme has been updated to the latest version.',
                variant: 'success',
            })
            onUpdateApplied?.()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Update request failed.'
            setErrorMessage(msg)
            setPanelState(diff.requiresDuplicate ? 'conflicts' : 'available')
        }
    }, [canApply, diff, availableVersionId, apiBase, themeSlug, storeId, notify, onUpdateApplied])

    // ── Rollback ──────────────────────────────────────────────────────────────

    const handleRollbackConfirm = useCallback(async () => {
        if (!actorId || !rollbackStorageKey || loadedRollbackStorageKey !== rollbackStorageKey || rollbackRecoveryError || rollingBack) return
        setRollingBack(true)
        setShowRollbackConfirm(false)
        try {
            let intent = rollbackIntentRef.current
            if (!intent) {
                if (!currentReleaseId || !rollbackTargetReleaseId || !rollbackTargetVersion || rollbackTargetReleaseId === currentReleaseId) throw new Error('Review a previous release before restoring it.')
                intent = Object.freeze({ actorId, storeId, themeSlug, targetReleaseId: rollbackTargetReleaseId,
                    targetVersion: rollbackTargetVersion, expectedCurrentReleaseId: currentReleaseId, idempotencyKey: crypto.randomUUID() })
                // Only immutable retry metadata is stored; no session or theme content.
                window.localStorage.setItem(rollbackStorageKey, JSON.stringify(intent))
                rollbackIntentRef.current = intent
                setPendingRollback(intent)
            }
            if (intent.actorId !== actorId || intent.storeId !== storeId || intent.themeSlug !== themeSlug) throw new Error('Your account or store changed. Reload releases.')
            const url = `${apiBase}/api/themes/${encodeURIComponent(intent.themeSlug)}/releases/${encodeURIComponent(intent.targetReleaseId)}/rollback`
            const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actorId: intent.actorId, store_name: intent.storeId, make_store_live: true,
                    expected_current_release_id: intent.expectedCurrentReleaseId, idempotency_key: intent.idempotencyKey }) })
            const payload = await res.json().catch(() => null) as Record<string, unknown> | null
            if (!res.ok) {
                if (res.status === 400 || res.status === 409) {
                    try { window.localStorage.removeItem(rollbackStorageKey) } catch { /* A retained old key can only replay the same intent. */ }
                    rollbackIntentRef.current = null
                    setPendingRollback(null)
                }
                throw new Error(friendlyError(payload, 'Rollback was not confirmed. Recover the same request before trying another release.'))
            }
            const result = payload?.data as Record<string, unknown> | undefined
            const release = result?.rollback as Record<string, unknown> | undefined
            const target = result?.restored_release as Record<string, unknown> | undefined
            if (typeof result?.replayed !== 'boolean' || typeof release?.release_id !== 'string' || target?.id !== intent.targetReleaseId ||
                typeof result.current_release_id !== 'string' || !Number.isInteger(result.current_release_version)) throw new Error('No confirmed rollback receipt was returned. Recover the same request.')
            try { window.localStorage.removeItem(rollbackStorageKey) } catch { /* Replaying a retained completed key is safe. */ }
            rollbackIntentRef.current = null
            setPendingRollback(null)
            notify({ title: 'Rollback confirmed', description: result.current_release_id === release.release_id
                ? `Version ${intent.targetVersion} is restored. Your newer saved draft remains available.`
                : 'The rollback was committed. A newer release is now live.', variant: 'success' })
            try { onRollbackApplied?.() } catch { /* A refresh failure cannot turn a confirmed rollback into a failed mutation. */ }
        } catch (err) {
            notify({ title: 'Rollback not confirmed', description: err instanceof Error ? err.message : 'Recover the same rollback request.', variant: 'critical' })
        } finally { setRollingBack(false) }
    }, [actorId, rollbackStorageKey, loadedRollbackStorageKey, rollbackRecoveryError, currentReleaseId, rollbackTargetReleaseId, rollbackTargetVersion, rollingBack, apiBase, themeSlug, storeId, notify, onRollbackApplied])

    const rollbackAvailable = Boolean(pendingRollback || (actorId && currentReleaseId && rollbackTargetReleaseId && rollbackTargetVersion))
    const rollbackAction = rollbackAvailable ? <>
        {rollbackRecoveryError && <Banner variant="critical" title="Rollback recovery unavailable" aria-live="assertive">{rollbackRecoveryError}</Banner>}
        <Button unstyled type="button" className="inline-flex h-[var(--lb-size-control-sm)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text-subdued)] disabled:opacity-50"
            onClick={() => setShowRollbackConfirm(true)} disabled={rollingBack || loadedRollbackStorageKey !== rollbackStorageKey || Boolean(rollbackRecoveryError)} aria-label="Rollback to the previous theme release" aria-busy={rollingBack}>
            <RotateCcw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
            {rollingBack ? 'Restoring...' : pendingRollback ? 'Recover rollback' : 'Rollback'}
        </Button>
        <ConfirmDialog open={showRollbackConfirm} title={pendingRollback ? 'Recover previous rollback?' : 'Restore reviewed release?'}
            description={`Restore version ${pendingRollback?.targetVersion ?? rollbackTargetVersion} as a new live release. Your newer saved draft will remain available.`}
            confirmLabel={pendingRollback ? 'Recover rollback' : 'Rollback'} destructive onClose={() => setShowRollbackConfirm(false)} onConfirm={() => void handleRollbackConfirm()} />
    </> : null

    // ── Render: no-update state ───────────────────────────────────────────────

    if (panelState === 'no-update') {
        return (
            <section
                role="region"
                aria-label="Theme update status"
                className="flex items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]"
            >
                <Check
                    className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-success)]"
                    aria-hidden="true"
                />
                <span className="text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                    This theme is up to date.
                </span>
                {rollbackAction}
            </section>
        )
    }

    // ── Render: main update panel ─────────────────────────────────────────────

    return (
        <section
            role="region"
            aria-label="Theme update"
            className="flex flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-5)]"
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)]">
                <div className="flex items-center gap-[var(--lb-space-2)]">
                    <ArrowUp
                        className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-primary)]"
                        aria-hidden="true"
                    />
                    <h2 className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                        Theme update
                    </h2>
                    {updateAvailable && panelState !== 'done' && (
                        <Badge
                            label="Update available"
                            variant="info"
                            aria-label="A theme update is available"
                        />
                    )}
                    {panelState === 'done' && (
                        <Badge
                            label="Updated"
                            variant="success"
                            aria-label="Theme update applied successfully"
                        />
                    )}
                </div>

                {panelState !== 'updating' && rollbackAction}
            </div>

            {/* ── Version info ───────────────────────────────────────────── */}
            {panelState !== 'done' && (
                <dl className="flex flex-col gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    <div className="flex gap-[var(--lb-space-2)]">
                        <dt className="font-[var(--lb-font-weight-medium)]">Current:</dt>
                        <dd className="font-mono text-[color:var(--lb-color-text)]">{currentVersionId}</dd>
                    </div>
                    {availableVersionId && availableVersionId !== currentVersionId && (
                        <div className="flex gap-[var(--lb-space-2)]">
                            <dt className="font-[var(--lb-font-weight-medium)]">Available:</dt>
                            <dd className="font-mono text-[color:var(--lb-color-text)]">{availableVersionId}</dd>
                        </div>
                    )}
                </dl>
            )}

            {/* ── Error banner ───────────────────────────────────────────── */}
            {errorMessage && panelState === 'error' && (
                <Banner variant="critical" title="Update error" aria-live="assertive">
                    {errorMessage}
                </Banner>
            )}
            {errorMessage && panelState !== 'error' && (
                <Banner variant="warning" title="Last attempt failed" aria-live="polite">
                    {errorMessage}
                </Banner>
            )}

            {/* ── requiresDuplicate conflict warning ─────────────────────── */}
            {diff?.requiresDuplicate && (panelState === 'conflicts' || panelState === 'available') && (
                <Banner
                    variant="warning"
                    title="Duplicate recommended before updating"
                >
                    <p className="m-0 mb-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)]">
                        This update removes sections that contain your customisations.
                        Duplicating the theme first preserves your current content for reference.
                        If you proceed without duplicating, content in removed sections will be lost.
                    </p>
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        <MerchantNavigationLink
                            href={`/${encodeURIComponent(storeSlug)}/online-store/themes`}
                            className="inline-flex h-[var(--lb-size-control-sm)] items-center rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-strong)] bg-[var(--lb-color-primary)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text-on-primary)] hover:opacity-90 focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                            aria-label="Open theme library to duplicate this theme before updating"
                        >
                            Duplicate in theme library
                        </MerchantNavigationLink>
                        <Button
                            unstyled
                            type="button"
                            className="inline-flex h-[var(--lb-size-control-sm)] items-center rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                            onClick={() => setConflictsAcknowledged(true)}
                            aria-label="Acknowledge content will be lost and proceed with update"
                            aria-pressed={conflictsAcknowledged}
                        >
                            {conflictsAcknowledged ? 'Acknowledged — content will be lost' : 'Proceed anyway'}
                        </Button>
                    </div>
                </Banner>
            )}

            {/* ── Incompatible schema warning (G4 gate reject) ───────────── */}
            {diff && !diff.compatible && (
                <Banner variant="critical" title="Schema version incompatible">
                    This update targets a schema version that is not compatible with the current theme.
                    Contact support or wait for a forward-compatible update. No changes have been applied.
                </Banner>
            )}

            {/* ── Preview loading skeleton ───────────────────────────────── */}
            {panelState === 'previewing' && (
                <div
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                    aria-label="Loading update preview"
                >
                    <Skeleton variant="card" />
                </div>
            )}

            {/* ── Section diff table ─────────────────────────────────────── */}
            {diff && panelState !== 'previewing' && (
                <div className="flex flex-col gap-[var(--lb-space-2)]">
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex items-center gap-[var(--lb-space-2)] self-start text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                        onClick={() => setDiffExpanded((prev) => !prev)}
                        aria-expanded={diffExpanded}
                        aria-controls={diffTableId}
                    >
                        <ChevronDown
                            className={[
                                'h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] transition-transform',
                                diffExpanded ? 'rotate-180' : '',
                            ].join(' ')}
                            aria-hidden="true"
                        />
                        {diffExpanded ? 'Hide' : 'Show'} update diff
                        {' '}({diff.rows.length} section{diff.rows.length !== 1 ? 's' : ''})
                    </Button>

                    {diffExpanded && (
                        <div
                            id={diffTableId}
                            className="overflow-x-auto rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)]"
                        >
                            <Table
                                className="w-full border-collapse text-[length:var(--lb-font-size-caption)]"
                                aria-label="Update diff: section changes per template"
                            >
                                <thead>
                                    <tr className="border-b border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)]">
                                        <th
                                            scope="col"
                                            className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text-subdued)]"
                                        >
                                            Template
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text-subdued)]"
                                        >
                                            Section type
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text-subdued)]"
                                        >
                                            Change
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text-subdued)]"
                                        >
                                            Content preserved
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {diff.rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-[var(--lb-space-3)] py-[var(--lb-space-4)] text-center text-[color:var(--lb-color-text-subdued)]"
                                            >
                                                No section changes in this update.
                                            </td>
                                        </tr>
                                    ) : (
                                        diff.rows.map((row, index) => (
                                            <tr
                                                key={`${row.templateKey}-${row.sectionType}-${index}`}
                                                className="border-b border-[var(--lb-color-border)] last:border-0 hover:bg-[var(--lb-color-surface-hovered)]"
                                            >
                                                <td className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                                    {row.templateKey}
                                                </td>
                                                <td className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] font-mono text-[color:var(--lb-color-text-subdued)]">
                                                    {row.sectionType}
                                                </td>
                                                <td className="px-[var(--lb-space-3)] py-[var(--lb-space-2)]">
                                                    <Badge
                                                        label={actionLabel(row.action)}
                                                        variant={actionBadgeVariant(row.action)}
                                                        aria-label={`${row.sectionType}: ${actionLabel(row.action)}`}
                                                    />
                                                </td>
                                                <td className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[color:var(--lb-color-text-subdued)]">
                                                    {row.action === 'removed' && row.lostContent && row.lostContent.length > 0 ? (
                                                        <span className="inline-flex items-center gap-[var(--lb-space-1)] text-[color:var(--lb-color-text-critical)]">
                                                            <AlertTriangle
                                                                className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                                                                aria-hidden="true"
                                                            />
                                                            Content will be lost
                                                        </span>
                                                    ) : row.action === 'added' ? (
                                                        <span>Bundle defaults</span>
                                                    ) : row.action === 'removed' ? (
                                                        <span>No customisations</span>
                                                    ) : (
                                                        <span className="flex items-center gap-[var(--lb-space-1)]">
                                                            <Check
                                                                className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-success)]"
                                                                aria-hidden="true"
                                                            />
                                                            Preserved
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Done state ─────────────────────────────────────────────── */}
            {panelState === 'done' && (
                <Banner variant="success" role="status" aria-live="polite">
                    Theme updated successfully. Customers now see the latest version.
                </Banner>
            )}

            {/* ── Action buttons ─────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                {/* Preview / refresh preview */}
                {(panelState === 'available' || panelState === 'error' || panelState === 'conflicts') && (
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)] disabled:opacity-50"
                        onClick={() => void handlePreview()}
                        aria-label={
                            diff
                                ? 'Refresh update preview to get a fresh diff'
                                : 'Preview what will change before applying the update'
                        }
                    >
                        <RefreshCw
                            className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                            aria-hidden="true"
                        />
                        {diff ? 'Refresh preview' : 'Preview update'}
                    </Button>
                )}

                {/* Preview in-flight */}
                {panelState === 'previewing' && (
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text-subdued)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                        disabled
                        aria-busy="true"
                        aria-label="Preview loading, please wait"
                    >
                        <RefreshCw
                            className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] animate-spin"
                            aria-hidden="true"
                        />
                        Previewing...
                    </Button>
                )}

                {/* Apply update — disabled until preview done + conflicts acknowledged */}
                {(panelState === 'available' || panelState === 'conflicts') && diff && (
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-strong)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text-on-primary)] hover:opacity-90 focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)] disabled:opacity-50"
                        onClick={() => void handleApplyUpdate()}
                        disabled={!canApply}
                        aria-disabled={!canApply}
                        aria-label={
                            !diff.compatible
                                ? 'Update cannot be applied: incompatible schema version'
                                : diff.requiresDuplicate && !conflictsAcknowledged
                                    ? 'Acknowledge the content loss warning before applying'
                                    : !diff.diffHash
                                        ? 'Preview the update first'
                                        : 'Apply theme update — your customisations will be preserved'
                        }
                    >
                        <ArrowUp
                            className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                            aria-hidden="true"
                        />
                        Apply update
                    </Button>
                )}

                {/* Updating in-flight */}
                {panelState === 'updating' && (
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-strong)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text-on-primary)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                        disabled
                        aria-busy="true"
                        aria-label="Applying update, please wait"
                    >
                        <ArrowUp
                            className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                            aria-hidden="true"
                        />
                        Applying update...
                    </Button>
                )}
            </div>


        </section>
    )
}
