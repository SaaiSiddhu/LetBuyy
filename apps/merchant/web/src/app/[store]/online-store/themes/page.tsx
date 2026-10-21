'use client'

import { useReadRequest } from '@/lib/api/use-read-request'
import { MerchantNavigationLink } from '@/components/MerchantNavigationLink'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Input,
    Banner,
    ChevronDown,
    ConfirmDialog,
    Copy,
    Edit3,
    ExternalLink,
    Eye,
    Lock,
    MoreHorizontal,
    Page,
    Palette,
    Rocket,
    Skeleton,
    Store,
    Upload,
    XCircle,
    letbuyyPrimitiveTokens,
    useToast,
} from '@letbuyy/ui'
import { getStorefrontStoreUrl, getThemeMarketplaceUrl } from '@/lib/public-urls'
import { ThemeLibraryWorkspace } from '@/components/theme-library/ThemeLibraryWorkspace'

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
    return getStorefrontStoreUrl(store)
}

function getThemeStoreUrl() {
    return getThemeMarketplaceUrl('/themes')
}

function getThemePalette(theme?: ThemeRecord | null) {
    const colors = theme?.config?.colors
    const palette = [
        colors?.primary,
        colors?.secondary,
        colors?.accent,
        colors?.background,
        colors?.text,
    ].filter(Boolean) as string[]

    return palette.length > 0
        ? palette.slice(0, 5)
        : [
            letbuyyPrimitiveTokens.color.gray[900],
            'rgb(79 127 240)',
            'rgb(242 169 59)',
            'rgb(247 247 245)',
            'rgb(217 217 214)',
        ]
}

function themePreviewVars(palette: string[]): CSSProperties {
    return {
        '--themes-preview-a': palette[0],
        '--themes-preview-b': palette[1] || palette[0],
        '--themes-preview-c': palette[2] || palette[1] || palette[0],
        '--themes-preview-d': palette[3] || letbuyyPrimitiveTokens.color.gray[50],
        '--themes-preview-e': palette[4] || letbuyyPrimitiveTokens.color.gray[900],
    } as CSSProperties
}

function formatThemeMeta(theme?: ThemeRecord | null) {
    if (!theme) return 'Select a theme from the library below.'
    const category = theme.category || theme.site_type || 'Theme'
    const author = theme.author || 'LetBuyy'
    return `${category} by ${author}`
}

function isThemeCurrent(theme: ThemeRecord, currentSlug?: string) {
    return theme.active === true || (currentSlug ? theme.slug === currentSlug : false)
}

export default function ThemesPage() {
    const params = useParams()
    const router = useRouter()
    const store = params.store as string
    const { notify } = useToast()
    const [versionOpen, setVersionOpen] = useState(false)
    const [libraryTab, setLibraryTab] = useState<'library' | 'discover'>('library')

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
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

    const beginRead = useReadRequest(store)
    const fetchData = useCallback(async () => {
        const request = beginRead()
        setLoadError(null)
        try {
            setLoading(true)

            const res = await fetch(`/api/themes?store_name=${encodeURIComponent(store)}`, { cache: 'no-store', signal: request.signal })
            if (!res.ok) throw new Error('Failed to fetch themes')
            const data = await res.json()
            if (!request.isCurrent()) return

            if (data.themes) setThemes(data.themes)
            setCurrentTheme(data.currentTheme || null)
            setStoreStatus(data.storeStatus || null)
            setStoreId(data.storeId || null)
        } catch (err) {
            if (!request.isCurrent()) return
            setLoadError('The theme workspace could not be loaded. Try again.')
            console.error('Failed to fetch themes:', err)
            notify({
                title: 'Theme library could not load',
                description: err instanceof Error ? err.message : 'Refresh the page and try again.',
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

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
                title: 'Theme added',
                description: 'The theme is now available in this store library.',
                variant: 'success',
            })
        } catch (err) {
            console.error('Install failed:', err)
            notify({
                title: 'Theme add failed',
                description: err instanceof Error ? err.message : 'Try adding the theme again.',
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
                title: 'Import unavailable',
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
                    : 'Theme package import failed'
                throw new Error(message)
            }

            const theme = data?.theme && typeof data.theme === 'object'
                ? data.theme as Record<string, unknown>
                : {}
            const name = typeof theme.name === 'string' ? theme.name : 'theme package'
            setUploadMessage(`Imported ${name}`)
            setUploadMessageKind('success')
            await fetchData()
            notify({
                title: 'Theme package imported',
                description: `${name} is now available in the theme library.`,
                variant: 'success',
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Theme package import failed'
            setUploadMessage(message)
            setUploadMessageKind('warning')
            notify({
                title: 'Theme import failed',
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

    const isPublished = storeStatus === 'published'
    const storefrontUrl = getStorefrontUrl(store)
    const themeStoreUrl = getThemeStoreUrl()
    const uploadIsSuccess = uploadMessageKind === 'success'
    const heroTheme = currentTheme || themes[0] || null
    const heroPalette = getThemePalette(heroTheme)
    const discoverThemes = themes.filter((theme) => !isThemeCurrent(theme, currentTheme?.slug))

    return (
        <Page className="themes-admin-page">
            <header className="themes-page-header">
                <div className="themes-page-heading">
                    <span className="themes-page-icon" aria-hidden="true">
                        <Store className="letbuyy-icon" />
                    </span>
                    <h1>Online Store</h1>
                </div>
                <div className="themes-page-actions">
                    <a className="themes-button themes-button-muted" href={storefrontUrl} target="_blank" rel="noreferrer">
                        View store
                    </a>
                    <Button unstyled className="themes-icon-button" type="button" aria-label="More online store actions">
                        <MoreHorizontal className="letbuyy-icon" aria-hidden="true" />
                    </Button>
                </div>
            </header>

            <Input unstyled
                ref={bundleInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                disabled={uploadingBundle}
                onChange={handleBundleUpload}
            />

            {loadError && <Banner variant="critical" title="Theme workspace could not load" action={<Button variant="secondary" onClick={() => { void fetchData() }}>Retry</Button>}>{loadError}</Banner>}

            {uploadMessage && (
                <Banner variant={uploadIsSuccess ? 'success' : 'warning'}>
                    {uploadMessage}
                </Banner>
            )}

            {loading ? (
                <Skeleton variant="card" className="themes-current-skeleton" />
            ) : loadError ? null : (
                <section className="themes-current-card" aria-label="Current theme">
                    <div className="themes-preview-stage">
                        <ThemeDevicePreview
                            theme={heroTheme}
                            palette={heroPalette}
                            storefrontUrl={storefrontUrl}
                        />
                    </div>

                    {!isPublished && (
                        <div className="themes-password-strip">
                            <div className="themes-password-message">
                                <Lock className="letbuyy-icon" aria-hidden="true" />
                                <span>Password protected: to remove the password, pick a plan</span>
                            </div>
                            <div className="themes-password-actions">
                                <Button unstyled type="button" className="themes-text-button">
                                    Edit password
                                </Button>
                                <MerchantNavigationLink className="themes-button themes-button-secondary" href={`/${store}/settings/plan`}>
                                    Pick a plan
                                </MerchantNavigationLink>
                            </div>
                        </div>
                    )}

                    <div className="themes-current-info">
                        <div className="themes-current-copy">
                            <h2>{heroTheme?.name || 'No theme selected'}</h2>
                            <p>{heroTheme ? 'Added: Today' : 'Add a theme from the library below.'}</p>
                            <Button unstyled
                                type="button"
                                className="themes-version-button"
                                onClick={() => setVersionOpen((current) => !current)}
                                disabled={!heroTheme}
                                aria-expanded={versionOpen}
                            >
                                Version {heroTheme?.version || '1.0.0'}
                                <ChevronDown className="letbuyy-icon" aria-hidden="true" />
                            </Button>
                            {versionOpen && heroTheme && (
                                <div className="themes-version-popover">
                                    <strong>You&apos;re up to date.</strong>
                                    <span>{heroTheme.name} {heroTheme.version || '1.0.0'}</span>
                                </div>
                            )}
                        </div>

                        <div className="themes-current-actions">
                            <Button unstyled className="themes-icon-button themes-card-more" type="button" aria-label="More theme actions">
                                <MoreHorizontal className="letbuyy-icon" aria-hidden="true" />
                            </Button>
                            <Button unstyled
                                className="themes-button themes-button-primary"
                                type="button"
                                onClick={openThemeEditor}
                                disabled={!heroTheme}
                            >
                                <Edit3 className="letbuyy-icon" aria-hidden="true" />
                                Edit theme
                            </Button>
                            <Button unstyled
                                className="themes-button themes-button-secondary"
                                type="button"
                                onClick={() => window.open(storefrontUrl, '_blank', 'noopener,noreferrer')}
                            >
                                <Eye className="letbuyy-icon" aria-hidden="true" />
                                Preview
                            </Button>
                            <Button unstyled className="themes-button themes-button-secondary" type="button" disabled>
                                <Copy className="letbuyy-icon" aria-hidden="true" />
                                Duplicate
                            </Button>
                            <Button unstyled
                                className="themes-button themes-button-primary"
                                type="button"
                                disabled={!storeId}
                                onClick={handlePublishToggle}
                            >
                                {isPublished
                                    ? <XCircle className="letbuyy-icon" aria-hidden="true" />
                                    : <Rocket className="letbuyy-icon" aria-hidden="true" />}
                                {publishing ? 'Saving...' : isPublished ? 'Unpublish' : 'Publish'}
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            {/* ── Tab strip: My themes / Discover ─────────────────────────── */}
            <div
                role="tablist"
                aria-label="Theme workspace"
                className="flex items-center gap-0 border-b border-[var(--lb-color-border)]"
            >
                <Button
                    unstyled
                    type="button"
                    role="tab"
                    aria-selected={libraryTab === 'library'}
                    aria-controls="themes-library-panel"
                    id="themes-library-tab"
                    className={[
                        'inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] border-b-2 px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-none focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]',
                        libraryTab === 'library'
                            ? 'border-[var(--lb-color-primary)] text-[color:var(--lb-color-primary)]'
                            : 'border-transparent text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)]',
                    ].join(' ')}
                    onClick={() => setLibraryTab('library')}
                >
                    My themes
                </Button>
                <Button
                    unstyled
                    type="button"
                    role="tab"
                    aria-selected={libraryTab === 'discover'}
                    aria-controls="themes-discover-panel"
                    id="themes-discover-tab"
                    className={[
                        'inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] border-b-2 px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-none focus-visible:outline focus-visible:outline-[var(--lb-color-focus-ring)]',
                        libraryTab === 'discover'
                            ? 'border-[var(--lb-color-primary)] text-[color:var(--lb-color-primary)]'
                            : 'border-transparent text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)]',
                    ].join(' ')}
                    onClick={() => setLibraryTab('discover')}
                >
                    Discover themes
                </Button>
            </div>

            {/* ── My themes panel ──────────────────────────────────────────── */}
            <div
                id="themes-library-panel"
                role="tabpanel"
                aria-labelledby="themes-library-tab"
                hidden={libraryTab !== 'library'}
            >
                {!loadError && <ThemeLibraryWorkspace key={store} store={store} storeId={storeId} />}
            </div>

            <section
                id="themes-discover-panel"
                role="tabpanel"
                aria-labelledby="themes-discover-tab"
                className="themes-discover-section"
                aria-label="Discover themes"
                hidden={libraryTab !== 'discover'}
            >
                <div className="themes-section-header">
                    <h2>Discover themes</h2>
                    <div className="themes-section-actions">
                        <a className="themes-button themes-button-muted" href={themeStoreUrl} target="_blank" rel="noreferrer">
                            Visit Theme Store
                        </a>
                        <Button unstyled
                            className="themes-button themes-button-muted"
                            type="button"
                            onClick={() => bundleInputRef.current?.click()}
                            disabled={!storeId || loading || uploadingBundle}
                        >
                            {uploadingBundle ? 'Importing...' : 'Import'}
                            <ChevronDown className="letbuyy-icon" aria-hidden="true" />
                        </Button>
                    </div>
                </div>

                <div className="themes-discover-panel">
                    {loading ? (
                        <div className="themes-discover-grid">
                            <Skeleton variant="card" />
                            <Skeleton variant="card" />
                            <Skeleton variant="card" />
                        </div>
                    ) : (
                        <div className="themes-discover-grid">
                            {discoverThemes.map((theme) => (
                                <ThemeLibraryCard
                                    key={theme.slug}
                                    theme={theme}
                                    installing={installing === theme.slug}
                                    onAdd={() => void handleInstall(theme.slug)}
                                    onPreview={() => router.push(`/${store}/online-store/themes/${theme.slug}/editor`)}
                                />
                            ))}
                            <article className="themes-explore-card">
                                <div>
                                    <Palette className="letbuyy-icon" aria-hidden="true" />
                                    <h3>Explore more themes</h3>
                                    <p>Browse professionally designed free and paid themes.</p>
                                </div>
                                <a className="themes-button themes-button-secondary" href={themeStoreUrl} target="_blank" rel="noreferrer">
                                    <ExternalLink className="letbuyy-icon" aria-hidden="true" />
                                    Visit Theme Store
                                </a>
                            </article>
                        </div>
                    )}
                </div>
            </section>

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

function ThemeDevicePreview({
    theme,
    palette,
    storefrontUrl,
}: {
    theme: ThemeRecord | null
    palette: string[]
    storefrontUrl: string
}) {
    const vars = themePreviewVars(palette)

    return (
        <div className="themes-device-wrap" style={vars}>
            <div className="themes-desktop-device">
                <div className="themes-browser-bar">
                    <span>{theme?.name || 'My Store'}</span>
                    <span>{storefrontUrl}</span>
                </div>
                <ThemePreviewArtwork theme={theme} />
            </div>
            <div className="themes-mobile-device">
                <div className="themes-mobile-top">
                    <span />
                    <strong>{theme?.name || 'My Store'}</strong>
                    <span />
                </div>
                <ThemePreviewArtwork theme={theme} compact />
            </div>
        </div>
    )
}

function ThemePreviewArtwork({ theme, compact = false }: { theme: ThemeRecord | null; compact?: boolean }) {
    const [imageFailed, setImageFailed] = useState(false)

    if (theme?.thumbnail_url && !imageFailed) {
        return (
            <img
                className="themes-preview-image"
                src={theme.thumbnail_url}
                alt={`${theme.name} theme preview`}
                onError={() => setImageFailed(true)}
            />
        )
    }

    return (
        <div className={`themes-preview-art ${compact ? 'themes-preview-art-compact' : ''}`}>
            <div className="themes-preview-sky" />
            <div className="themes-preview-hills" />
            <div className="themes-preview-panel">
                <span />
                <span />
                <span />
            </div>
            <div className="themes-preview-headline">Browse our latest products</div>
            <div className="themes-preview-products">
                <span />
                <span />
                <span />
            </div>
        </div>
    )
}

function ThemeLibraryCard({
    theme,
    installing,
    onAdd,
    onPreview,
}: {
    theme: ThemeRecord
    installing: boolean
    onAdd: () => void
    onPreview: () => void
}) {
    const palette = getThemePalette(theme)
    const vars = themePreviewVars(palette)
    const buttonLabel = theme.installed ? 'Added' : 'Add'

    return (
        <article className="themes-library-card" style={vars}>
            <Button unstyled className="themes-library-preview" type="button" onClick={onPreview} aria-label={`Preview ${theme.name}`}>
                <ThemePreviewArtwork theme={theme} />
            </Button>
            <div className="themes-library-body">
                <div className="themes-library-copy">
                    <Button unstyled type="button" className="themes-library-title" onClick={onPreview}>
                        {theme.name}
                    </Button>
                    <span>{formatThemeMeta(theme)}</span>
                </div>
                <Button unstyled
                    type="button"
                    className="themes-button themes-button-secondary"
                    onClick={onAdd}
                    disabled={installing || theme.installed}
                >
                    {installing ? 'Adding...' : buttonLabel}
                </Button>
            </div>
        </article>
    )
}
