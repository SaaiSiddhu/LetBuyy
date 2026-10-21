'use client'

/**
 * UpdatePageClient — Phase AB: Client component for the theme update page.
 *
 * Fetches available theme version information via the same-origin proxy and
 * renders ThemeUpdatePanel. Handles loading, error, and no-theme states.
 *
 * All API calls go through same-origin /api/* proxies — never to the gateway
 * or Supabase directly.
 *
 * Uses @letbuyy/ui components + --lb-* design tokens.
 * Mobile-first layout.
 * No raw rounded-[Npx] Tailwind classes.
 *
 * RISK-DUAL-N01: delegates all update logic to ThemeUpdatePanel; this
 * component does not mutate section_definitions.
 *
 * Does NOT import from:
 *   - editor/page.tsx (foreign WIP)
 *   - ExperiencePicker.tsx (foreign WIP)
 *   - globals.css (foreign WIP)
 *   - @letbuyy/api-client src/index.ts (foreign WIP)
 *   - settings/localization/page.tsx (foreign WIP)
 */

import { useCallback, useEffect, useState } from 'react'
import {
    Banner,
    Button,
    Page,
    RefreshCw,
    Skeleton,
} from '@letbuyy/ui'
import ThemeUpdatePanel from '@/components/theme-editor/ThemeUpdatePanel'
import { useReadRequest } from '@/lib/api/use-read-request'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'

interface UpdatePageClientProps {
    store: string
    storeId: string | null
    themeSlug: string
    fetchError?: string | null
}

interface ThemeVersionInfo {
    themeSlug: string
    currentVersionId: string
    availableVersionId?: string
    currentReleaseId?: string
    rollbackTargetReleaseId?: string
    rollbackTargetVersion?: number
    actorId?: string
    themeName?: string
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

export default function UpdatePageClient({
    store,
    storeId,
    themeSlug: initialThemeSlug,
    fetchError: initialFetchError,
}: UpdatePageClientProps) {
    const { actorId } = useMerchantSecurityContext(store)
    const beginVersions = useReadRequest(`${actorId}:${store}:${initialThemeSlug}`)
    const [loading, setLoading] = useState(Boolean(storeId && initialThemeSlug))
    const [fetchError, setFetchError] = useState<string | null>(initialFetchError ?? null)
    const [versionInfo, setVersionInfo] = useState<ThemeVersionInfo | null>(null)

    const fetchVersionInfo = useCallback(async () => {
        if (!storeId || !initialThemeSlug) return
        const request = beginVersions()
        setLoading(true)
        setFetchError(null)
        setVersionInfo(null)
        try {
            // GET the theme's release list to find current + available versions
            const res = await fetch(
                `/api/themes/${encodeURIComponent(initialThemeSlug)}/releases?store_name=${encodeURIComponent(store)}`,
                { credentials: 'same-origin', cache: 'no-store', signal: request.signal }
            )
            const payload = await res.json().catch(() => null) as Record<string, unknown> | null
            if (!request.isCurrent()) return
            if (!res.ok || !payload) {
                setFetchError(friendlyError(payload, 'Could not load theme version information.'))
                return
            }

            // Extract current release and available update from the releases list
            const releases = Array.isArray(payload.data) ? payload.data : []
            const currentRelease = releases.find(
                (r: Record<string, unknown>) => r.is_current === true && r.release_status === 'published'
            ) as Record<string, unknown> | undefined
            const latestAvailable = releases.find(
                (r: Record<string, unknown>) => r.release_status === 'available' || r.is_latest
            ) as Record<string, unknown> | undefined

            const priorRelease = releases.filter((r: Record<string, unknown>) => r.is_current !== true &&
                r.release_status === 'superseded' && typeof r.release_version === 'number' &&
                typeof currentRelease?.release_version === 'number' && r.release_version < currentRelease.release_version)
                .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.release_version) - Number(a.release_version))[0] as Record<string, unknown> | undefined
            setVersionInfo({
                themeSlug: initialThemeSlug,
                currentVersionId: typeof currentRelease?.schema_version === 'string'
                    ? currentRelease.schema_version
                    : typeof currentRelease?.id === 'string' ? currentRelease.id : 'current',
                availableVersionId: typeof latestAvailable?.schema_version === 'string'
                    ? latestAvailable.schema_version
                    : typeof latestAvailable?.id === 'string' ? latestAvailable.id : undefined,
                currentReleaseId: typeof currentRelease?.id === 'string' ? currentRelease.id : undefined,
                rollbackTargetReleaseId: typeof priorRelease?.id === 'string' ? priorRelease.id : undefined,
                rollbackTargetVersion: typeof priorRelease?.release_version === 'number' ? priorRelease.release_version : undefined,
                actorId,
            })
        } catch (err) {
            if (!request.isCurrent()) return
            setFetchError(err instanceof Error ? err.message : 'Could not load version information.')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [actorId, beginVersions, storeId, initialThemeSlug, store])

    useEffect(() => {
        void fetchVersionInfo()
    }, [fetchVersionInfo])

    // ── Loading ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <Page>
                <div
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                    aria-label="Loading theme update information"
                    className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-5)]"
                >
                    <Skeleton variant="card" />
                </div>
            </Page>
        )
    }

    // ── No store ──────────────────────────────────────────────────────────────

    if (!storeId) {
        return (
            <Page>
                <div className="p-[var(--lb-space-5)]">
                    <Banner variant="critical" title="Store not found" role="alert">
                        Could not resolve store context. Please navigate back and try again.
                    </Banner>
                </div>
            </Page>
        )
    }

    // ── No theme slug ─────────────────────────────────────────────────────────

    if (!initialThemeSlug) {
        return (
            <Page>
                <div className="p-[var(--lb-space-5)]">
                    <Banner variant="warning" title="No theme selected">
                        Navigate to your theme and use the update action from there.
                    </Banner>
                </div>
            </Page>
        )
    }

    // ── Error ─────────────────────────────────────────────────────────────────

    if (fetchError && !versionInfo) {
        return (
            <Page>
                <div className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-5)]">
                    <Banner variant="critical" title="Could not load update information" role="alert">
                        {fetchError}
                    </Banner>
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-md)] w-fit items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                        onClick={() => void fetchVersionInfo()}
                        aria-label="Retry loading theme version information"
                    >
                        <RefreshCw
                            className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                            aria-hidden="true"
                        />
                        Retry
                    </Button>
                </div>
            </Page>
        )
    }

    // ── Render update panel ───────────────────────────────────────────────────

    return (
        <Page>
            <div
                aria-label={`Theme update — ${initialThemeSlug}`}
                className="flex flex-col gap-[var(--lb-space-5)] p-[var(--lb-space-5)]"
            >
                <header className="flex flex-col gap-[var(--lb-space-1)]">
                    <h1 className="m-0 text-[length:var(--lb-font-size-page-title)] font-[var(--lb-font-weight-bold)] leading-[var(--lb-line-height-page-title)] text-[color:var(--lb-color-text)]">
                        Update theme
                    </h1>
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                        Preview and apply updates to <strong>{initialThemeSlug}</strong> while
                        preserving your customisations.
                    </p>
                </header>

                {versionInfo ? (
                    <ThemeUpdatePanel
                        themeSlug={versionInfo.themeSlug}
                        storeId={storeId}
                        currentVersionId={versionInfo.currentVersionId}
                        availableVersionId={versionInfo.availableVersionId}
                        currentReleaseId={versionInfo.currentReleaseId}
                        rollbackTargetReleaseId={versionInfo.rollbackTargetReleaseId}
                        rollbackTargetVersion={versionInfo.rollbackTargetVersion}
                        actorId={versionInfo.actorId}
                        onUpdateApplied={() => void fetchVersionInfo()}
                        onRollbackApplied={() => void fetchVersionInfo()}
                    />
                ) : (
                    <Banner variant="info">
                        No update information available for this theme.
                    </Banner>
                )}
            </div>
        </Page>
    )
}
