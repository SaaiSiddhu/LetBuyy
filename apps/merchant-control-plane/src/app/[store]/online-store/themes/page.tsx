'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    ConfirmDialog,
    Copy,
    Edit3,
    EmptyState,
    Eye,
    FileJson,
    Page,
    PageHeader,
    Palette,
    Rocket,
    Section,
    Skeleton,
    Tooltip,
    Upload,
    XCircle,
    useToast,
} from '@letbuyy/ui'

interface ThemeConfig {
    colors?: {
        primary?: string
        secondary?: string
        background?: string
        text?: string
        accent?: string
    }
    fonts?: { heading?: string; body?: string }
    layout?: Record<string, unknown>
    darkMode?: boolean
}

interface ThemeRecord {
    id: string
    name: string
    slug: string
    site_type: string
    category: string | null
    description: string | null
    long_description: string | null
    preview_url: string | null
    thumbnail_url: string | null
    is_premium: boolean
    price: number
    config: ThemeConfig
    author: string
    version: string
    is_active: boolean
    sort_order: number
    install_count: number
    letbuyy_pricing_type: string
    letbuyy_price_usd: number
    letbuyy_price_inr: number
    features: string[]
    tags: string[]
    rating_avg: number
    review_count: number
    installed?: boolean
    active?: boolean
}

function getStorefrontUrl(store: string) {
    if (process.env.NODE_ENV !== 'production') {
        const localStorefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_LOCAL_URL || 'http://localhost:3003'
        return `${localStorefrontUrl.replace(/\/$/, '')}/store/${encodeURIComponent(store)}`
    }

    return `https://${store}.letbuyy.store`
}

export default function ThemesPage() {
    const params = useParams()
    const router = useRouter()
    const store = params.store as string
    const { notify } = useToast()
    const [versionOpen, setVersionOpen] = useState(false)

    const [loading, setLoading] = useState(true)
    const [themes, setThemes] = useState<ThemeRecord[]>([])
    const [currentTheme, setCurrentTheme] = useState<ThemeRecord | null>(null)
    const [storeStatus, setStoreStatus] = useState<string | null>(null)
    const [storeId, setStoreId] = useState<string | null>(null)
    const [installing, setInstalling] = useState<string | null>(null)
    const [publishing, setPublishing] = useState(false)
    const [uploadingBundle, setUploadingBundle] = useState(false)
    const [uploadMessage, setUploadMessage] = useState<string | null>(null)
    const [uploadMessageKind, setUploadMessageKind] = useState<'success' | 'warning' | null>(null)
    const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false)
    const bundleInputRef = useRef<HTMLInputElement>(null)

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)

            const res = await fetch(`/api/themes?store_name=${encodeURIComponent(store)}`)
            if (!res.ok) throw new Error('Failed to fetch themes')
            const data = await res.json()

            if (data.themes) setThemes(data.themes)
            if (data.currentTheme) setCurrentTheme(data.currentTheme)
            if (data.storeStatus) setStoreStatus(data.storeStatus)
            if (data.storeId) setStoreId(data.storeId)
        } catch (err) {
            console.error('Failed to fetch themes:', err)
            notify({
                title: 'Theme library could not load',
                description: err instanceof Error ? err.message : 'Refresh the page and try again.',
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void fetchData()
    }, [fetchData])

    const handleInstall = async (themeSlug: string) => {
        if (!storeId || installing) return
        setInstalling(themeSlug)
        try {
            const res = await fetch('/api/themes/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeId, themeSlug }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(typeof data?.error?.message === 'string' ? data.error.message : 'Theme install failed')
            }
            await fetchData()
            notify({
                title: 'Theme installed',
                description: 'The theme is now available in this store library.',
                variant: 'success',
            })
        } catch (err) {
            console.error('Install failed:', err)
            notify({
                title: 'Theme install failed',
                description: err instanceof Error ? err.message : 'Try installing the theme again.',
                variant: 'critical',
            })
        } finally {
            setInstalling(null)
        }
    }

    const handleBundleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || uploadingBundle) return

        if (!storeId) {
            setUploadMessage('Store context is unavailable')
            setUploadMessageKind('warning')
            notify({
                title: 'Upload unavailable',
                description: 'Store context is unavailable.',
                variant: 'warning',
            })
            event.target.value = ''
            return
        }

        setUploadingBundle(true)
        setUploadMessage(null)
        setUploadMessageKind(null)

        try {
            const bundle = JSON.parse(await file.text()) as unknown
            if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
                throw new Error('Theme package must be a JSON object')
            }

            const res = await fetch('/api/themes/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeId, bundle }),
            })
            const data = await res.json().catch(() => null) as Record<string, unknown> | null

            if (!res.ok) {
                const errorRecord = data?.error && typeof data.error === 'object'
                    ? data.error as Record<string, unknown>
                    : null
                const message = typeof errorRecord?.message === 'string'
                    ? errorRecord.message
                    : 'Theme package upload failed'
                throw new Error(message)
            }

            const theme = data?.theme && typeof data.theme === 'object'
                ? data.theme as Record<string, unknown>
                : {}
            const name = typeof theme.name === 'string' ? theme.name : 'theme package'
            setUploadMessage(`Installed ${name}`)
            setUploadMessageKind('success')
            await fetchData()
            notify({
                title: 'Theme package installed',
                description: `${name} is now available in the theme library.`,
                variant: 'success',
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Theme package upload failed'
            setUploadMessage(message)
            setUploadMessageKind('warning')
            notify({
                title: 'Theme upload failed',
                description: message,
                variant: 'critical',
            })
        } finally {
            setUploadingBundle(false)
            if (bundleInputRef.current) bundleInputRef.current.value = ''
        }
    }

    const performPublishToggle = async () => {
        if (!storeId || publishing) return
        setPublishing(true)
        try {
            const action = storeStatus === 'published' ? 'unpublish' : 'publish'
            const res = await fetch('/api/themes/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeId, action }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(typeof data?.error?.message === 'string' ? data.error.message : 'Storefront publishing failed')
            }
            setStoreStatus(data.status)
            notify({
                title: action === 'publish' ? 'Store published' : 'Store unpublished',
                description: action === 'publish'
                    ? 'Customers can now view this storefront.'
                    : 'Customers can no longer view this storefront.',
                variant: action === 'publish' ? 'success' : 'warning',
            })
        } catch (err) {
            console.error('Publish toggle failed:', err)
            notify({
                title: 'Publishing update failed',
                description: err instanceof Error ? err.message : 'Try updating the storefront status again.',
                variant: 'critical',
            })
        } finally {
            setPublishing(false)
            setConfirmUnpublishOpen(false)
        }
    }

    const handlePublishToggle = () => {
        if (storeStatus === 'published') {
            setConfirmUnpublishOpen(true)
            return
        }

        void performPublishToggle()
    }

    const openThemeEditor = () => {
        const editableTheme = currentTheme || themes[0]
        if (!editableTheme) return
        router.push(`/${store}/online-store/themes/${editableTheme.slug}/editor`)
    }

    const themeColors = currentTheme?.config?.colors
    const themePalette = themeColors
        ? [themeColors.primary, themeColors.secondary, themeColors.accent, themeColors.text].filter(Boolean) as string[]
        : []
    const displayColors = themePalette.length > 0
        ? themePalette
        : ['var(--lb-color-primary)', 'var(--lb-color-info)', 'var(--lb-color-warning)', 'var(--lb-color-text)']
    const draftThemes = themes.filter((theme) => !isThemeCurrent(theme, currentTheme?.slug))

    const isPublished = storeStatus === 'published'
    const storefrontUrl = getStorefrontUrl(store)
    const uploadIsSuccess = uploadMessageKind === 'success'

    return (
        <Page>
            <PageHeader
                breadcrumbs={[
                    { label: 'Home', href: `/${store}/dashboard` },
                    { label: 'Online Store' },
                ]}
                eyebrow="Online Store"
                title="Themes"
                description="Manage the storefront theme, preview the live site, and install JSON-contract theme packages."
                primaryAction={{
                    label: 'Edit theme',
                    onClick: openThemeEditor,
                    disabled: loading || (!currentTheme && themes.length === 0),
                    icon: <Edit3 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'View store',
                        href: storefrontUrl,
                        icon: <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            <Card>
                <Section
                    title="Current theme"
                    description="Preview the storefront and manage publishing status from one place."
                    action={
                        <Badge
                            label={isPublished ? 'Published' : 'Draft'}
                            variant={isPublished ? 'success' : 'warning'}
                        />
                    }
                >
                    {loading ? (
                        <div className="grid gap-[var(--lb-space-5)] lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
                            <Skeleton variant="card" className="min-h-[calc(var(--lb-space-7)*5)]" />
                            <Skeleton variant="table" lines={5} />
                        </div>
                    ) : (
                        <div className="grid gap-[var(--lb-space-5)] lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
                            <div className="overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-bg)] shadow-[var(--lb-shadow-sm)]">
                                <div className="flex items-center gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                    <div className="flex gap-[var(--lb-space-1)]" aria-hidden="true">
                                        <span className="h-[var(--lb-space-2)] w-[var(--lb-space-2)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-critical)]" />
                                        <span className="h-[var(--lb-space-2)] w-[var(--lb-space-2)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-warning)]" />
                                        <span className="h-[var(--lb-space-2)] w-[var(--lb-space-2)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-success)]" />
                                    </div>
                                    <span className="min-w-0 flex-1 truncate rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-1)] text-center text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        {storefrontUrl}
                                    </span>
                                    <a
                                        href={storefrontUrl}
                                        className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-primary)] hover:text-[var(--lb-color-primary-hover)]"
                                    >
                                        Open
                                    </a>
                                </div>
                                <div
                                    className="grid min-h-[calc(var(--lb-space-7)*8)] gap-[var(--lb-space-4)] bg-[var(--lb-color-surface)] p-[var(--lb-space-5)] md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]"
                                    aria-label={`${currentTheme?.name || 'Current theme'} storefront preview mock`}
                                >
                                    <div
                                        className="flex min-h-[calc(var(--lb-space-7)*5)] flex-col justify-between rounded-[var(--lb-radius-lg)] p-[var(--lb-space-5)] text-[var(--lb-color-surface)] shadow-[var(--lb-shadow-sm)]"
                                        style={{ backgroundColor: displayColors[0] }}
                                    >
                                        <div className="space-y-[var(--lb-space-3)]">
                                            <div className="h-[var(--lb-space-3)] w-[var(--lb-space-7)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] opacity-80" />
                                            <div className="h-[var(--lb-space-5)] max-w-[360px] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] opacity-95" />
                                            <div className="h-[var(--lb-space-3)] max-w-[280px] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] opacity-70" />
                                        </div>
                                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                            <span className="h-[var(--lb-space-5)] w-[var(--lb-space-7)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] opacity-95" />
                                            <span className="h-[var(--lb-space-5)] w-[var(--lb-space-7)] rounded-[var(--lb-radius-full)] border border-[var(--lb-color-surface)] opacity-80" />
                                        </div>
                                    </div>
                                    <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                                        {[0, 1, 2, 3].map((item) => (
                                            <div
                                                key={item}
                                                className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] shadow-[var(--lb-shadow-sm)]"
                                            >
                                                <div
                                                    className="mb-[var(--lb-space-3)] h-[var(--lb-space-7)] rounded-[var(--lb-radius-md)]"
                                                    style={{ backgroundColor: displayColors[(item + 1) % displayColors.length] }}
                                                />
                                                <div className="space-y-[var(--lb-space-2)]">
                                                    <div className="h-[var(--lb-space-2)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-border-strong)]" />
                                                    <div className="h-[var(--lb-space-2)] w-2/3 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-border)]" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <div className="space-y-[var(--lb-space-2)]">
                                    <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                                        <div>
                                            <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                                {currentTheme?.name || 'No theme selected'}
                                            </h3>
                                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {currentTheme
                                                    ? `${currentTheme.category || 'Custom'} by ${currentTheme.author || 'LetBuyy'}`
                                                    : 'Select a theme from the library below.'}
                                            </p>
                                        </div>
                                        <Badge label="Current theme" variant="info" />
                                    </div>

                                    <div className="flex flex-wrap gap-[var(--lb-space-2)]" aria-label="Current theme colors">
                                        {displayColors.map((color, index) => (
                                            <span
                                                key={`${color}-${index}`}
                                                className="h-[var(--lb-space-5)] w-[var(--lb-space-5)] rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)]"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <Banner
                                    title={isPublished ? 'Store is live' : 'Store is in draft mode'}
                                    variant={isPublished ? 'success' : 'info'}
                                >
                                    {isPublished
                                        ? 'Customers can view this storefront.'
                                        : 'Only signed-in merchants can preview this storefront until it is published.'}
                                </Banner>

                                {currentTheme && (
                                    <div className="space-y-[var(--lb-space-2)]">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setVersionOpen((current) => !current)}
                                        >
                                            <FileJson className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            Version {currentTheme.version || '1.0.0'}
                                        </Button>
                                        {versionOpen && (
                                            <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                                    You&apos;re up to date on the latest version.
                                                </p>
                                                <p className="m-0">
                                                    Current version: {currentTheme.name} {currentTheme.version || '1.0.0'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-auto flex flex-wrap gap-[var(--lb-space-2)]">
                                    <Button onClick={openThemeEditor} disabled={!currentTheme && themes.length === 0}>
                                        <Edit3 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        Edit theme
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => window.open(storefrontUrl, '_blank', 'noopener,noreferrer')}
                                    >
                                        <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        Preview
                                    </Button>
                                    <Tooltip content="Duplicate needs a backend draft-copy endpoint before it can create a new theme draft.">
                                        <span>
                                            <Button variant="outline" disabled>
                                                <Copy className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                Duplicate
                                            </Button>
                                        </span>
                                    </Tooltip>
                                    <Button
                                        variant={isPublished ? 'outline' : 'primary'}
                                        loading={publishing}
                                        onClick={handlePublishToggle}
                                        disabled={!storeId}
                                    >
                                        {isPublished
                                            ? <XCircle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            : <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                        {isPublished ? 'Unpublish' : 'Publish'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Section>
            </Card>

            <Card>
                <Section
                    title="Upload theme package"
                    description="Install a JSON-contract bundle that the Commerce API validates before it becomes available."
                    action={
                        <Button
                            variant="outline"
                            loading={uploadingBundle}
                            onClick={() => bundleInputRef.current?.click()}
                            disabled={!storeId || loading}
                        >
                            <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Upload JSON
                        </Button>
                    }
                >
                    <input
                        ref={bundleInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        disabled={uploadingBundle}
                        onChange={handleBundleUpload}
                    />
                    {uploadMessage ? (
                        <Banner variant={uploadIsSuccess ? 'success' : 'warning'}>
                            {uploadMessage}
                        </Banner>
                    ) : (
                        <div className="flex items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                            <div className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Upload className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)]" aria-hidden="true" />
                            </div>
                            <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                Choose a JSON bundle to install it as a selectable store theme.
                            </p>
                        </div>
                    )}
                </Section>
            </Card>

            <Card>
                <Section
                    title="Draft themes"
                    description="Preview, publish, or prepare alternate themes without losing sight of the current live theme."
                    action={<Badge label={`${draftThemes.length} draft${draftThemes.length === 1 ? '' : 's'}`} variant="default" />}
                >
                    {loading ? (
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-3">
                            <Skeleton variant="card" />
                            <Skeleton variant="card" />
                            <Skeleton variant="card" />
                        </div>
                    ) : draftThemes.length === 0 ? (
                        <EmptyState
                            icon={<Palette className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)]" aria-hidden="true" />}
                            title="No draft themes yet"
                            body="Alternate themes will appear here after a package is uploaded or a marketplace theme is added as a draft."
                            primaryAction={
                                <Button onClick={() => bundleInputRef.current?.click()}>
                                    Upload theme
                                </Button>
                            }
                        />
                    ) : (
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-3">
                            {draftThemes.map((theme) => (
                                <ThemeLibraryCard
                                    key={theme.slug}
                                    theme={theme}
                                    installing={installing === theme.slug}
                                    onPublish={() => void handleInstall(theme.slug)}
                                    onPreview={() => router.push(`/${store}/online-store/themes/${theme.slug}/editor`)}
                                />
                            ))}
                        </div>
                    )}
                </Section>
            </Card>

            <ConfirmDialog
                open={confirmUnpublishOpen}
                title="Unpublish storefront?"
                description="Customers will no longer be able to view this storefront until it is published again."
                confirmLabel="Unpublish"
                destructive
                onClose={() => setConfirmUnpublishOpen(false)}
                onConfirm={() => void performPublishToggle()}
            />
        </Page>
    )
}

function ThemeLibraryCard({
    theme,
    installing,
    onPublish,
    onPreview,
}: {
    theme: ThemeRecord
    installing: boolean
    onPublish: () => void
    onPreview: () => void
}) {
    const colors = theme.config?.colors || {}
    const palette = [
        colors.primary || 'var(--lb-color-primary)',
        colors.secondary || 'var(--lb-color-info)',
        colors.accent || 'var(--lb-color-warning)',
    ]
    const themeState = theme.installed ? 'Draft' : 'Available draft'

    return (
        <article className="overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)]">
            <div className="relative flex h-[calc(var(--lb-space-7)*3)] items-end overflow-hidden bg-[var(--lb-color-primary-soft)] p-[var(--lb-space-4)]">
                <div className="absolute inset-0 grid grid-cols-3" aria-hidden="true">
                    {palette.map((color, index) => (
                        <span
                            key={`${theme.slug}-preview-${index}`}
                            style={{ backgroundColor: color } satisfies CSSProperties}
                        />
                    ))}
                </div>
                <div className="absolute inset-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-surface)] bg-[var(--lb-color-surface)] opacity-60 shadow-[var(--lb-shadow-sm)]" aria-hidden="true" />
                <div className="absolute inset-x-[var(--lb-space-7)] top-[var(--lb-space-6)] h-[var(--lb-space-3)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] opacity-90" aria-hidden="true" />
                <div className="absolute inset-x-[var(--lb-space-7)] top-[calc(var(--lb-space-6)+var(--lb-space-5))] h-[var(--lb-space-3)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] opacity-70" aria-hidden="true" />
                <div className="relative z-[1] flex flex-wrap gap-[var(--lb-space-2)]">
                    <Badge label={theme.category || theme.site_type || 'Theme'} variant="info" />
                    {theme.is_premium && <Badge label="Premium" variant="warning" />}
                </div>
            </div>

            <div className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-4)]">
                <div className="space-y-[var(--lb-space-2)]">
                    <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                        <div>
                            <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                {theme.name}
                            </h3>
                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                by {theme.author || 'LetBuyy'}
                            </p>
                        </div>
                        <Badge label={themeState} variant={theme.installed ? 'info' : 'default'} />
                    </div>

                    <p className="m-0 min-h-[calc(var(--lb-line-height-body)*2em)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                        {theme.description || 'A production-ready theme package for this storefront.'}
                    </p>
                </div>

                <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                    <div className="flex gap-[var(--lb-space-1)]" aria-label={`${theme.name} palette`}>
                        {palette.map((color, index) => (
                            <span
                                key={`${theme.slug}-${index}`}
                                className="h-[var(--lb-space-4)] w-[var(--lb-space-4)] rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)]"
                                style={{ backgroundColor: color } satisfies CSSProperties}
                            />
                        ))}
                    </div>
                    <span className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        {theme.review_count > 0
                            ? `${theme.rating_avg.toFixed(1)} rating`
                            : `${theme.install_count.toLocaleString()} installs`}
                    </span>
                </div>

                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                    <Button variant="outline" onClick={onPreview}>
                        <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Preview
                    </Button>
                    <Tooltip content="Duplicate needs a backend draft-copy endpoint before it can create a new theme draft.">
                        <span>
                            <Button variant="outline" disabled>
                                <Copy className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Duplicate
                            </Button>
                        </span>
                    </Tooltip>
                    <Button
                        loading={installing}
                        variant="primary"
                        onClick={onPublish}
                    >
                        <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Publish
                    </Button>
                </div>
            </div>
        </article>
    )
}

function isThemeCurrent(theme: ThemeRecord, currentSlug?: string) {
    return theme.active === true || (currentSlug ? theme.slug === currentSlug : false)
}
