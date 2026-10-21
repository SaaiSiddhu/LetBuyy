'use client'

import { useRouter } from 'next/navigation'
import {
    Badge,
    Button,
    Dropdown,
    type DropdownItem,
    Edit3,
    Eye,
    MoreHorizontal,
    Copy,
    Pencil,
    RotateCcw,
    Rocket,
    Trash2,
} from '@letbuyy/ui'

/**
 * SiteThemeRecord — shape of one installed theme as returned by
 * GET /api/themes/library. All fields are set by the gateway after joining
 * theme_instances + themes catalog + theme_releases.
 */
export interface SiteThemeRecord {
    slug: string
    thumbnail_url?: string | null
    name: string
    /** Current lifecycle status of the theme instance on this site */
    instance_status: 'active' | 'installed' | 'inactive' | 'archived' | 'deleted'
    installed_at: string | null
    last_published_at: string | null
    last_modified_at: string | null
    /** Whether an unsaved draft exists in theme_editor_drafts */
    hasDraft: boolean
    /** Whether this theme slug matches sites.current_theme_release_id */
    isCurrentlyPublished: boolean
    /** Whether a newer package version is available in the marketplace */
    updateAvailable: boolean
    theme_package_version_id: string | null
}

interface ThemeLibraryCardProps {
    theme: SiteThemeRecord
    /** Route store param (subdomain handle) for building editor links */
    store: string
    onPublish: (slug: string) => void
    onDuplicate: (slug: string) => void
    onRename: (slug: string, currentName: string) => void
    onArchive: (slug: string, name: string) => void
    onDelete: (slug: string, name: string) => void
    onRollback?: (slug: string) => void
    /** Set to the slug of the theme currently undergoing an async operation */
    busySlug?: string | null
}

function formatEnIn(isoDate: string | null): string {
    if (!isoDate) return ''
    try {
        return new Intl.DateTimeFormat('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(new Date(isoDate))
    } catch {
        return isoDate.slice(0, 10)
    }
}

function statusLabel(theme: SiteThemeRecord): string {
    if (theme.isCurrentlyPublished) return 'Published'
    if (theme.hasDraft) return 'Saved draft'
    if (theme.instance_status === 'archived') return 'Archived'
    return 'Inactive'
}

function statusVariant(theme: SiteThemeRecord): 'success' | 'info' | 'default' | 'warning' {
    if (theme.isCurrentlyPublished) return 'success'
    if (theme.hasDraft) return 'info'
    if (theme.instance_status === 'archived') return 'default'
    return 'default'
}

/**
 * ThemeLibraryCard
 *
 * Displays one installed site theme with its status, last modified/published
 * date, and an accessible action menu. Composes exclusively from @letbuyy/ui
 * and --lb-* design tokens (no raw px, radius, or color values).
 *
 * Destructive actions (archive, delete) are not performed here — callers
 * receive the slug + name and show a ConfirmDialog before acting.
 */
export function ThemeLibraryCard({
    theme,
    store,
    onPublish,
    onDuplicate,
    onRename,
    onArchive,
    onDelete,
    onRollback,
    busySlug,
}: ThemeLibraryCardProps) {
    const router = useRouter()
    const isBusy = busySlug === theme.slug
    const isPublished = theme.isCurrentlyPublished
    const lastDate = theme.last_published_at || theme.last_modified_at
    const dateLabel = theme.last_published_at
        ? `Published ${formatEnIn(theme.last_published_at)}`
        : theme.last_modified_at
            ? `Modified ${formatEnIn(theme.last_modified_at)}`
            : 'Not yet published'

    const menuItems: DropdownItem[] = [
        {
            id: 'customize',
            label: 'Customize',
            icon: <Edit3 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
            onSelect: () => {
                router.push(`/${store}/online-store/themes/${theme.slug}/editor`)
            },
        },
        {
            id: 'preview',
            label: 'Preview in editor',
            icon: <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
            onSelect: () => {
                window.open(`/${store}/online-store/themes/${theme.slug}/editor`, '_blank', 'noopener,noreferrer')
            },
        },
        ...(isPublished ? [] : [
            {
                id: 'publish',
                label: 'Publish',
                icon: <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                onSelect: () => onPublish(theme.slug),
                disabled: isBusy,
            } satisfies DropdownItem,
        ]),
        {
            id: 'duplicate',
            label: 'Duplicate',
            icon: <Copy className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
            onSelect: () => onDuplicate(theme.slug),
            disabled: isBusy,
        },
        {
            id: 'rename',
            label: 'Rename',
            icon: <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
            onSelect: () => onRename(theme.slug, theme.name),
            disabled: isBusy,
        },
        ...(onRollback ? [
            {
                id: 'rollback',
                label: 'View history',
                icon: <RotateCcw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                onSelect: () => onRollback(theme.slug),
            } satisfies DropdownItem,
        ] : []),
        ...(!isPublished && theme.instance_status !== 'archived' ? [
            {
                id: 'archive',
                label: 'Archive',
                onSelect: () => onArchive(theme.slug, theme.name),
                disabled: isBusy,
            } satisfies DropdownItem,
        ] : []),
        ...(!isPublished ? [
            {
                id: 'delete',
                label: 'Delete',
                icon: <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                destructive: true,
                onSelect: () => onDelete(theme.slug, theme.name),
                disabled: isBusy,
            } satisfies DropdownItem,
        ] : []),
    ]

    return (
        <article
            className="flex min-w-0 flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]"
            aria-label={`${theme.name} theme`}
        >
            {theme.thumbnail_url && <img className="theme-library-thumbnail" src={theme.thumbnail_url} alt={`${theme.name} design preview`} loading="lazy" />}
            {/* Card header */}
            <div className="flex min-w-0 items-start justify-between gap-[var(--lb-space-2)]">
                <div className="min-w-0">
                    <p className="m-0 truncate text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        {theme.name}
                    </p>
                    <p className="m-0 mt-[var(--lb-space-1)] truncate text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {dateLabel}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-[var(--lb-space-2)]">
                    <Badge label={statusLabel(theme)} variant={statusVariant(theme)} />
                    <Dropdown
                        trigger={
                            <Button
                                unstyled
                                type="button"
                                className="flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] items-center justify-center rounded-[var(--lb-radius-md)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-hovered)] hover:text-[color:var(--lb-color-text)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]"
                                aria-label={`More actions for ${theme.name}`}
                                disabled={isBusy}
                            >
                                <MoreHorizontal className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </Button>
                        }
                        items={menuItems}
                        align="end"
                    />
                </div>
            </div>

            {/* Card footer: quick actions */}
            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                {theme.updateAvailable && (
                    <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-caution)]">
                        Update available
                    </span>
                )}
                {theme.hasDraft && !theme.isCurrentlyPublished && (
                    <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-info)]">
                        Saved draft
                    </span>
                )}
                <div className="ml-auto flex items-center gap-[var(--lb-space-2)]">
                    {!isPublished && (
                        <Button
                            unstyled
                            type="button"
                            className="inline-flex h-[var(--lb-size-control-sm)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)] focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)] disabled:opacity-50"
                            onClick={() => onPublish(theme.slug)}
                            disabled={isBusy}
                            aria-label={`Publish ${theme.name}`}
                        >
                            <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Publish
                        </Button>
                    )}
                    <Button
                        unstyled
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-sm)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-strong)] bg-[var(--lb-color-primary)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-none text-[color:var(--lb-color-text-on-primary)] hover:opacity-90 focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)] disabled:opacity-50"
                        onClick={() => {
                            router.push(`/${store}/online-store/themes/${theme.slug}/editor`)
                        }}
                        disabled={isBusy}
                        aria-label={`Customize ${theme.name}`}
                    >
                        <Edit3 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Customize
                    </Button>
                </div>
            </div>
        </article>
    )
}
