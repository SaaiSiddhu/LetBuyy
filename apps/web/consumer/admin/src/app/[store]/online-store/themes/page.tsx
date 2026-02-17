'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
}

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function ThemesPage() {
    const params = useParams()
    const store = params.store as string
    const [importOpen, setImportOpen] = useState(false)
    const [versionOpen, setVersionOpen] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('')
    const importRef = useRef<HTMLDivElement>(null)

    // Dynamic data state
    const [loading, setLoading] = useState(true)
    const [themes, setThemes] = useState<ThemeRecord[]>([])
    const [currentTheme, setCurrentTheme] = useState<ThemeRecord | null>(null)
    const [storeStatus, setStoreStatus] = useState<string | null>(null)
    const [storeId, setStoreId] = useState<string | null>(null)
    const [installing, setInstalling] = useState<string | null>(null)
    const [publishing, setPublishing] = useState(false)

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
        if (importOpen) setImportOpen(false)
        if (versionOpen) setVersionOpen(false)
    }

    // Determine current theme colors for display
    const themeColors = currentTheme?.config?.colors
    const displayColors = themeColors
        ? [themeColors.primary, themeColors.secondary, themeColors.accent, themeColors.text].filter(Boolean) as string[]
        : ['#6366f1', '#8b5cf6', '#f59e0b', '#1f2937']

    // Filter available themes (exclude current)
    const availableThemes = themes.filter(
        t => !currentTheme || t.slug !== currentTheme.slug
    )
    const freeThemes = availableThemes.filter(t => t.letbuyy_pricing_type === 'free' || !t.is_premium)

    const isPublished = storeStatus === 'published'

    return (
        <div className="online-store-page" onClick={handleOutsideClick}>
            {/* Page Header */}
            <div className="os-page-header">
                <h1 className="os-page-title">
                    <span className="material-symbols-outlined">storefront</span>
                    Online Store
                </h1>
            </div>

            {/* Themes Section Header */}
            <div className="os-section-header">
                <h2 className="os-section-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>palette</span>
                    Themes
                </h2>
                <div className="os-section-actions">
                    <a
                        href={`https://${store}.letbuyy.store`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="os-btn os-btn-outline"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                        View your store
                    </a>
                    <div className="os-dropdown-wrapper" ref={importRef}>
                        <button
                            className="os-btn os-btn-outline"
                            onClick={(e) => {
                                e.stopPropagation()
                                setImportOpen(!importOpen)
                            }}
                        >
                            Import theme
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>expand_more</span>
                        </button>
                        {importOpen && (
                            <div className="os-dropdown-menu">
                                <button className="os-dropdown-item">
                                    <span className="material-symbols-outlined">store</span>
                                    Visit Theme Store
                                </button>
                                <button className="os-dropdown-item">
                                    <span className="material-symbols-outlined">upload_file</span>
                                    Upload zip file
                                </button>
                                <button className="os-dropdown-item">
                                    <span className="material-symbols-outlined">link</span>
                                    Connect from GitHub
                                </button>
                            </div>
                        )}
                    </div>
                </div>
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
                        {/* Desktop + Mobile Preview */}
                        <div className="theme-preview-mockups">
                            {/* Desktop Preview */}
                            <div className="theme-mockup-desktop">
                                <div className="theme-mockup-browser-bar">
                                    <div className="theme-mockup-dots">
                                        <span /><span /><span />
                                    </div>
                                    <div className="theme-mockup-url">{store}.letbuyy.store</div>
                                </div>
                                <div className="theme-mockup-content">
                                    <div className="theme-mockup-nav">
                                        <span className="theme-mockup-storename">{currentTheme?.name || store}</span>
                                        <span>Home</span>
                                        <span>Catalog</span>
                                        <span>Contact</span>
                                        <div className="theme-mockup-nav-icons">
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>search</span>
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person</span>
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>shopping_bag</span>
                                        </div>
                                    </div>
                                    <div className="theme-mockup-hero" style={{
                                        background: themeColors
                                            ? `linear-gradient(135deg, ${themeColors.primary || '#6366f1'}, ${themeColors.secondary || '#8b5cf6'})`
                                            : undefined
                                    }}>
                                        <div className="theme-mockup-hero-gradient" />
                                        <div className="theme-mockup-hero-text">
                                            <p>Welcome to our store</p>
                                            <h3>Browse our latest products</h3>
                                            <button className="theme-mockup-cta">Shop all</button>
                                        </div>
                                    </div>
                                    <div className="theme-mockup-products-label">Products</div>
                                    <div className="theme-mockup-products">
                                        <div className="theme-mockup-product" style={{ background: '#FEE2E2' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#DC2626' }}>steps</span></div>
                                        <div className="theme-mockup-product" style={{ background: '#DBEAFE' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#2563EB' }}>deployed_code</span></div>
                                        <div className="theme-mockup-product" style={{ background: '#D1FAE5' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#059669' }}>checkroom</span></div>
                                        <div className="theme-mockup-product" style={{ background: '#FEF3C7' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#D97706' }}>shopping_bag</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Preview */}
                            <div className="theme-mockup-mobile">
                                <div className="theme-mockup-mobile-notch" />
                                <div className="theme-mockup-content theme-mockup-content-mobile">
                                    <div className="theme-mockup-nav theme-mockup-nav-mobile">
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>menu</span>
                                        <span className="theme-mockup-storename">{currentTheme?.name || store}</span>
                                        <div className="theme-mockup-nav-icons">
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>shopping_bag</span>
                                        </div>
                                    </div>
                                    <div className="theme-mockup-hero theme-mockup-hero-mobile" style={{
                                        background: themeColors
                                            ? `linear-gradient(135deg, ${themeColors.primary || '#6366f1'}, ${themeColors.secondary || '#8b5cf6'})`
                                            : undefined
                                    }}>
                                        <div className="theme-mockup-hero-gradient" />
                                        <div className="theme-mockup-hero-text">
                                            <h3 style={{ fontSize: '13px' }}>Browse our latest products</h3>
                                            <button className="theme-mockup-cta" style={{ fontSize: '10px', padding: '4px 10px' }}>Shop all</button>
                                        </div>
                                    </div>
                                    <div className="theme-mockup-products-label" style={{ fontSize: '11px' }}>Products</div>
                                    <div className="theme-mockup-products theme-mockup-products-mobile">
                                        <div className="theme-mockup-product" style={{ background: '#FEE2E2' }}><span className="material-symbols-outlined" style={{ fontSize: 14, color: '#DC2626' }}>steps</span></div>
                                        <div className="theme-mockup-product" style={{ background: '#DBEAFE' }}><span className="material-symbols-outlined" style={{ fontSize: 14, color: '#2563EB' }}>deployed_code</span></div>
                                    </div>
                                </div>
                            </div>
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
                                <button className="os-btn-icon">
                                    <span className="material-symbols-outlined">more_horiz</span>
                                </button>
                                <button className="os-btn os-btn-primary">Edit theme</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* AI Section — Design your store */}
            <div className="theme-ai-section">
                <div className="theme-ai-title">
                    Design your store in seconds
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent-color)' }}>auto_awesome</span>
                </div>
                <p className="theme-ai-desc">Describe your business to create unique themes with personalized content</p>
                <div className="theme-ai-input-row">
                    <input
                        type="text"
                        className="theme-ai-input"
                        placeholder="e.g. modern handmade jewelry"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                    />
                    <button className="os-btn os-btn-outline" disabled={!aiPrompt.trim()}>Generate themes</button>
                </div>
            </div>

            {/* Popular Free Themes — DYNAMIC */}
            {!loading && (
                <div className="theme-popular-section">
                    <div className="theme-popular-header">
                        <div className="theme-popular-icon">
                            <span className="material-symbols-outlined">diamond</span>
                        </div>
                        <div>
                            <h3 className="theme-popular-title">
                                {freeThemes.length > 0 ? 'Popular free themes' : 'All themes installed'}
                            </h3>
                            <p className="theme-popular-desc">
                                {freeThemes.length > 0
                                    ? 'Made with core features you can easily customize — no coding needed.'
                                    : 'You have access to all available themes.'}
                            </p>
                        </div>
                    </div>

                    <div className="theme-grid">
                        {freeThemes.map((theme) => {
                            const colors = theme.config?.colors || {}
                            const c1 = colors.primary || '#6366f1'
                            const c2 = colors.secondary || '#8b5cf6'

                            return (
                                <div key={theme.slug} className="theme-card">
                                    <div className="theme-card-preview" style={{
                                        background: `linear-gradient(135deg, ${c1}, ${c2})`,
                                    }}>
                                        <div className="theme-card-preview-mockup">
                                            <div className="theme-card-mockup-nav">
                                                <div className="theme-card-mockup-dots">
                                                    <span /><span /><span />
                                                </div>
                                            </div>
                                            <div className="theme-card-mockup-hero">
                                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#fff' }}>
                                                    {theme.category || 'Modern'}
                                                </span>
                                            </div>
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
                                            className="os-btn os-btn-outline os-btn-sm"
                                            onClick={() => handleInstall(theme.slug)}
                                            disabled={installing === theme.slug}
                                        >
                                            {installing === theme.slug ? (
                                                <span className="loading-spinner-sm" />
                                            ) : (
                                                'Add'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Last card: Explore more */}
                        <div className="theme-card theme-card-explore">
                            <div className="theme-card-explore-content">
                                <h4>Explore more themes</h4>
                                <p>Browse professionally designed free and paid themes.</p>
                                <a href="https://themes.letbuyy.store" target="_blank" rel="noopener noreferrer" className="os-btn os-btn-outline os-btn-sm">
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                                    Visit Theme Store
                                </a>
                            </div>
                        </div>
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
