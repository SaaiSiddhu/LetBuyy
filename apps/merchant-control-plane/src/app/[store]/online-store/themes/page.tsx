'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChangeEvent } from 'react'
import { useParams } from 'next/navigation'

/* ——————————————————————————————————————
   Types
   —————————————————————————————————————— */

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

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function ThemesPage() {
    const params = useParams()
    const store = params.store as string
    const [versionOpen, setVersionOpen] = useState(false)
    const [themeActionsOpen, setThemeActionsOpen] = useState(false)
    const themeActionsRef = useRef<HTMLDivElement>(null)

    // Dynamic data state
    const [loading, setLoading] = useState(true)
    const [themes, setThemes] = useState<ThemeRecord[]>([])
    const [currentTheme, setCurrentTheme] = useState<ThemeRecord | null>(null)
    const [storeStatus, setStoreStatus] = useState<string | null>(null)
    const [storeId, setStoreId] = useState<string | null>(null)
    const [installing, setInstalling] = useState<string | null>(null)
    const [publishing, setPublishing] = useState(false)
    const [uploadingBundle, setUploadingBundle] = useState(false)
    const [uploadMessage, setUploadMessage] = useState<string | null>(null)
    const bundleInputRef = useRef<HTMLInputElement>(null)

    // Fetch store ID and themes from the API
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
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Install a theme
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
            if (data.success) {
                // Refresh data
                await fetchData()
            }
        } catch (err) {
            console.error('Install failed:', err)
        } finally {
            setInstalling(null)
        }
    }

    const handleBundleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || uploadingBundle) return

        if (!storeId) {
            setUploadMessage('Store context is unavailable')
            event.target.value = ''
            return
        }

        setUploadingBundle(true)
        setUploadMessage(null)

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
            await fetchData()
        } catch (err) {
            setUploadMessage(err instanceof Error ? err.message : 'Theme package upload failed')
        } finally {
            setUploadingBundle(false)
            if (bundleInputRef.current) bundleInputRef.current.value = ''
        }
    }

    // Publish/Unpublish
    const handlePublishToggle = async () => {
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
            if (data.success) {
                setStoreStatus(data.status)
            }
        } catch (err) {
            console.error('Publish toggle failed:', err)
        } finally {
            setPublishing(false)
        }
    }

    // Close dropdown on outside click
    const handleOutsideClick = () => {
        if (versionOpen) setVersionOpen(false)
        if (themeActionsOpen) setThemeActionsOpen(false)
    }

    const openThemeEditor = () => {
        const editableTheme = currentTheme || themes[0]
        if (!editableTheme) return
        window.location.href = `/${store}/online-store/themes/${editableTheme.slug}/editor`
    }

    // Determine current theme colors for display
    const themeColors = currentTheme?.config?.colors
    const displayColors = themeColors
        ? [themeColors.primary, themeColors.secondary, themeColors.accent, themeColors.text].filter(Boolean) as string[]
        : ['#6366f1', '#8b5cf6', '#f59e0b', '#1f2937']

    const availableThemes = themes

    const isPublished = storeStatus === 'published'
    const storefrontUrl = getStorefrontUrl(store)

    return (
        <div className="online-store-page" onClick={handleOutsideClick}>
            {/* Page Header */}
            <div className="os-page-header">
                <h1 className="os-page-title">
                    <span className="material-symbols-outlined">storefront</span>
                    Online Store
                </h1>
                <div className="os-section-actions">
                    <a
                        href={storefrontUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="os-btn os-btn-outline"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                        View your store
                    </a>
                </div>
            </div>

            {/* Themes Section Header */}
            <div className="os-section-header">
                <h2 className="os-section-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>palette</span>
                    Themes
                </h2>
            </div>

            {loading ? (
                <div className="theme-preview-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                        <p>Loading themes...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Current Theme Preview Card */}
                    <div className="theme-preview-card">
                        <div className="theme-live-preview-frame">
                            <div className="theme-live-preview-toolbar">
                                <div className="theme-live-preview-dots">
                                    <span /><span /><span />
                                </div>
                                <div className="theme-live-preview-url">{storefrontUrl}</div>
                                <a
                                    href={storefrontUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="theme-live-preview-link"
                                >
                                    Open
                                </a>
                            </div>
                            <iframe
                                className="theme-live-preview-iframe"
                                src={storefrontUrl}
                                title={`${store} storefront preview`}
                                loading="lazy"
                            />
                        </div>

                        {/* Publish Status Banner */}
                        <div className={`theme-password-banner ${isPublished ? 'theme-status-published' : 'theme-status-draft'}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                {isPublished ? 'check_circle' : 'visibility_off'}
                            </span>
                            <span>
                                {isPublished
                                    ? 'Your store is live and visible to customers'
                                    : 'Your store is in draft mode — only you can see it'}
                            </span>
                            <div className="theme-password-actions">
                                <button
                                    className={`os-btn ${isPublished ? 'os-btn-outline' : 'os-btn-primary'} os-btn-sm`}
                                    onClick={handlePublishToggle}
                                    disabled={publishing}
                                >
                                    {publishing ? (
                                        <>
                                            <span className="loading-spinner-sm" />
                                            {isPublished ? 'Unpublishing...' : 'Publishing...'}
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                                {isPublished ? 'pause_circle' : 'rocket_launch'}
                                            </span>
                                            {isPublished ? 'Unpublish' : 'Publish'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Current Theme Info */}
                        <div className="theme-info-bar">
                            <div className="theme-info-left">
                                <div className="theme-info-colors">
                                    {displayColors.map((color, i) => (
                                        <span key={i} className="theme-info-dot" style={{ background: color }} />
                                    ))}
                                </div>
                                <div className="theme-info-details">
                                    <div className="theme-info-name-row">
                                        <span className="theme-info-name">{currentTheme?.name || 'No theme selected'}</span>
                                        <span className="theme-info-badge">Current theme</span>
                                    </div>
                                    <div className="theme-info-meta">
                                        {currentTheme
                                            ? `${currentTheme.category || 'Custom'} · ${currentTheme.author || 'Unknown'}`
                                            : 'Select a theme from below'}
                                    </div>
                                    {currentTheme && (
                                        <div className="theme-info-version-wrapper">
                                            <button
                                                className="theme-info-version"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setVersionOpen(!versionOpen)
                                                }}
                                            >
                                                Version {currentTheme.version || '1.0.0'}
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>expand_more</span>
                                            </button>
                                            {versionOpen && (
                                                <div className="os-dropdown-menu os-dropdown-version">
                                                    <div className="os-dropdown-version-content">
                                                        <div className="os-dropdown-version-dot" />
                                                        <div>
                                                            <strong>You&apos;re up to date on the latest version</strong>
                                                            <p>Your current version: {currentTheme.name} {currentTheme.version || '1.0.0'}</p>
                                                        </div>
                                                    </div>
                                                    <button className="os-btn os-btn-outline os-btn-sm" style={{ marginTop: '8px' }}>View release notes</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="theme-info-right">
                                <div className="theme-actions-wrapper" ref={themeActionsRef}>
                                    <button
                                        className="os-btn-icon theme-actions-trigger"
                                        type="button"
                                        aria-label="Open theme actions"
                                        aria-expanded={themeActionsOpen}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setThemeActionsOpen(!themeActionsOpen)
                                        }}
                                    >
                                        <span className="material-symbols-outlined">more_horiz</span>
                                    </button>
                                    {themeActionsOpen && (
                                        <div className="os-dropdown-menu theme-actions-menu" onClick={(e) => e.stopPropagation()}>
                                            <button className="os-dropdown-item" type="button" onClick={openThemeEditor}>
                                                <span className="material-symbols-outlined">edit</span>
                                                Edit theme
                                            </button>
                                            <a
                                                className="os-dropdown-item"
                                                href={storefrontUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <span className="material-symbols-outlined">visibility</span>
                                                Preview store
                                            </a>
                                            <button
                                                className="os-dropdown-item"
                                                type="button"
                                                onClick={() => {
                                                    setVersionOpen(true)
                                                    setThemeActionsOpen(false)
                                                }}
                                            >
                                                <span className="material-symbols-outlined">new_releases</span>
                                                Version details
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button className="os-btn os-btn-primary theme-edit-button" type="button" onClick={openThemeEditor}>
                                    <span className="material-symbols-outlined">edit</span>
                                    Edit theme
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {!loading && (
                <div className="theme-upload-section">
                    <div className="theme-upload-copy">
                        <div className="theme-upload-icon">
                            <span className="material-symbols-outlined">upload_file</span>
                        </div>
                        <div>
                            <h3 className="theme-upload-title">Upload theme package</h3>
                            <p className="theme-upload-desc">JSON-contract bundles are validated by the Commerce API before installation.</p>
                            {uploadMessage && (
                                <p className="theme-upload-status">{uploadMessage}</p>
                            )}
                        </div>
                    </div>
                    <label className={`os-btn os-btn-outline os-btn-sm ${uploadingBundle ? 'theme-upload-disabled' : ''}`}>
                        {uploadingBundle ? (
                            <>
                                <span className="loading-spinner-sm" />
                                Uploading
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                                Upload JSON
                            </>
                        )}
                        <input
                            ref={bundleInputRef}
                            type="file"
                            accept="application/json,.json"
                            className="theme-upload-input"
                            disabled={uploadingBundle}
                            onChange={handleBundleUpload}
                        />
                    </label>
                </div>
            )}

            {/* Available Store Templates */}
            {!loading && availableThemes.length > 0 && (
                <div className="theme-popular-section">
                    <div className="theme-popular-header">
                        <div className="theme-popular-icon">
                            <span className="material-symbols-outlined">diamond</span>
                        </div>
                        <div>
                            <h3 className="theme-popular-title">
                                Store themes
                            </h3>
                            <p className="theme-popular-desc">
                                Install production and uploaded JSON-contract themes for this store.
                            </p>
                        </div>
                    </div>

                    <div className="theme-grid">
                        {availableThemes.map((theme) => {
                            const colors = theme.config?.colors || {}
                            const c1 = colors.primary || '#6366f1'
                            const c2 = colors.secondary || '#8b5cf6'
                            const isCurrentTheme = theme.active === true || theme.slug === currentTheme?.slug
                            const previewStyle = theme.thumbnail_url
                                ? {
                                    backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.32)), url("${theme.thumbnail_url}")`,
                                }
                                : {
                                    background: `linear-gradient(135deg, ${c1}, ${c2})`,
                                }

                            return (
                                <div key={theme.slug} className="theme-card">
                                    <div
                                        className={`theme-card-preview ${theme.thumbnail_url ? 'theme-card-preview--image' : 'theme-card-preview--fallback'}`}
                                        style={previewStyle}
                                    >
                                        <div className="theme-card-preview-meta">
                                            <span>{theme.category || theme.site_type || 'Theme'}</span>
                                            <strong>{theme.name}</strong>
                                        </div>
                                    </div>
                                    <div className="theme-card-swatches">
                                        <span className="theme-card-swatch" style={{ background: c1 }} />
                                        <span className="theme-card-swatch" style={{ background: c2 }} />
                                        <span className="theme-card-swatch" style={{ background: colors.accent || '#fff', border: '1px solid var(--border-primary)' }} />
                                    </div>
                                    <div className="theme-card-footer">
                                        <div>
                                            <span className="theme-card-name">{theme.name}</span>
                                            <p className="theme-card-author">by {theme.author || 'LetBuyy'}</p>
                                        </div>
                                        <button
                                            className={`os-btn os-btn-sm ${isCurrentTheme ? 'theme-current-button' : 'os-btn-outline'}`}
                                            onClick={() => !isCurrentTheme && handleInstall(theme.slug)}
                                            disabled={isCurrentTheme || installing === theme.slug}
                                        >
                                            {isCurrentTheme ? (
                                                'Current'
                                            ) : installing === theme.slug ? (
                                                <span className="loading-spinner-sm" />
                                            ) : (
                                                'Add'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Footer link */}
            <div className="theme-footer-link">
                <a href="https://help.letbuyy.store/themes" target="_blank" rel="noopener noreferrer">
                    Learn more about themes
                </a>
            </div>
        </div>
    )
}
